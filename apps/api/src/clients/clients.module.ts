import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { and, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { SessionGuard } from '../common/guards/session.guard';
import { tokens } from '../common/utils/text';
import { Database, InjectDb } from '../db/db.module';
import { clients, quotes } from '../db/schema';

export class ClientDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(160) email?: string | null;
  @IsOptional() @IsString() @MaxLength(80) zone?: string | null;
  @IsOptional() @IsString() @MaxLength(200) address?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string | null;
}

class ClientQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

/** Solo dígitos, para comparar teléfonos escritos de distintas formas */
export const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');

@Injectable()
export class ClientsService {
  constructor(@InjectDb() private readonly db: Database) {}

  async list(q?: string) {
    const conds: (SQL | undefined)[] = [];
    if (q) {
      for (const t of tokens(q)) {
        const d = digits(t);
        conds.push(or(sql`translate(lower(${clients.name}), 'áéíóúüñ', 'aeiouun') like ${'%' + t + '%'}`, ilike(clients.zone, `%${t}%`), d.length >= 4 ? sql`regexp_replace(coalesce(${clients.phone}, ''), '\\D', '', 'g') like ${'%' + d + '%'}` : undefined));
      }
    }
    const rows = await this.db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        zone: clients.zone,
        address: clients.address,
        updatedAt: clients.updatedAt,
        quoteCount: sql<number>`(select count(*)::int from quotes q where q.client_id = "clients"."id")`,
        lastQuoteAt: sql<string | null>`(select max(q.created_at) from quotes q where q.client_id = "clients"."id")`,
      })
      .from(clients)
      .where(and(...conds.filter(Boolean)))
      .orderBy(desc(clients.updatedAt))
      .limit(60);
    return rows;
  }

  async byId(id: string) {
    const c = await this.db.query.clients.findFirst({ where: eq(clients.id, id) });
    if (!c) throw new NotFoundException('No encontramos ese cliente.');
    return c;
  }

  /**
   * Busca el cliente por id o por teléfono; si no existe lo crea. Si existe, actualiza los datos que vinieron.
   * Así no se duplican clientes cuando se arma un presupuesto nuevo para alguien que ya estaba.
   */
  async upsert(dto: ClientDto & { id?: string | null }) {
    const values = this.clean(dto);
    let found = dto.id ? await this.db.query.clients.findFirst({ where: eq(clients.id, dto.id) }) : undefined;
    const d = digits(values.phone);
    if (!found && d.length >= 6) {
      const [m] = await this.db
        .select()
        .from(clients)
        .where(sql`right(regexp_replace(coalesce(${clients.phone}, ''), '\\D', '', 'g'), 8) = ${d.slice(-8)}`)
        .limit(1);
      found = m;
    }
    if (found) {
      const [c] = await this.db.update(clients).set(values).where(eq(clients.id, found.id)).returning();
      return c;
    }
    const [c] = await this.db.insert(clients).values(values).returning();
    return c;
  }

  async update(id: string, dto: Partial<ClientDto>) {
    const [c] = await this.db.update(clients).set(this.clean(dto)).where(eq(clients.id, id)).returning();
    if (!c) throw new NotFoundException('No encontramos ese cliente.');
    return c;
  }

  async byIds(ids: string[]) {
    if (!ids.length) return [];
    return this.db.select().from(clients).where(inArray(clients.id, ids));
  }

  private clean<T extends Partial<ClientDto>>(dto: T) {
    const out: Record<string, unknown> = {};
    for (const k of ['name', 'phone', 'email', 'zone', 'address', 'notes'] as const) {
      if (dto[k] === undefined) continue;
      const v = typeof dto[k] === 'string' ? (dto[k] as string).trim() : dto[k];
      out[k] = v === '' ? null : v;
    }
    return out as Partial<typeof clients.$inferInsert> & { name: string; phone?: string | null };
  }
}

@ApiTags('clientes')
@Controller('clients')
@UseGuards(SessionGuard)
class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get() list(@Query() q: ClientQuery) {
    return this.svc.list(q.q);
  }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.byId(id);
  }
  @Post() create(@Body() dto: ClientDto) {
    return this.svc.upsert(dto);
  }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClientDto) {
    return this.svc.update(id, dto);
  }
}

@Module({ controllers: [ClientsController], providers: [ClientsService], exports: [ClientsService] })
export class ClientsModule {}
