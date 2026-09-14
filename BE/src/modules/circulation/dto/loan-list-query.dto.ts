import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/http/dto/pagination-query.dto';
import type { LoanState } from '../entities/loan.entity';

const LOAN_STATES: LoanState[] = [
  'reserved',
  'borrowed',
  'returned',
  'cancelled',
  'expired',
  'lost',
];

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}

export class OwnLoanListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(LOAN_STATES)
  state?: LoanState;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  overdue?: boolean;
}

export class AdminLoanListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  copyId?: string;

  @IsOptional()
  @IsIn(LOAN_STATES)
  state?: LoanState;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  overdue?: boolean;
}
