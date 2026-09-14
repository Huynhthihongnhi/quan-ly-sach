import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../access/entities/permission.entity';
import { RolePermission } from '../access/entities/role-permission.entity';
import { UserRole } from '../access/entities/user-role.entity';

@Injectable()
export class PermissionResolverService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
  ) {}

  async resolvePermissionCodesForUser(userId: string): Promise<string[]> {
    const rows = await this.permissions
      .createQueryBuilder('permission')
      .select('permission.code', 'code')
      .innerJoin(RolePermission, 'rolePermission', 'rolePermission.permissionId = permission.id')
      .innerJoin(UserRole, 'userRole', 'userRole.roleId = rolePermission.roleId')
      .where('userRole.userId = :userId', { userId })
      .distinct(true)
      .getRawMany<{ code: string }>();

    return rows.map((row) => row.code);
  }
}
