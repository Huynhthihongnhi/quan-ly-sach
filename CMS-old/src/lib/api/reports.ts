import { apiRequest } from './client';

export interface CirculationReport {
  range: { from: string; to: string; timezone: string };
  period: { checkouts: number; returns: number; lost: number };
  asOf: { generatedAt: string; currentlyBorrowed: number; currentlyOverdue: number };
}

export interface InventoryReport {
  asOf: string;
  titles: number;
  physicalCopies: number;
  available: number;
  reservedActive: number;
  borrowed: number;
  repair: number;
  lost: number;
  retired: number;
}

export interface PurchasesReport {
  range: { from: string; to: string };
  submitted: number;
  approved: number;
  rejected: number;
  pendingNow: number;
}

interface DetailResponse<T> {
  data: T;
}

const REPORT_API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export async function fetchCirculationReport(from: string, to: string): Promise<CirculationReport> {
  const response = await apiRequest<DetailResponse<CirculationReport>>(
    `/reports/circulation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return response.data;
}

export async function fetchInventoryReport(): Promise<InventoryReport> {
  const response = await apiRequest<DetailResponse<InventoryReport>>('/reports/inventory');
  return response.data;
}

export async function fetchPurchasesReport(from: string, to: string): Promise<PurchasesReport> {
  const response = await apiRequest<DetailResponse<PurchasesReport>>(
    `/reports/purchases?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return response.data;
}

export function buildDateRangeReportCsvHref(
  report: 'circulation' | 'purchases',
  from: string,
  to: string,
): string {
  return `${REPORT_API_BASE}/reports/${report}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&format=csv`;
}

export function buildInventoryReportCsvHref(): string {
  return `${REPORT_API_BASE}/reports/inventory?format=csv`;
}
