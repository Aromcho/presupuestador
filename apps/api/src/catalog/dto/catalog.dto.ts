import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import type { Currency, ItemType, PriceRule } from '../../db/schema';

const TYPES = ['EQUIPO', 'REPUESTO', 'MATERIAL', 'MANO_DE_OBRA', 'SERVICIO'];
const RULES = ['COSTO_MAS_MARGEN', 'LISTA_MENOS_DESCUENTO', 'PRECIO_FIJO'];

export class ItemQueryDto {
  @ApiPropertyOptional({ description: 'Busca por código, nombre o marca (sin acentos). Ej.: "peisa 24"' })
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(TYPES) type?: ItemType;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() priceListId?: string;
  @ApiPropertyOptional({ enum: ['true', 'false', 'all'] })
  @IsOptional() @IsIn(['true', 'false', 'all']) active?: 'true' | 'false' | 'all';
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

export class UpsertItemDto {
  @IsIn(TYPES) type: ItemType;
  @IsOptional() @IsString() @MaxLength(60) code?: string | null;
  @IsString() @MinLength(2, { message: 'Poné un nombre' }) @MaxLength(200) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() brandId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() priceListId?: string | null;
  @IsIn(['ARS', 'USD']) currency: Currency;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) listPrice: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(RULES) ruleOverride?: PriceRule | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsNumber() @Min(-100) @Max(1000) percentOverride?: number | null;
  @IsBoolean() ivaIncluded: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) ivaRate?: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class BulkPercentDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(500) percent: number;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsIn(TYPES) type?: ItemType;
  @IsOptional() @IsUUID() priceListId?: string;
  @IsOptional() @IsBoolean() preview?: boolean;
}

export class PriceListDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() brandId?: string | null;
  @IsIn(['ARS', 'USD']) currency: Currency;
  @IsIn(RULES) rule: PriceRule;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1000) percent: number;
  @IsBoolean() ivaIncluded: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) ivaRate?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class BrandDto {
  @IsString() @MinLength(2) @MaxLength(60) name: string;
}
