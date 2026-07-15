import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('port');
  const env = config.getOrThrow<string>('env');

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`[${env}] listening on http://0.0.0.0:${port}`);
}

void bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
