import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnvironmentVariables } from '../../config/environment.schema';

@Injectable()
export class AuthConfigService {
  readonly sessionCookieName: string;
  readonly sessionIdleTtlMs: number;
  readonly sessionAbsoluteTtlMs: number;
  readonly csrfHmacSecret: string;
  readonly rateLimitHmacSecret: string;
  readonly allowedOrigins: string[];
  readonly loginRateLimitMax: number;
  readonly loginRateLimitWindowMs: number;
  readonly isProduction: boolean;

  constructor(configService: ConfigService<AppEnvironmentVariables, true>) {
    this.isProduction = configService.get('NODE_ENV', { infer: true }) === 'production';
    this.sessionCookieName =
      configService.get('SESSION_COOKIE_NAME', { infer: true }) ?? 'library-session';
    this.sessionIdleTtlMs = Number(
      configService.get('SESSION_IDLE_TTL_MS', { infer: true }) ?? 30 * 60 * 1000,
    );
    this.sessionAbsoluteTtlMs = Number(
      configService.get('SESSION_ABSOLUTE_TTL_MS', { infer: true }) ?? 12 * 60 * 60 * 1000,
    );
    this.csrfHmacSecret =
      configService.get('CSRF_HMAC_SECRET', { infer: true }) ?? 'local-dev-csrf-secret';
    this.rateLimitHmacSecret =
      configService.get('RATE_LIMIT_HMAC_SECRET', { infer: true }) ?? 'local-dev-rate-limit-secret';
    this.loginRateLimitMax = Number(
      configService.get('LOGIN_RATE_LIMIT_MAX', { infer: true }) ?? 5,
    );
    this.loginRateLimitWindowMs = Number(
      configService.get('LOGIN_RATE_LIMIT_WINDOW_MS', { infer: true }) ?? 15 * 60 * 1000,
    );

    const originsRaw =
      configService.get('ALLOWED_ORIGINS', { infer: true }) ?? 'http://127.0.0.1:3000';
    this.allowedOrigins = originsRaw
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
}
