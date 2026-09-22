import { Inject, Injectable } from '@nestjs/common';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { CirculationInventoryService } from '../circulation/circulation-inventory.service';
import { LIBRARY_TIMEZONE } from '../circulation/library-timezone.util';
import { buildCsvDocument, csvField } from './csv.util';
import { ReportRangeError, ReportUtcRange, resolveReportRange } from './date-range.util';
import { ReportDateRangeQueryDto } from './dto/report-date-range-query.dto';
import { ReportsRepository } from './reports.repository';

export interface ReportRange {
  from: string;
  to: string;
  timezone: string;
}

export interface CirculationReportResponse {
  range: ReportRange;
  period: { checkouts: number; returns: number; lost: number };
  asOf: { generatedAt: string; currentlyBorrowed: number; currentlyOverdue: number };
}

export interface InventoryReportResponse {
  asOf: string;
  titles: number;
  physicalCopies: number;
  available: number;
  reservedActive: number;
  borrowed: number;
  repair: number;
  lost: number;
  retired: number;
}

export interface PurchasesReportResponse {
  range: ReportRange;
  submitted: number;
  approved: number;
  rejected: number;
  pendingNow: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly circulationInventory: CirculationInventoryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getCirculationReport(query: ReportDateRangeQueryDto): Promise<CirculationReportResponse> {
    await this.assertCirculationReadable();
    const range = this.parseRange(query.from, query.to);
    const now = this.clock.now();
    const [period, snapshot] = await Promise.all([
      this.reportsRepository.countCirculationPeriod(range.startUtc, range.endUtc),
      this.reportsRepository.countCirculationSnapshot(now),
    ]);
    return {
      range: { from: query.from, to: query.to, timezone: LIBRARY_TIMEZONE },
      period,
      asOf: { generatedAt: now.toISOString(), ...snapshot },
    };
  }

  circulationReportToCsv(report: CirculationReportResponse): string {
    return buildCsvDocument(
      [
        'from',
        'to',
        'timezone',
        'checkouts',
        'returns',
        'lost',
        'currentlyBorrowed',
        'currentlyOverdue',
        'generatedAt',
      ],
      [
        [
          csvField(report.range.from),
          csvField(report.range.to),
          csvField(report.range.timezone),
          String(report.period.checkouts),
          String(report.period.returns),
          String(report.period.lost),
          String(report.asOf.currentlyBorrowed),
          String(report.asOf.currentlyOverdue),
          csvField(report.asOf.generatedAt),
        ],
      ],
    );
  }

  async getInventoryReport(): Promise<InventoryReportResponse> {
    await this.assertCirculationReadable();
    const now = this.clock.now();
    const snapshot = await this.reportsRepository.getInventorySnapshot(now);
    return { asOf: now.toISOString(), ...snapshot };
  }

  inventoryReportToCsv(report: InventoryReportResponse): string {
    return buildCsvDocument(
      [
        'asOf',
        'titles',
        'physicalCopies',
        'available',
        'reservedActive',
        'borrowed',
        'repair',
        'lost',
        'retired',
      ],
      [
        [
          csvField(report.asOf),
          String(report.titles),
          String(report.physicalCopies),
          String(report.available),
          String(report.reservedActive),
          String(report.borrowed),
          String(report.repair),
          String(report.lost),
          String(report.retired),
        ],
      ],
    );
  }

  async getPurchasesReport(query: ReportDateRangeQueryDto): Promise<PurchasesReportResponse> {
    const range = this.parseRange(query.from, query.to);
    const counts = await this.reportsRepository.countPurchasesPeriod(range.startUtc, range.endUtc);
    return {
      range: { from: query.from, to: query.to, timezone: LIBRARY_TIMEZONE },
      ...counts,
    };
  }

  async purchasesReportToCsv(query: ReportDateRangeQueryDto): Promise<string> {
    const range = this.parseRange(query.from, query.to);
    const rows = await this.reportsRepository.listPurchaseRowsForCsv(range.startUtc, range.endUtc);
    return buildCsvDocument(
      [
        'id',
        'title',
        'authorText',
        'publicationYear',
        'state',
        'createdAt',
        'reviewedAt',
        'reviewReason',
      ],
      rows.map((row) => [
        row.id,
        csvField(row.title),
        csvField(row.authorText),
        String(row.publicationYear),
        row.state,
        row.createdAt.toISOString(),
        row.reviewedAt ? row.reviewedAt.toISOString() : '',
        row.reviewReason ? csvField(row.reviewReason) : '',
      ]),
    );
  }

  private parseRange(from: string, to: string): ReportUtcRange {
    try {
      return resolveReportRange(from, to);
    } catch (error) {
      if (error instanceof ReportRangeError) {
        throw new ApiException(422, ErrorCode.VALIDATION_FAILED, error.message, [
          { field: error.field, code: error.reason },
        ]);
      }
      throw error;
    }
  }

  private async assertCirculationReadable(): Promise<void> {
    await this.circulationInventory.assertSchemaReady();
    if (!this.circulationInventory.isEnabled()) {
      throw new ApiException(503, ErrorCode.DEPENDENCY_UNAVAILABLE, 'Circulation is not enabled.');
    }
  }
}
