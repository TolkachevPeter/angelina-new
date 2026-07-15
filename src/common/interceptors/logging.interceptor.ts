import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Lightweight structured request logging with a per-request id (echoed back as
 * `X-Request-Id`) and response duration — enough to trace requests in
 * production logs without pulling in a full logging stack.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => this.write(method, originalUrl, res.statusCode, start, requestId),
        error: () => this.write(method, originalUrl, res.statusCode || 500, start, requestId),
      }),
    );
  }

  private write(method: string, url: string, status: number, start: number, id: string): void {
    const ms = Date.now() - start;
    this.logger.log(`${method} ${url} ${status} ${ms}ms [${id}]`);
  }
}
