import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnvironmentVariables } from '../../config/environment.schema';

@Injectable()
export class CirculationConfigService {
  readonly maxActiveLoans: number;
  readonly reservationTtlMs: number;
  readonly loanReauthMaxFailures: number;
  readonly loanReauthWindowMs: number;
  readonly maxCopyPickAttempts: number;

  constructor(configService: ConfigService<AppEnvironmentVariables, true>) {
    this.maxActiveLoans = Number(configService.get('MAX_ACTIVE_LOANS', { infer: true }) ?? 5);
    this.reservationTtlMs =
      Number(configService.get('RESERVATION_TTL_SECONDS', { infer: true }) ?? 24 * 60 * 60) * 1000;
    this.loanReauthMaxFailures = Number(
      configService.get('LOAN_REAUTH_MAX_FAILURES', { infer: true }) ?? 3,
    );
    this.loanReauthWindowMs = Number(
      configService.get('LOAN_REAUTH_WINDOW_MS', { infer: true }) ?? 15 * 60 * 1000,
    );
    this.maxCopyPickAttempts = 32;
  }
}
