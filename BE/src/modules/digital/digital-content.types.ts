export interface DigitalContentSlice {
  body: Buffer;
  mimeType: string;
  filename: string;
  totalSize: number;
  statusCode: 200 | 206;
  contentRange?: string;
}
