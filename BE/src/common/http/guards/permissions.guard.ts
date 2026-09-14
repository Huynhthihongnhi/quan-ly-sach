import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../api.exception';
import { IS_PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from '../constants/metadata-keys';
import { ErrorCode } from '../error-code';
import { RequestWithContext } from '../types/request-with-context';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const actorPermissions = new Set(request.actor?.permissionCodes ?? []);
    const allowed = requiredPermissions.every((permission) => actorPermissions.has(permission));

    if (!allowed) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'You do not have permission for this action.',
      );
    }

    return true;
  }
}
