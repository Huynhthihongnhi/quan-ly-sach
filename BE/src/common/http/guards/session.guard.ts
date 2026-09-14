import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiException } from '../api.exception';
import { IS_PUBLIC_ROUTE } from '../constants/metadata-keys';
import { ErrorCode } from '../error-code';
import { RequestWithContext } from '../types/request-with-context';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.actor) {
      throw new ApiException(401, ErrorCode.AUTHENTICATION_REQUIRED, 'Authentication is required.');
    }

    return true;
  }
}
