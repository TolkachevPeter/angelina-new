import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'http';
import { join, sep } from 'path';
import { createHash } from 'crypto';
import helmet from 'helmet';
import compression from 'compression';
import { AppConfig } from '../config/configuration';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { THEME_INIT_SCRIPT } from '../theme/theme';

// The only inline script on the page is the no-flash theme initializer. Its hash
// is whitelisted so `script-src` stays free of 'unsafe-inline'. Derived from the
// same constant the template injects, so the two can never drift.
const THEME_INIT_HASH = `'sha256-${createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64')}'`;

/**
 * Applies every cross-cutting concern (security headers, compression, static
 * assets, validation, error handling, logging, CORS) to a Nest app. Shared by
 * `main.ts` and the e2e tests so both exercise the exact same configuration.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const env = config.getOrThrow<AppConfig['env']>('env');
  const trustProxy = config.getOrThrow<boolean>('trustProxy');
  const corsOrigins = config.getOrThrow<string[]>('corsOrigins');
  const isProd = env === 'production';

  if (trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", THEME_INIT_HASH],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'manifest-src': ["'self'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  app.use(compression());

  // Cache policy by asset type. Fonts are content-addressed (UUID filenames) so
  // they are safe to cache immutably for a year. Everything else is NOT
  // content-fingerprinted (app.js, three.min.js, SVGs, favicons), so it uses a
  // short, revalidating TTL — otherwise a deploy would not reach cached clients.
  app.useStaticAssets(join(process.cwd(), 'public'), {
    index: false,
    setHeaders: (res: ServerResponse, filePath: string) => {
      if (filePath.includes(`${sep}fonts${sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (/\.(?:js|css)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      } else {
        // images, favicons, og.png — mutable but change rarely
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, methods: ['GET', 'POST'], maxAge: 600 });
  }

  app.enableShutdownHooks();
}
