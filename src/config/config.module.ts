import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validateEnv } from './env.validation';

/**
 * Global config: loads `.env`, validates the environment at boot, and exposes
 * the typed `configuration()` tree app-wide.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
