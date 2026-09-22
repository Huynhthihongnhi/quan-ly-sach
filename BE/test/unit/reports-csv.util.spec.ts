import { buildCsvDocument, csvField } from '../../src/modules/reports/csv.util';

describe('reports CSV field encoding', () => {
  it('leaves plain text untouched', () => {
    expect(csvField('Clean Code')).toBe('Clean Code');
  });

  it('quotes and doubles internal quotes when a comma, quote, or newline is present', () => {
    expect(csvField('Title, with comma')).toBe('"Title, with comma"');
    expect(csvField('Say "hello"')).toBe('"Say ""hello"""');
    expect(csvField('Line one\nLine two')).toBe('"Line one\nLine two"');
    expect(csvField('Carriage\rReturn')).toBe('"Carriage\rReturn"');
  });

  it('neutralizes leading formula-trigger characters with a leading apostrophe', () => {
    expect(csvField('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvField('+1234')).toBe("'+1234");
    expect(csvField('-1234')).toBe("'-1234");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes a neutralized field that also contains a comma', () => {
    expect(csvField('=A1,B1')).toBe('"\'=A1,B1"');
  });

  it('does not neutralize a character that only appears mid-string', () => {
    expect(csvField('Total = 5')).toBe('Total = 5');
  });

  it('builds a CRLF-terminated document from pre-escaped cells', () => {
    const doc = buildCsvDocument(
      ['title', 'count'],
      [
        [csvField('Plain'), '3'],
        [csvField('=cmd'), '1'],
      ],
    );
    expect(doc).toBe("title,count\r\nPlain,3\r\n'=cmd,1\r\n");
  });
});
