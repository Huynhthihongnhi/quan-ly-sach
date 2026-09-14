import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { OutboxWorkerRunner } from './modules/messaging/outbox-worker.runner';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = new Logger('WorkerBootstrap');
  const runner = app.get(OutboxWorkerRunner);

  app.enableShutdownHooks();
  logger.log('Worker context started');

  const shutdown = (): void => {
    runner.requestStop();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await runner.runUntilStopped();
  await app.close();
}

void bootstrap();
