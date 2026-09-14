import { beWorkingDirectory, loadMigrationRunnerConfig } from './migration-runner/config';
import {
  getStatus,
  migrateDown,
  migrateUp,
  MigrationRunnerError,
  previewDown,
  previewUp,
} from './migration-runner/runner';

type ParsedArgs = {
  command: string;
  flags: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = '', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token?.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { command, flags };
}

function readVersionFlag(flags: Record<string, string | boolean>, key: string): number;
function readVersionFlag(
  flags: Record<string, string | boolean>,
  key: string,
  required: false,
): number | undefined;
function readVersionFlag(
  flags: Record<string, string | boolean>,
  key: string,
  required = true,
): number | undefined {
  const raw = flags[key];
  if (raw === undefined) {
    if (required) {
      throw new MigrationRunnerError(
        `Missing required flag --${key}`,
        'migration_cli_invalid_args',
      );
    }
    return undefined;
  }

  if (typeof raw !== 'string') {
    throw new MigrationRunnerError(`Missing required flag --${key}`, 'migration_cli_invalid_args');
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MigrationRunnerError(
      `Flag --${key} must be a non-negative integer`,
      'migration_cli_invalid_args',
    );
  }

  return parsed;
}

function readConfirmFlag(flags: Record<string, string | boolean>): boolean {
  return flags.confirm === true || flags.confirm === 'true';
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const config = loadMigrationRunnerConfig(beWorkingDirectory());

  switch (command) {
    case 'status': {
      const report = await getStatus(config);
      printJson(report);
      return;
    }
    case 'preview': {
      if (flags.to !== undefined) {
        const targetVersion = readVersionFlag(flags, 'to');
        const report = await previewUp(config, targetVersion);
        printJson(report);
        return;
      }

      if (flags.version !== undefined) {
        const targetVersion = readVersionFlag(flags, 'version');
        const report = await previewDown(config, targetVersion);
        printJson(report);
        return;
      }

      throw new MigrationRunnerError(
        'Preview requires --to <version> for up or --version <version> for down',
        'migration_cli_invalid_args',
      );
    }
    case 'up': {
      const targetVersion = readVersionFlag(flags, 'to', false);
      const report = await migrateUp(config, targetVersion);
      printJson(report);
      return;
    }
    case 'down': {
      const targetVersion = readVersionFlag(flags, 'version');
      const report = await migrateDown(config, targetVersion, readConfirmFlag(flags));
      printJson(report);
      return;
    }
    default:
      throw new MigrationRunnerError(
        'Usage: db-cli <status|preview|up|down> [--to <version>] [--version <version>] [--confirm]',
        'migration_cli_invalid_args',
      );
  }
}

main().catch((error: unknown) => {
  const payload =
    error instanceof MigrationRunnerError
      ? { error: error.message, code: error.errorCode }
      : {
          error: error instanceof Error ? error.message : String(error),
          code: 'migration_cli_failed',
        };

  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exitCode = 1;
});
