import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../api.exception';
import { IS_SESSION_ROUTE } from '../decorators/session-route.decorator';
import { IS_PUBLIC_ROUTE, REQUIRED_PERMISSIONS } from '../constants/metadata-keys';
import { ErrorCode } from '../error-code';

@Injectable()
export class RoutePolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isSessionRoute = this.reflector.getAllAndOverride<boolean>(IS_SESSION_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || isSessionRoute || (permissions && permissions.length > 0)) {
      return true;
    }

    throw new ApiException(
      403,
      ErrorCode.MISSING_ROUTE_POLICY,
      'Route is missing public or permission policy metadata.',
    );
  }
}
