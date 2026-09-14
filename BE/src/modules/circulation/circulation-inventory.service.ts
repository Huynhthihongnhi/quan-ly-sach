import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CIRCULATION_LOANS_TABLE, isCirculationEnabled } from './circulation.constants';

@Injectable()
export class CirculationInventoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  isEnabled(): boolean {
    return isCirculationEnabled();
  }

  async assertSchemaReady(): Promise<void> {
    if (!isCirculationEnabled()) {
      return;
    }
    const ready = await this.loansTableExists();
    if (!ready) {
      throw new ApiException(
        503,
        ErrorCode.DEPENDENCY_UNAVAILABLE,
        'Circulation schema is not available.',
      );
    }
  }

  async loansTableExists(): Promise<boolean> {
    const rows: Array<{ count: number }> = await this.dataSource.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [CIRCULATION_LOANS_TABLE],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async countAvailableCopiesForBook(bookId: string, manager?: EntityManager): Promise<number> {
    await this.assertSchemaReady();
    const runner = manager ?? this.dataSource.manager;
    const rows: Array<{ count: string }> = await runner.query(
      `SELECT COUNT(*) AS count
       FROM book_copies c
       WHERE c.book_id = ?
         AND c.condition_state = 'serviceable'
         AND NOT EXISTS (
           SELECT 1 FROM loans l
           WHERE l.copy_id = c.id AND l.state IN ('reserved', 'borrowed')
         )`,
      [bookId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async countAvailableCopiesForBooks(bookIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const bookId of bookIds) {
      counts.set(bookId, 0);
    }
    if (bookIds.length === 0 || !isCirculationEnabled()) {
      return counts;
    }
    await this.assertSchemaReady();

    const placeholders = bookIds.map(() => '?').join(', ');
    const rows: Array<{ bookId: string; count: string }> = await this.dataSource.query(
      `SELECT c.book_id AS bookId, COUNT(*) AS count
       FROM book_copies c
       WHERE c.book_id IN (${placeholders})
         AND c.condition_state = 'serviceable'
         AND NOT EXISTS (
           SELECT 1 FROM loans l
           WHERE l.copy_id = c.id AND l.state IN ('reserved', 'borrowed')
         )
       GROUP BY c.book_id`,
      bookIds,
    );
    for (const row of rows) {
      counts.set(String(row.bookId), Number(row.count));
    }
    return counts;
  }

  async hasActiveLoanForCopy(copyId: string, manager?: EntityManager): Promise<boolean> {
    if (!isCirculationEnabled()) {
      return false;
    }
    await this.assertSchemaReady();
    const runner = manager ?? this.dataSource.manager;
    const rows: Array<{ count: string }> = await runner.query(
      `SELECT COUNT(*) AS count
       FROM loans
       WHERE copy_id = ? AND state IN ('reserved', 'borrowed')`,
      [copyId],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async assertCopyAvailableForMutation(copyId: string, manager?: EntityManager): Promise<void> {
    if (!isCirculationEnabled()) {
      return;
    }
    const blocked = await this.hasActiveLoanForCopy(copyId, manager);
    if (blocked) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Copy is reserved or borrowed and cannot be changed.',
      );
    }
  }
}
