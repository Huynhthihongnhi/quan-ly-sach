import { create } from 'zustand';

import type { SnackbarItem, SnackbarOptions, SnackbarSeverity } from './types';

/** One global toast queue for the whole app. Create it once, not per feature. */
const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 4000;

let seq = 0;
const nextId = () => {
  seq += 1;
  return `snackbar-${seq}`;
};

type Notify = (message: SnackbarItem['message'], options?: SnackbarOptions) => string;

type SnackbarState = {
  notifications: SnackbarItem[];
  notify: Notify;
  success: Notify;
  error: Notify;
  warning: Notify;
  info: Notify;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useSnackbarStore = create<SnackbarState>((set) => {
  const push = (severity: SnackbarSeverity): Notify => (message, options = {}) => {
    const item: SnackbarItem = {
      id: nextId(),
      message,
      severity: options.severity ?? severity,
      autoHideDuration:
        options.autoHideDuration === undefined ? DEFAULT_DURATION : options.autoHideDuration,
    };
    // Cap the queue so a burst of mutations cannot flood the screen.
    set((state) => ({ notifications: [...state.notifications, item].slice(-MAX_VISIBLE) }));
    return item.id;
  };

  return {
    notifications: [],
    notify: push('info'),
    success: push('success'),
    error: push('error'),
    warning: push('warning'),
    info: push('info'),
    dismiss: (id) =>
      set((state) => ({ notifications: state.notifications.filter((item) => item.id !== id) })),
    clear: () => set({ notifications: [] }),
  };
});

/**
 * Non-hook accessor for code that runs outside React, such as an Axios response
 * interceptor or a TanStack Query mutation callback defined outside a component.
 * Inside components prefer useSnackbar().
 */
export const snackbar = {
  notify: ((message, options) => useSnackbarStore.getState().notify(message, options)) as Notify,
  success: ((message, options) => useSnackbarStore.getState().success(message, options)) as Notify,
  error: ((message, options) => useSnackbarStore.getState().error(message, options)) as Notify,
  warning: ((message, options) => useSnackbarStore.getState().warning(message, options)) as Notify,
  info: ((message, options) => useSnackbarStore.getState().info(message, options)) as Notify,
  dismiss: (id: string) => useSnackbarStore.getState().dismiss(id),
  clear: () => useSnackbarStore.getState().clear(),
};
