import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import { UserStatus } from '../../identity/entities/user.entity';

const USER_STATUSES = [
  'invited',
  'active',
  'blocked',
  'archived',
] as const satisfies readonly UserStatus[];

export class UserListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;
}
