import { ConfigurationError } from './app-config.service';

// Fail closed: any NODE_ENV other than the known-safe 'development'/'test' values is treated as
// a real deployment that must not run with development-only fallback secrets, matching the
// allowlist approach already used for the CONTRACT_TEST_ACTOR gate in app-config.service.ts.
export function isProductionEnvironment(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'development' && nodeEnv !== 'test';
}

export function requireProductionSecret(params: {
  key: string;
  isProduction: boolean;
  usedFallback: boolean;
}): void {
  if (params.isProduction && params.usedFallback) {
    throw new ConfigurationError(
      `${params.key} must be set explicitly when NODE_ENV=production: refusing the built-in development fallback.`,
    );
  }
}
