import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { Database, InjectDb } from '../../db/db.module';
import { Role, users } from '../../db/schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

export const SESSION_COOKIE = 'gc_session';

/**
 * Valida la sesión (cookie httpOnly o Bearer) y, si el endpoint usa @Roles, el rol.
 * Lee el usuario de la base en cada pedido: si lo desactivan, la sesión deja de servir al instante.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = req.headers.authorization;
    const token = req.cookies?.[SESSION_COOKIE] ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException('Tu sesión venció. Volvé a ingresar.');

    let sub: string;
    try {
      ({ sub } = await this.jwt.verifyAsync<{ sub: string }>(token));
    } catch {
      throw new UnauthorizedException('Tu sesión venció. Volvé a ingresar.');
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, sub) });
    if (!user || !user.active) throw new UnauthorizedException('Tu usuario no está activo.');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('No tenés permisos para esta acción.');

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    return true;
  }
}
