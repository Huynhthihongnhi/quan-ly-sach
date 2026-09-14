import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AccessRepository } from '../../../src/modules/access/access.repository';
import { BootstrapService } from '../../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../../src/modules/identity/password-hasher';
import { UserRepository } from '../../../src/modules/identity/user.repository';
import { authAgent, extractSessionCookie } from '../auth/auth-request';
import type { IamPersona } from './iam-route-matrix';

const TEST_PASSWORD = 'ValidPass123!';

export interface PersonaSession {
  persona: IamPersona;
  userId: string;
  email: string;
  cookie: string;
  csrfToken: string;
}

export interface IamPersonaFixtures {
  admin: PersonaSession;
  librarian: PersonaSession;
  reader: PersonaSession;
}

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string } };
}

export async function seedIamPersonas(app: INestApplication): Promise<IamPersonaFixtures> {
  const dataSource = app.get(DataSource);
  const userRepository = app.get(UserRepository);
  const accessRepository = app.get(AccessRepository);
  const bootstrapService = app.get(BootstrapService);

  await bootstrapService.seedRegistryOnly();
  await bootstrapService.bootstrapAdmin({
    email: 'admin.acceptance@test.local',
    password: TEST_PASSWORD,
    displayName: 'Acceptance Admin',
    requestId: 'iam-acceptance-seed',
  });

  const adminUser = await userRepository.findByEmail('admin.acceptance@test.local');
  if (!adminUser) {
    throw new Error('Admin seed failed');
  }

  const adminLogin = await loginPersona(app.getHttpServer() as Server, {
    email: 'admin.acceptance@test.local',
    password: TEST_PASSWORD,
    persona: 'admin',
  });

  const librarianId = await createActiveUserWithRole(dataSource, userRepository, accessRepository, {
    email: 'librarian.acceptance@test.local',
    displayName: 'Acceptance Librarian',
    roleCode: 'librarian',
    assignedBy: adminUser.id,
  });

  const readerId = await createActiveUserWithRole(dataSource, userRepository, accessRepository, {
    email: 'reader.acceptance@test.local',
    displayName: 'Acceptance Reader',
    roleCode: 'reader',
    assignedBy: adminUser.id,
  });

  const librarianLogin = await loginPersona(app.getHttpServer() as Server, {
    email: 'librarian.acceptance@test.local',
    password: TEST_PASSWORD,
    persona: 'librarian',
  });
  const readerLogin = await loginPersona(app.getHttpServer() as Server, {
    email: 'reader.acceptance@test.local',
    password: TEST_PASSWORD,
    persona: 'reader',
  });

  return {
    admin: { ...adminLogin, userId: adminUser.id },
    librarian: { ...librarianLogin, userId: librarianId },
    reader: { ...readerLogin, userId: readerId },
  };
}

async function createActiveUserWithRole(
  dataSource: DataSource,
  userRepository: UserRepository,
  accessRepository: AccessRepository,
  input: {
    email: string;
    displayName: string;
    roleCode: string;
    assignedBy: string;
  },
): Promise<string> {
  const role = await accessRepository.findRoleByCode(input.roleCode);
  if (!role) {
    throw new Error(`Role ${input.roleCode} is missing`);
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);
  const { user } = await dataSource.transaction((manager) =>
    userRepository.createWithProfile(manager, {
      email: input.email,
      displayName: input.displayName,
      status: 'active',
      passwordHash,
    }),
  );

  await dataSource.transaction((manager) =>
    accessRepository.assignRole(manager, {
      userId: user.id,
      roleId: role.id,
      assignedBy: input.assignedBy,
    }),
  );

  return user.id;
}

async function loginPersona(
  httpServer: Server,
  input: { email: string; password: string; persona: IamPersona },
): Promise<Omit<PersonaSession, 'userId'>> {
  const login = await authAgent(httpServer).login(input.email, input.password).expect(200);
  const body = login.body as LoginResponseBody;
  return {
    persona: input.persona,
    email: input.email,
    cookie: extractSessionCookie(login.headers['set-cookie']),
    csrfToken: body.data.csrfToken,
  };
}

export async function callRoute(
  httpServer: Server,
  session: PersonaSession,
  route: {
    method: 'get' | 'post' | 'patch';
    path: string;
    body?: Record<string, unknown>;
  },
): Promise<request.Response> {
  const withSession = (req: request.Test) => req.set('Cookie', session.cookie);
  const withMutation = (req: request.Test) =>
    withSession(req)
      .set('Origin', 'http://127.0.0.1:3000')
      .set('X-Requested-With', 'library-web')
      .set('X-CSRF-Token', session.csrfToken);

  if (route.method === 'get') {
    return withSession(request(httpServer).get(route.path));
  }

  const req = withMutation(request(httpServer)[route.method](route.path));
  if (route.body) {
    req.send(route.body);
  }
  return req;
}
