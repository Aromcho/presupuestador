import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { ActivityService } from '../activity/activity.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { priceOf } from '../common/utils/pricing';
import { excludePrefixes, normalize } from '../common/utils/text';
import { Database, InjectDb } from '../db/db.module';
import { brands, clients, ItemType, items, priceLists, quoteGroups, QuoteStatus, quotes, users } from '../db/schema';
import { effectiveStatus, lineTotal, numero } from '../quotes/quotes.service';

const NOCHE = 'FF040B1D';
const RULE_LABEL = { COSTO_MAS_MARGEN: 'Costo + ganancia', LISTA_MENOS_DESCUENTO: 'Público − beneficio', PRECIO_FIJO: 'Precio fijo' };
const STATUS_LABEL: Record<QuoteStatus, string> = { BORRADOR: 'Borrador', ENVIADO: 'Enviado', ACEPTADO: 'Aceptado', RECHAZADO: 'Rechazado', VENCIDO: 'Vencido' };
const TYPE_LABEL: Record<ItemType, string> = { EQUIPO: 'Equipo', REPUESTO: 'Repuesto', MATERIAL: 'Material', MANO_DE_OBRA: 'Mano de obra', SERVICIO: 'Servicio' };
const TYPE_FROM_TEXT: [RegExp, ItemType][] = [
  [/repuesto/, 'REPUESTO'],
  [/material|accesorio/, 'MATERIAL'],
  [/mano de obra|instalacion/, 'MANO_DE_OBRA'],
  [/servicio|service/, 'SERVICIO'],
  [/equipo|caldera|climatizador|radiador|termotanque|bomba/, 'EQUIPO'],
];

export interface ImportMapping {
  sheet: string;
  headerRow: number;
  codeCol: number | null;
  nameCol: number;
  priceCol: number;
  typeCol: number | null;
}

interface ParsedRow {
  row: number;
  code: string | null;
  name: string;
  price: number;
  type: ItemType;
}

interface PendingImport {
  id: string;
  priceListId: string;
  brandId: string | null;
  fileName: string;
  createdAt: number;
  newRows: ParsedRow[];
  changed: { id: string; row: ParsedRow; before: number; sameCurrency: boolean }[];
  unchanged: number;
}

/** Convierte "U$S 1.234,56", "1,234.56", "$ 2.700.000" o un número de Excel en número */
export function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v && typeof v === 'object' && 'result' in v) return parsePrice((v as { result: unknown }).result);
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, '');
  else if (lastDot >= 0 && s.split('.').length > 2) s = s.replace(/\./g, '');
  else if (lastDot >= 0 && s.length - lastDot - 1 === 3 && !/^0/.test(s)) s = s.replace('.', ''); // "2.700" = dos mil setecientos
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const cellText = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.text) return String(o.text);
    if (o.result != null) return String(o.result);
  }
  return String(v).trim();
};

@Injectable()
export class ExcelService {
  private pending = new Map<string, PendingImport>();

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly catalog: CatalogService,
    private readonly activity: ActivityService,
  ) {}

  private async load(file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Elegí un archivo de Excel (.xlsx) o CSV.');
    const wb = new ExcelJS.Workbook();
    const name = file.originalname.toLowerCase();
    try {
      if (name.endsWith('.csv')) {
        const { Readable } = await import('stream');
        await wb.csv.read(Readable.from(file.buffer.toString('utf8')), { parserOptions: { delimiter: file.buffer.includes(';') ? ';' : ',' } });
      } else {
        await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
      }
    } catch {
      throw new BadRequestException('No pudimos leer el archivo. Guardalo como Excel (.xlsx) y probá de nuevo. Los .xls viejos no se pueden leer.');
    }
    return wb;
  }

  /** Busca la fila de títulos y adivina qué columna es código, descripción, precio y tipo */
  private detect(ws: ExcelJS.Worksheet): Omit<ImportMapping, 'sheet'> {
    let best = { headerRow: 1, score: -1, codeCol: null as number | null, nameCol: 0, priceCol: 0, typeCol: null as number | null };
    const max = Math.min(ws.rowCount, 25);
    for (let r = 1; r <= max; r++) {
      const vals = (ws.getRow(r).values as unknown[]).map((v) => normalize(cellText(v)));
      let codeCol: number | null = null, nameCol = 0, priceCol = 0, typeCol: number | null = null;
      vals.forEach((v, c) => {
        if (!v) return;
        if (!codeCol && /^(cod|codigo|cod\.|art|articulo|sku|ref|referencia)\b/.test(v)) codeCol = c;
        else if (!nameCol && /(descrip|producto|nombre|detalle|modelo|articulo)/.test(v)) nameCol = c;
        else if (!priceCol && /(precio|p\. ?lista|importe|valor|u\$s|usd|lista|neto|pvp)/.test(v)) priceCol = c;
        else if (!typeCol && /(tipo|rubro|categoria|familia)/.test(v)) typeCol = c;
      });
      const score = (codeCol ? 1 : 0) + (nameCol ? 2 : 0) + (priceCol ? 2 : 0);
      if (score > best.score) best = { headerRow: r, score, codeCol, nameCol, priceCol, typeCol };
    }
    if (!best.nameCol || !best.priceCol) {
      // Sin títulos reconocibles: primera columna de texto = descripción, última numérica = precio
      const row = ws.getRow(Math.min(2, ws.rowCount)).values as unknown[];
      row.forEach((v, c) => {
        if (!best.nameCol && typeof v === 'string' && v.length > 3) best.nameCol = c;
        if (parsePrice(v) != null) best.priceCol = c;
      });
      best.headerRow = 0;
    }
    return { headerRow: best.headerRow, codeCol: best.codeCol, nameCol: best.nameCol, priceCol: best.priceCol, typeCol: best.typeCol };
  }

  async preview(file: Express.Multer.File, priceListId: string, defaultType: ItemType, override: Partial<ImportMapping>) {
    const list = await this.db.query.priceLists.findFirst({ where: eq(priceLists.id, priceListId) });
    if (!list) throw new BadRequestException('Elegí a qué lista de precios corresponde el archivo.');
    const wb = await this.load(file);
    const ws = (override.sheet ? wb.getWorksheet(override.sheet) : undefined) ?? wb.worksheets.find((w) => w.rowCount > 1) ?? wb.worksheets[0];
    if (!ws) throw new BadRequestException('El archivo no tiene hojas con datos.');
    const auto = this.detect(ws);
    const map: ImportMapping = {
      sheet: ws.name,
      headerRow: override.headerRow ?? auto.headerRow,
      codeCol: override.codeCol !== undefined ? override.codeCol : auto.codeCol,
      nameCol: override.nameCol ?? auto.nameCol,
      priceCol: override.priceCol ?? auto.priceCol,
      typeCol: override.typeCol !== undefined ? override.typeCol : auto.typeCol,
    };
    if (!map.nameCol || !map.priceCol) throw new BadRequestException('No encontramos las columnas de descripción y precio. Elegilas a mano.');

    const header = map.headerRow ? (ws.getRow(map.headerRow).values as unknown[]) : [];
    const columns = Array.from({ length: Math.max(ws.columnCount, header.length - 1) }, (_, i) => ({
      col: i + 1,
      title: cellText(header[i + 1]) || `Columna ${String.fromCharCode(65 + (i % 26))}`,
    }));

    const parsed: ParsedRow[] = [];
    let invalid = 0;
    let excluded = 0;
    const prefijos = excludePrefixes(list.excludeCodes);
    const seen = new Set<string>();
    ws.eachRow((row, r) => {
      if (r <= map.headerRow) return;
      const v = row.values as unknown[];
      const name = cellText(v[map.nameCol]).replace(/\s+/g, ' ');
      const price = parsePrice(v[map.priceCol]);
      const code = map.codeCol ? cellText(v[map.codeCol]) || null : null;
      if (!name && !code) return;
      if (code && prefijos.some((pre) => code.toUpperCase().startsWith(pre))) {
        excluded++;
        return;
      }
      if (!name || price == null || price < 0) {
        invalid++;
        return;
      }
      const key = code ?? normalize(name);
      if (seen.has(key)) return;
      seen.add(key);
      const typeText = map.typeCol ? normalize(cellText(v[map.typeCol])) : '';
      const type = TYPE_FROM_TEXT.find(([re]) => re.test(typeText))?.[1] ?? defaultType;
      parsed.push({ row: r, code, name: name.slice(0, 200), price: Math.round(price * 100) / 100, type });
    });
    if (!parsed.length) throw new BadRequestException('No encontramos filas con descripción y precio. Revisá las columnas elegidas.');

    const byCode = await this.catalog.existingByCode(list.brandId, parsed.filter((p) => p.code).map((p) => p.code!));
    const sameList = await this.db
      .select({ id: items.id, name: items.name, listPrice: items.listPrice, code: items.code, currency: items.currency })
      .from(items)
      .where(eq(items.priceListId, list.id));
    const byName = new Map(sameList.filter((i) => !i.code).map((i) => [normalize(i.name), i]));

    const pending: PendingImport = { id: randomUUID(), priceListId: list.id, brandId: list.brandId, fileName: file.originalname, createdAt: Date.now(), newRows: [], changed: [], unchanged: 0 };
    for (const p of parsed) {
      const hit = p.code ? byCode.get(p.code) : byName.get(normalize(p.name));
      if (!hit) pending.newRows.push(p);
      else if (Math.abs(hit.listPrice - p.price) > 0.004 || hit.currency !== list.currency)
        pending.changed.push({ id: hit.id, row: p, before: hit.listPrice, sameCurrency: hit.currency === list.currency });
      else pending.unchanged++;
    }
    this.gc();
    this.pending.set(pending.id, pending);

    const ctx = await this.catalog.priceContext();
    const rule = list.rule;
    const ars = (price: number, type: ItemType) =>
      priceOf({ type, currency: list.currency, listPrice: price, rule, percent: list.percent, ivaIncluded: list.ivaIncluded, ivaRate: list.ivaRate }, ctx.dollar, ctx.rounding).ars;

    return {
      importId: pending.id,
      fileName: file.originalname,
      sheets: wb.worksheets.map((w) => w.name),
      mapping: map,
      columns,
      list: { id: list.id, name: list.name, currency: list.currency, rule: list.rule, percent: list.percent, ivaIncluded: list.ivaIncluded },
      totals: { rows: parsed.length, new: pending.newRows.length, changed: pending.changed.length, unchanged: pending.unchanged, invalid, excluded },
      excludeCodes: prefijos,
      changed: pending.changed.slice(0, 25).map((c) => ({
        code: c.row.code,
        name: c.row.name,
        before: c.before,
        after: c.row.price,
        pct: c.before && c.sameCurrency ? Math.round(((c.row.price - c.before) / c.before) * 1000) / 10 : null,
        currencyChanged: !c.sameCurrency,
        arsAfter: ars(c.row.price, c.row.type),
      })),
      news: pending.newRows.slice(0, 15).map((n) => ({ code: n.code, name: n.name, price: n.price, type: n.type, ars: ars(n.price, n.type) })),
    };
  }

  async confirm(importId: string, by: AuthUser) {
    const p = this.pending.get(importId);
    if (!p) throw new NotFoundException('La vista previa venció. Subí el archivo de nuevo.');
    const list = await this.db.query.priceLists.findFirst({ where: eq(priceLists.id, p.priceListId) });
    if (!list) throw new NotFoundException('La lista ya no existe.');
    const brand = p.brandId ? await this.db.query.brands.findFirst({ where: eq(brands.id, p.brandId) }) : null;

    await this.db.transaction(async (tx) => {
      for (let i = 0; i < p.newRows.length; i += 500) {
        const chunk = p.newRows.slice(i, i + 500);
        await tx.insert(items).values(
          chunk.map((r) => ({
            type: r.type,
            code: r.code,
            name: r.name,
            brandId: p.brandId,
            priceListId: p.priceListId,
            currency: list.currency,
            listPrice: r.price,
            ivaIncluded: list.ivaIncluded,
            ivaRate: list.ivaRate,
            searchText: normalize([r.code, r.name, brand?.name].filter(Boolean).join(' ')),
          })),
        );
      }
      for (const c of p.changed) {
        await tx
          .update(items)
          .set({ listPrice: c.row.price, priceListId: p.priceListId, currency: list.currency, ivaIncluded: list.ivaIncluded, ivaRate: list.ivaRate, active: true })
          .where(eq(items.id, c.id));
      }
      await tx.update(priceLists).set({ validFrom: new Date() }).where(eq(priceLists.id, p.priceListId));
      // Lo que la lista excluye (ej.: Peisa dentro de Hydraulic) queda archivado aunque se haya cargado antes
      const prefijos = excludePrefixes(list.excludeCodes);
      if (prefijos.length)
        await tx
          .update(items)
          .set({ active: false })
          .where(and(eq(items.priceListId, p.priceListId), eq(items.active, true), or(...prefijos.map((pre) => ilike(items.code, `${pre}%`)))));
    });
    this.pending.delete(importId);
    await this.activity.log({
      userId: by.id,
      action: 'importar',
      entity: 'lista',
      entityId: p.priceListId,
      summary: `Importó "${p.fileName}" en "${list.name}": ${p.newRows.length} nuevos, ${p.changed.length} con precio nuevo`,
    });
    return { ok: true, created: p.newRows.length, updated: p.changed.length, unchanged: p.unchanged };
  }

  private gc() {
    const limit = Date.now() - 30 * 60_000;
    for (const [k, v] of this.pending) if (v.createdAt < limit) this.pending.delete(k);
  }

  // ---------------------------------------------------------------- planillas
  private styleSheet(ws: ExcelJS.Worksheet, title: string, headers: { header: string; key: string; width: number }[]) {
    ws.columns = headers.map((h) => ({ key: h.key, width: h.width }));
    ws.mergeCells(1, 1, 1, headers.length);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NOCHE } };
    t.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 26;
    const hr = ws.getRow(2);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h.header;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12234A' } };
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };
  }

  async template() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lista');
    this.styleSheet(ws, 'GESETEC CALDERAS · Plantilla para importar una lista de precios', [
      { header: 'Código', key: 'code', width: 16 },
      { header: 'Descripción', key: 'name', width: 56 },
      { header: 'Precio', key: 'price', width: 16 },
      { header: 'Tipo', key: 'type', width: 16 },
    ]);
    ws.addRow({ code: 'PT24DS', name: 'Caldera Peisa Prima Tec 24 DS tiro forzado 26.300 kcal/h GN', price: 1650, type: 'Equipo' });
    ws.addRow({ code: 'R-1234', name: 'Sensor de temperatura NTC (ejemplo)', price: 18.5, type: 'Repuesto' });
    ws.addRow({});
    ws.addRow({ name: 'El precio va como figura en la lista (en dólares o en pesos). La moneda, la ganancia o el beneficio y el IVA se configuran en la lista del sistema.' });
    return wb.xlsx.writeBuffer();
  }

  async exportCatalog(filter: { priceListId?: string; brandId?: string; type?: ItemType }) {
    const conds: SQL[] = [eq(items.active, true)];
    if (filter.priceListId) conds.push(eq(items.priceListId, filter.priceListId));
    if (filter.brandId) conds.push(eq(items.brandId, filter.brandId));
    if (filter.type) conds.push(eq(items.type, filter.type));
    const rows = await this.db
      .select({
        code: items.code,
        name: items.name,
        type: items.type,
        brand: brands.name,
        list: priceLists.name,
        currency: items.currency,
        listPrice: items.listPrice,
        rule: priceLists.rule,
        percent: priceLists.percent,
        ruleOverride: items.ruleOverride,
        percentOverride: items.percentOverride,
        ivaIncluded: items.ivaIncluded,
        ivaRate: items.ivaRate,
      })
      .from(items)
      .leftJoin(brands, eq(items.brandId, brands.id))
      .leftJoin(priceLists, eq(items.priceListId, priceLists.id))
      .where(and(...conds))
      .orderBy(asc(brands.sortOrder), asc(items.type), asc(items.name));

    const ctx = await this.catalog.priceContext();
    const fecha = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Presupuestador Gesetec';
    const ws = wb.addWorksheet('Catálogo');
    this.styleSheet(ws, `GESETEC CALDERAS · Catálogo y precios · ${fecha}${ctx.dollar ? ` · Dólar BNA venta $${ctx.dollar}` : ''}`, [
      { header: 'Código', key: 'code', width: 14 },
      { header: 'Ítem', key: 'name', width: 48 },
      { header: 'Marca', key: 'brand', width: 12 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Lista', key: 'list', width: 24 },
      { header: 'Moneda', key: 'currency', width: 9 },
      { header: 'Precio de lista', key: 'listPrice', width: 16 },
      { header: 'Regla', key: 'rule', width: 20 },
      { header: '%', key: 'percent', width: 8 },
      { header: 'IVA en lista', key: 'iva', width: 12 },
      { header: 'Precio final ($)', key: 'ars', width: 18 },
    ]);
    for (const r of rows) {
      const rule = r.ruleOverride ?? r.rule ?? 'PRECIO_FIJO';
      const percent = r.percentOverride ?? r.percent ?? 0;
      const p = priceOf({ type: r.type, currency: r.currency, listPrice: r.listPrice, rule, percent, ivaIncluded: r.ivaIncluded, ivaRate: r.ivaRate }, ctx.dollar, ctx.rounding);
      const row = ws.addRow({
        code: r.code ?? '',
        name: r.name,
        brand: r.brand ?? '',
        type: TYPE_LABEL[r.type],
        list: r.list ?? '',
        currency: r.currency,
        listPrice: r.listPrice,
        rule: RULE_LABEL[rule],
        percent: percent / 100,
        iva: r.ivaIncluded ? 'Incluido' : `+ ${r.ivaRate}%`,
        ars: p.ars,
      });
      row.getCell('listPrice').numFmt = r.currency === 'USD' ? '"U$S" #,##0.00' : '"$" #,##0.00';
      row.getCell('percent').numFmt = '0.0%';
      row.getCell('ars').numFmt = '"$" #,##0';
    }
    return wb.xlsx.writeBuffer();
  }

  async exportQuotes(filter: { desde?: string; hasta?: string; status?: QuoteStatus }) {
    const conds: SQL[] = [];
    if (filter.desde) conds.push(gte(quotes.createdAt, new Date(`${filter.desde}T00:00:00-03:00`)));
    if (filter.hasta) conds.push(lte(quotes.createdAt, new Date(`${filter.hasta}T23:59:59-03:00`)));
    const rows = await this.db
      .select({ quote: quotes, client: clients, userName: users.name })
      .from(quotes)
      .leftJoin(clients, eq(quotes.clientId, clients.id))
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(and(...conds))
      .orderBy(desc(quotes.number));
    const groups = rows.length
      ? await this.db.query.quoteGroups.findMany({ where: inArray(quoteGroups.quoteId, rows.map((r) => r.quote.id)), orderBy: asc(quoteGroups.sortOrder), with: { items: true } })
      : [];
    const list = rows
      .map((r) => ({ ...r, status: effectiveStatus(r.quote) }))
      .filter((r) => !filter.status || r.status === filter.status);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Presupuestador Gesetec';
    const fecha = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const ws = wb.addWorksheet('Presupuestos');
    this.styleSheet(ws, `GESETEC CALDERAS · Presupuestos · ${fecha}`, [
      { header: 'N°', key: 'number', width: 8 },
      { header: 'Fecha', key: 'date', width: 12 },
      { header: 'Cliente', key: 'client', width: 28 },
      { header: 'WhatsApp', key: 'phone', width: 16 },
      { header: 'Zona', key: 'zone', width: 18 },
      { header: 'Título', key: 'title', width: 40 },
      { header: 'Tipo', key: 'mode', width: 13 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Total / opciones ($)', key: 'total', width: 20 },
      { header: 'Dólar usado', key: 'dollar', width: 12 },
      { header: 'Armó', key: 'user', width: 16 },
    ]);
    const det = wb.addWorksheet('Detalle de ítems');
    this.styleSheet(det, `GESETEC CALDERAS · Ítems de cada presupuesto · ${fecha}`, [
      { header: 'N°', key: 'number', width: 8 },
      { header: 'Cliente', key: 'client', width: 26 },
      { header: 'Opción', key: 'group', width: 14 },
      { header: 'Código', key: 'code', width: 16 },
      { header: 'Ítem', key: 'name', width: 46 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Cantidad', key: 'qty', width: 10 },
      { header: 'Precio unitario ($)', key: 'unit', width: 18 },
      { header: 'Subtotal ($)', key: 'sub', width: 16 },
    ]);
    let suma = 0;
    for (const r of list) {
      const gs = groups.filter((g) => g.quoteId === r.quote.id);
      const totals = gs.map((g) => g.items.reduce((a, i) => a + lineTotal(i), 0));
      const isSuma = r.quote.mode === 'SUMA';
      if (isSuma) suma += totals.reduce((a, b) => a + b, 0);
      const row = ws.addRow({
        number: numero(r.quote.number),
        date: r.quote.createdAt,
        client: r.client?.name ?? '',
        phone: r.client?.phone ?? '',
        zone: r.client?.zone ?? '',
        title: r.quote.title,
        mode: isSuma ? 'Una opción' : 'Comparativa',
        status: STATUS_LABEL[r.status],
        total: isSuma ? totals.reduce((a, b) => a + b, 0) : totals.map((t, i) => `${gs[i].label}: $ ${t.toLocaleString('es-AR')}`).join(' · '),
        dollar: r.quote.dollarSell == null ? '' : Number(r.quote.dollarSell),
        user: r.userName ?? '',
      });
      row.getCell('date').numFmt = 'dd/mm/yyyy';
      if (isSuma) row.getCell('total').numFmt = '"$" #,##0';
      row.getCell('dollar').numFmt = '"$" #,##0.00';
      for (const g of gs)
        for (const i of g.items) {
          const d = det.addRow({ number: numero(r.quote.number), client: r.client?.name ?? '', group: isSuma ? '' : g.label, code: i.code ?? '', name: i.name, type: TYPE_LABEL[i.type], qty: Number(i.qty), unit: i.unitPrice, sub: lineTotal(i) });
          d.getCell('unit').numFmt = '"$" #,##0';
          d.getCell('sub').numFmt = '"$" #,##0';
        }
    }
    const tot = ws.addRow({ title: 'Total presupuestos de una opción', total: suma });
    tot.font = { bold: true };
    tot.getCell('total').numFmt = '"$" #,##0';
    return wb.xlsx.writeBuffer();
  }

  async exportClients() {
    const rows = await this.db
      .select({
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        zone: clients.zone,
        address: clients.address,
        createdAt: clients.createdAt,
        quoteCount: sql<number>`(select count(*)::int from quotes q where q.client_id = "clients"."id")`,
        lastQuoteAt: sql<string | null>`(select max(q.created_at) from quotes q where q.client_id = "clients"."id")`,
      })
      .from(clients)
      .orderBy(asc(clients.name));
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Presupuestador Gesetec';
    const fecha = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const ws = wb.addWorksheet('Clientes');
    this.styleSheet(ws, `GESETEC CALDERAS · Clientes · ${fecha}`, [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'WhatsApp', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Zona', key: 'zone', width: 18 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Presupuestos', key: 'quoteCount', width: 13 },
      { header: 'Último presupuesto', key: 'last', width: 18 },
      { header: 'Alta', key: 'createdAt', width: 12 },
    ]);
    for (const r of rows) {
      const row = ws.addRow({ ...r, last: r.lastQuoteAt ? new Date(r.lastQuoteAt) : '' });
      row.getCell('last').numFmt = 'dd/mm/yyyy';
      row.getCell('createdAt').numFmt = 'dd/mm/yyyy';
    }
    return wb.xlsx.writeBuffer();
  }
}
