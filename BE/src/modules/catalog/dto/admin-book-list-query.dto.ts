import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';

export class AdminBookListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  state?: 'draft' | 'published' | 'archived';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  q?: string;
}
