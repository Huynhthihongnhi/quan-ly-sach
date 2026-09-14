export function isCirculationEnabled(): boolean {
  return process.env.CIRCULATION_ENABLED === '1';
}

export const CIRCULATION_LOANS_TABLE = 'loans';
