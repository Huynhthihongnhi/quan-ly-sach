import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function exportOpenApi(): Promise<void> {
  process.env.PORT = process.env.PORT ?? '3000';
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.DATABASE_HOST = process.env.DATABASE_HOST ?? '127.0.0.1';
  process.env.DATABASE_PORT = process.env.DATABASE_PORT ?? '3306';
  process.env.DATABASE_USERNAME = process.env.DATABASE_USERNAME ?? 'app';
  process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD ?? 'local-app-change-me';
  process.env.DATABASE_NAME = process.env.DATABASE_NAME ?? 'quan_ly_sach_test';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DataSource)
    .useValue({
      isInitialized: true,
      query: <T>() => Promise.resolve([{ '1': 1 }] as T),
    } as unknown as DataSource)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const config = new DocumentBuilder()
    .setTitle('Quan Ly Sach API')
    .setDescription('OpenAPI contract export for FE/CMS integration')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  const logger = new Logger('OpenApiExport');
  logger.log(`Wrote ${outputPath}`);
}

void exportOpenApi();
