import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { normalize, slugify } from '../common/utils/text';
import { Database, InjectDb } from '../db/db.module';
import { marketingPending, marketingPosts, marketingResources, settings } from '../db/schema';

/**
 * Marketing y redes: plan, calendario de publicaciones, recursos y pendientes.
 * El contenido se carga importando el Excel del plan (no va en el repo, que es público).
 * El estado de cada pieza y de cada pendiente se maneja desde el panel y no se pisa al volver a importar.
 */

export const POST_STATUS = ['idea', 'para producir', 'en edición', 'programado', 'publicado'] as const;
export const PENDING_STATUS = ['Abierto', 'Resuelto'] as const;

/** Columnas del calendario: [cómo empieza el título (sin acentos), clave, título para exportar] */
const POST_COLS: [string, string, string][] = [
  ['id', 'code', 'ID'],
  ['fecha', 'date', 'Fecha'],
  ['dia', 'day', 'Día'],
  ['hora', 'time', 'Hora'],
  ['formato', 'format', 'Formato'],
  ['serie', 'series', 'Serie'],
  ['capitulo', 'chapter', 'Capítulo del hilo'],
  ['etapa', 'arc', 'Etapa del arco'],
  ['objetivo', 'goal', 'Objetivo'],
  ['formula', 'formula', 'Fórmula de gancho'],
  ['gancho hablado', 'hookVoice', 'Gancho hablado'],
  ['gancho en pantalla', 'hookScreen', 'Gancho en pantalla'],
  ['puntaje', 'score', 'Puntaje'],
  ['opcion b', 'optionB', 'Opción B'],
  ['opcion c', 'optionC', 'Opción C'],
  ['guion', 'script', 'Guion corto'],
  ['frase antes', 'echo', 'Frase antes del llamado (eco)'],
  ['recursos', 'resources', 'Recursos (ID · ruta)'],
  ['que falta', 'toProduce', 'Qué falta producir'],
  ['producto', 'product', 'Producto o modelo'],
  ['zona', 'zone', 'Zona'],
  ['llamado', 'cta', 'Llamado a la acción'],
  ['texto del post', 'caption', 'Texto del post'],
  ['etiqueta de ia', 'ai', 'Etiqueta de IA'],
  ['base o extra', 'base', 'Base o EXTRA'],
  ['que se recicla', 'recycle', 'Qué se recicla'],
  ['viene de', 'prev', 'Viene de'],
  ['lleva a', 'next', 'Lleva a'],
  ['estado', 'status', 'Estado'],
];

const RESOURCE_COLS: [string, string][] = [
  ['id', 'code'],
  ['album', 'album'],
  ['archivo', 'file'],
  ['ruta', 'path'],
  ['tipo', 'type'],
  ['categoria', 'category'],
  ['que muestra', 'desc'],
  ['marca', 'brand'],
  ['modelo', 'model'],
  ['zona', 'zone'],
  ['orientacion', 'orientation'],
  ['duracion', 'duration'],
  ['resolucion', 'resolution'],
  ['calidad', 'quality'],
  ['personas', 'people'],
  ['patente', 'plate'],
  ['frente', 'facade'],
  ['se puede usar', 'usable'],
  ['condicion', 'condition'],
  ['valor', 'value'],
  ['tambien en', 'alsoIn'],
  ['pieza ya editada', 'edited'],
  ['fecha del archivo', 'fileDate'],
  ['usado en', 'usedIn'],
];

const PENDING_COLS: [string, string, string][] = [
  ['tipo', 'kind', 'Tipo'],
  ['tema', 'topic', 'Tema'],
  ['detalle', 'detail', 'Detalle'],
  ['afecta', 'affects', 'Afecta a'],
  ['quien', 'owner', 'Quién lo resuelve'],
  ['estado', 'status', 'Estado'],
];

export interface Tabla {
  headers: string[];
  rows: string[][];
}

export interface PlanSeccion {
  titulo: string;
  md: string;
}

export interface MarketingAjustes {
  importedAt: string | null;
  importedBy: string | null;
  fileName: string | null;
  plan: PlanSeccion[];
  series: Tabla | null;
  hilo: Tabla | null;
  rutina: Tabla | null;
}

const AJUSTES_VACIOS: MarketingAjustes = { importedAt: null, importedBy: null, fileName: null, plan: [], series: null, hilo: null, rutina: null };

const clave = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Texto de una celda de exceljs (fechas como AAAA-MM-DD, horas como HH:MM) */
function texto(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    // Una hora sola llega como 30/12/1899 + la hora
    if (v.getUTCFullYear() < 1901) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
    return isoDate(v);
  }
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (o.richText)
      return o.richText
        .map((r) => r.text)
        .join('')
        .trim();
    if (o.text != null) return texto(o.text);
    if (o.result != null) return texto(o.result);
    if (o.hyperlink) return o.hyperlink;
    return '';
  }
  return String(v).trim();
}

/** Fecha del calendario: acepta AAAA-MM-DD, DD/MM/AAAA o el número de serie de Excel */
function fechaISO(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  const n = Number(s);
  if (Number.isFinite(n) && n > 30000 && n < 80000) return isoDate(new Date(Date.UTC(1899, 11, 30) + n * 86_400_000));
  return null;
}

/** Hora: "19:30", "'19:30" o la fracción del día de Excel */
function hora(s: string): string {
  const t = s.replace(/^'/, '');
  const n = Number(t);
  if (t && Number.isFinite(n) && n > 0 && n < 1) {
    const min = Math.round(n * 24 * 60);
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }
  return t;
}

function buscarHoja(wb: ExcelJS.Workbook, nombre: string) {
  return wb.worksheets.find((w) => clave(w.name) === nombre) ?? wb.worksheets.find((w) => clave(w.name).startsWith(nombre));
}

/** Filas de una hoja como texto, desde la fila de títulos (la primera con contenido) */
function filas(ws: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  const ancho = ws.actualColumnCount || ws.columnCount;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: string[] = [];
    for (let c = 1; c <= ancho; c++) vals.push(texto(row.getCell(c).value));
    while (vals.length && !vals[vals.length - 1]) vals.pop();
    if (vals.some(Boolean)) out.push(vals);
  });
  return out;
}

/** Lee una hoja con títulos y la pasa a objetos con las claves de `cols` */
function objetos(ws: ExcelJS.Worksheet, cols: [string, string, ...string[]][]): Record<string, string>[] {
  const fs = filas(ws);
  // Fila de títulos: la primera (entre las 5 primeras) que reconoce al menos 3 columnas
  let hi = 0;
  for (let i = 0; i < Math.min(5, fs.length); i++) {
    const hits = fs[i].filter((h) => cols.some(([p]) => clave(h).startsWith(p))).length;
    if (hits >= 3) {
      hi = i;
      break;
    }
  }
  const header = fs[hi] ?? [];
  const keys = header.map((h) => {
    const k = clave(h);
    // La coincidencia más larga gana ("gancho en pantalla" antes que "gancho")
    const hit = cols.filter(([p]) => k.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
    return hit ? hit[1] : k ? `x_${slugify(h)}` : '';
  });
  return fs.slice(hi + 1).map((r) => {
    const o: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k && r[i]) o[k] = r[i];
    });
    return o;
  });
}

function tabla(ws: ExcelJS.Worksheet | undefined): Tabla | null {
  if (!ws) return null;
  const fs = filas(ws);
  if (!fs.length) return null;
  const ancho = Math.max(...fs.map((f) => f.length));
  return { headers: fs[0], rows: fs.slice(1).map((f) => [...f, ...Array(Math.max(0, ancho - f.length)).fill('')]) };
}

const estadoPieza = (s: string | undefined): string | null => {
  const k = normalize(s ?? '');
  return POST_STATUS.find((e) => normalize(e) === k) ?? null;
};
const estadoPendiente = (s: string | undefined): string | null => {
  const k = normalize(s ?? '');
  if (!k) return null;
  return k.startsWith('resuel') || k === 'cerrado' || k === 'hecho' ? 'Resuelto' : 'Abierto';
};

class PostPatchDto {
  @IsOptional() @IsIn(POST_STATUS as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

class PendingPatchDto {
  @IsOptional() @IsIn(PENDING_STATUS as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) answer?: string;
}

@Injectable()
class MarketingService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly activity: ActivityService,
  ) {}

  private async ajustes(): Promise<MarketingAjustes> {
    const row = await this.db.query.settings.findFirst({ where: eq(settings.key, 'marketing') });
    return { ...AJUSTES_VACIOS, ...((row?.value as Partial<MarketingAjustes>) ?? {}) };
  }

  async resumen() {
    const [aj, posts, pending, [{ n }]] = await Promise.all([
      this.ajustes(),
      this.db.select().from(marketingPosts).orderBy(asc(marketingPosts.date), asc(marketingPosts.sortOrder)),
      this.db.select().from(marketingPending).orderBy(asc(marketingPending.sortOrder)),
      this.db.select({ n: sql<number>`count(*)::int` }).from(marketingResources),
    ]);
    return {
      ...aj,
      resourcesCount: n,
      posts: posts.map((p) => ({ ...p.data, id: p.id, code: p.code, date: p.date, status: p.status, note: p.note ?? '', updatedAt: p.updatedAt })),
      pending: pending.map((p) => ({ ...p.data, id: p.id, status: p.status, answer: p.answer ?? '' })),
    };
  }

  async recursos() {
    const rows = await this.db.select().from(marketingResources).orderBy(asc(marketingResources.sortOrder));
    return rows.map((r) => ({ ...r.data, code: r.code }));
  }

  async editarPieza(id: string, dto: PostPatchDto, by: AuthUser) {
    const set: Partial<typeof marketingPosts.$inferInsert> = {};
    if (dto.status !== undefined) Object.assign(set, { status: dto.status, statusFromPanel: true });
    if (dto.note !== undefined) set.note = dto.note.trim() || null;
    if (!Object.keys(set).length) throw new BadRequestException('No hay nada para cambiar.');
    const [p] = await this.db.update(marketingPosts).set(set).where(eq(marketingPosts.id, id)).returning();
    if (!p) throw new NotFoundException('No encontramos esa publicación.');
    if (dto.status !== undefined) await this.activity.log({ userId: by.id, action: 'editar', entity: 'marketing', entityId: p.code, summary: `Pasó ${p.code} a «${p.status}»` });
    return { id: p.id, status: p.status, note: p.note ?? '' };
  }

  async editarPendiente(id: string, dto: PendingPatchDto) {
    const set: Partial<typeof marketingPending.$inferInsert> = { fromPanel: true };
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.answer !== undefined) set.answer = dto.answer.trim() || null;
    const [p] = await this.db.update(marketingPending).set(set).where(eq(marketingPending.id, id)).returning();
    if (!p) throw new NotFoundException('No encontramos ese pendiente.');
    return { id: p.id, status: p.status, answer: p.answer ?? '' };
  }

  /** Importa el Excel del plan. Pisa el contenido, pero respeta el estado y las notas cargados en el panel. */
  async importar(file: Express.Multer.File, by: AuthUser) {
    if (!file?.buffer?.length) throw new BadRequestException('Elegí el Excel del plan (.xlsx).');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('El plan se importa desde un Excel (.xlsx).');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No pudimos leer el archivo. Descargalo de nuevo como Excel (.xlsx) y probá otra vez.');
    }

    const hojaCal = buscarHoja(wb, 'calendario');
    if (!hojaCal) throw new BadRequestException('El archivo no tiene la hoja «Calendario».');

    const piezas = objetos(hojaCal, POST_COLS)
      .filter((o) => o.code && o.date)
      .map((o, i) => ({ ...o, code: o.code.toUpperCase(), date: fechaISO(o.date) ?? '', time: hora(o.time ?? ''), orden: i }));
    const sinFecha = piezas.filter((p) => !p.date).map((p) => p.code);
    if (sinFecha.length) throw new BadRequestException(`Estas publicaciones no tienen una fecha válida: ${sinFecha.slice(0, 8).join(', ')}.`);
    const repetidas = piezas.map((p) => p.code).filter((c, i, a) => a.indexOf(c) !== i);
    if (repetidas.length) throw new BadRequestException(`Hay IDs repetidos en el calendario: ${[...new Set(repetidas)].join(', ')}.`);
    if (!piezas.length) throw new BadRequestException('La hoja «Calendario» no tiene publicaciones con ID y fecha.');

    const hojaRec = buscarHoja(wb, 'recursos');
    const recursos = hojaRec ? objetos(hojaRec, RESOURCE_COLS).filter((o) => o.code) : null;
    const hojaPen = buscarHoja(wb, 'pendientes');
    const pendientes = hojaPen ? objetos(hojaPen, PENDING_COLS).filter((o) => o.topic || o.detail) : null;
    const hojaPlan = buscarHoja(wb, 'plan');
    const plan = hojaPlan
      ? filas(hojaPlan)
          .slice(1)
          .filter((f) => f[0] || f[1])
          .map((f) => ({ titulo: f[0] ?? '', md: f[1] ?? '' }))
      : null;

    const res = { nuevas: 0, actualizadas: 0, borradas: 0, estadosRespetados: 0, recursos: recursos?.length ?? null, pendientes: pendientes?.length ?? null };

    await this.db.transaction(async (tx) => {
      // Calendario
      const actuales = await tx.select().from(marketingPosts);
      const porCodigo = new Map(actuales.map((p) => [p.code, p]));
      for (const p of piezas) {
        const { orden, ...rest } = p;
        const data: Record<string, string> = rest;
        const previa = porCodigo.get(p.code);
        const delArchivo = estadoPieza(data.status);
        if (previa) {
          const status = previa.statusFromPanel ? previa.status : (delArchivo ?? previa.status);
          if (previa.statusFromPanel && delArchivo && delArchivo !== previa.status) res.estadosRespetados++;
          await tx.update(marketingPosts).set({ date: p.date, sortOrder: orden, data, status }).where(eq(marketingPosts.id, previa.id));
          res.actualizadas++;
        } else {
          await tx.insert(marketingPosts).values({ code: p.code, date: p.date, sortOrder: orden, data, status: delArchivo ?? 'idea' });
          res.nuevas++;
        }
      }
      const fuera = actuales.filter((a) => !piezas.some((p) => p.code === a.code)).map((a) => a.id);
      if (fuera.length) {
        await tx.delete(marketingPosts).where(inArray(marketingPosts.id, fuera));
        res.borradas = fuera.length;
      }

      // Recursos: se reemplazan enteros
      if (recursos) {
        await tx.delete(marketingResources);
        const vistos = new Set<string>();
        const unicos = recursos.filter((r) => !vistos.has(r.code) && vistos.add(r.code));
        for (let i = 0; i < unicos.length; i += 250) {
          await tx.insert(marketingResources).values(unicos.slice(i, i + 250).map((data, j) => ({ code: data.code, sortOrder: i + j, data })));
        }
        res.recursos = unicos.length;
      }

      // Pendientes: por tipo + tema; el estado y la respuesta del panel se respetan
      if (pendientes) {
        const prev = await tx.select().from(marketingPending);
        const porClave = new Map(prev.map((p) => [p.key, p]));
        const claves = new Set<string>();
        for (const [i, data] of pendientes.entries()) {
          let key = slugify(`${data.kind ?? ''} ${data.topic ?? data.detail ?? ''}`).slice(0, 120) || `pendiente-${i}`;
          while (claves.has(key)) key = `${key}-${i}`;
          claves.add(key);
          const previo = porClave.get(key);
          const delArchivo = estadoPendiente(data.status);
          if (previo) {
            await tx
              .update(marketingPending)
              .set({ data, sortOrder: i, status: previo.fromPanel ? previo.status : (delArchivo ?? previo.status) })
              .where(eq(marketingPending.id, previo.id));
          } else {
            await tx.insert(marketingPending).values({ key, data, sortOrder: i, status: delArchivo ?? 'Abierto' });
          }
        }
        const sobran = prev.filter((p) => !claves.has(p.key)).map((p) => p.id);
        if (sobran.length) await tx.delete(marketingPending).where(inArray(marketingPending.id, sobran));
      }

      // Plan, series, hilo y rutina: si la hoja no viene, queda lo anterior
      const antes = await this.ajustes();
      const value: MarketingAjustes = {
        importedAt: new Date().toISOString(),
        importedBy: by.name,
        fileName: file.originalname,
        plan: plan ?? antes.plan,
        series: tabla(buscarHoja(wb, 'series')) ?? antes.series,
        hilo: tabla(buscarHoja(wb, 'hilo')) ?? antes.hilo,
        rutina: tabla(buscarHoja(wb, 'rutina')) ?? antes.rutina,
      };
      await tx
        .insert(settings)
        .values({ key: 'marketing', value })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: sql`now()` } });
    });

    await this.activity.log({
      userId: by.id,
      action: 'importar',
      entity: 'marketing',
      summary: `Importó el plan de marketing «${file.originalname}»: ${piezas.length} publicaciones${res.recursos != null ? `, ${res.recursos} recursos` : ''}${res.pendientes != null ? `, ${res.pendientes} pendientes` : ''}`,
    });
    return { ...res, publicaciones: piezas.length };
  }

  /** Calendario y pendientes con el estado del panel, para seguir en Excel */
  async exportar() {
    const [posts, pending] = await Promise.all([
      this.db.select().from(marketingPosts).orderBy(asc(marketingPosts.date), asc(marketingPosts.sortOrder)),
      this.db.select().from(marketingPending).orderBy(asc(marketingPending.sortOrder)),
    ]);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Panel admin Gesetec';
    const estilo = (ws: ExcelJS.Worksheet, anchos: number[]) => {
      const hr = ws.getRow(1);
      hr.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF040B1D' } };
        c.alignment = { vertical: 'middle', wrapText: true };
      });
      anchos.forEach((w, i) => (ws.getColumn(i + 1).width = w));
      ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: anchos.length } };
      ws.eachRow((r, n) => n > 1 && r.eachCell((c) => (c.alignment = { vertical: 'top', wrapText: true })));
    };

    const cal = wb.addWorksheet('Calendario');
    const cols = POST_COLS.filter(([, k]) => k !== 'status');
    cal.addRow([...cols.map(([, , t]) => t), 'Estado', 'Nota']);
    for (const p of posts) {
      const d = p.data;
      cal.addRow([...cols.map(([, k]) => (k === 'code' ? p.code : k === 'date' ? p.date : (d[k] ?? ''))), p.status, p.note ?? '']);
    }
    estilo(cal, [8, 12, 11, 7, 10, 22, 22, 14, 11, 20, 46, 26, 13, 50, 50, 60, 34, 70, 46, 26, 26, 40, 60, 10, 10, 34, 9, 12, 14, 40]);

    const pen = wb.addWorksheet('Pendientes');
    pen.addRow([...PENDING_COLS.filter(([, k]) => k !== 'status').map(([, , t]) => t), 'Estado', 'Respuesta']);
    for (const p of pending) pen.addRow([...PENDING_COLS.filter(([, k]) => k !== 'status').map(([, k]) => p.data[k] ?? ''), p.status, p.answer ?? '']);
    estilo(pen, [18, 30, 90, 26, 18, 12, 50]);

    return wb.xlsx.writeBuffer();
  }
}

@ApiTags('admin / marketing')
@Controller('admin/marketing')
@UseGuards(SessionGuard)
@Roles('ADMIN')
class MarketingController {
  constructor(private readonly svc: MarketingService) {}

  @Get() resumen() {
    return this.svc.resumen();
  }

  @Get('recursos') recursos() {
    return this.svc.recursos();
  }

  @Patch('posts/:id') editarPieza(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PostPatchDto, @CurrentUser() by: AuthUser) {
    return this.svc.editarPieza(id, dto, by);
  }

  @Patch('pendientes/:id') editarPendiente(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PendingPatchDto) {
    return this.svc.editarPendiente(id, dto);
  }

  @Post('import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  importar(@UploadedFile() file: Express.Multer.File, @CurrentUser() by: AuthUser) {
    return this.svc.importar(file, by);
  }

  @Get('export.xlsx')
  async exportar(@Res() res: Response) {
    const buf = await this.svc.exportar();
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Gesetec_marketing_${fecha}.xlsx"`);
    res.send(Buffer.from(buf));
  }
}

@Module({ controllers: [MarketingController], providers: [MarketingService] })
export class MarketingModule {}
