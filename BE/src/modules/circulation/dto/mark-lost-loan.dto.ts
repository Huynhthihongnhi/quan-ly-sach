import { IsString, MaxLength, MinLength } from 'class-validator';
import { LoanVersionDto } from './loan-version.dto';

export class MarkLostLoanDto extends LoanVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
