import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS } from '../constants/metadata-keys';

export const RequirePermissions = (...permissions: string[]): MethodDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);
