import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const expressClientErrorStatus = isHttpException
      ? undefined
      : this.extractExpressClientErrorStatus(exception);

    const status = isHttpException
      ? exception.getStatus()
      : (expressClientErrorStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const message = isHttpException
      ? this.extractMessage(exception)
      : expressClientErrorStatus
        ? (exception as Error).message
        : 'Internal server error';

    if (!isHttpException && !expressClientErrorStatus) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unknown error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    response.status(status).json(body);
  }

  private extractMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const message = (response as { message?: string | string[] }).message;
    return message ?? exception.message;
  }

  // Express-level middleware (body-parser, etc.) throws plain `http-errors`
  // instances with a numeric `status`, not a NestJS HttpException.
  private extractExpressClientErrorStatus(
    exception: unknown,
  ): number | undefined {
    if (typeof exception !== 'object' || exception === null) {
      return undefined;
    }
    const status = (exception as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return status;
    }
    return undefined;
  }
}
