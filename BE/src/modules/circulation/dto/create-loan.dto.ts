import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  bookId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[\x21-\x7E]+$/)
  cardNumber!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsInt()
  @Min(1)
  @Max(15)
  requestedDays!: number;
}
