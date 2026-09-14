import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCopyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shelfLocation?: string | null;

  @IsOptional()
  @IsIn(['serviceable', 'repair', 'lost', 'retired'])
  conditionState?: 'serviceable' | 'repair' | 'lost' | 'retired';

  @IsString()
  version!: string;
}
