import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequirePermissions } from '../../common/http/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../common/http/decorators/skip-response-envelope.decorator';
import { ReportDateRangeQueryDto } from './dto/report-date-range-query.dto';
import { ReportSnapshotQueryDto } from './dto/report-snapshot-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermissions('reports.read')
  @SkipResponseEnvelope()
  @Header('Cache-Control', 'no-store')
  @Get('circulation')
  @ApiOperation({ summary: 'Circulation totals for a local date range' })
  async circulation(@Query() query: ReportDateRangeQueryDto, @Res() res: Response): Promise<void> {
    const report = await this.reportsService.getCirculationReport(query);
    if (query.format === 'csv') {
      sendCsv(res, 'circulation-report.csv', this.reportsService.circulationReportToCsv(report));
      return;
    }
    res.status(200).json({ data: report });
  }

  @RequirePermissions('reports.read')
  @SkipResponseEnvelope()
  @Header('Cache-Control', 'no-store')
  @Get('inventory')
  @ApiOperation({ summary: 'Current catalog and copy inventory snapshot' })
  async inventory(@Query() query: ReportSnapshotQueryDto, @Res() res: Response): Promise<void> {
    const report = await this.reportsService.getInventoryReport();
    if (query.format === 'csv') {
      sendCsv(res, 'inventory-report.csv', this.reportsService.inventoryReportToCsv(report));
      return;
    }
    res.status(200).json({ data: report });
  }

  @RequirePermissions('reports.read')
  @SkipResponseEnvelope()
  @Header('Cache-Control', 'no-store')
  @Get('purchases')
  @ApiOperation({ summary: 'Purchase request totals for a local date range' })
  async purchases(@Query() query: ReportDateRangeQueryDto, @Res() res: Response): Promise<void> {
    if (query.format === 'csv') {
      const csv = await this.reportsService.purchasesReportToCsv(query);
      sendCsv(res, 'purchases-report.csv', csv);
      return;
    }
    const report = await this.reportsService.getPurchasesReport(query);
    res.status(200).json({ data: report });
  }
}

function sendCsv(res: Response, filename: string, body: string): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}
