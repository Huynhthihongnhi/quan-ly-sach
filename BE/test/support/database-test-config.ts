export interface DatabaseTestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  migrationUsername: string;
  migrationPassword: string;
}

export function getDatabaseTestConfig(): DatabaseTestConfig {
  return {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USERNAME ?? 'app',
    password: process.env.DATABASE_PASSWORD ?? 'local-app-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    migrationUsername: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    migrationPassword: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
  };
}
