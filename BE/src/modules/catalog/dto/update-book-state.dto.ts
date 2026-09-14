import { IsIn, IsString } from 'class-validator';

export class UpdateBookStateDto {
  @IsIn(['draft', 'published', 'archived'])
  state!: 'draft' | 'published' | 'archived';

  @IsString()
  version!: string;
}
