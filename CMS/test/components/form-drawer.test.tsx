import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { FormDrawer, createDrawerStore } from 'src/components/form-drawer';

afterEach(cleanup);

const renderDrawer = (props: Partial<React.ComponentProps<typeof FormDrawer>> = {}) => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const result = render(
    <FormDrawer open title="Thêm sách" onClose={onClose} onSubmit={onSubmit} {...props}>
      <label>
        Tên sách
        <input name="title" />
      </label>
    </FormDrawer>
  );
  return { ...result, onClose, onSubmit };
};

describe('FormDrawer', () => {
  it('exposes a named dialog on the right and submits the form', async () => {
    const { onSubmit } = renderDrawer();
    const dialog = screen.getByRole('dialog', { name: 'Thêm sách' });
    expect(dialog.className).toContain('MuiDrawer-paperAnchorRight');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sách mới' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm mới' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('dialog', { name: 'Thêm sách' })).toBeTruthy();
  });

  it.each([
    ['Hủy', 'cancelButton'],
    ['Đóng biểu mẫu', 'closeButton'],
  ])('closes from %s with its reason', (label, reason) => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onClose).toHaveBeenCalledWith(reason);
  });

  it('closes using Escape and the backdrop', () => {
    const { onClose } = renderDrawer();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('escapeKeyDown');
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
    expect(onClose).toHaveBeenCalledWith('backdropClick');
  });

  it('keeps dirty values until discard is explicitly confirmed', () => {
    const { onClose } = renderDrawer({ dirty: true });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Chưa lưu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục sửa' }));
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Chưa lưu');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng biểu mẫu', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onClose).toHaveBeenCalledWith('closeButton');
  });

  it('blocks duplicate submit, all dismissals and edits while saving', async () => {
    let resolve!: () => void;
    const save = vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        })
    );
    const { onClose } = renderDrawer({ onSubmit: save });
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    fireEvent.click(document.querySelector('.MuiBackdrop-root')!);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đóng biểu mẫu' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('fieldset')!.disabled).toBe(true);
    await act(async () => resolve());
    expect(document.querySelector('fieldset')!.disabled).toBe(false);
  });

  it('keeps input and allows retry after a rejected mutation without exposing raw errors', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('private server detail'))
      .mockResolvedValueOnce(undefined);
    const { onClose } = renderDrawer({ onSubmit: save });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Giữ lại' } });
    fireEvent.submit(document.querySelector('form')!);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Không thể hoàn tất thao tác. Vui lòng thử lại.'
    );
    expect(screen.queryByText('private server detail')).toBeNull();
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Giữ lại');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it('requires an explicit delete submit and focuses cancel', () => {
    const { onSubmit } = renderDrawer({ mode: 'delete', title: 'Xóa tác giả' });
    expect(onSubmit).not.toHaveBeenCalled();
    const cancel = screen.getByRole('button', { name: 'Hủy' });
    expect(document.activeElement).toBe(cancel);
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeTruthy();
  });

  it('never submits a view drawer', () => {
    const { onSubmit } = renderDrawer({ mode: 'view' });
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Lưu' })).toBeNull();
    fireEvent.submit(document.querySelector('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([{ loading: true }, { submitting: true }, { submitDisabled: true }])(
    'blocks submission for %j',
    (props) => {
      const { onSubmit } = renderDrawer(props);
      fireEvent.submit(document.querySelector('form')!);
      expect(onSubmit).not.toHaveBeenCalled();
    }
  );

  it('does not render a closed drawer', () => {
    renderDrawer({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

it('isolates UI selections between features and clears record IDs on create/close', () => {
  const books = createDrawerStore();
  const roles = createDrawerStore();
  books.getState().show({ mode: 'edit', id: '9007199254740993' });
  expect(roles.getState().selection).toBeNull();
  books.getState().show({ mode: 'create' });
  expect(books.getState().selection).toEqual({ mode: 'create' });
  books.getState().close();
  expect(books.getState().selection).toBeNull();
});
