import { Controller, Get, Injectable, Module, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { and, asc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import { Database, InjectDb } from '../db/db.module';
import { clients, marketingPosts, quotes } from '../db/schema';
import { InternalGuard } from './internal.guard';
import { UpcomingItem, baDay, baLocal, bump, emptySeries, parseLimit, parseRange, sortUpcoming, today, totalsOf } from './internal.util';

/**
 * Módulo /internal del panel de Gesetec (panel central). Solo lectura.
 * Contrato: GET /api/internal/health · /api/internal/metrics?desde=&hasta= · /api/internal/upcoming?limite=
 * Contrato completo y cómo sumar un proyecto: README del repo panel-dios.
 */
const SERVICE = 'gesetec';
const { version } = require('../../package.json') as { version: string };

/** Contadores de la serie diaria */
const COUNTERS = ['presupuestos', 'enviados', 'aceptados', 'clientes', 'planificadas', 'publicadas'] as const;
/** Qué contadores propios alimentan cada contador común del panel */
const COMMON = { publicaciones: ['publicadas'], consultas: ['presupuestos'], ventas: ['aceptados'], visitas: [] };
const HHMM = /^\d{2}:\d{2}$/;

@Injectable()
class InternalService {
  constructor(@InjectDb() private readonly db: Database) {}

  async health() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch {
      db = 'down';
    }
    return { ok: db === 'up', service: SERVICE, version, uptime: Math.round(process.uptime()), db, now: new Date().toISOString() };
  }

  async metrics(query: Record<string, unknown>) {
    const range = parseRange(query);
    const [creados, enviados, aceptados, clientes, piezas, atrasadas] = await Promise.all([
      this.db
        .select({ createdAt: quotes.createdAt, status: quotes.status })
        .from(quotes)
        .where(and(gte(quotes.createdAt, range.from), lt(quotes.createdAt, range.to))),
      this.db
        .select({ sentAt: quotes.sentAt })
        .from(quotes)
        .where(and(gte(quotes.sentAt, range.from), lt(quotes.sentAt, range.to))),
      // No hay fecha de aceptación: se toma la última modificación del presupuesto aceptado
      this.db
        .select({ updatedAt: quotes.updatedAt })
        .from(quotes)
        .where(and(eq(quotes.status, 'ACEPTADO'), gte(quotes.updatedAt, range.from), lt(quotes.updatedAt, range.to))),
      this.db
        .select({ createdAt: clients.createdAt })
        .from(clients)
        .where(and(gte(clients.createdAt, range.from), lt(clients.createdAt, range.to))),
      // marketing_posts.date es texto YYYY-MM-DD: el rango se compara como texto
      this.db
        .select({ date: marketingPosts.date, status: marketingPosts.status })
        .from(marketingPosts)
        .where(and(gte(marketingPosts.date, range.desde), lt(marketingPosts.date, range.hastaNext))),
      this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(marketingPosts)
        .where(and(lt(marketingPosts.date, today()), ne(marketingPosts.status, 'publicado'))),
    ]);

    const series = emptySeries(range, COUNTERS);
    const presupuestosPorEstado: Record<string, number> = {};
    for (const q of creados) {
      bump(series, baDay(q.createdAt), 'presupuestos');
      presupuestosPorEstado[q.status] = (presupuestosPorEstado[q.status] ?? 0) + 1;
    }
    enviados.forEach((q) => q.sentAt && bump(series, baDay(q.sentAt), 'enviados'));
    aceptados.forEach((q) => bump(series, baDay(q.updatedAt), 'aceptados'));
    clientes.forEach((c) => bump(series, baDay(c.createdAt), 'clientes'));
    const publicacionesPorEstado: Record<string, number> = {};
    for (const p of piezas) {
      const day = p.date.slice(0, 10);
      bump(series, day, 'planificadas');
      if (p.status === 'publicado') bump(series, day, 'publicadas');
      publicacionesPorEstado[p.status] = (publicacionesPorEstado[p.status] ?? 0) + 1;
    }

    return {
      service: SERVICE,
      desde: range.desde,
      hasta: range.hasta,
      totals: { ...totalsOf(series, COUNTERS), presupuestosPorEstado, publicacionesPorEstado, publicacionesAtrasadas: atrasadas[0]?.n ?? 0 },
      common: COMMON,
      series: [...series.values()],
      byProperty: [],
    };
  }

  async upcoming(query: Record<string, unknown>) {
    const limite = parseLimit(query);
    const hoy = today();
    const sinPublicar = ne(marketingPosts.status, 'publicado');
    const [proximas, atrasadas, vigentes] = await Promise.all([
      this.db
        .select()
        .from(marketingPosts)
        .where(and(gte(marketingPosts.date, hoy), sinPublicar))
        .orderBy(asc(marketingPosts.date), asc(marketingPosts.sortOrder))
        .limit(limite),
      this.db
        .select()
        .from(marketingPosts)
        .where(and(lt(marketingPosts.date, hoy), sinPublicar))
        .orderBy(asc(marketingPosts.date), asc(marketingPosts.sortOrder))
        .limit(limite),
      // Presupuestos enviados que todavía están dentro de su validez: cuándo vencen
      this.db
        .select({ id: quotes.id, number: quotes.number, title: quotes.title, sentAt: quotes.sentAt, validityHours: quotes.validityHours, client: clients.name })
        .from(quotes)
        .leftJoin(clients, eq(quotes.clientId, clients.id))
        .where(and(eq(quotes.status, 'ENVIADO'), sql`${quotes.sentAt} + make_interval(hours => ${quotes.validityHours}) >= now()`))
        .limit(limite),
    ]);

    const pieza = (p: typeof marketingPosts.$inferSelect, pending: boolean): UpcomingItem => {
      const titulo = p.data.hookVoice || p.data.series || p.data.goal || p.code;
      return {
        kind: pending ? 'publicacion_atrasada' : 'publicacion',
        title: p.data.format ? `${p.data.format}: ${titulo}` : titulo,
        date: !pending && HHMM.test(p.data.time ?? '') ? `${p.date}T${p.data.time}` : p.date,
        pending,
        who: '',
        status: p.status,
        propertyId: null,
        ref: p.code,
      };
    };

    const items: UpcomingItem[] = [
      ...proximas.map((p) => pieza(p, false)),
      ...vigentes
        .filter((q) => q.sentAt)
        .map((q) => ({
          kind: 'presupuesto_vence',
          title: `Presupuesto #${q.number}${q.client ? `, ${q.client}` : ''}`,
          date: baLocal(q.sentAt!.getTime() + q.validityHours * 3_600_000),
          pending: false,
          who: '',
          status: 'ENVIADO',
          propertyId: null,
          ref: q.id,
        })),
    ];

    return {
      service: SERVICE,
      generatedAt: new Date().toISOString(),
      items: [...sortUpcoming(items).slice(0, limite), ...atrasadas.map((p) => pieza(p, true))],
    };
  }
}

@ApiExcludeController()
@SkipThrottle()
@Controller('internal')
@UseGuards(InternalGuard)
class InternalController {
  constructor(private readonly internal: InternalService) {}

  @Get('health')
  health() {
    return this.internal.health();
  }

  @Get('metrics')
  metrics(@Query() query: Record<string, unknown>) {
    return this.internal.metrics(query);
  }

  @Get('upcoming')
  upcoming(@Query() query: Record<string, unknown>) {
    return this.internal.upcoming(query);
  }
}

@Module({ controllers: [InternalController], providers: [InternalService, InternalGuard] })
export class InternalModule {}
