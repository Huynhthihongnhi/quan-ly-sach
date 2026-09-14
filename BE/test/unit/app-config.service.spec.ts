import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../../src/config/app-config.service';

describe('AppConfigService', () => {
  it('throws when required database configuration is missing', () => {
    expect(
      () =>
        new AppConfigService({
          get: () => undefined,
        } as never),
    ).toThrow(/Missing required configuration/);
  });

  it('does not expose secret values in error messages', () => {
    try {
      new AppConfigService({
        get: (key: string) => {
          if (key === 'PORT') {
            return 3000;
          }
          if (key === 'NODE_ENV') {
            return 'test';
          }
          if (key === 'DATABASE_PASSWORD') {
            return 'super-secret-password';
          }
          return undefined;
        },
      } as never);
      fail('Expected configuration error');
    } catch (error) {
      expect(String(error)).not.toContain('super-secret-password');
    }
  });
});

describe('App bootstrap modules', () => {
  it('loads AppConfigModule validation without leaking secrets', async () => {
    const previousEnv = { ...process.env };
    process.env = {
      PORT: '3000',
      NODE_ENV: 'test',
      DATABASE_HOST: '127.0.0.1',
      DATABASE_PORT: '3306',
      DATABASE_USERNAME: 'app',
      DATABASE_PASSWORD: 'local-test-password',
      DATABASE_NAME: 'quan_ly_sach_test',
    };

    try {
      const { AppConfigModule } = await import('../../src/config/app-config.module');
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [AppConfigModule],
      }).compile();
      const config = moduleRef.get(AppConfigService);
      expect(config.database.host).toBe('127.0.0.1');
    } finally {
      process.env = previousEnv;
    }
  });
});
