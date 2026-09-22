import type { ReactNode } from 'react';

import { useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Portal from '@mui/material/Portal';

import { useSnackbarStore } from './snackbar-store';

import type { SnackbarItem } from './types';

const CLOSE_TEXT = 'Đóng thông báo';

/**
 * Mount once, high in the tree and inside ThemeProvider, wrapping the app.
 * It renders the toast stack from the global store; anything can push a toast
 * with useSnackbar() or the snackbar accessor without prop drilling.
 */
export function SnackbarProvider({ children }: { children?: ReactNode }) {
  const notifications = useSnackbarStore((state) => state.notifications);
  const dismiss = useSnackbarStore((state) => state.dismiss);

  return (
    <>
      {children}
      <Portal>
        <Stack
          spacing={1.5}
          sx={{
            position: 'fixed',
            top: (theme) => theme.spacing(3),
            right: (theme) => theme.spacing(3),
            zIndex: (theme) => theme.zIndex.snackbar,
            width: { xs: 'calc(100% - 32px)', sm: 360 },
            maxWidth: 'calc(100% - 32px)',
            pointerEvents: 'none',
          }}
        >
          {notifications.map((item) => (
            <SnackbarRow key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </Stack>
      </Portal>
    </>
  );
}

function SnackbarRow({ item, onDismiss }: { item: SnackbarItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (item.autoHideDuration === null) return undefined;
    const timer = setTimeout(() => onDismiss(item.id), item.autoHideDuration);
    return () => clearTimeout(timer);
  }, [item.autoHideDuration, item.id, onDismiss]);

  return (
    <Alert
      variant="filled"
      severity={item.severity}
      closeText={CLOSE_TEXT}
      onClose={() => onDismiss(item.id)}
      sx={{ pointerEvents: 'auto', boxShadow: 3, alignItems: 'center' }}
    >
      {item.message}
    </Alert>
  );
}
