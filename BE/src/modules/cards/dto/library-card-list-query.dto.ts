import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import type { LibraryCardState } from '../entities/library-card.entity';

export class LibraryCardListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(['active', 'suspended', 'revoked', 'expired'])
  state?: LibraryCardState;
}
