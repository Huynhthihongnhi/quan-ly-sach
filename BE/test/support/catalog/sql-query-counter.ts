import { DataSource, Logger } from 'typeorm';

class CountingLogger implements Logger {
  queryCount = 0;

  logQuery(): void {
    this.queryCount += 1;
  }

  logQueryError(): void {}

  logQuerySlow(): void {}

  logSchemaBuild(): void {}

  logMigration(): void {}

  log(): void {}

  warn(): void {}
}

export function withSqlQueryCounter<T>(
  dataSource: DataSource,
  run: (counter: CountingLogger) => Promise<T>,
): Promise<T> {
  const counter = new CountingLogger();
  const previousLogger = dataSource.logger;
  dataSource.logger = counter;
  return run(counter).finally(() => {
    dataSource.logger = previousLogger;
  });
}
