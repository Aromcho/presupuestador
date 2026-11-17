import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, sql, SQL } from 'drizzle-orm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { priceOf } from '../common/utils/pricing';
import { normalize, slugify, tokens } from '../common/utils/text';
import { CompanyService } from '../company/company.service';
import { Database, InjectDb } from '../db/db.module';
import { brands, Currency, ItemType, items, media, MediaVariants, PriceRule, priceLists } from '../db/schema';
import { ExchangeService } from '../exchange/exchange.service';
import { MediaService } from '../media/media.service';
import { BulkPercentDto, ItemQueryDto, PriceListDto, UpsertItemDto } from './dto/catalog.dto';

const ROW = {
  id: items.id,
  type: items.type,
  code: items.code,
  name: items.name,
  description: items.description,
  brandId: items.brandId,
  brandName: brands.name,
  priceListId: items.priceListId,
  priceListName: priceLists.name,
  listRule: priceLists.rule,
  listPercent: priceLists.percent,
  mediaId: items.mediaId,
  variants: media.variants,
  currency: items.currency,
  listPrice: items.listPrice,
  ruleOverride: items.ruleOverride,
  percentOverride: items.percentOverride,
  ivaIncluded: items.ivaIncluded,
  ivaRate: items.ivaRate,
  unit: items.unit,
  active: items.active,
  updatedAt: items.updatedAt,
};
type Row = {
  id: string;
  type: ItemType;
  code: string | null;
  name: string;
  description: string | null;
  brandId: string | null;
  brandName: string | null;
  priceListId: string | null;
  priceListName: string | null;
  listRule: PriceRule | null;
  listPercent: number | null;
  mediaId: string | null;
  variants: unknown;
  currency: Currency;
  listPrice: number;
  ruleOverride: PriceRule | null;
  percentOverride: number | null;
  ivaIncluded: boolean;
  ivaRate: number;
  unit: string;
  active: boolean;
  updatedAt: Date;
};

export interface PriceContext {
  dollar: number | null;
  rounding: number;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly exchange: ExchangeService,
    private readonly company: CompanyService,
    private readonly media: MediaService,
    private readonly activity: ActivityService,
  ) {}

  async priceContext(): Promise<PriceContext> {
    const [d, p] = await Promise.all([this.exchange.current(), this.company.presupuestos()]);
    return { dollar: d.venta, rounding: p.redondeo };
  }

  /** Arma la respuesta de un ítem con su precio final; a VENTAS no le muestra lista, regla ni margen */
  present(r: Row, ctx: PriceContext, admin: boolean) {
    const rule: PriceRule = r.ruleOverride ?? r.listRule ?? 'PRECIO_FIJO';
    const percent = r.percentOverride ?? r.listPercent ?? 0;
    const price = priceOf(
      { type: r.type, currency: r.currency, listPrice: r.listPrice, rule, percent, ivaIncluded: r.ivaIncluded, ivaRate: r.ivaRate },
      ctx.dollar,
      ctx.rounding,
    );
    const photo = (r.variants as MediaVariants | null) ?? null;
    const base = {
      id: r.id,
      type: r.type,
      code: r.code,
      name: r.name,
      description: r.description,
      brand: r.brandId ? { id: r.brandId, name: r.brandName } : null,
      priceList: r.priceListId ? { id: r.priceListId, name: r.priceListName } : null,
      photo: photo ? { sm: `/uploads/${photo.sm}`, md: `/uploads/${photo.md}` } : null,
      currency: r.currency,
      unit: r.unit,
      active: r.active,
      price: { ars: price.ars, withIva: price.withIva, needsDollar: r.currency === 'USD' && !ctx.dollar },
      updatedAt: r.updatedAt,
    };
    if (!admin) return base;
    return {
      ...base,
      listPrice: r.listPrice,
      rule,
      percent,
      ruleOverride: r.ruleOverride,
      percentOverride: r.percentOverride,
      ivaIncluded: r.ivaIncluded,
      ivaRate: r.ivaRate,
      price: { ...base.price, net: price.net, quoted: price.quoted },
    };
  }

  private baseQuery() {
    return this.db
      .select(ROW)
      .from(items)
      .leftJoin(brands, eq(items.brandId, brands.id))
      .leftJoin(priceLists, eq(items.priceListId, priceLists.id))
      .leftJoin(media, eq(items.mediaId, media.id));
  }

  private filters(q: ItemQueryDto): SQL | undefined {
    const conds: (SQL | undefined)[] = [];
    if (q.q) conds.push(...tokens(q.q).map((t) => ilike(items.searchText, `%${t}%`)));
    if (q.ids) {
      const ids = q.ids.split(',').map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
      conds.push(ids.length ? inArray(items.id, ids) : sql`false`);
    }
    if (q.type) conds.push(eq(items.type, q.type));
    if (q.brandId) conds.push(eq(items.brandId, q.brandId));
    if (q.priceListId) conds.push(eq(items.priceListId, q.priceListId));
    if (q.active !== 'all') conds.push(eq(items.active, q.active !== 'false'));
    return and(...conds.filter(Boolean));
  }

  async list(q: ItemQueryDto, user: AuthUser) {
    const limit = Math.min(Number(q.limit) || 50, 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const where = this.filters(q);
    // Si busca un código exacto, ese va primero
    const exact = q.q ? sql`case when lower(${items.code}) = ${normalize(q.q)} then 0 else 1 end` : sql`1`;
    const [rows, [{ total }], ctx] = await Promise.all([
      this.baseQuery()
        .where(where)
        .orderBy(exact, asc(items.type), asc(brands.sortOrder), asc(items.name))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ total: count() }).from(items).where(where),
      this.priceContext(),
    ]);
    return { items: rows.map((r) => this.present(r as Row, ctx, user.role === 'ADMIN')), total, page, limit };
  }

  /** Precio final en pesos de hoy para varios ítems (para actualizar un presupuesto al dólar del día) */
  async arsFor(ids: string[]) {
    if (!ids.length) return new Map<string, { ars: number; currency: Currency }>();
    const [rows, ctx] = await Promise.all([this.baseQuery().where(inArray(items.id, ids)), this.priceContext()]);
    return new Map(rows.map((r) => [r.id, { ars: this.present(r as Row, ctx, false).price.ars, currency: r.currency as Currency }]));
  }

  async byId(id: string, user: AuthUser) {
    const [r] = await this.baseQuery().where(eq(items.id, id));
    if (!r) throw new NotFoundException('No encontramos ese ítem.');
    return this.present(r as Row, await this.priceContext(), user.role === 'ADMIN');
  }

  private async searchTextFor(dto: { code?: string | null; name: string; description?: string | null; brandId?: string | null }) {
    const brand = dto.brandId ? await this.db.query.brands.findFirst({ where: eq(brands.id, dto.brandId) }) : null;
    return normalize([dto.code, dto.name, brand?.name, dto.description?.slice(0, 160)].filter(Boolean).join(' '));
  }

  async create(dto: UpsertItemDto, by: AuthUser) {
    const values = { ...this.clean(dto), searchText: await this.searchTextFor(dto) };
    const [row] = await this.db.insert(items).values(values as typeof items.$inferInsert).returning({ id: items.id, name: items.name });
    await this.activity.log({ userId: by.id, action: 'crear', entity: 'item', entityId: row.id, summary: `Agregó "${row.name}" al catálogo` });
    return this.byId(row.id, by);
  }

  async update(id: string, dto: Partial<UpsertItemDto>, by: AuthUser) {
    const before = await this.db.query.items.findFirst({ where: eq(items.id, id) });
    if (!before) throw new NotFoundException('No encontramos ese ítem.');
    const merged = { ...before, ...this.clean(dto) };
    const searchText = await this.searchTextFor(merged);
    await this.db.update(items).set({ ...this.clean(dto), searchText }).where(eq(items.id, id));
    const priceChanged = dto.listPrice !== undefined && dto.listPrice !== before.listPrice;
    await this.activity.log({
      userId: by.id,
      action: priceChanged ? 'actualizar-precios' : 'editar',
      entity: 'item',
      entityId: id,
      summary: priceChanged ? `Cambió el precio de "${merged.name}": ${before.listPrice} → ${dto.listPrice} ${merged.currency}` : `Editó "${merged.name}"`,
      before: priceChanged ? { listPrice: before.listPrice } : undefined,
      after: priceChanged ? { listPrice: dto.listPrice } : undefined,
    });
    return this.byId(id, by);
  }

  private clean(dto: Partial<UpsertItemDto>) {
    const out: Record<string, unknown> = { ...dto };
    if (typeof dto.code === 'string') out.code = dto.code.trim() || null;
    if (typeof dto.name === 'string') out.name = dto.name.trim();
    return out as Partial<typeof items.$inferInsert>;
  }

  async setPhoto(id: string, file: Express.Multer.File | undefined, by: AuthUser) {
    if (!file) throw new BadRequestException('Elegí una foto.');
    const m = await this.media.saveImage(file.buffer, file.mimetype);
    await this.db.update(items).set({ mediaId: m.id }).where(eq(items.id, id));
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'item', entityId: id, summary: 'Cambió la foto de un ítem' });
    return this.byId(id, by);
  }

  async archive(id: string, by: AuthUser) {
    const [row] = await this.db.update(items).set({ active: false }).where(eq(items.id, id)).returning({ name: items.name });
    if (!row) throw new NotFoundException('No encontramos ese ítem.');
    await this.activity.log({ userId: by.id, action: 'borrar', entity: 'item', entityId: id, summary: `Archivó "${row.name}"` });
    return { ok: true };
  }

  /** Actualización masiva por %: con preview muestra qué cambia; sin preview, lo aplica */
  async bulkPercent(dto: BulkPercentDto, by: AuthUser) {
    if (!dto.percent) throw new BadRequestException('Indicá un porcentaje distinto de cero.');
    const where = this.filters({ brandId: dto.brandId, type: dto.type, priceListId: dto.priceListId, active: 'true' });
    const factor = 1 + dto.percent / 100;
    const [[{ total }], sample, ctx] = await Promise.all([
      this.db.select({ total: count() }).from(items).where(where),
      this.baseQuery().where(where).orderBy(asc(items.name)).limit(8),
      this.priceContext(),
    ]);
    const changes = sample.map((r) => {
      const before = this.present(r as Row, ctx, true);
      const after = this.present({ ...(r as Row), listPrice: Math.round(r.listPrice * factor * 100) / 100 }, ctx, true);
      return { id: r.id, name: r.name, before: before.price.ars, after: after.price.ars };
    });
    if (dto.preview) return { total, changes };
    await this.db
      .update(items)
      .set({ listPrice: sql`round(${items.listPrice} * ${factor}::numeric, 2)` })
      .where(where);
    await this.activity.log({
      userId: by.id,
      action: 'actualizar-precios',
      entity: 'item',
      summary: `Actualizó ${total} precios un ${dto.percent > 0 ? '+' : ''}${dto.percent}%`,
      after: { percent: dto.percent, brandId: dto.brandId ?? null, type: dto.type ?? null, priceListId: dto.priceListId ?? null },
    });
    return { total, changes, applied: true };
  }

  // ---------------------------------------------------------------- marcas
  listBrands() {
    return this.db.select().from(brands).where(eq(brands.active, true)).orderBy(asc(brands.sortOrder), asc(brands.name));
  }

  async createBrand(name: string) {
    const [row] = await this.db.insert(brands).values({ name: name.trim(), slug: slugify(name) }).returning();
    return row;
  }

  // ---------------------------------------------------------------- listas de precios
  async listPriceLists() {
    const counts = this.db
      .select({ priceListId: items.priceListId, n: count().as('n') })
      .from(items)
      .where(eq(items.active, true))
      .groupBy(items.priceListId)
      .as('c');
    return this.db
      .select({
        id: priceLists.id,
        name: priceLists.name,
        brandId: priceLists.brandId,
        brandName: brands.name,
        currency: priceLists.currency,
        rule: priceLists.rule,
        percent: priceLists.percent,
        ivaIncluded: priceLists.ivaIncluded,
        ivaRate: priceLists.ivaRate,
        validFrom: priceLists.validFrom,
        notes: priceLists.notes,
        active: priceLists.active,
        updatedAt: priceLists.updatedAt,
        itemCount: sql<number>`coalesce(${counts.n}, 0)::int`,
      })
      .from(priceLists)
      .leftJoin(brands, eq(priceLists.brandId, brands.id))
      .leftJoin(counts, eq(counts.priceListId, priceLists.id))
      .orderBy(desc(priceLists.active), asc(brands.sortOrder), asc(priceLists.name));
  }

  async createPriceList(dto: PriceListDto, by: AuthUser) {
    const [row] = await this.db.insert(priceLists).values(dto).returning();
    await this.activity.log({ userId: by.id, action: 'crear', entity: 'lista', entityId: row.id, summary: `Creó la lista "${row.name}"` });
    return row;
  }

  async updatePriceList(id: string, dto: Partial<PriceListDto>, by: AuthUser) {
    const before = await this.db.query.priceLists.findFirst({ where: eq(priceLists.id, id) });
    if (!before) throw new NotFoundException('No encontramos esa lista.');
    const [row] = await this.db.update(priceLists).set(dto).where(eq(priceLists.id, id)).returning();
    // Moneda e IVA de la lista se copian a sus ítems para que el cálculo sea consistente
    const sync: Partial<typeof items.$inferInsert> = {};
    if (dto.currency) sync.currency = dto.currency as Currency;
    if (dto.ivaIncluded !== undefined) sync.ivaIncluded = dto.ivaIncluded;
    if (dto.ivaRate !== undefined) sync.ivaRate = dto.ivaRate;
    if (Object.keys(sync).length) await this.db.update(items).set(sync).where(eq(items.priceListId, id));
    await this.activity.log({
      userId: by.id,
      action: 'editar',
      entity: 'lista',
      entityId: id,
      summary: `Editó la lista "${row.name}"`,
      before: { rule: before.rule, percent: before.percent, currency: before.currency, ivaIncluded: before.ivaIncluded },
      after: { rule: row.rule, percent: row.percent, currency: row.currency, ivaIncluded: row.ivaIncluded },
    });
    return row;
  }

  /** Para el import: ítems existentes de una marca por código */
  async existingByCode(brandId: string | null, codes: string[]) {
    if (!codes.length) return new Map<string, { id: string; listPrice: number; name: string; currency: Currency }>();
    const rows = await this.db
      .select({ id: items.id, code: items.code, listPrice: items.listPrice, name: items.name, currency: items.currency })
      .from(items)
      .where(and(brandId ? eq(items.brandId, brandId) : sql`${items.brandId} is null`, inArray(items.code, codes)));
    return new Map(rows.map((r) => [r.code!, { id: r.id, listPrice: r.listPrice, name: r.name, currency: r.currency }]));
  }

  async stats() {
    const rows = await this.db.select({ type: items.type, n: count() }).from(items).where(eq(items.active, true)).groupBy(items.type);
    return Object.fromEntries(rows.map((r) => [r.type, r.n])) as Partial<Record<ItemType, number>>;
  }
}
