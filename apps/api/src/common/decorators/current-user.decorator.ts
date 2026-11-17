import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../../db/schema';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Usuario de la sesión: @CurrentUser() user: AuthUser */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
