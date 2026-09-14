import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateNamedTaxonomyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
