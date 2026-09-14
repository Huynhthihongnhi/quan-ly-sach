import { DIGITAL_ASSET_MIME_PDF } from './digital.constants';

const PDF_SIGNATURE = Buffer.from('%PDF-');

export function validatePdfUpload(file: { buffer: Buffer; mimetype: string; size: number }): {
  mimeType: string;
  byteSize: number;
} {
  if (file.size <= 0 || file.buffer.length !== file.size) {
    throw new Error('EMPTY_FILE');
  }
  if (!file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new Error('INVALID_PDF');
  }
  if (file.mimetype !== DIGITAL_ASSET_MIME_PDF && file.mimetype !== 'application/octet-stream') {
    throw new Error('INVALID_MIME');
  }
  return { mimeType: DIGITAL_ASSET_MIME_PDF, byteSize: file.size };
}
