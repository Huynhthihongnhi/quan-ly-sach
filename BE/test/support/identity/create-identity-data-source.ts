import { DataSource } from 'typeorm';
import { AuditEvent } from '../../../src/modules/audit/entities/audit-event.entity';
import { IamPolicyLock } from '../../../src/modules/access/entities/iam-policy-lock.entity';
import { Permission } from '../../../src/modules/access/entities/permission.entity';
import { RolePermission } from '../../../src/modules/access/entities/role-permission.entity';
import { Role } from '../../../src/modules/access/entities/role.entity';
import { UserRole } from '../../../src/modules/access/entities/user-role.entity';
import { Profile } from '../../../src/modules/identity/entities/profile.entity';
import { User } from '../../../src/modules/identity/entities/user.entity';

export function createIdentityDataSource(): DataSource {
  return new DataSource({
    type: 'mysql',
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USERNAME ?? 'app',
    password: process.env.DATABASE_PASSWORD ?? 'local-app-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    synchronize: false,
    migrationsRun: false,
    entities: [
      User,
      Profile,
      Role,
      Permission,
      UserRole,
      RolePermission,
      IamPolicyLock,
      AuditEvent,
    ],
    timezone: 'Z',
  });
}
