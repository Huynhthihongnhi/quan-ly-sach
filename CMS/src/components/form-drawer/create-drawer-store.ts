import { create } from 'zustand';

import type { FormDrawerMode } from './types';

export type DrawerSelection =
  | { mode: 'create'; id?: never }
  | { mode: Exclude<FormDrawerMode, 'create'>; id: string };

/** Create once per feature, outside render. Store IDs, never form values or API rows. */
export function createDrawerStore() {
  return create<{
    selection: DrawerSelection | null;
    show: (selection: DrawerSelection) => void;
    close: () => void;
  }>((set) => ({
    selection: null,
    show: (selection) => set({ selection }),
    close: () => set({ selection: null }),
  }));
}
