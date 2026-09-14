import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { AppEnvironmentVariables } from './environment.schema';

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

@Injectable()
export class AppConfigService {
  readonly port: number;
  readonly nodeEnv: string;
  readonly database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
  };

  constructor(configService: ConfigService<AppEnvironmentVariables, true>) {
    this.port = this.readNumber(configService, 'PORT', 3000);
    this.nodeEnv = this.readString(configService, 'NODE_ENV', 'development');
    this.database = {
      host: this.readString(configService, 'DATABASE_HOST'),
      port: this.readNumber(configService, 'DATABASE_PORT', 3306),
      username: this.readString(configService, 'DATABASE_USERNAME'),
      password: this.readString(configService, 'DATABASE_PASSWORD'),
      name: this.readString(configService, 'DATABASE_NAME'),
    };
  }

  private readString(
    configService: ConfigService<AppEnvironmentVariables, true>,
    key: keyof AppEnvironmentVariables,
    fallback?: string,
  ): string {
    const value = configService.get(key, { infer: true });
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new ConfigurationError(`Missing required configuration: ${String(key)}`);
    }
    return String(value);
  }

  private readNumber(
    configService: ConfigService<AppEnvironmentVariables, true>,
    key: keyof AppEnvironmentVariables,
    fallback?: number,
  ): number {
    const value = configService.get(key, { infer: true });
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) {
        return fallback;
      }
      throw new ConfigurationError(`Missing required configuration: ${String(key)}`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      throw new ConfigurationError(`Invalid integer configuration: ${String(key)}`);
    }
    return parsed;
  }
}

export class EnvironmentValidationDto {
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  NODE_ENV!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;
}
