import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppConfigService, EnvironmentValidationDto } from './app-config.service';

function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const normalized = {
    PORT: config.PORT ?? '3000',
    NODE_ENV: config.NODE_ENV ?? 'development',
    DATABASE_HOST: config.DATABASE_HOST,
    DATABASE_PORT: config.DATABASE_PORT ?? '3306',
    DATABASE_USERNAME: config.DATABASE_USERNAME,
    DATABASE_PASSWORD: config.DATABASE_PASSWORD,
    DATABASE_NAME: config.DATABASE_NAME,
  };

  const instance = plainToInstance(EnvironmentValidationDto, normalized, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, {
    skipMissingProperties: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  // Keep every parsed env var (ALLOWED_ORIGINS, SESSION_*, CSRF_*, MAIL_*, ...) available to
  // ConfigService; only apply the validated defaults for the core keys. Returning `normalized`
  // alone would drop the rest and force AuthConfigService onto its fallbacks.
  return { ...config, ...normalized };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
