import type { FormEvent, ReactNode } from 'react';
import type { Theme, SxProps } from '@mui/material/styles';

export type FormDrawerMode = 'create' | 'edit' | 'delete' | 'view';

export type FormDrawerCloseReason =
  | 'closeButton'
  | 'cancelButton'
  | 'escapeKeyDown'
  | 'backdropClick';

export type FormDrawerProps = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  mode?: FormDrawerMode;
  onClose: (reason: FormDrawerCloseReason) => void;
  /** Resolve after saving; reject to keep the drawer open and show an error. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<unknown>;
  /** The caller closes the drawer only after a successful mutation. */
  submitting?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  /** Pass React Hook Form's formState.isDirty when using a form provider. */
  dirty?: boolean;
  error?: ReactNode;
  width?: number | string;
  submitLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  pendingLabel?: string;
  discardTitle?: string;
  discardDescription?: string;
  discardLabel?: string;
  keepEditingLabel?: string;
  submitErrorMessage?: string;
  footerContent?: ReactNode;
  contentSx?: SxProps<Theme>;
};
