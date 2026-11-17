import { Body, Controller, Get, HttpCode, Module, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import type { Response } from 'express';
import { CatalogModule } from '../catalog/catalog.module';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import type { ItemType } from '../db/schema';
import { ExcelService } from './excel.service';

const TYPES = ['EQUIPO', 'REPUESTO', 'MATERIAL', 'MANO_DE_OBRA', 'SERVICIO'];

class ImportDto {
  @IsUUID() priceListId: string;
  @IsOptional() @IsIn(TYPES) defaultType?: ItemType;
  @IsOptional() @IsString() sheet?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) headerRow?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) codeCol?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) nameCol?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) priceCol?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) typeCol?: number;
}

class ExportQuery {
  @IsOptional() @IsUUID() priceListId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsIn(TYPES) type?: ItemType;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('admin / excel')
@Controller('admin/excel')
@UseGuards(SessionGuard)
@Roles('ADMIN')
class ExcelController {
  constructor(private readonly excel: ExcelService) {}

  /** Sube una lista (xlsx o csv) y devuelve qué cambiaría, sin tocar nada */
  @Post('import/preview')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  preview(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportDto) {
    const { priceListId, defaultType, ...map } = dto;
    // 0 en una columna opcional = "no hay"
    const override = { ...map, codeCol: map.codeCol === 0 ? null : map.codeCol, typeCol: map.typeCol === 0 ? null : map.typeCol };
    return this.excel.preview(file, priceListId, defaultType ?? 'EQUIPO', override);
  }

  @Post('import/:id/confirm')
  @HttpCode(200)
  confirm(@Param('id') id: string, @CurrentUser() by: AuthUser) {
    return this.excel.confirm(id, by);
  }

  @Get('plantilla.xlsx')
  async template(@Res() res: Response) {
    const buf = await this.excel.template();
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', 'attachment; filename="Gesetec_plantilla_lista_de_precios.xlsx"');
    res.send(Buffer.from(buf));
  }

  @Get('export/catalogo.xlsx')
  async exportCatalog(@Query() q: ExportQuery, @Res() res: Response) {
    const buf = await this.excel.exportCatalog(q);
    const fecha = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="Gesetec_catalogo_${fecha}.xlsx"`);
    res.send(Buffer.from(buf));
  }
}

@Module({ imports: [CatalogModule], controllers: [ExcelController], providers: [ExcelService] })
export class ExcelModule {}
