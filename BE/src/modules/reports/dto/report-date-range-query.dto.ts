import { IsIn, IsOptional, Matches } from 'class-validator';

const LOCAL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ReportDateRangeQueryDto {
  @Matches(LOCAL_DATE_REGEX, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @Matches(LOCAL_DATE_REGEX, { message: 'to must be YYYY-MM-DD' })
  to!: string;

  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
