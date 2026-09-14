import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoanVersionDto {
  @IsString()
  @MinLength(1)
  version!: string;
}

export class CancelLoanDto extends LoanVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
