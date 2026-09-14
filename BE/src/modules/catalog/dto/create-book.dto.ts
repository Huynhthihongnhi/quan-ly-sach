import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  authorIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  topicIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  publisherName?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(9999)
  publicationYear?: number | null;

  @IsOptional()
  @IsString()
  description?: string | null;
}
