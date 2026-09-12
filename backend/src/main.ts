import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.setGlobalPrefix('v1');
  app.enableCors({ origin: true });
  app.useGlobalFilters(new AllExceptionsFilter());
  // Render (si orice alt host in spatele unui reverse proxy) trimite cererile
  // prin proxy: fara asta, req.ip ar fi acelasi pentru toata lumea si
  // rate limiting-ul per-IP (ex. inregistrari) ar bloca gresit pe toti deodata.
  app.set('trust proxy', 1);

  // Fallback de dezvoltare pentru imagini, cat timp Supabase nu e configurat.
  app.useStaticAssets(join(process.cwd(), 'storage'), {
    prefix: '/static/',
    maxAge: '365d',
    fallthrough: false,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API pornit pe http://localhost:${port}/v1`);
}

void bootstrap();
