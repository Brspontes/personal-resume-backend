import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization'];

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, _response: Response, next: NextFunction): void {
    const { method, originalUrl, body } = request;

    const sanitizedBody = this.sanitizeBody(body);

    this.logger.log(
      sanitizedBody
        ? `${method} ${originalUrl} - body: ${JSON.stringify(sanitizedBody)}`
        : `${method} ${originalUrl}`,
    );

    next();
  }

  private sanitizeBody(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return undefined;
    }

    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(
      entries.map(([key, value]) =>
        SENSITIVE_KEYS.some((sensitive) =>
          key.toLowerCase().includes(sensitive),
        )
          ? [key, '[REDACTED]']
          : [key, value],
      ),
    );
  }
}
