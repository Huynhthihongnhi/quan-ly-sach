import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import request from 'supertest';

export const TEST_ACTOR_HEADER = 'x-contract-test-actor';

export interface HttpActor {
  userId: string;
  permissionCodes: string[];
}

export class HttpTestHarness {
  constructor(private readonly httpServer: Server) {}

  static fromApp(app: INestApplication): HttpTestHarness {
    return new HttpTestHarness(app.getHttpServer() as Server);
  }

  getPublic(path: string): request.Test {
    return request(this.httpServer).get(path);
  }

  getProtected(path: string, permissions: string[], userId = 'test-user'): request.Test {
    return request(this.httpServer)
      .get(path)
      .set(
        TEST_ACTOR_HEADER,
        JSON.stringify({ userId, permissionCodes: permissions } satisfies HttpActor),
      );
  }
}
