import { Controller, Get, Global, Module, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { ActivityService } from './activity.service';

@ApiTags('admin / actividad')
@Controller('admin/activity')
@UseGuards(SessionGuard)
@Roles('ADMIN')
class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.activity.list(Number(limit) || 100);
  }
}

@Global()
@Module({ controllers: [ActivityController], providers: [ActivityService], exports: [ActivityService] })
export class ActivityModule {}
