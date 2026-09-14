import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeValue } from './error-code';

export interface ApiFieldError {
  field: string;
  code: string;
}

export class ApiException extends HttpException {
  readonly code: ErrorCodeValue;
  readonly fields: ApiFieldError[];
  readonly retryAfterSeconds?: number;

  constructor(
    status: HttpStatus,
    code: ErrorCodeValue,
    message: string,
    fields: ApiFieldError[] = [],
    retryAfterSeconds?: number,
  ) {
    super({ code, message, fields }, status);
    this.code = code;
    this.fields = fields;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
