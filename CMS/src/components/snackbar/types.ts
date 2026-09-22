import type { ReactNode } from 'react';
import type { AlertColor } from '@mui/material/Alert';

/** Reuse MUI's severities so the Alert host maps them 1:1. */
export type SnackbarSeverity = AlertColor; // 'success' | 'info' | 'warning' | 'error'

export type SnackbarOptions = {
  severity?: SnackbarSeverity;
  /** Milliseconds before auto-dismiss. Pass null to keep it until the user closes it. */
  autoHideDuration?: number | null;
};

export type SnackbarItem = {
  id: string;
  message: ReactNode;
  severity: SnackbarSeverity;
  autoHideDuration: number | null;
};
