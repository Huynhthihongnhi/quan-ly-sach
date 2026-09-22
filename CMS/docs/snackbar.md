# Snackbar dùng chung

Source: [snackbar-provider.tsx](../src/components/snackbar/snackbar-provider.tsx), [snackbar-store.ts](../src/components/snackbar/snackbar-store.ts), [use-snackbar.ts](../src/components/snackbar/use-snackbar.ts), [types.ts](../src/components/snackbar/types.ts), [test](../test/components/snackbar.test.tsx).

Thông báo toast dùng chung cho toàn CMS. Một hàng đợi toàn cục giữ trong Zustand, một host `SnackbarProvider` render các `Alert` của MUI. Bất kỳ nơi nào cũng phát được một thông báo mà không cần truyền prop. Dùng cho phản hồi sau thao tác: thêm, sửa, xóa, xuất dữ liệu thành công hoặc thất bại.

## Gắn host một lần

`SnackbarProvider` đã được gắn trong [app.tsx](../src/app.tsx), bên trong `ThemeProvider`, bao quanh nội dung route. Toast hiện ở góc trên bên phải, xếp chồng dọc, `zIndex` bằng `theme.zIndex.snackbar` nên nổi trên Drawer và Dialog. Không gắn host lần thứ hai.

## Phát thông báo trong component

```tsx
import { useSnackbar } from 'src/components/snackbar';

function BookForm() {
  const { success, error } = useSnackbar();

  const onSubmit = async () => {
    // ... gọi mutation
    success('Đã thêm sách mới vào danh mục.');
  };
}
```

Các hàm từ `useSnackbar()` có tham chiếu ổn định, gọi hook không thêm re-render.

## Phát thông báo ngoài React

Dùng accessor `snackbar` cho code chạy ngoài component, ví dụ interceptor Axios hoặc callback định nghĩa ngoài component:

```ts
import { snackbar } from 'src/components/snackbar';

axios.interceptors.response.use(undefined, (err) => {
  snackbar.error('Mất kết nối tới máy chủ.');
  return Promise.reject(err);
});
```

## API

| Hàm | Cách dùng |
| --- | --- |
| `success`, `error`, `warning`, `info` | Phát toast theo mức; nhận `message` và `options` |
| `notify(message, options)` | Phát toast, mặc định mức `info` |
| `dismiss(id)` | Đóng một toast theo id trả về từ hàm phát |
| `clear()` | Xóa toàn bộ hàng đợi |

`options`:

| Trường | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `severity` | theo hàm gọi | Ghi đè mức hiển thị |
| `autoHideDuration` | 4000 ms | Thời gian tự ẩn; đặt `null` để giữ tới khi người dùng đóng |

## Quy tắc

- Hàng đợi giữ tối đa 4 toast gần nhất; một loạt mutation không làm tràn màn hình.
- Toast báo kết quả chung sau thao tác. Lỗi trường của form vẫn thuộc React Hook Form, và `FormDrawer` tự hiện lỗi chung trong drawer; không lặp lại cùng một lỗi bằng cả drawer và snackbar.
- Chỉ đặt chuỗi hiển thị bằng tiếng Việt, không nhét dữ liệu nhạy cảm hoặc lỗi thô từ server vào message.

Tài liệu đúng major: [MUI 7 Alert](https://v7.mui.com/material-ui/react-alert/), [Zustand](https://github.com/pmndrs/zustand).
