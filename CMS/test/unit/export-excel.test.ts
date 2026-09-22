import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { createExcelBuffer, EXCEL_EXPORT_MAX_ROWS } from 'src/utils/export-excel';

describe('ExcelJS export', () => {
  it('round-trips Vietnamese, large string IDs, numbers, dates and formula-like strings', async () => {
    const date = new Date('2026-09-18T00:00:00.000Z');
    const row = {
      id: '9007199254740993',
      title: 'Thư viện tiếng Việt',
      count: 12,
      active: true,
      date,
      text: '=1+1',
      privateValue: 'excluded',
    };
    const buffer = await createExcelBuffer({
      rows: [row],
      columns: [
        { header: 'ID', value: (r) => r.id },
        { header: 'Tên sách', value: (r) => r.title },
        { header: 'Số lượng', value: (r) => r.count },
        { header: 'Hoạt động', value: (r) => r.active },
        { header: 'Ngày', value: (r) => r.date, numFmt: 'dd/mm/yyyy' },
        { header: 'Nội dung', value: (r) => r.text },
      ],
      sheetName: 'Sách / danh mục',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(2);
    expect(sheet.columnCount).toBe(6);
    expect(sheet.getRow(2).values).toEqual([undefined, row.id, row.title, 12, true, date, '=1+1']);
    expect(sheet.getCell('F2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('E2').numFmt).toBe('dd/mm/yyyy');
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('exports headers for an empty result and rejects an empty column selection', async () => {
    const buffer = await createExcelBuffer({
      rows: [],
      columns: [{ header: 'Tên', value: () => '' }],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    await expect(createExcelBuffer({ rows: [], columns: [] })).rejects.toThrow('ít nhất một cột');
  });

  it('rejects formula objects from untyped input and oversized exports', async () => {
    await expect(
      createExcelBuffer({
        rows: [1],
        columns: [{ header: 'Unsafe', value: () => ({ formula: '1+1' }) as never }],
      })
    ).rejects.toThrow('không hợp lệ');
    await expect(
      createExcelBuffer({
        rows: Array(EXCEL_EXPORT_MAX_ROWS + 1).fill(1),
        columns: [{ header: 'ID', value: (r) => r }],
      })
    ).rejects.toThrow('tối đa');
  });
});
