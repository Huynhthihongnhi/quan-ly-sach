import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ClockModule } from '../../platform/clock/clock.module';
import { AccessRepository } from './access.repository';
import { AccessService } from './access.service';
import { IamPolicyLock } from './entities/iam-policy-lock.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { IamPolicyService } from './iam-policy.service';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { UserRolesController } from './user-roles.controller';

@Module({
  imports: [
    ClockModule,
    IdentityModule,
    AuditModule,
    TypeOrmModule.forFeature([Role, Permission, UserRole, RolePermission, IamPolicyLock]),
  ],
  controllers: [RolesController, PermissionsController, UserRolesController],
  providers: [AccessRepository, IamPolicyService, AccessService],
  exports: [AccessRepository, IamPolicyService, AccessService, TypeOrmModule],
})
export class AccessModule {}
