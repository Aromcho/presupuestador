import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Database, InjectDb } from '../db/db.module';
import { settings } from '../db/schema';

export interface Empresa {
  nombre: string;
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  direccion: string;
  localidad: string;
  telefono: string;
  whatsapp: string;
  email: string;
  web: string;
  instagram: string;
  zonas: string[];
  marcas: string[];
}

export interface AjustesPresupuestos {
  proximoNumero: number;
  validezHoras: number;
  formaPago: string;
  /** Redondeo de los precios en pesos (1, 100 o 1000; -1 = hacia arriba a números redondos, en los precios en dólares) */
  redondeo: number;
  pie: string;
}

export const EMPRESA_DEFAULT: Empresa = {
  nombre: 'Gesetec Calderas',
  razonSocial: '',
  cuit: '',
  condicionIva: '',
  direccion: 'Av. Buenos Aires 737',
  localidad: 'Villa Gesell',
  telefono: '2255 48-5539',
  whatsapp: '5492255485539',
  email: '',
  web: 'gesetecalderas.com',
  instagram: 'gesetec.calderas',
  zonas: ['Villa Gesell', 'Cariló', 'Pinamar', 'Costa Esmeralda', 'Mar de las Pampas'],
  marcas: ['Peisa', 'Baxi', 'Tameco', 'Bowman', 'Ferroli', 'Euterma', 'Rinnai', 'Rowa'],
};

export const PRESUPUESTOS_DEFAULT: AjustesPresupuestos = {
  proximoNumero: 1,
  validezHoras: 48,
  formaPago: 'Contado: efectivo o transferencia.',
  redondeo: 100,
  pie: 'Servicio técnico oficial',
};

@Injectable()
export class CompanyService {
  constructor(@InjectDb() private readonly db: Database) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.query.settings.findFirst({ where: eq(settings.key, key) });
    return { ...fallback, ...((row?.value as Partial<T>) ?? {}) };
  }

  async set<T extends object>(key: string, value: Partial<T>, fallback: T): Promise<T> {
    const next = { ...(await this.get<T>(key, fallback)), ...value };
    await this.db
      .insert(settings)
      .values({ key, value: next })
      .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: sql`now()` } });
    return next;
  }

  empresa() {
    return this.get('empresa', EMPRESA_DEFAULT);
  }

  presupuestos() {
    return this.get('presupuestos', PRESUPUESTOS_DEFAULT);
  }
}
