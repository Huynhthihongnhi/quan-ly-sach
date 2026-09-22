import { useSnackbarStore } from './snackbar-store';

/**
 * Access the toast queue from a component. Each action is a stable reference,
 * so calling this hook does not add re-renders. Example:
 *   const { success, error } = useSnackbar();
 *   success('Đã thêm sách mới.');
 */
export function useSnackbar() {
  const notify = useSnackbarStore((state) => state.notify);
  const success = useSnackbarStore((state) => state.success);
  const error = useSnackbarStore((state) => state.error);
  const warning = useSnackbarStore((state) => state.warning);
  const info = useSnackbarStore((state) => state.info);
  const dismiss = useSnackbarStore((state) => state.dismiss);
  const clear = useSnackbarStore((state) => state.clear);

  return { notify, success, error, warning, info, dismiss, clear };
}
