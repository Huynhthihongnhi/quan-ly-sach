export interface ParsedByteRange {
  start: number;
  end: number;
}

export function parseSingleByteRange(
  rangeHeader: string | undefined,
  totalSize: number,
): ParsedByteRange | null {
  if (!rangeHeader) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    throw new RangeParseError('Range header is malformed.');
  }

  const [, startPart, endPart] = match;
  if (startPart === '' && endPart === '') {
    throw new RangeParseError('Range header is empty.');
  }

  let start: number;
  let end: number;

  if (startPart === '') {
    const suffixLength = Number(endPart);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      throw new RangeParseError('Suffix range is invalid.');
    }
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = Number(startPart);
    end = endPart === '' ? totalSize - 1 : Number(endPart);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    throw new RangeParseError('Range bounds are invalid.');
  }
  if (start >= totalSize) {
    throw new RangeParseError('Range start is outside the file.');
  }
  end = Math.min(end, totalSize - 1);
  return { start, end };
}

export class RangeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RangeParseError';
  }
}
