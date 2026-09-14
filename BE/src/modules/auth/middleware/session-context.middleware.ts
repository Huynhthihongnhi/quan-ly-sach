import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithContext } from '../../../common/http/types/request-with-context';
import { AuthConfigService } from '../auth-config.service';
import { SessionResolverService } from '../session-resolver.service';

const TEST_ACTOR_HEADER = 'x-contract-test-actor';

@Injectable()
export class SessionContextMiddleware implements NestMiddleware {
  constructor(
    private readonly sessionResolver: SessionResolverService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async use(req: RequestWithContext, res: Response, next: NextFunction): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const rawToken = cookies?.[this.authConfig.sessionCookieName];
    if (typeof rawToken === 'string' && rawToken.length > 0) {
      const sessionToken = Buffer.from(rawToken, 'base64url');
      const resolved = await this.sessionResolver.resolveFromSessionToken(sessionToken);
      if (resolved) {
        req.actor = {
          userId: resolved.userId,
          permissionCodes: resolved.permissionCodes,
        };
        req.sessionContext = {
          sessionId: resolved.sessionId,
          csrfToken: resolved.csrfToken,
          sessionToken,
        };
        next();
        return;
      }
    }

    if (process.env.CONTRACT_TEST_ACTOR === '1') {
      req.actor = this.resolveContractTestActor(req);
    }

    next();
  }

  private resolveContractTestActor(req: RequestWithContext) {
    const raw = req.header(TEST_ACTOR_HEADER);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as { userId?: unknown; permissionCodes?: unknown };
      if (typeof parsed.userId !== 'string' || parsed.userId.length === 0) {
        return null;
      }

      const permissionCodes = Array.isArray(parsed.permissionCodes)
        ? parsed.permissionCodes.filter((value): value is string => typeof value === 'string')
        : [];

      return { userId: parsed.userId, permissionCodes };
    } catch {
      return null;
    }
  }
}
