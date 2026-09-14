import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { ApiException } from '../../../common/http/api.exception';
import { IS_PUBLIC_ROUTE } from '../../../common/http/constants/metadata-keys';
import { ErrorCode } from '../../../common/http/error-code';
import { RequestWithContext } from '../../../common/http/types/request-with-context';

const TEST_ACTOR_HEADER = 'x-contract-test-actor';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    if (process.env.CONTRACT_TEST_ACTOR === '1' && request.header(TEST_ACTOR_HEADER)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !request.sessionContext) {
      return true;
    }

    const provided = request.header('x-csrf-token');
    if (!provided) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'CSRF token is required.');
    }

    const expected = request.sessionContext.csrfToken;
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'CSRF token is invalid.');
    }

    return true;
  }
}
