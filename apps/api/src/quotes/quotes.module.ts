import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientsModule } from '../clients/clients.module';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { CatalogModule } from '../catalog/catalog.module';
import { PdfService } from './pdf.service';
import { QuoteQuery, SaveQuoteDto, StatusDto } from './quotes.dto';
import { QuoteDetail, QuotesService } from './quotes.service';

function sendPdf(res: Response, pdf: Buffer, q: QuoteDetail, download: boolean) {
  const name = `Presupuesto-${q.numberLabel}-Gesetec.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(pdf);
}

@ApiTags('presupuestos')
@Controller('quotes')
@UseGuards(SessionGuard)
class QuotesController {
  constructor(
    private readonly svc: QuotesService,
    private readonly pdf: PdfService,
  ) {}

  @Get() list(@Query() q: QuoteQuery) {
    return this.svc.list(q);
  }
  @Get('stats') stats() {
    return this.svc.stats();
  }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.detail(id);
  }
  @Get(':id/pdf') async file(@Param('id', ParseUUIDPipe) id: string, @Query('descargar') descargar: string | undefined, @Res() res: Response) {
    const q = await this.svc.detail(id);
    sendPdf(res, await this.pdf.render(q), q, descargar === '1');
  }
  @Post() create(@Body() dto: SaveQuoteDto, @CurrentUser() by: AuthUser) {
    return this.svc.create(dto, by);
  }
  @Put(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveQuoteDto, @CurrentUser() by: AuthUser) {
    return this.svc.update(id, dto, by);
  }
  @Patch(':id/status') status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto, @CurrentUser() by: AuthUser) {
    return this.svc.setStatus(id, dto.status, by);
  }
  @Post(':id/duplicate') duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() by: AuthUser) {
    return this.svc.duplicate(id, by);
  }
  @Post(':id/reprice') @HttpCode(200) reprice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() by: AuthUser) {
    return this.svc.reprice(id, by);
  }
  @Post(':id/send') @HttpCode(200) send(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() by: AuthUser) {
    return this.svc.send(id, by);
  }
  @Delete(':id') remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() by: AuthUser) {
    return this.svc.remove(id, by);
  }
}

/** Link público que recibe el cliente por WhatsApp: abre el PDF sin login */
@ApiTags('presupuestos')
@Controller('p')
class PublicQuoteController {
  constructor(
    private readonly svc: QuotesService,
    private readonly pdf: PdfService,
  ) {}

  @Get(':token') async file(@Param('token') token: string, @Query('descargar') descargar: string | undefined, @Res() res: Response) {
    const q = await this.svc.byToken(token.replace(/\.pdf$/i, '').slice(0, 64));
    sendPdf(res, await this.pdf.render(q), q, descargar === '1');
  }
}

@Module({
  imports: [ClientsModule, CatalogModule],
  controllers: [QuotesController, PublicQuoteController],
  providers: [QuotesService, PdfService],
  exports: [QuotesService],
})
export class QuotesModule {}
