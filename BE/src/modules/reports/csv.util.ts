const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);
const NEEDS_QUOTING_PATTERN = /[",\n\r]/;

export function csvField(value: string): string {
  let field = value;
  if (field.length > 0 && FORMULA_TRIGGER_CHARS.has(field[0])) {
    field = `'${field}`;
  }
  if (NEEDS_QUOTING_PATTERN.test(field)) {
    field = `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function buildCsvDocument(
  headers: readonly string[],
  rows: ReadonlyArray<readonly string[]>,
): string {
  const lines = [headers.join(','), ...rows.map((row) => row.join(','))];
  return `${lines.join('\r\n')}\r\n`;
}
