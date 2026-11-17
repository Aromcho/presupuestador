/**
 * Carga inicial (npm run seed). Es idempotente: se puede correr varias veces.
 * Con --reset borra catálogo, plantillas y notas y los vuelve a cargar (no toca usuarios ni presupuestos).
 *
 * Los equipos de ejemplo salen de los presupuestos reales de Leo (16/11/2026).
 * Las listas de cada marca se cargan después desde Administración → Listas de precios (Excel).
 */
import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { Pool } from 'pg';
import sharp from 'sharp';
import { normalize, slugify } from '../common/utils/text';
import * as schema from './schema';

const { brands, items, media, notes, priceLists, settings, templateItems, templates, users } = schema;
const RESET = process.argv.includes('--reset');
const SEED = resolve(__dirname, '../../seed');
const UPLOADS = resolve(process.env.UPLOADS_DIR ?? './uploads');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const MARCAS = ['Peisa', 'Baxi', 'Tameco', 'Bowman', 'Ferroli', 'Euterma', 'Rinnai', 'Rowa'];

const NOTAS: { text: string; rule: schema.NoteRule }[] = [
  { text: 'Precios finales, IVA incluido.', rule: 'SI_PRODUCTOS' },
  { text: 'Mano de obra: en caso de requerir factura, se suma el IVA.', rule: 'SI_MANO_DE_OBRA' },
  { text: 'La instalación se cotiza aparte.', rule: 'SI_SIN_INSTALACION' },
  { text: 'Validez del presupuesto: 48 hs.', rule: 'SIEMPRE' },
  { text: 'Forma de pago: contado, efectivo o transferencia bancaria.', rule: 'SIEMPRE' },
];

const INCLUYE_CALDERA = [
  'Asesoramiento personalizado de técnico oficial de la marca',
  'Logística y envío gratis a su domicilio',
  'Kit de ventilación correspondiente',
  'Puesta en marcha',
];

async function photo(file: string) {
  const src = join(SEED, 'images', file);
  if (!existsSync(src)) return null;
  const year = String(new Date().getFullYear());
  mkdirSync(join(UPLOADS, 'media', year), { recursive: true });
  const base = randomUUID();
  const variants = { sm: `media/${year}/${base}-480.webp`, md: `media/${year}/${base}-960.webp` };
  const pipe = (w: number) => sharp(src).resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).webp({ quality: 85 });
  await pipe(480).toFile(join(UPLOADS, variants.sm));
  const info = await pipe(960).toFile(join(UPLOADS, variants.md));
  const [m] = await db.insert(media).values({ path: variants.md, variants, width: info.width, height: info.height, mime: 'image/webp', sizeBytes: info.size }).returning();
  return m.id;
}

async function main() {
  if (RESET) {
    console.log('↺ Borrando catálogo, plantillas y notas…');
    await db.execute(sql`truncate template_items, templates, notes, items, price_lists, brands, media restart identity cascade`);
  }

  // Usuarios
  const people = [
    { email: process.env.ADMIN_EMAIL ?? 'leo@gesetecalderas.com', password: process.env.ADMIN_PASSWORD ?? 'Gesetec2026!', name: process.env.ADMIN_NAME ?? 'Leo', role: 'ADMIN' as const },
    { email: process.env.VENTAS_EMAIL ?? 'administracion@gesetecalderas.com', password: process.env.VENTAS_PASSWORD ?? 'Ventas2026!', name: process.env.VENTAS_NAME ?? 'Administración', role: 'VENTAS' as const },
  ];
  for (const p of people) {
    const exists = await db.query.users.findFirst({ where: eq(users.email, p.email.toLowerCase()) });
    if (!exists) {
      await db.insert(users).values({ email: p.email.toLowerCase(), name: p.name, role: p.role, passwordHash: await bcrypt.hash(p.password, 12) });
      console.log(`✓ Usuario ${p.name} (${p.role}): ${p.email}`);
    }
  }

  // Ajustes (solo si no existen)
  await db
    .insert(settings)
    .values([
      { key: 'empresa', value: { nombre: 'Gesetec Calderas' } },
      { key: 'presupuestos', value: { proximoNumero: 1, validezHoras: 48, redondeo: 100 } },
      { key: 'dolar', value: { modo: 'auto', manual: null } },
    ])
    .onConflictDoNothing();

  // Marcas
  for (const [i, name] of MARCAS.entries()) {
    await db.insert(brands).values({ name, slug: slugify(name), sortOrder: i }).onConflictDoNothing();
  }
  const brandId = async (name: string) => (await db.query.brands.findFirst({ where: eq(brands.name, name) }))!.id;

  // Listas propias en pesos (las de cada marca se importan desde Excel)
  const ensureList = async (name: string, values: Partial<typeof priceLists.$inferInsert>) => {
    const found = await db.query.priceLists.findFirst({ where: eq(priceLists.name, name) });
    if (found) return found.id;
    const [row] = await db.insert(priceLists).values({ name, ...values }).returning();
    return row.id;
  };
  const propios = await ensureList('Precios propios (pesos, IVA incluido)', {
    currency: 'ARS',
    rule: 'PRECIO_FIJO',
    percent: 0,
    ivaIncluded: true,
    notes: 'Equipos con precio final cargado a mano.',
  });
  await ensureList('Mano de obra y servicios (pesos, sin IVA)', {
    currency: 'ARS',
    rule: 'PRECIO_FIJO',
    percent: 0,
    ivaIncluded: false,
    notes: 'Si requiere factura, se suma el IVA.',
  });

  // Equipos de los presupuestos reales de Leo
  const EQUIPOS = [
    {
      brand: 'Peisa',
      code: 'PRIMA-TEC-24-DS',
      name: 'Caldera Peisa Prima Tec 24 DS',
      description: 'Tiro forzado · 26.300 kcal/h · gas natural.',
      listPrice: 2_700_000,
      img: 'peisa-prima-tec-24-ds.png',
    },
    {
      brand: 'Peisa',
      code: 'PRIMA-TEC-SMART-24-DS',
      name: 'Caldera Peisa Prima Tec Smart 24 DS',
      description: 'Tiro forzado · 26.300 kcal/h · gas natural. Incluye termostato wifi Zentraly.',
      listPrice: 2_900_000,
      img: 'peisa-prima-tec-smart-24-ds.png',
    },
    {
      brand: 'Tameco',
      code: 'CP30',
      name: 'Caldera Tameco CP30',
      description: '30.000 kcal/h · gas natural · interior / exterior.',
      listPrice: 4_300_000,
      img: 'tameco-cp30.png',
    },
  ];
  const ids: Record<string, string> = {};
  for (const e of EQUIPOS) {
    const bId = await brandId(e.brand);
    const found = await db.query.items.findFirst({ where: (t, { and, eq: eq2 }) => and(eq2(t.code, e.code), eq2(t.brandId, bId)) });
    if (found) {
      ids[e.code] = found.id;
      continue;
    }
    const [row] = await db
      .insert(items)
      .values({
        type: 'EQUIPO',
        code: e.code,
        name: e.name,
        description: e.description,
        brandId: bId,
        priceListId: propios,
        currency: 'ARS',
        listPrice: e.listPrice,
        ivaIncluded: true,
        mediaId: await photo(e.img),
        searchText: normalize([e.code, e.name, e.brand, e.description].join(' ')),
      })
      .returning();
    ids[e.code] = row.id;
  }

  // Notas
  const hasNotes = await db.select({ n: sql<number>`count(*)::int` }).from(notes);
  if (!hasNotes[0].n) await db.insert(notes).values(NOTAS.map((n, i) => ({ ...n, sortOrder: i })));

  // Plantillas
  const PLANTILLAS: { name: string; title: string; icon: string; mode?: schema.QuoteMode; seIncluye: string[]; items?: string[] }[] = [
    { name: 'Caldera mural', title: 'Caldera mural', icon: 'instalacion', seIncluye: INCLUYE_CALDERA, items: ['PRIMA-TEC-24-DS'] },
    { name: 'Comparativa de calderas', title: 'Comparativa de calderas', icon: 'columnas', mode: 'COMPARATIVA', seIncluye: INCLUYE_CALDERA, items: ['PRIMA-TEC-24-DS', 'PRIMA-TEC-SMART-24-DS'] },
    { name: 'Caldera de pie', title: 'Caldera de pie', icon: 'caldera_pie', seIncluye: INCLUYE_CALDERA.filter((s) => !s.startsWith('Kit')), items: ['CP30'] },
    { name: 'Climatizador de piscina', title: 'Climatización de piscina', icon: 'piscina', seIncluye: ['Asesoramiento personalizado de técnico oficial de la marca', 'Traslado del equipo', 'Puesta en marcha'] },
    { name: 'Piso radiante y radiadores', title: 'Calefacción por piso radiante y radiadores', icon: 'radiador', seIncluye: [] },
    { name: 'Service anual', title: 'Service anual', icon: 'mantenimiento', seIncluye: [] },
    { name: 'Puesta en marcha de temporada', title: 'Puesta en marcha de temporada', icon: 'temporada', seIncluye: [] },
  ];
  for (const [i, p] of PLANTILLAS.entries()) {
    const slug = slugify(p.name);
    if (await db.query.templates.findFirst({ where: eq(templates.slug, slug) })) continue;
    const [t] = await db.insert(templates).values({ name: p.name, slug, title: p.title, icon: p.icon, mode: p.mode ?? 'SUMA', seIncluye: p.seIncluye, sortOrder: i }).returning();
    if (p.items?.length) await db.insert(templateItems).values(p.items.map((code, n) => ({ templateId: t.id, itemId: ids[code], qty: 1, sortOrder: n })));
  }

  console.log('✓ Carga inicial lista');
  await pool.end();
}

main().catch(async (err) => {
  console.error('✗ Falló la carga inicial:', err);
  await pool.end();
  process.exit(1);
});
