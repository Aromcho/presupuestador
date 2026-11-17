import { Injectable } from '@nestjs/common';
import { desc } from 'drizzle-orm';
import { Database, InjectDb } from '../db/db.module';
import { activity } from '../db/schema';

export interface LogEntry {
  userId?: string | null;
  action: 'crear' | 'editar' | 'borrar' | 'importar' | 'actualizar-precios' | 'dolar' | 'enviar';
  entity: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}

/** Registro de actividad: quién cambió qué (precios, catálogo, usuarios) */
@Injectable()
export class ActivityService {
  constructor(@InjectDb() private readonly db: Database) {}

  async log(e: LogEntry) {
    await this.db.insert(activity).values({
      userId: e.userId ?? null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? null,
      summary: e.summary,
      before: (e.before ?? null) as never,
      after: (e.after ?? null) as never,
    });
  }

  list(limit = 100) {
    return this.db.query.activity.findMany({ orderBy: desc(activity.createdAt), limit: Math.min(limit, 500) });
  }
}
