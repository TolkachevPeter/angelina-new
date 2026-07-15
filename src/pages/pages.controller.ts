import { Controller, Get, Header, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { PagesService } from './pages.service';

/**
 * Serves the server-rendered landing page per language: `/` (English, default),
 * `/ru` and `/fr`. Each is a cached static string, kept out of the throttler and
 * marked publicly cacheable so a CDN/reverse proxy can serve it at the edge.
 */
@SkipThrottle()
@Controller()
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('/')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=3600, must-revalidate')
  @Header('Content-Language', 'en')
  en(@Res() res: Response): void {
    res.send(this.pages.html('en'));
  }

  @Get('/ru')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=3600, must-revalidate')
  @Header('Content-Language', 'ru')
  ru(@Res() res: Response): void {
    res.send(this.pages.html('ru'));
  }

  @Get('/fr')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=3600, must-revalidate')
  @Header('Content-Language', 'fr')
  fr(@Res() res: Response): void {
    res.send(this.pages.html('fr'));
  }
}
