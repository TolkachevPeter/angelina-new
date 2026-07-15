import { Controller, Get, Header, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PagesService } from './pages.service';

/**
 * Owns `GET /` and returns the fully server-rendered landing page. Kept out of
 * the throttler (it is a cached static string) and marked publicly cacheable so
 * a CDN/reverse proxy can serve it at the edge.
 */
@SkipThrottle()
@Controller()
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('/')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=3600, must-revalidate')
  home(@Res() res: Response): void {
    res.send(this.pages.html);
  }
}
