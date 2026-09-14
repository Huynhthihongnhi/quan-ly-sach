import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { BootstrapModule } from '../modules/bootstrap/bootstrap.module';
import { BootstrapService } from '../modules/bootstrap/bootstrap.service';

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'System Administrator';

  if (!email || !password) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
  }

  const app = await NestFactory.createApplicationContext(BootstrapModule, {
    logger: false,
  });

  try {
    const bootstrapService = app.get(BootstrapService);
    const result = await bootstrapService.bootstrapAdmin({
      email,
      password,
      displayName,
      requestId: randomUUID(),
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const payload = {
    error: error instanceof Error ? error.message : String(error),
    code: 'bootstrap_cli_failed',
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
});
