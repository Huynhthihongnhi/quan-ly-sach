import { IsString, MaxLength, MinLength } from 'class-validator';

export class PatchTaxonomyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  expectedName!: string;
}
