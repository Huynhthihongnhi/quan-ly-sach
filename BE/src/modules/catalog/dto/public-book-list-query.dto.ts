import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import { PUBLIC_TEXT_QUERY_MAX_LENGTH } from '../catalog-like.util';

export class PublicBookListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(PUBLIC_TEXT_QUERY_MAX_LENGTH)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  author?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  topicId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(9999)
  year?: number;
}
