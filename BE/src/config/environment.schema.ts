export interface AppEnvironmentVariables {
  PORT: number;
  NODE_ENV: string;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_IDLE_TTL_MS?: number;
  SESSION_ABSOLUTE_TTL_MS?: number;
  CSRF_HMAC_SECRET?: string;
  RATE_LIMIT_HMAC_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  LOGIN_RATE_LIMIT_MAX?: number;
  LOGIN_RATE_LIMIT_WINDOW_MS?: number;
  APP_PUBLIC_ORIGIN?: string;
  RESET_PASSWORD_TTL_MS?: number;
  ACTIVATION_TTL_MS?: number;
  FORGOT_RATE_LIMIT_MAX?: number;
  FORGOT_RATE_LIMIT_WINDOW_MS?: number;
  MAX_ACTIVE_LOANS?: number;
  RESERVATION_TTL_SECONDS?: number;
  LOAN_REAUTH_MAX_FAILURES?: number;
  LOAN_REAUTH_WINDOW_MS?: number;
}
