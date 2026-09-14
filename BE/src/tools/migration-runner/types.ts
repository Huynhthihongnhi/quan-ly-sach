export type MigrationDirection = 'up' | 'down';

export type MigrationState = 'running' | 'applied' | 'failed' | 'rolled_back';

export interface MigrationFilePair {
  version: number;
  name: string;
  upPath: string;
  downPath: string;
  upChecksum: string;
  downChecksum: string;
}

export interface MigrationHistoryRow {
  version: number;
  name: string;
  upChecksum: string;
  downChecksum: string;
  state: MigrationState;
  direction: MigrationDirection;
  runnerId: string;
  startedAt: Date;
  finishedAt: Date | null;
  errorCode: string | null;
}

export interface MigrationRunnerConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  migrationsDir: string;
  lockName: string;
  lockTimeoutSeconds: number;
}

export interface MigrationPlanEntry {
  version: number;
  name: string;
  direction: MigrationDirection;
  upChecksum: string;
  downChecksum: string;
  status: 'pending' | 'applied' | 'failed' | 'running' | 'rolled_back' | 'missing_history';
}
