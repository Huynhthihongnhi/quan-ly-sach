import { IsIn, IsOptional } from 'class-validator';

export class ReportSnapshotQueryDto {
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
