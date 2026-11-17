import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ItemType, QuoteMode, QuoteStatus } from '../db/schema';

const TYPES: ItemType[] = ['EQUIPO', 'REPUESTO', 'MATERIAL', 'MANO_DE_OBRA', 'SERVICIO'];
export const STATUSES: QuoteStatus[] = ['BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO'];

export class QuoteClientDto {
  @IsOptional() @IsUUID() id?: string | null;
  @IsString() @MinLength(2, { message: 'Poné el nombre del cliente.' }) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(160) email?: string | null;
  @IsOptional() @IsString() @MaxLength(80) zone?: string | null;
  @IsOptional() @IsString() @MaxLength(200) address?: string | null;
}

export class QuoteLineDto {
  @IsOptional() @IsUUID() itemId?: string | null;
  @IsIn(TYPES) type: ItemType;
  @IsOptional() @IsString() @MaxLength(80) code?: string | null;
  @IsString() @MinLength(1, { message: 'Cada ítem necesita un nombre.' }) @MaxLength(240) name: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string | null;
  @Type(() => Number) @IsInt({ message: 'Los precios van en pesos, sin centavos.' }) @Min(0) @Max(2_000_000_000) unitPrice: number;
  @Type(() => Number) @IsNumber() @Min(0.01) @Max(100_000) qty: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) discountPct?: number;
  @IsOptional() @IsBoolean() ivaIncluded?: boolean;
}

export class QuoteGroupDto {
  @IsString() @MaxLength(60) label: string;
  @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => QuoteLineDto) items: QuoteLineDto[];
}

export class SaveQuoteDto {
  @ValidateNested() @Type(() => QuoteClientDto) client: QuoteClientDto;
  @IsOptional() @IsUUID() templateId?: string | null;
  @IsString() @MinLength(2, { message: 'Poné un título al presupuesto.' }) @MaxLength(160) title: string;
  @IsIn(['SUMA', 'COMPARATIVA']) mode: QuoteMode;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => QuoteGroupDto) groups: QuoteGroupDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) seIncluye?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(300, { each: true }) notes?: string[];
  @IsOptional() @IsString() @MaxLength(2000) observations?: string | null;
  @IsOptional() @IsString() @MaxLength(200) paymentTerms?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24 * 90) validityHours?: number;
}

export class StatusDto {
  @IsIn(STATUSES) status: QuoteStatus;
}

export class QuoteQuery {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn([...STATUSES, 'SEGUIR']) status?: QuoteStatus | 'SEGUIR';
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}
