import { useId, useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import SvgIcon from '@mui/material/SvgIcon';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import DialogContentText from '@mui/material/DialogContentText';

import type { FormDrawerProps, FormDrawerCloseReason } from './types';

const submitLabels = { create: 'Thêm mới', edit: 'Lưu thay đổi', delete: 'Xóa', view: 'Lưu' };

export function FormDrawer({
  open,
  title,
  children,
  description,
  mode = 'create',
  onClose,
  onSubmit,
  submitting = false,
  loading = false,
  submitDisabled = false,
  dirty = false,
  error,
  width = 560,
  submitLabel = submitLabels[mode],
  cancelLabel = 'Hủy',
  closeLabel = 'Đóng biểu mẫu',
  pendingLabel = 'Đang xử lý...',
  discardTitle = 'Bỏ thay đổi chưa lưu?',
  discardDescription = 'Những thay đổi trong biểu mẫu sẽ không được lưu.',
  discardLabel = 'Bỏ thay đổi',
  keepEditingLabel = 'Tiếp tục sửa',
  submitErrorMessage = 'Không thể hoàn tất thao tác. Vui lòng thử lại.',
  footerContent,
  contentSx,
}: FormDrawerProps) {
  const id = useId();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardReason, setDiscardReason] = useState<FormDrawerCloseReason | null>(null);
  const busy = pending || submitting || loading;

  useEffect(() => {
    if (!open) {
      setDiscardReason(null);
      setSubmitError(null);
    }
  }, [open]);

  const requestClose = (reason: FormDrawerCloseReason) => {
    if (busy || inFlight.current) return;
    if (dirty) {
      setDiscardReason(reason);
      return;
    }
    onClose(reason);
  };

  const handleSubmit: NonNullable<FormDrawerProps['onSubmit']> = async (event) => {
    event.preventDefault();
    if (!onSubmit || mode === 'view' || busy || submitDisabled || inFlight.current) return;

    inFlight.current = true;
    setPending(true);
    setSubmitError(null);
    try {
      await onSubmit(event);
    } catch {
      // API field errors belong to the caller. Never expose a raw server error here.
      setSubmitError(submitErrorMessage);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        anchor="right"
        onClose={(_event, reason) => requestClose(reason)}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': `${id}-title`,
            'aria-describedby': description ? `${id}-description` : undefined,
            'aria-busy': busy,
            sx: { width: { xs: '100%', sm: width }, maxWidth: '100%', overflow: 'hidden' },
          },
        }}
      >
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit}
          sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
        >
          <Box sx={{ p: 3, display: 'flex', alignItems: 'flex-start', gap: 2, flexShrink: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography id={`${id}-title`} variant="h6" component="h2">
                {title}
              </Typography>
              {description && (
                <Typography id={`${id}-description`} color="text.secondary" sx={{ mt: 1 }}>
                  {description}
                </Typography>
              )}
            </Box>
            <IconButton
              aria-label={closeLabel}
              disabled={busy}
              onClick={() => requestClose('closeButton')}
            >
              <SvgIcon>
                <path d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9z" />
              </SvgIcon>
            </IconButton>
          </Box>

          {busy && <LinearProgress aria-label={pendingLabel} />}

          <Box
            sx={[
              { p: 3, pt: 1, flex: 1, minHeight: 0, overflowY: 'auto' },
              ...(Array.isArray(contentSx) ? contentSx : [contentSx]),
            ]}
          >
            {(error || submitError) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error || submitError}
              </Alert>
            )}
            <Box component="fieldset" disabled={busy} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
              {children}
            </Box>
          </Box>

          <Box
            sx={{
              p: 3,
              gap: 1.5,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexShrink: 0,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {footerContent}
            <Button
              type="button"
              variant="outlined"
              autoFocus={mode === 'delete'}
              disabled={busy}
              onClick={() => requestClose('cancelButton')}
            >
              {cancelLabel}
            </Button>
            {onSubmit && mode !== 'view' && (
              <Button
                type="submit"
                variant="contained"
                color={mode === 'delete' ? 'error' : 'primary'}
                disabled={busy || submitDisabled}
              >
                {busy ? pendingLabel : submitLabel}
              </Button>
            )}
          </Box>
        </Box>
      </Drawer>

      <Dialog
        open={open && discardReason !== null}
        onClose={() => {
          if (!busy) setDiscardReason(null);
        }}
        aria-labelledby={`${id}-discard-title`}
        aria-describedby={`${id}-discard-description`}
      >
        <DialogTitle id={`${id}-discard-title`}>{discardTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText id={`${id}-discard-description`}>
            {discardDescription}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={busy} onClick={() => setDiscardReason(null)}>
            {keepEditingLabel}
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={() => {
              if (busy || inFlight.current || !discardReason) return;
              const reason = discardReason;
              setDiscardReason(null);
              onClose(reason);
            }}
          >
            {discardLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
