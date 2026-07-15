import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { AppConfig } from './config/configuration';
import { LeadsModule } from './leads/leads.module';
import { PagesModule } from './pages/pages.module';
import { SeoModule } from './seo/seo.module';
import { HealthController } from './health/health.controller';

// Static assets (fonts, images, favicons, manifest) are served in main.ts via
// `useStaticAssets` with fallthrough, so unmatched paths reach the Nest router
// and return a real 404 — this is a server-rendered site, not a SPA, so there
// is deliberately no index.html fallback.
@Module({
  imports: [
    AppConfigModule,
    // Rate limiting (defaults from config; per-endpoint overrides via decorators).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.getOrThrow<AppConfig['throttle']>('throttle');
        return { throttlers: [{ ttl: t.ttlSeconds * 1000, limit: t.limit }] };
      },
    }),
    PagesModule,
    SeoModule,
    LeadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
