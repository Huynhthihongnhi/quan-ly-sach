export type ExcelValue = string | number | boolean | Date | null | undefined;

export type ExcelColumn<Row> = {
  header: string;
  value: (row: Row) => ExcelValue;
  width?: number;
  numFmt?: string;
};

export type ExcelExportOptions<Row> = {
  rows: readonly Row[];
  columns: readonly ExcelColumn<Row>[];
  sheetName?: string;
};

export const EXCEL_EXPORT_MAX_ROWS = 5000;

export async function createExcelBuffer<Row>({
  rows,
  columns,
  sheetName = 'Dữ liệu',
}: ExcelExportOptions<Row>) {
  if (rows.length > EXCEL_EXPORT_MAX_ROWS) {
    throw new Error(`Chỉ xuất tối đa ${EXCEL_EXPORT_MAX_ROWS} dòng mỗi lần.`);
  }
  if (!columns.length) throw new Error('Cần chọn ít nhất một cột để xuất.');

  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const safeName = sheetName
    .replace(/[\\/?*:[\]]/g, ' ')
    .replace(/^'+|'+$/g, '')
    .trim()
    .slice(0, 31);
  const sheet = workbook.addWorksheet(safeName || 'Dữ liệu');
  sheet.columns = columns.map(({ header, width = 24, numFmt }) => ({
    header,
    width,
    ...(numFmt ? { style: { numFmt } } : {}),
  }));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  for (const row of rows) {
    sheet.addRow(
      columns.map(({ value }) => {
        const cell = value(row);
        if (cell == null) return null;
        if (typeof cell === 'string' || typeof cell === 'boolean') return cell;
        if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
        if (cell instanceof Date && Number.isFinite(cell.getTime())) return cell;
        // Formula/hyperlink objects are not accepted, even from untyped callers.
        throw new Error('Giá trị ô Excel không hợp lệ.');
      })
    );
  }

  return workbook.xlsx.writeBuffer();
}

/** Export only the rows explicitly supplied by the caller, never fetch hidden pages. */
export async function exportExcel<Row>(options: ExcelExportOptions<Row> & { fileName: string }) {
  const buffer = await createExcelBuffer(options);
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${options.fileName.replace(/\.xlsx$/i, '').replace(/[\\/:*?"<>|]/g, '-') || 'du-lieu'}.xlsx`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to consume the download before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
