import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDemoItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsInt()
  @Min(1)
  @Max(365)
  requestedDays!: number;
}
