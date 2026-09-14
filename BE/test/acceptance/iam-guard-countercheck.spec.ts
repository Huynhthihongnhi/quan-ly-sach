import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { PermissionsGuard } from '../../src/common/http/guards/permissions.guard';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { callRoute, seedIamPersonas } from '../support/acceptance/persona-session';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const countercheckEnabled = process.env.IAM_GUARD_COUNTERCHECK === '1';
const describeCountercheck = countercheckEnabled ? describe : describe.skip;

describeCountercheck('TST-S1-07 guard countercheck (must fail when guards are bypassed)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let guardSpy: jest.SpyInstance;

  beforeAll(async () => {
    guardSpy = jest.spyOn(PermissionsGuard.prototype, 'canActivate').mockReturnValue(true);

    const fakeClock = new FakeClock(new Date('2026-09-11T08:00:00.000Z'));
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer() as Server;
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
  });

  afterAll(async () => {
    guardSpy.mockRestore();
    await app.close();
  });

  it('reader listing users must stay forbidden; bypassed guard breaks this assertion', async () => {
    const personas = await seedIamPersonas(app);
    const response = await callRoute(httpServer, personas.reader, {
      method: 'get',
      path: '/api/v1/users',
    });

    expect(response.status).toBe(403);
  });
});
