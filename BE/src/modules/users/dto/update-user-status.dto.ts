import { IsIn, IsString } from 'class-validator';
import { UserStatus } from '../../identity/entities/user.entity';

const PATCHABLE_STATUSES = [
  'active',
  'blocked',
  'archived',
] as const satisfies readonly UserStatus[];

export class UpdateUserStatusDto {
  @IsIn(PATCHABLE_STATUSES)
  status!: (typeof PATCHABLE_STATUSES)[number];

  @IsString()
  version!: string;
}
