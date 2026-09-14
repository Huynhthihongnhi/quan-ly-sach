import { IsIn, IsString, MinLength } from 'class-validator';
import { LoanVersionDto } from './loan-version.dto';

export class ReturnLoanDto extends LoanVersionDto {
  @IsString()
  @MinLength(1)
  @IsIn(['serviceable', 'repair'])
  conditionState!: 'serviceable' | 'repair';
}
