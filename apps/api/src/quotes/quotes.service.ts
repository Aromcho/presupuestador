import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { ActivityService } from '../activity/activity.service';
import { CatalogService } from '../catalog/catalog.service';
import { ClientsService, digits } from '../clients/clients.module';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { tokens } from '../common/utils/text';
import { CompanyService, PRESUPUESTOS_DEFAULT } from '../company/company.service';
import { Database, InjectDb } from '../db/db.module';
import { clients, items, media, MediaVariants, PRODUCT_TYPES, QuoteStatus, quoteGroups, quoteItems, quotes, shareLinks, users } from '../db/schema';
import { ExchangeService } from '../exchange/exchange.service';
import { QuoteQuery, SaveQuoteDto } from './quotes.dto';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type QuoteRow = typeof quotes.$inferSelect;
type ItemRow = typeof quoteItems.$inferSelect;

const SHARE_DAYS = 30;

export const numero = (n: number) => String(n).padStart(4, '0');
export const lineTotal = (i: Pick<ItemRow, 'unitPrice' | 'qty' | 'discountPct'>) => Math.round(i.unitPrice * Number(i.qty) * (1 - Number(i.discountPct ?? 0) / 100));

/** Enviado y pasada la validez: se muestra como vencido (en la base sigue "ENVIADO") */
export function effectiveStatus(q: Pick<QuoteRow, 'status' | 'sentAt' | 'validityHours'>): QuoteStatus {
  if (q.status === 'ENVIADO' && q.sentAt && q.sentAt.getTime() + q.validityHours * 3_600_000 < Date.now()) return 'VENCIDO';
  return q.status;
}

/** Teléfono argentino para wa.me: 2255 15-485539 → 5492255485539 */
export function waPhone(raw?: string | null) {
  let d = digits(raw);
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('9') && d.length === 11) return `54${d}`;
  if (d.length === 12) {
    for (const a of [2, 3, 4]) {
      if (d.slice(a, a + 2) === '15') {
        d = d.slice(0, a) + d.slice(a + 2);
        break;
      }
    }
  }
  if (d.length === 10) return `549${d}`;
  return d.length >= 8 ? `54${d}` : '';
}

@Injectable()
export class QuotesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly clientsSvc: ClientsService,
    private readonly catalog: CatalogService,
    private readonly company: CompanyService,
    private readonly exchange: ExchangeService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  private get siteUrl() {
    return (this.config.get<string>('PUBLIC_SITE_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  // ------------------------------------------------------------ lectura

  async list(q: QuoteQuery) {
    const limit = Math.min(Number(q.limit) || 30, 100);
    const page = Math.max(Number(q.page) || 1, 1);
    const conds: (SQL | undefined)[] = [];
    const expired = sql`${quotes.sentAt} + make_interval(hours => ${quotes.validityHours}) < now()`;
    if (q.status === 'VENCIDO') conds.push(and(eq(quotes.status, 'ENVIADO'), expired));
    else if (q.status === 'ENVIADO') conds.push(and(eq(quotes.status, 'ENVIADO'), sql`not (${expired})`));
    else if (q.status === 'SEGUIR') conds.push(eq(quotes.status, 'ENVIADO'));
    else if (q.status) conds.push(eq(quotes.status, q.status));
    if (q.clientId) conds.push(eq(quotes.clientId, q.clientId));
    if (q.q) {
      const n = Number(q.q.replace(/\D/g, ''));
      for (const t of tokens(q.q)) {
        const d = digits(t);
        conds.push(
          or(
            sql`translate(lower(${clients.name}), 'áéíóúüñ', 'aeiouun') like ${'%' + t + '%'}`,
            sql`translate(lower(${quotes.title}), 'áéíóúüñ', 'aeiouun') like ${'%' + t + '%'}`,
            ilike(clients.zone, `%${t}%`),
            d.length >= 4 ? sql`regexp_replace(coalesce(${clients.phone}, ''), '\\D', '', 'g') like ${'%' + d + '%'}` : undefined,
            n && /^\d+$/.test(t) ? eq(quotes.number, n) : undefined,
          ),
        );
      }
    }
    const where = and(...conds.filter(Boolean));
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ quote: quotes, client: clients, userName: users.name })
        .from(quotes)
        .leftJoin(clients, eq(quotes.clientId, clients.id))
        .leftJoin(users, eq(quotes.userId, users.id))
        .where(where)
        .orderBy(desc(quotes.number))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ total: count() }).from(quotes).leftJoin(clients, eq(quotes.clientId, clients.id)).where(where),
    ]);
    const groups = rows.length
      ? await this.db.query.quoteGroups.findMany({ where: inArray(quoteGroups.quoteId, rows.map((r) => r.quote.id)), orderBy: asc(quoteGroups.sortOrder), with: { items: true } })
      : [];
    return {
      items: rows.map(({ quote, client, userName }) => {
        const gs = groups.filter((g) => g.quoteId === quote.id).map((g) => ({ label: g.label, total: g.items.reduce((a, i) => a + lineTotal(i), 0), count: g.items.length }));
        return {
          id: quote.id,
          number: quote.number,
          numberLabel: numero(quote.number),
          title: quote.title,
          mode: quote.mode,
          status: effectiveStatus(quote),
          createdAt: quote.createdAt,
          sentAt: quote.sentAt,
          client: client ? { id: client.id, name: client.name, phone: client.phone, zone: client.zone } : null,
          userName,
          groups: gs,
          total: quote.mode === 'SUMA' ? gs.reduce((a, g) => a + g.total, 0) : null,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async stats() {
    const monthStart = sql`date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'`;
    const [[r]] = await Promise.all([
      this.db
        .select({
          creados: sql<number>`count(*) filter (where ${quotes.createdAt} >= ${monthStart})::int`,
          enviados: sql<number>`count(*) filter (where ${quotes.sentAt} >= ${monthStart})::int`,
          aceptados: sql<number>`count(*) filter (where ${quotes.status} = 'ACEPTADO' and ${quotes.updatedAt} >= ${monthStart})::int`,
          seguir: sql<number>`count(*) filter (where ${quotes.status} = 'ENVIADO')::int`,
          borradores: sql<number>`count(*) filter (where ${quotes.status} = 'BORRADOR')::int`,
        })
        .from(quotes),
    ]);
    return r;
  }

  async detail(id: string) {
    const q = await this.db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: {
        client: true,
        user: { columns: { id: true, name: true } },
        template: { columns: { id: true, name: true, slug: true } },
        groups: { orderBy: asc(quoteGroups.sortOrder), with: { items: { orderBy: asc(quoteItems.sortOrder) } } },
        shareLinks: { orderBy: desc(shareLinks.createdAt), limit: 1 },
      },
    });
    if (!q) throw new NotFoundException('No encontramos ese presupuesto.');
    const itemIds = q.groups.flatMap((g) => g.items.map((i) => i.itemId)).filter((x): x is string => !!x);
    const currencies = itemIds.length ? await this.db.select({ id: items.id, currency: items.currency }).from(items).where(inArray(items.id, itemIds)) : [];
    const usd = new Set(currencies.filter((c) => c.currency === 'USD').map((c) => c.id));
    const groups = q.groups.map((g) => {
      const its = g.items.map((i) => ({
        ...i,
        qty: Number(i.qty),
        discountPct: Number(i.discountPct),
        photo: i.photoPath ? `/uploads/${i.photoPath}` : null,
        total: lineTotal(i),
        usd: !!i.itemId && usd.has(i.itemId),
      }));
      return { id: g.id, label: g.label, sortOrder: g.sortOrder, items: its, total: its.reduce((a, i) => a + i.total, 0) };
    });
    const link = q.shareLinks[0];
    const share = link && link.expiresAt.getTime() > Date.now() ? { token: link.token, url: `${this.siteUrl}/p/${link.token}`, expiresAt: link.expiresAt } : null;
    const { shareLinks: _s, groups: _g, ...rest } = q;
    return {
      ...rest,
      dollarSell: q.dollarSell == null ? null : Number(q.dollarSell),
      numberLabel: numero(q.number),
      status: effectiveStatus(q),
      rawStatus: q.status,
      expiresAt: q.sentAt ? new Date(q.sentAt.getTime() + q.validityHours * 3_600_000) : null,
      groups,
      total: q.mode === 'SUMA' ? groups.reduce((a, g) => a + g.total, 0) : null,
      usesDollar: usd.size > 0,
      share,
    };
  }

  // ------------------------------------------------------------ escritura

  async create(dto: SaveQuoteDto, by: AuthUser) {
    this.validate(dto);
    const client = await this.clientsSvc.upsert(dto.client);
    const [cfg, dolar] = await Promise.all([this.company.presupuestos(), this.exchange.current()]);
    const photos = await this.photosFor(dto);
    const id = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(7342001)`);
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${quotes.number}), 0)::int` }).from(quotes);
      const number = Math.max(cfg.proximoNumero, max + 1);
      const [q] = await tx
        .insert(quotes)
        .values({
          number,
          clientId: client.id,
          templateId: dto.templateId ?? null,
          userId: by.id,
          title: dto.title.trim(),
          mode: dto.mode,
          status: 'BORRADOR',
          validityHours: dto.validityHours ?? cfg.validezHoras,
          paymentTerms: dto.paymentTerms ?? cfg.formaPago,
          seIncluye: this.cleanList(dto.seIncluye),
          notes: this.cleanList(dto.notes),
          observations: dto.observations?.trim() || null,
          dollarSell: dolar.venta,
          dollarAt: dolar.fecha ? new Date(dolar.fecha) : new Date(),
        })
        .returning({ id: quotes.id });
      await this.insertGroups(tx, q.id, dto, photos);
      return { id: q.id, number };
    });
    await this.company.set('presupuestos', { proximoNumero: id.number + 1 }, PRESUPUESTOS_DEFAULT);
    await this.activity.log({ userId: by.id, action: 'crear', entity: 'presupuesto', entityId: id.id, summary: `Armó el presupuesto N° ${numero(id.number)} para ${client.name}` });
    return this.detail(id.id);
  }

  async update(id: string, dto: SaveQuoteDto, by: AuthUser) {
    this.validate(dto);
    const before = await this.db.query.quotes.findFirst({ where: eq(quotes.id, id) });
    if (!before) throw new NotFoundException('No encontramos ese presupuesto.');
    const client = await this.clientsSvc.upsert(dto.client);
    const photos = await this.photosFor(dto);
    await this.db.transaction(async (tx) => {
      await tx
        .update(quotes)
        .set({
          clientId: client.id,
          templateId: dto.templateId ?? before.templateId,
          title: dto.title.trim(),
          mode: dto.mode,
          validityHours: dto.validityHours ?? before.validityHours,
          paymentTerms: dto.paymentTerms ?? before.paymentTerms,
          seIncluye: this.cleanList(dto.seIncluye),
          notes: this.cleanList(dto.notes),
          observations: dto.observations?.trim() || null,
        })
        .where(eq(quotes.id, id));
      await tx.delete(quoteGroups).where(eq(quoteGroups.quoteId, id));
      await this.insertGroups(tx, id, dto, photos);
    });
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'presupuesto', entityId: id, summary: `Editó el presupuesto N° ${numero(before.number)}` });
    return this.detail(id);
  }

  async setStatus(id: string, status: QuoteStatus, by: AuthUser) {
    const q = await this.db.query.quotes.findFirst({ where: eq(quotes.id, id) });
    if (!q) throw new NotFoundException('No encontramos ese presupuesto.');
    const next = status === 'VENCIDO' ? 'ENVIADO' : status;
    await this.db
      .update(quotes)
      .set({ status: next, ...(next === 'ENVIADO' && !q.sentAt ? { sentAt: new Date() } : {}) })
      .where(eq(quotes.id, id));
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'presupuesto', entityId: id, summary: `Marcó el N° ${numero(q.number)} como ${next.toLowerCase()}` });
    return this.detail(id);
  }

  async duplicate(id: string, by: AuthUser) {
    const d = await this.detail(id);
    return this.create(
      {
        client: d.client ? { id: d.client.id, name: d.client.name, phone: d.client.phone, email: d.client.email, zone: d.client.zone, address: d.client.address } : { name: 'Cliente' },
        templateId: d.templateId,
        title: d.title,
        mode: d.mode,
        groups: d.groups.map((g) => ({
          label: g.label,
          items: g.items.map((i) => ({ itemId: i.itemId, type: i.type, code: i.code, name: i.name, description: i.description, unitPrice: i.unitPrice, qty: i.qty, discountPct: i.discountPct, ivaIncluded: i.ivaIncluded })),
        })),
        seIncluye: d.seIncluye,
        notes: d.notes,
        observations: d.observations,
        paymentTerms: d.paymentTerms,
        validityHours: d.validityHours,
      },
      by,
    );
  }

  async remove(id: string, by: AuthUser) {
    const q = await this.db.query.quotes.findFirst({ where: eq(quotes.id, id) });
    if (!q) throw new NotFoundException('No encontramos ese presupuesto.');
    if (by.role !== 'ADMIN' && q.status !== 'BORRADOR') throw new ForbiddenException('Solo el administrador puede borrar un presupuesto ya enviado.');
    await this.db.delete(quotes).where(eq(quotes.id, id));
    await this.activity.log({ userId: by.id, action: 'borrar', entity: 'presupuesto', entityId: id, summary: `Borró el presupuesto N° ${numero(q.number)}` });
    return { ok: true };
  }

  /** Recalcula los ítems del catálogo con los precios y el dólar de hoy */
  async reprice(id: string, by: AuthUser) {
    const d = await this.detail(id);
    const ids = d.groups.flatMap((g) => g.items.map((i) => i.itemId)).filter((x): x is string => !!x);
    const now = await this.catalog.arsFor(ids);
    const dolar = await this.exchange.current();
    let changed = 0;
    await this.db.transaction(async (tx) => {
      for (const g of d.groups)
        for (const i of g.items) {
          const p = i.itemId ? now.get(i.itemId) : undefined;
          if (p && p.ars > 0 && p.ars !== i.unitPrice) {
            changed++;
            await tx.update(quoteItems).set({ unitPrice: p.ars }).where(eq(quoteItems.id, i.id));
          }
        }
      await tx
        .update(quotes)
        .set({ dollarSell: dolar.venta, dollarAt: dolar.fecha ? new Date(dolar.fecha) : new Date(), ...(d.rawStatus === 'ENVIADO' ? { sentAt: new Date() } : {}) })
        .where(eq(quotes.id, id));
    });
    await this.activity.log({ userId: by.id, action: 'actualizar-precios', entity: 'presupuesto', entityId: id, summary: `Actualizó los precios del N° ${d.numberLabel} (${changed} ítems)` });
    return { ...(await this.detail(id)), changed };
  }

  /** Link público para el cliente + mensaje de WhatsApp. Marca el presupuesto como enviado. */
  async send(id: string, by: AuthUser) {
    const q = await this.db.query.quotes.findFirst({ where: eq(quotes.id, id), with: { client: true } });
    if (!q) throw new NotFoundException('No encontramos ese presupuesto.');
    let link = await this.db.query.shareLinks.findFirst({ where: and(eq(shareLinks.quoteId, id), gte(shareLinks.expiresAt, new Date(Date.now() + 3 * 86_400_000))) });
    if (!link) {
      [link] = await this.db
        .insert(shareLinks)
        .values({ quoteId: id, token: randomBytes(9).toString('base64url'), expiresAt: new Date(Date.now() + SHARE_DAYS * 86_400_000) })
        .returning();
    }
    const status = q.status === 'ACEPTADO' || q.status === 'RECHAZADO' ? q.status : 'ENVIADO';
    await this.db.update(quotes).set({ status, sentAt: new Date() }).where(eq(quotes.id, id));
    await this.activity.log({ userId: by.id, action: 'enviar', entity: 'presupuesto', entityId: id, summary: `Mandó el N° ${numero(q.number)}${q.client ? ` a ${q.client.name}` : ''}` });

    const url = `${this.siteUrl}/p/${link.token}`;
    const empresa = await this.company.empresa();
    const nombre = q.client?.name.trim().split(/\s+/)[0] ?? '';
    const horas = q.validityHours;
    const text = [
      `Hola${nombre ? ` ${nombre}` : ''}, ¿cómo estás? Te paso el presupuesto de ${empresa.nombre}: ${q.title}.`,
      '',
      `Lo podés ver y descargar en PDF acá: ${url}`,
      '',
      `Validez: ${horas % 24 === 0 ? `${horas} hs` : `${horas} hs`}. Cualquier consulta, quedo a disposición.`,
    ].join('\n');
    const phone = waPhone(q.client?.phone);
    return { url, text, phone, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
  }

  async byToken(token: string) {
    const link = await this.db.query.shareLinks.findFirst({ where: eq(shareLinks.token, token) });
    if (!link || link.expiresAt.getTime() < Date.now()) throw new NotFoundException('Este link venció. Pedile a Gesetec que te lo mande de nuevo.');
    return this.detail(link.quoteId);
  }

  // ------------------------------------------------------------ ayudas

  private validate(dto: SaveQuoteDto) {
    const lines = dto.groups.reduce((a, g) => a + g.items.length, 0);
    if (!lines) throw new BadRequestException('Agregá al menos un equipo o trabajo.');
    if (dto.mode === 'SUMA' && dto.groups.length > 1) throw new BadRequestException('Un presupuesto de una sola opción va en un solo grupo.');
  }

  private cleanList(list?: string[]) {
    return (list ?? []).map((s) => s.trim()).filter(Boolean);
  }

  private async photosFor(dto: SaveQuoteDto) {
    const ids = [...new Set(dto.groups.flatMap((g) => g.items.map((i) => i.itemId)).filter((x): x is string => !!x))];
    if (!ids.length) return new Map<string, string>();
    const rows = await this.db.select({ id: items.id, variants: media.variants }).from(items).leftJoin(media, eq(items.mediaId, media.id)).where(inArray(items.id, ids));
    return new Map(rows.filter((r) => r.variants).map((r) => [r.id, (r.variants as MediaVariants).md]));
  }

  private async insertGroups(tx: Tx, quoteId: string, dto: SaveQuoteDto, photos: Map<string, string>) {
    const groups = dto.mode === 'SUMA' ? dto.groups.slice(0, 1) : dto.groups.filter((g) => g.items.length);
    for (const [gi, g] of groups.entries()) {
      const label = g.label?.trim() || (dto.mode === 'SUMA' ? 'Presupuesto' : `Opción ${String.fromCharCode(65 + gi)}`);
      const [row] = await tx.insert(quoteGroups).values({ quoteId, label, sortOrder: gi }).returning({ id: quoteGroups.id });
      if (!g.items.length) continue;
      await tx.insert(quoteItems).values(
        g.items.map((i, n) => ({
          groupId: row.id,
          itemId: i.itemId ?? null,
          type: i.type,
          code: i.code?.trim() || null,
          name: i.name.trim(),
          description: i.description?.trim() || null,
          photoPath: i.itemId ? (photos.get(i.itemId) ?? null) : null,
          unitPrice: Math.round(i.unitPrice),
          qty: i.qty,
          discountPct: i.discountPct ?? 0,
          ivaIncluded: i.ivaIncluded ?? PRODUCT_TYPES.includes(i.type),
          sortOrder: n,
        })),
      );
    }
  }
}

export type QuoteDetail = Awaited<ReturnType<QuotesService['detail']>>;
