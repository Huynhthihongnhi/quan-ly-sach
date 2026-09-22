import { Controller, Get, Module, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { Server } from 'node:http';
import request from 'supertest';
import { AppConfigModule } from '../../src/config/app-config.module';
import { configureApp } from '../../src/setup-app';

interface ProbeResponseBody {
  ip: string | undefined;
}

@Controller()
class ProbeController {
  @Get('probe/ip')
  probe(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

@Module({ imports: [AppConfigModule], controllers: [ProbeController] })
class ProbeModule {}

function withRequiredEnv(overrides: Record<string, string>, run: () => Promise<void>) {
  const previousEnv = { ...process.env };
  process.env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: '3306',
    DATABASE_USERNAME: 'app',
    DATABASE_PASSWORD: 'unit-test-password',
    DATABASE_NAME: 'quan_ly_sach_test',
    ...overrides,
  };
  return run().finally(() => {
    process.env = previousEnv;
  });
}

describe('configureApp trust proxy wiring', () => {
  it('ignores X-Forwarded-For by default, so a direct caller cannot spoof req.ip', async () => {
    await withRequiredEnv({}, async () => {
      const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
      const app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();

      const response = await request(app.getHttpServer() as Server)
        .get('/api/v1/probe/ip')
        .set('X-Forwarded-For', '203.0.113.5');

      expect((response.body as ProbeResponseBody).ip).not.toBe('203.0.113.5');
      await app.close();
    });
  });

  it('trusts the first X-Forwarded-For hop when TRUST_PROXY=1, matching the compose proxy topology', async () => {
    await withRequiredEnv({ TRUST_PROXY: '1' }, async () => {
      const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
      const app = moduleRef.createNestApplication();
      configureApp(app);
      await app.init();

      const response = await request(app.getHttpServer() as Server)
        .get('/api/v1/probe/ip')
        .set('X-Forwarded-For', '203.0.113.5');

      expect((response.body as ProbeResponseBody).ip).toBe('203.0.113.5');
      await app.close();
    });
  });
});
