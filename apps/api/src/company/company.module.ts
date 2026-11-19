import { Body, Controller, Get, Global, Module, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { AjustesPresupuestos, CompanyService, Empresa, EMPRESA_DEFAULT, PRESUPUESTOS_DEFAULT } from './company.service';

class EmpresaDto {
  @IsOptional() @IsString() @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(160) razonSocial?: string;
  @IsOptional() @IsString() @MaxLength(20) cuit?: string;
  @IsOptional() @IsString() @MaxLength(60) condicionIva?: string;
  @IsOptional() @IsString() @MaxLength(160) direccion?: string;
  @IsOptional() @IsString() @MaxLength(80) localidad?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) web?: string;
  @IsOptional() @IsString() @MaxLength(60) instagram?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) zonas?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) marcas?: string[];
}

class PresupuestosDto {
  @IsOptional() @IsInt() @Min(1) proximoNumero?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24 * 60) validezHoras?: number;
  @IsOptional() @IsString() @MaxLength(200) formaPago?: string;
  @IsOptional() @IsIn([1, 10, 100, 1000, -1]) redondeo?: number;
  @IsOptional() @IsString() @MaxLength(200) pie?: string;
}

class AjustesDto {
  @IsOptional() @ValidateNested() @Type(() => EmpresaDto) empresa?: EmpresaDto;
  @IsOptional() @ValidateNested() @Type(() => PresupuestosDto) presupuestos?: PresupuestosDto;
}

@ApiTags('empresa')
@Controller()
@UseGuards(SessionGuard)
class CompanyController {
  constructor(private readonly company: CompanyService, private readonly activity: ActivityService) {}

  @Get('company')
  async get() {
    const [empresa, presupuestos] = await Promise.all([this.company.empresa(), this.company.presupuestos()]);
    return { empresa, presupuestos };
  }

  @Patch('admin/company')
  @Roles('ADMIN')
  async update(@Body() dto: AjustesDto, @CurrentUser() by: AuthUser) {
    const empresa = dto.empresa ? await this.company.set<Empresa>('empresa', dto.empresa, EMPRESA_DEFAULT) : await this.company.empresa();
    const presupuestos = dto.presupuestos
      ? await this.company.set<AjustesPresupuestos>('presupuestos', dto.presupuestos, PRESUPUESTOS_DEFAULT)
      : await this.company.presupuestos();
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'empresa', summary: 'Editó los datos de la empresa' });
    return { empresa, presupuestos };
  }
}

@Global()
@Module({ controllers: [CompanyController], providers: [CompanyService], exports: [CompanyService] })
export class CompanyModule {}
