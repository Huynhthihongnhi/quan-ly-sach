import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePurchaseRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  authorText!: string;

  @IsInt()
  @Min(1000)
  @Max(9999)
  publicationYear!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
