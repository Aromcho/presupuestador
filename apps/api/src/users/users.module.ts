import { BadRequestException, Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { asc, eq } from 'drizzle-orm';
import { ActivityService } from '../activity/activity.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { Database, InjectDb } from '../db/db.module';
import { Role, users } from '../db/schema';

class CreateUserDto {
  @IsEmail({}, { message: 'Revisá el email' }) email: string;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsIn(['ADMIN', 'VENTAS']) role: Role;
  @IsString() @MinLength(8, { message: 'La contraseña tiene que tener al menos 8 caracteres' }) password: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(['ADMIN', 'VENTAS']) role?: Role;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(8, { message: 'La contraseña tiene que tener al menos 8 caracteres' }) password?: string;
}

const PUBLIC = { id: users.id, email: users.email, name: users.name, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt };

@Injectable()
class UsersService {
  constructor(@InjectDb() private readonly db: Database, private readonly activity: ActivityService) {}

  list() {
    return this.db.select(PUBLIC).from(users).orderBy(asc(users.name));
  }

  async create(dto: CreateUserDto, by: AuthUser) {
    const [u] = await this.db
      .insert(users)
      .values({ email: dto.email.toLowerCase().trim(), name: dto.name.trim(), role: dto.role, passwordHash: await bcrypt.hash(dto.password, 12) })
      .returning(PUBLIC);
    await this.activity.log({ userId: by.id, action: 'crear', entity: 'usuario', entityId: u.id, summary: `Creó el usuario ${u.name} (${u.role})` });
    return u;
  }

  async update(id: string, dto: UpdateUserDto, by: AuthUser) {
    if (id === by.id && (dto.active === false || dto.role === 'VENTAS')) {
      throw new BadRequestException('No podés quitarte el acceso de administrador a vos mismo.');
    }
    const { password, ...rest } = dto;
    const [u] = await this.db
      .update(users)
      .set({ ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) })
      .where(eq(users.id, id))
      .returning(PUBLIC);
    if (!u) throw new BadRequestException('No encontramos ese usuario.');
    await this.activity.log({ userId: by.id, action: 'editar', entity: 'usuario', entityId: id, summary: `Editó el usuario ${u.name}${password ? ' (nueva contraseña)' : ''}` });
    return u;
  }
}

@ApiTags('admin / usuarios')
@Controller('admin/users')
@UseGuards(SessionGuard)
@Roles('ADMIN')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list() {
    return this.users.list();
  }
  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() by: AuthUser) {
    return this.users.create(dto, by);
  }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() by: AuthUser) {
    return this.users.update(id, dto, by);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
