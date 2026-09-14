import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/http/api.exception';
import { ErrorCode } from '../../../common/http/error-code';
import { RequestWithContext } from '../../../common/http/types/request-with-context';
import { AuthConfigService } from '../auth-config.service';

const LIBRARY_WEB_HEADER = 'library-web';
const TEST_ACTOR_HEADER = 'x-contract-test-actor';

@Injectable()
export class MutationOriginGuard implements CanActivate {
  constructor(private readonly authConfig: AuthConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    if (process.env.CONTRACT_TEST_ACTOR === '1' && request.header(TEST_ACTOR_HEADER)) {
      return true;
    }

    const origin = request.header('origin');
    const requestedWith = request.header('x-requested-with');
    if (requestedWith !== LIBRARY_WEB_HEADER) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'Origin verification failed.');
    }

    if (!origin || !this.authConfig.allowedOrigins.includes(origin)) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'Origin verification failed.');
    }

    return true;
  }
}
