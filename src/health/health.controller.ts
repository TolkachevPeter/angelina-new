import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface HealthResponse {
  ok: true;
  service: string;
  status: 'up';
  uptime: number;
  timestamp: string;
}

/**
 * Liveness/readiness endpoints for load balancers, Docker and uptime monitors.
 * Excluded from rate limiting and marked non-cacheable so probes always hit the
 * live process.
 */
@SkipThrottle()
@Controller('api/health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  @Header('Cache-Control', 'no-store')
  check(): HealthResponse {
    return {
      ok: true,
      service: 'belokon-site-backend',
      status: 'up',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Kubernetes-style liveness alias. */
  @Get('live')
  @Header('Cache-Control', 'no-store')
  live(): { ok: true; status: 'up' } {
    return { ok: true, status: 'up' };
  }

  /** Readiness — the process is ready to serve traffic. */
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  ready(): { ok: true; status: 'ready'; uptime: number } {
    return { ok: true, status: 'ready', uptime: Math.round((Date.now() - this.startedAt) / 1000) };
  }
}
