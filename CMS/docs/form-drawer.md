# FormDrawer dùng chung

Source: [form-drawer.tsx](../src/components/form-drawer/form-drawer.tsx), [types.ts](../src/components/form-drawer/types.ts), [test](../test/components/form-drawer.test.tsx).

Drawer trượt từ bên phải, rộng mặc định 560 px trên desktop và toàn chiều rộng trên màn hình nhỏ. Header/footer giữ vị trí, nội dung tự cuộn. Component dùng theme MUI hiện có, có tên dialog cho trình đọc màn hình và giữ cơ chế quản lý focus của MUI.

| Prop | Cách dùng |
| --- | --- |
| `open`, `title`, `children`, `onClose` | Bắt buộc; parent quản lý mở/đóng và nội dung |
| `mode` | `create`, `edit`, `delete`, `view`; mặc định create |
| `onSubmit` | Handler form, có thể trả Promise; view không submit |
| `dirty` | Bật xác nhận bỏ thay đổi khi đóng, kể cả Escape/backdrop |
| `submitting`, `loading` | Khóa input chuẩn HTML, submit và mọi đường đóng do người dùng |
| `submitDisabled` | Chặn submit, vẫn cho đóng |
| `error` | Lỗi chung từ caller; lỗi field đặt qua RHF |
| `width`, `contentSx`, `footerContent` | Điều chỉnh kích thước, nội dung, thông tin phụ ở footer |
| `submitLabel`, `cancelLabel`, `closeLabel`, `pendingLabel` | Đổi nhãn theo nghiệp vụ |
| `discardTitle`, `discardDescription`, `discardLabel`, `keepEditingLabel`, `submitErrorMessage` | Đổi nội dung xác nhận và lỗi chung |

`onClose(reason)` nhận `closeButton`, `cancelButton`, `escapeKeyDown` hoặc `backdropClick`. Parent chỉ đổi `open=false` khi chấp nhận đóng. Component không thể ngăn parent cưỡng bức unmount hoặc chuyển route; guard chuyển route là trách nhiệm của màn nghiệp vụ.

`onSubmit` phải trả/await Promise của mutation để khóa thao tác tới khi hoàn tất. Component bắt rejection, giữ drawer và hiển thị lỗi chung. Caller đóng sau thành công và invalidate cache; component không tự suy ra mutation đã hoàn tất từ việc handler được gọi. `mode='delete'` đặt nút nguy hiểm và focus ban đầu ở Hủy. `mode='view'` bỏ nút submit; caller render nội dung chỉ đọc.

## Ví dụ React Hook Form

Ví dụ dưới dùng payload chỉ có tên để minh họa, không phải DTO hoàn chỉnh cho sách. `save` phải map DTO/version và xử lý lỗi trường theo tài nguyên. Component sở hữu thẻ `<form>`, vì vậy dùng `FormProvider` của RHF, không bọc bằng `Form` hiện có vốn tạo thêm một thẻ `<form>`.

```tsx
import { FormProvider, useForm } from 'react-hook-form';
import TextField from '@mui/material/TextField';
import { FormDrawer } from 'src/components/form-drawer';

type Values = { name: string };

export function NameDrawer({ initial, save, close }: {
  initial: Values;
  save: (values: Values) => Promise<void>;
  close: () => void;
}) {
  const methods = useForm<Values>({ defaultValues: initial });
  return (
    <FormProvider {...methods}>
      <FormDrawer
        open
        title="Sửa thông tin"
        mode="edit"
        dirty={methods.formState.isDirty}
        submitting={methods.formState.isSubmitting}
        onClose={close}
        onSubmit={methods.handleSubmit(async (values) => {
          await save(values);
          close();
        })}
      >
        <TextField
          fullWidth
          label="Tên"
          {...methods.register('name', { required: 'Vui lòng nhập tên' })}
          error={!!methods.formState.errors.name}
          helperText={methods.formState.errors.name?.message}
        />
      </FormDrawer>
    </FormProvider>
  );
}
```

Khi chọn bản ghi khác, parent mount ví dụ bằng `key={record.id}`; không kỳ vọng `defaultValues` tự cập nhật. Khi tạo mới dùng key khác và dữ liệu rỗng. Field tùy biến không dùng input/button chuẩn phải nhận `disabled` từ caller; fieldset không thể vô hiệu hóa mọi widget tự viết.

## Zustand cho danh sách có nhiều thao tác

```ts
import { createDrawerStore } from 'src/components/form-drawer';

// Định nghĩa một lần ở module sách; module roles tạo store riêng.
export const useBooksDrawer = createDrawerStore();

useBooksDrawer.getState().show({ mode: 'create' });
useBooksDrawer.getState().show({ mode: 'edit', id: '123' });
useBooksDrawer.getState().show({ mode: 'delete', id: '123' });
useBooksDrawer.getState().close();
```

Trong component dùng selector `useBooksDrawer((state) => state.selection)`. Store không giữ form, phiên hoặc row API; Query tải chi tiết theo ID. `show({ mode: 'create' })` xóa ID cũ. Mỗi feature sở hữu store để đóng drawer này không tác động drawer khác.

Mẫu chạy local: `/dev/form-drawer` khi `npm run dev`. Route chỉ đăng ký trong chế độ dev, không có trong production build. Dữ liệu minh họa nằm trong bộ nhớ và không gọi backend.
