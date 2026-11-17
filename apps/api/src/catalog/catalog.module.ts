import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { CatalogService } from './catalog.service';
import { BrandDto, BulkPercentDto, ItemQueryDto, PriceListDto, UpsertItemDto } from './dto/catalog.dto';

/** Catálogo para armar presupuestos (cualquier usuario) */
@ApiTags('catálogo')
@Controller()
@UseGuards(SessionGuard)
class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('items')
  list(@Query() q: ItemQueryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.list(q, user);
  }

  @Get('items/stats')
  stats() {
    return this.catalog.stats();
  }

  @Get('items/:id')
  byId(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.byId(id, user);
  }

  @Get('brands')
  brands() {
    return this.catalog.listBrands();
  }
}

/** Gestión del catálogo, marcas y listas (solo administrador) */
@ApiTags('admin / catálogo')
@Controller('admin')
@UseGuards(SessionGuard)
@Roles('ADMIN')
class CatalogAdminController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('items')
  create(@Body() dto: UpsertItemDto, @CurrentUser() by: AuthUser) {
    return this.catalog.create(dto, by);
  }

  @Patch('items/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertItemDto, @CurrentUser() by: AuthUser) {
    return this.catalog.update(id, dto, by);
  }

  @Delete('items/:id')
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() by: AuthUser) {
    return this.catalog.archive(id, by);
  }

  @Post('items/:id/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  photo(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() by: AuthUser) {
    return this.catalog.setPhoto(id, file, by);
  }

  @Post('items/bulk-percent')
  bulk(@Body() dto: BulkPercentDto, @CurrentUser() by: AuthUser) {
    return this.catalog.bulkPercent(dto, by);
  }

  @Post('brands')
  createBrand(@Body() dto: BrandDto) {
    return this.catalog.createBrand(dto.name);
  }

  @Get('price-lists')
  priceLists() {
    return this.catalog.listPriceLists();
  }

  @Post('price-lists')
  createPriceList(@Body() dto: PriceListDto, @CurrentUser() by: AuthUser) {
    return this.catalog.createPriceList(dto, by);
  }

  @Patch('price-lists/:id')
  updatePriceList(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PriceListDto, @CurrentUser() by: AuthUser) {
    return this.catalog.updatePriceList(id, dto, by);
  }
}

@Module({ controllers: [CatalogController, CatalogAdminController], providers: [CatalogService], exports: [CatalogService] })
export class CatalogModule {}
