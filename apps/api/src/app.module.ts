import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { PgExceptionFilter } from './common/filters/pg-exception.filter';
import { CompanyModule } from './company/company.module';
import { DbModule } from './db/db.module';
import { ExcelModule } from './excel/excel.module';
import { ExchangeModule } from './exchange/exchange.module';
import { HealthController } from './health.controller';
import { MediaModule } from './media/media.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 240 }]),
    DbModule,
    ActivityModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    MediaModule,
    ExchangeModule,
    CatalogModule,
    ExcelModule,
    TemplatesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: PgExceptionFilter },
  ],
})
export class AppModule {}
