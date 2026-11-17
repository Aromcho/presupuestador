import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../db/schema';

export const ROLES_KEY = 'roles';
/** Restringe un controller o endpoint a ciertos roles: @Roles('ADMIN') */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
