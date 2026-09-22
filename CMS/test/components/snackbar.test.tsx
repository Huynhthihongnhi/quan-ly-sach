import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { snackbar, useSnackbar, SnackbarProvider, useSnackbarStore } from 'src/components/snackbar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useSnackbarStore.setState({ notifications: [] });
});

describe('Snackbar', () => {
  it('shows a success alert with the message when success() is called', () => {
    render(<SnackbarProvider />);
    act(() => {
      snackbar.success('Đã thêm sách mới vào danh mục.');
    });
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Đã thêm sách mới vào danh mục.')).toBeTruthy();
    expect(alert.className).toContain('MuiAlert-filledSuccess');
  });

  it('renders error severity for error()', () => {
    render(<SnackbarProvider />);
    act(() => {
      snackbar.error('Không thể lưu. Vui lòng thử lại.');
    });
    expect(screen.getByRole('alert').className).toContain('MuiAlert-filledError');
  });

  it('dismisses when the close button is clicked', () => {
    render(<SnackbarProvider />);
    act(() => {
      snackbar.info('Thông báo tạm.');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('auto-hides after the given duration', () => {
    vi.useFakeTimers();
    render(<SnackbarProvider />);
    act(() => {
      snackbar.success('Tự ẩn', { autoHideDuration: 2000 });
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the alert until dismissed when autoHideDuration is null', () => {
    vi.useFakeTimers();
    render(<SnackbarProvider />);
    act(() => {
      snackbar.warning('Ở lại tới khi đóng', { autoHideDuration: null });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps only the most recent notifications when many arrive at once', () => {
    render(<SnackbarProvider />);
    act(() => {
      for (let i = 1; i <= 6; i += 1) snackbar.info(`Thông báo ${i}`);
    });
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    expect(screen.queryByText('Thông báo 1')).toBeNull();
    expect(screen.getByText('Thông báo 6')).toBeTruthy();
  });

  it('pushes the same queue through the useSnackbar hook', () => {
    function Trigger() {
      const { success } = useSnackbar();
      return (
        <button type="button" onClick={() => success('Từ hook')}>
          Gửi
        </button>
      );
    }
    render(
      <SnackbarProvider>
        <Trigger />
      </SnackbarProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(screen.getByText('Từ hook')).toBeTruthy();
  });
});
