import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiException, ApiFieldError } from '../api.exception';
import { ErrorCode, ErrorCodeValue } from '../error-code';
import { RequestWithContext } from '../types/request-with-context';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof ApiException) {
      const body = exception.getResponse() as {
        code: ErrorCodeValue;
        message: string;
        fields: ApiFieldError[];
      };
      if (exception.retryAfterSeconds !== undefined) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
      response.status(exception.getStatus()).json({
        error: {
          code: body.code,
          message: body.message,
          requestId,
          fields: body.fields,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = this.mapHttpException(exception, status, requestId);
      if (status >= 500) {
        this.logger.error(`Unhandled HTTP ${status}`, exception.stack);
      }
      response.status(status).json({ error: payload });
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
        requestId,
        fields: [],
      },
    });
  }

  private mapHttpException(
    exception: HttpException,
    status: number,
    requestId: string,
  ): {
    code: ErrorCodeValue;
    message: string;
    requestId: string;
    fields: ApiFieldError[];
  } {
    const response = exception.getResponse();
    const fields: ApiFieldError[] = [];
    let message = exception.message;
    let code: ErrorCodeValue = ErrorCode.INTERNAL_ERROR;

    if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = 'Validation failed.';
        code = ErrorCode.VALIDATION_FAILED;
        for (const entry of body.message) {
          if (typeof entry === 'string') {
            fields.push({ field: 'body', code: 'INVALID' });
          }
        }
      }
    }

    if (status === Number(HttpStatus.BAD_REQUEST) && code === ErrorCode.INTERNAL_ERROR) {
      code = ErrorCode.VALIDATION_FAILED;
    } else if (status === Number(HttpStatus.UNAUTHORIZED)) {
      code = ErrorCode.AUTHENTICATION_REQUIRED;
    } else if (status === Number(HttpStatus.FORBIDDEN)) {
      code = ErrorCode.FORBIDDEN;
    } else if (status === Number(HttpStatus.NOT_FOUND)) {
      code = ErrorCode.NOT_FOUND;
    } else if (status === Number(HttpStatus.CONFLICT)) {
      code = ErrorCode.VERSION_CONFLICT;
    } else if (status === Number(HttpStatus.UNPROCESSABLE_ENTITY)) {
      code = ErrorCode.VALIDATION_FAILED;
    } else if (status === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      code = ErrorCode.RATE_LIMITED;
    } else if (status === Number(HttpStatus.SERVICE_UNAVAILABLE)) {
      code = ErrorCode.DEPENDENCY_UNAVAILABLE;
    } else if (status >= 500) {
      code = ErrorCode.INTERNAL_ERROR;
      message = 'An unexpected error occurred.';
    }

    return { code, message, requestId, fields };
  }
}
