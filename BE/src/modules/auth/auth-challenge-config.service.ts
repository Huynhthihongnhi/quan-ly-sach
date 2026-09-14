import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnvironmentVariables } from '../../config/environment.schema';
import type { ChallengePurpose } from '../challenge/challenge.types';

@Injectable()
export class AuthChallengeConfigService {
  readonly appPublicOrigin: string;
  readonly resetPasswordTtlMs: number;
  readonly activationTtlMs: number;
  readonly forgotRateLimitMax: number;
  readonly forgotRateLimitWindowMs: number;

  constructor(configService: ConfigService<AppEnvironmentVariables, true>) {
    this.appPublicOrigin =
      configService.get('APP_PUBLIC_ORIGIN', { infer: true }) ?? 'http://127.0.0.1:5173';
    this.resetPasswordTtlMs = Number(
      configService.get('RESET_PASSWORD_TTL_MS', { infer: true }) ?? 15 * 60 * 1000,
    );
    this.activationTtlMs = Number(
      configService.get('ACTIVATION_TTL_MS', { infer: true }) ?? 24 * 60 * 60 * 1000,
    );
    this.forgotRateLimitMax = Number(
      configService.get('FORGOT_RATE_LIMIT_MAX', { infer: true }) ?? 5,
    );
    this.forgotRateLimitWindowMs = Number(
      configService.get('FORGOT_RATE_LIMIT_WINDOW_MS', { infer: true }) ?? 15 * 60 * 1000,
    );
  }

  buildChallengeLink(purpose: ChallengePurpose, rawToken: string): string {
    const path = purpose === 'reset_password' ? '/reset-password' : '/activate';
    const origin = this.appPublicOrigin.replace(/\/$/, '');
    return `${origin}${path}?token=${encodeURIComponent(rawToken)}`;
  }

  ttlMsForPurpose(purpose: ChallengePurpose): number {
    return purpose === 'reset_password' ? this.resetPasswordTtlMs : this.activationTtlMs;
  }
}
