import { Body, Controller, Get, Global, HttpCode, Module, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { ExchangeService } from './exchange.service';

class ManualDto {
  /** Vacío o null: vuelve al automático */
  @IsOptional() @IsNumber() @Min(1) @Max(1_000_000) venta?: number | null;
}

@ApiTags('dólar')
@Controller()
@UseGuards(SessionGuard)
class ExchangeController {
  constructor(private readonly exchange: ExchangeService) {}

  @Get('exchange')
  current() {
    return this.exchange.current();
  }

  @Get('admin/exchange/history')
  @Roles('ADMIN')
  history() {
    return this.exchange.history();
  }

  @Post('admin/exchange/refresh')
  @Roles('ADMIN')
  @HttpCode(200)
  async refresh() {
    const ok = await this.exchange.refresh();
    return { ok, dolar: await this.exchange.current() };
  }

  @Post('admin/exchange/manual')
  @Roles('ADMIN')
  @HttpCode(200)
  manual(@Body() dto: ManualDto, @CurrentUser() by: AuthUser) {
    return this.exchange.setManual(dto.venta ?? null, by.id);
  }
}

@Global()
@Module({ controllers: [ExchangeController], providers: [ExchangeService], exports: [ExchangeService] })
export class ExchangeModule {}
