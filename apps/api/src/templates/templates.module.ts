import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { asc, eq } from 'drizzle-orm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { slugify } from '../common/utils/text';
import { Database, InjectDb } from '../db/db.module';
import { NoteRule, notes, QuoteMode, templateItems, templates } from '../db/schema';

const ICONS = ['instalacion', 'caldera_pie', 'piscina', 'radiador', 'mantenimiento', 'temporada', 'columnas', 'llave'];

class TemplateItemDto {
  @IsUUID() itemId: string;
  @Type(() => Number) @IsNumber() @Min(0.01) qty: number;
}

class TemplateDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MinLength(2) @MaxLength(160) title: string;
  @IsOptional() @IsIn(ICONS) icon?: string;
  @IsOptional() @IsIn(['SUMA', 'COMPARATIVA']) mode?: QuoteMode;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true }) seIncluye?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => TemplateItemDto) items?: TemplateItemDto[];
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class NoteDto {
  @IsString() @MinLength(3) @MaxLength(240) text: string;
  @IsIn(['SIEMPRE', 'SI_PRODUCTOS', 'SI_MANO_DE_OBRA', 'SI_SIN_INSTALACION', 'SI_SERVICIO', 'MANUAL']) rule: NoteRule;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
class TemplatesService {
  constructor(@InjectDb() private readonly db: Database, private readonly activity: ActivityService) {}

  list() {
    return this.db.query.templates.findMany({
      orderBy: [asc(templates.sortOrder), asc(templates.name)],
      with: { items: { orderBy: asc(templateItems.sortOrder), with: { item: { columns: { id: true, name: true, code: true, type: true } } } } },
    });
  }

  async create(dto: TemplateDto, by: AuthUser) {
    const { items: its, ...rest } = dto;
    const [t] = await this.db.insert(templates).values({ ...rest, slug: `${slugify(dto.name)}-${Date.now().toString(36)}` }).returning();
    if (its?.length) await this.db.insert(templateItems).values(its.map((i, n) => ({ templateId: t.id, itemId: i.itemId, qty: i.qty, sortOrder: n })));
    await this.activity.log({ userId: by.id, action: 'crear', entity: 'plantilla', entityId: t.id, summary: `Creó la plantilla "${t.name}"` });
    return t;
  }

  async update(id: string, dto: Partial<TemplateDto>, by: AuthUser) {
    const { items: its, ...rest } = dto;
    const [t] = await this.db.update(templates).set(rest).where(eq(templates.id, id)).returning();
    if (!t) throw new NotFoundException('No encontramos esa plantilla.');
    if (its) {
      await this.db.delete(templateItems).where(eq(templateItems.templateId, id));
      if (its.length) await this.db.insert(templateItems).values(its.map((i, n) => ({ templateId: id, itemId: i.itemId, qty: i.qty, sortOrder: n })));
    }
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'plantilla', entityId: id, summary: `Editó la plantilla "${t.name}"` });
    return t;
  }

  listNotes() {
    return this.db.select().from(notes).orderBy(asc(notes.sortOrder), asc(notes.createdAt));
  }

  async createNote(dto: NoteDto) {
    const [n] = await this.db.insert(notes).values(dto).returning();
    return n;
  }

  async updateNote(id: string, dto: Partial<NoteDto>) {
    const [n] = await this.db.update(notes).set(dto).where(eq(notes.id, id)).returning();
    if (!n) throw new NotFoundException('No encontramos esa nota.');
    return n;
  }

  async removeNote(id: string) {
    await this.db.delete(notes).where(eq(notes.id, id));
    return { ok: true };
  }
}

@ApiTags('plantillas y notas')
@Controller()
@UseGuards(SessionGuard)
class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Get('templates') list() {
    return this.svc.list();
  }
  @Get('notes') notes() {
    return this.svc.listNotes();
  }

  @Post('admin/templates') @Roles('ADMIN') create(@Body() dto: TemplateDto, @CurrentUser() by: AuthUser) {
    return this.svc.create(dto, by);
  }
  @Patch('admin/templates/:id') @Roles('ADMIN') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateDto, @CurrentUser() by: AuthUser) {
    return this.svc.update(id, dto, by);
  }
  @Post('admin/notes') @Roles('ADMIN') createNote(@Body() dto: NoteDto) {
    return this.svc.createNote(dto);
  }
  @Patch('admin/notes/:id') @Roles('ADMIN') updateNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NoteDto) {
    return this.svc.updateNote(id, dto);
  }
  @Delete('admin/notes/:id') @Roles('ADMIN') removeNote(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.removeNote(id);
  }
}

@Module({ controllers: [TemplatesController], providers: [TemplatesService] })
export class TemplatesModule {}
