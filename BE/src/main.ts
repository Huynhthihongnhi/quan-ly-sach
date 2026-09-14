import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { configureApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApp(app);

  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  await app.listen(config.port);
  logger.log(`API listening on port ${config.port}`);
}

void bootstrap();
