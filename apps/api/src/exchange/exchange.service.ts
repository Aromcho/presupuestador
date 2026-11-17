import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq, like } from 'drizzle-orm';
import { ActivityService } from '../activity/activity.service';
import { CompanyService } from '../company/company.service';
import { Database, InjectDb } from '../db/db.module';
import { exchangeRates } from '../db/schema';

export interface DolarConfig {
  modo: 'auto' | 'manual';
  manual: number | null;
}
const DOLAR_DEFAULT: DolarConfig = { modo: 'auto', manual: null };

export interface Dolar {
  venta: number | null;
  compra: number | null;
  fecha: string | null;
  fuente: 'BNA oficial' | 'manual' | 'sin datos';
  modo: 'auto' | 'manual';
}

/**
 * Dólar oficial Banco Nación (venta). Se consulta cada hora en dolarapi.com y se guarda;
 * si la fuente falla, se usa el último valor guardado. Desde Administración se puede fijar a mano.
 */
@Injectable()
export class ExchangeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Dólar');
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly config: ConfigService,
    private readonly company: CompanyService,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const minutes = Number(this.config.get('DOLAR_REFRESH_MINUTES') ?? 60);
    void this.refresh().catch(() => undefined);
    this.timer = setInterval(() => void this.refresh().catch(() => undefined), Math.max(5, minutes) * 60_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Trae la cotización de la fuente y la guarda (solo si cambió o pasó más de una hora) */
  async refresh() {
    const url = this.config.get<string>('DOLAR_API_URL') ?? 'https://dolarapi.com/v1/dolares/oficial';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { compra?: number; venta?: number; fechaActualizacion?: string };
      const venta = Number(data.venta);
      if (!Number.isFinite(venta) || venta <= 0) throw new Error('respuesta sin valor de venta');
      const quotedAt = data.fechaActualizacion ? new Date(data.fechaActualizacion) : new Date();
      const last = await this.lastAuto();
      if (!last || last.sell !== venta || Date.now() - last.createdAt.getTime() > 60 * 60_000) {
        await this.db.insert(exchangeRates).values({ source: 'dolarapi:oficial', buy: Number(data.compra) || null, sell: venta, quotedAt });
      }
      return true;
    } catch (err) {
      this.logger.warn(`No se pudo actualizar el dólar (${(err as Error).message}). Queda el último valor guardado.`);
      return false;
    }
  }

  private lastAuto() {
    return this.db.query.exchangeRates.findFirst({ where: like(exchangeRates.source, 'dolarapi%'), orderBy: desc(exchangeRates.createdAt) });
  }

  async current(): Promise<Dolar> {
    const cfg = await this.company.get<DolarConfig>('dolar', DOLAR_DEFAULT);
    if (cfg.modo === 'manual' && cfg.manual) {
      const row = await this.db.query.exchangeRates.findFirst({ where: eq(exchangeRates.source, 'manual'), orderBy: desc(exchangeRates.createdAt) });
      return { venta: cfg.manual, compra: null, fecha: row?.createdAt.toISOString() ?? null, fuente: 'manual', modo: 'manual' };
    }
    const last = await this.lastAuto();
    return last
      ? { venta: last.sell, compra: last.buy, fecha: last.quotedAt.toISOString(), fuente: 'BNA oficial', modo: 'auto' }
      : { venta: null, compra: null, fecha: null, fuente: 'sin datos', modo: 'auto' };
  }

  history(limit = 20) {
    return this.db.query.exchangeRates.findMany({ orderBy: desc(exchangeRates.createdAt), limit });
  }

  async setManual(venta: number | null, userId: string) {
    if (venta) {
      await this.company.set<DolarConfig>('dolar', { modo: 'manual', manual: venta }, DOLAR_DEFAULT);
      await this.db.insert(exchangeRates).values({ source: 'manual', sell: venta, quotedAt: new Date() });
      await this.activity.log({ userId, action: 'dolar', entity: 'dolar', summary: `Fijó el dólar a mano en $${venta}` });
    } else {
      await this.company.set<DolarConfig>('dolar', { modo: 'auto', manual: null }, DOLAR_DEFAULT);
      await this.refresh();
      await this.activity.log({ userId, action: 'dolar', entity: 'dolar', summary: 'Volvió al dólar BNA automático' });
    }
    return this.current();
  }
}
