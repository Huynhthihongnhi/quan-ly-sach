import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfigModule } from '../../src/config/app-config.module';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { AccessModule } from '../../src/modules/access/access.module';
import { IamPolicyService } from '../../src/modules/access/iam-policy.service';
import { UserRole } from '../../src/modules/access/entities/user-role.entity';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { BootstrapModule } from '../../src/modules/bootstrap/bootstrap.module';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { IdentityModule } from '../../src/modules/identity/identity.module';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { User } from '../../src/modules/identity/entities/user.entity';
import { Profile } from '../../src/modules/identity/entities/profile.entity';
import { DatabaseModule } from '../../src/platform/database/database.module';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('TST-S1-01 identity and RBAC on MySQL test database', () => {
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let accessRepository: AccessRepository;
  let iamPolicyService: IamPolicyService;
  let bootstrapService: BootstrapService;

  beforeAll(async () => {
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        DatabaseModule,
        IdentityModule,
        AccessModule,
        AuditModule,
        BootstrapModule,
      ],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    userRepository = moduleRef.get(UserRepository);
    accessRepository = moduleRef.get(AccessRepository);
    iamPolicyService = moduleRef.get(IamPolicyService);
    bootstrapService = moduleRef.get(BootstrapService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('normalizes email case so duplicates are rejected', async () => {
    await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email: 'Reader.A@test.local',
        displayName: 'Reader A',
      }),
    );

    await expect(
      dataSource.transaction((manager) =>
        userRepository.createWithProfile(manager, {
          email: 'reader.a@test.local',
          displayName: 'Reader A duplicate',
        }),
      ),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('creates user and profile atomically and rolls back together on fault', async () => {
    await expect(
      dataSource.transaction(async (manager) => {
        await userRepository.createWithProfile(manager, {
          email: 'fault@test.local',
          displayName: 'Fault User',
        });
        throw new Error('injected fault');
      }),
    ).rejects.toThrow('injected fault');

    const userCount = await dataSource.getRepository(User).count();
    const profileCount = await dataSource.getRepository(Profile).count();
    expect(userCount).toBe(0);
    expect(profileCount).toBe(0);
  });

  it('does not duplicate role assignments and preserves assigned_by metadata', async () => {
    const adminRole = await accessRepository.findRoleByCode('admin');
    expect(adminRole).not.toBeNull();

    const { user: actor } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email: 'actor@test.local',
        displayName: 'Actor',
      }),
    );
    const { user: target } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email: 'target@test.local',
        displayName: 'Target',
      }),
    );

    await dataSource.transaction(async (manager) => {
      await accessRepository.assignRole(manager, {
        userId: target.id,
        roleId: adminRole!.id,
        assignedBy: actor.id,
      });
      await accessRepository.assignRole(manager, {
        userId: target.id,
        roleId: adminRole!.id,
        assignedBy: actor.id,
      });
    });

    const assignments = await dataSource.getRepository(UserRole).find({
      where: { userId: target.id, roleId: adminRole!.id },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.assignedBy).toBe(actor.id);
    expect(assignments[0]?.assignedAt).toBeInstanceOf(Date);
  });

  it('rejects foreign keys for missing users and roles', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
         VALUES (999999, 999999, 999999, UTC_TIMESTAMP(6))`,
      ),
    ).rejects.toMatchObject({ code: 'ER_NO_REFERENCED_ROW_2' });
  });

  it('blocks deleting a role that is still assigned', async () => {
    const librarianRole = await accessRepository.findRoleByCode('librarian');
    expect(librarianRole).not.toBeNull();

    const { user } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email: 'librarian@test.local',
        displayName: 'Librarian User',
      }),
    );

    await dataSource.transaction(async (manager) => {
      await accessRepository.assignRole(manager, {
        userId: user.id,
        roleId: librarianRole!.id,
        assignedBy: user.id,
      });
    });

    await expect(
      dataSource.transaction((manager) =>
        accessRepository.deleteRoleById(manager, librarianRole!.id),
      ),
    ).rejects.toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2' });
  });

  it('bootstraps admin once with self assigned_by and keeps credentials on second run', async () => {
    const first = await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'bootstrap-password-1',
      displayName: 'Bootstrap Admin',
      requestId: randomUUID(),
    });
    expect(first.created).toBe(true);

    const [userBefore] = await dataSource.query<Array<{ password_hash: string | null }>>(
      `SELECT password_hash FROM users WHERE email = ?`,
      ['admin@test.local'],
    );
    expect(userBefore?.password_hash).toBeTruthy();

    const [assignment] = await dataSource.query<Array<{ assigned_by: string; user_id: string }>>(
      `SELECT CAST(assigned_by AS CHAR) AS assigned_by, CAST(user_id AS CHAR) AS user_id
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE r.code = 'admin'`,
    );
    expect(assignment?.assigned_by).toBe(assignment?.user_id);

    const second = await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'different-password-2',
      displayName: 'Bootstrap Admin',
      requestId: randomUUID(),
    });
    expect(second.created).toBe(false);

    const [userAfter] = await dataSource.query<Array<{ password_hash: string | null }>>(
      `SELECT password_hash FROM users WHERE email = ?`,
      ['admin@test.local'],
    );
    expect(userAfter?.password_hash).toBe(userBefore?.password_hash);
  });

  it('rejects bootstrap when iam policy lock row is missing', async () => {
    await dataSource.query(`DELETE FROM iam_policy_locks`);

    await expect(
      bootstrapService.bootstrapAdmin({
        email: 'admin@test.local',
        password: 'bootstrap-password-1',
        displayName: 'Bootstrap Admin',
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'iam_policy_lock_missing' });
  });

  it('denies removing the last active admin through policy service', async () => {
    await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'bootstrap-password-1',
      displayName: 'Bootstrap Admin',
      requestId: randomUUID(),
    });

    const admin = await userRepository.findByEmail('admin@test.local');
    expect(admin).not.toBeNull();

    await expect(
      dataSource.transaction((manager) =>
        iamPolicyService.assertRetainsLastAdmin(manager, {
          targetUserId: admin!.id,
          wouldBlockOrArchive: true,
        }),
      ),
    ).rejects.toMatchObject({ code: 'last_admin_denied' });
  });

  it('preserves large BIGINT identifiers as strings through ORM', async () => {
    const largeId = '9223372036854775807';
    await dataSource.query(
      `INSERT INTO users (id, email, status, auth_version, version)
       VALUES (?, 'large-id@test.local', 'invited', 1, 1)`,
      [largeId],
    );
    await dataSource.query(
      `INSERT INTO profiles (user_id, display_name, version)
       VALUES (?, 'Large ID', 1)`,
      [largeId],
    );

    const user = await userRepository.findById(largeId);
    expect(user?.id).toBe(largeId);

    const profile = await userRepository.findProfileByUserId(largeId);
    expect(profile?.userId).toBe(largeId);
  });
});
