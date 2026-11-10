import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS } from './permissions.guard.js';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
