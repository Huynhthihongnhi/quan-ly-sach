import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CirculationPeriodCounts {
  checkouts: number;
  returns: number;
  lost: number;
}

export interface CirculationSnapshotCounts {
  currentlyBorrowed: number;
  currentlyOverdue: number;
}

export interface InventorySnapshot {
  titles: number;
  physicalCopies: number;
  available: number;
  reservedActive: number;
  borrowed: number;
  repair: number;
  lost: number;
  retired: number;
}

export interface PurchasesPeriodCounts {
  submitted: number;
  approved: number;
  rejected: number;
  pendingNow: number;
}

export interface PurchaseReportRow {
  id: string;
  title: string;
  authorText: string;
  publicationYear: number;
  state: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewReason: string | null;
}

const PURCHASE_CSV_ROW_LIMIT = 10000;

@Injectable()
export class ReportsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async countCirculationPeriod(startUtc: Date, endUtc: Date): Promise<CirculationPeriodCounts> {
    const rows: Array<{ checkouts: string | null; returns: string | null; lost: string | null }> =
      await this.dataSource.query(
        `SELECT
           SUM(CASE WHEN checked_out_at >= ? AND checked_out_at < ? THEN 1 ELSE 0 END) AS checkouts,
           SUM(CASE WHEN state = 'returned' AND closed_at >= ? AND closed_at < ? THEN 1 ELSE 0 END) AS returns,
           SUM(CASE WHEN state = 'lost' AND closed_at >= ? AND closed_at < ? THEN 1 ELSE 0 END) AS lost
         FROM loans`,
        [startUtc, endUtc, startUtc, endUtc, startUtc, endUtc],
      );
    const row = rows[0];
    return {
      checkouts: Number(row?.checkouts ?? 0),
      returns: Number(row?.returns ?? 0),
      lost: Number(row?.lost ?? 0),
    };
  }

  async countCirculationSnapshot(now: Date): Promise<CirculationSnapshotCounts> {
    const rows: Array<{ borrowed: string | null; overdue: string | null }> =
      await this.dataSource.query(
        `SELECT
           SUM(CASE WHEN state = 'borrowed' THEN 1 ELSE 0 END) AS borrowed,
           SUM(CASE WHEN state = 'borrowed' AND due_at < ? THEN 1 ELSE 0 END) AS overdue
         FROM loans`,
        [now],
      );
    const row = rows[0];
    return {
      currentlyBorrowed: Number(row?.borrowed ?? 0),
      currentlyOverdue: Number(row?.overdue ?? 0),
    };
  }

  async getInventorySnapshot(now: Date): Promise<InventorySnapshot> {
    const titleRows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM books`,
    );
    const copyRows: Array<{
      total: string;
      repair: string | null;
      lost: string | null;
      retired: string | null;
    }> = await this.dataSource.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN condition_state = 'repair' THEN 1 ELSE 0 END) AS repair,
         SUM(CASE WHEN condition_state = 'lost' THEN 1 ELSE 0 END) AS lost,
         SUM(CASE WHEN condition_state = 'retired' THEN 1 ELSE 0 END) AS retired
       FROM book_copies`,
    );
    const availableRows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS count
       FROM book_copies c
       WHERE c.condition_state = 'serviceable'
         AND NOT EXISTS (
           SELECT 1 FROM loans l
           WHERE l.copy_id = c.id AND (l.state = 'borrowed' OR
             (l.state = 'reserved' AND l.reservation_expires_at > ?))
         )`,
      [now],
    );
    const loanRows: Array<{ borrowed: string | null; reservedActive: string | null }> =
      await this.dataSource.query(
        `SELECT
           SUM(CASE WHEN state = 'borrowed' THEN 1 ELSE 0 END) AS borrowed,
           SUM(CASE WHEN state = 'reserved' AND reservation_expires_at > ? THEN 1 ELSE 0 END) AS reservedActive
         FROM loans`,
        [now],
      );

    return {
      titles: Number(titleRows[0]?.count ?? 0),
      physicalCopies: Number(copyRows[0]?.total ?? 0),
      available: Number(availableRows[0]?.count ?? 0),
      reservedActive: Number(loanRows[0]?.reservedActive ?? 0),
      borrowed: Number(loanRows[0]?.borrowed ?? 0),
      repair: Number(copyRows[0]?.repair ?? 0),
      lost: Number(copyRows[0]?.lost ?? 0),
      retired: Number(copyRows[0]?.retired ?? 0),
    };
  }

  async countPurchasesPeriod(startUtc: Date, endUtc: Date): Promise<PurchasesPeriodCounts> {
    const periodRows: Array<{
      submitted: string | null;
      approved: string | null;
      rejected: string | null;
    }> = await this.dataSource.query(
      `SELECT
         SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS submitted,
         SUM(CASE WHEN state = 'approved' AND reviewed_at >= ? AND reviewed_at < ? THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN state = 'rejected' AND reviewed_at >= ? AND reviewed_at < ? THEN 1 ELSE 0 END) AS rejected
       FROM purchase_requests`,
      [startUtc, endUtc, startUtc, endUtc, startUtc, endUtc],
    );
    const pendingRows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM purchase_requests WHERE state = 'pending'`,
    );
    const row = periodRows[0];
    return {
      submitted: Number(row?.submitted ?? 0),
      approved: Number(row?.approved ?? 0),
      rejected: Number(row?.rejected ?? 0),
      pendingNow: Number(pendingRows[0]?.count ?? 0),
    };
  }

  listPurchaseRowsForCsv(startUtc: Date, endUtc: Date): Promise<PurchaseReportRow[]> {
    return this.dataSource.query(
      `SELECT id, title, author_text AS authorText, publication_year AS publicationYear,
              state, created_at AS createdAt, reviewed_at AS reviewedAt, review_reason AS reviewReason
       FROM purchase_requests
       WHERE (created_at >= ? AND created_at < ?)
          OR (reviewed_at IS NOT NULL AND reviewed_at >= ? AND reviewed_at < ?)
       ORDER BY id ASC
       LIMIT ${PURCHASE_CSV_ROW_LIMIT}`,
      [startUtc, endUtc, startUtc, endUtc],
    );
  }
}
