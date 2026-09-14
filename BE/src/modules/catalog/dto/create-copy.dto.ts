import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCopyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  barcode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shelfLocation?: string | null;
}
