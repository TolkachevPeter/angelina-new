import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Res } from '@nestjs/common';
import { SeoService } from './seo.service';

/**
 * Serves the crawler-facing text endpoints. Both are cached at the CDN/proxy
 * layer for a day; they are cheap to regenerate and never user-specific.
 */
@SkipThrottle()
@Controller()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  robots(): string {
    return this.seo.robots();
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  sitemap(@Res() res: Response): void {
    res.send(this.seo.sitemap());
  }
}
