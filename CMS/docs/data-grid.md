# Quy ước Data Grid và ExcelJS

Đây là contract triển khai các màn nghiệp vụ. `DataGrid` chưa được nối API thư viện trong CMS mới. Theme Data Grid đã có từ template; helper ExcelJS và drawer đã có source và test riêng.

## Bảng dữ liệu

Dùng `DataGrid` từ `@mui/x-data-grid` Community major 7. Không import API dành cho v8/v9, Pro hoặc Premium vào bộ gói hiện tại. Community giới hạn 100 dòng mỗi trang và có các giới hạn tính năng riêng; xuất Excel tích hợp thuộc Premium. CMS dùng nút riêng gọi ExcelJS nên không phụ thuộc `exportDataAsExcel`. [Pagination v7](https://v7.mui.com/x/react-data-grid/pagination/), [Export v7](https://v7.mui.com/x/react-data-grid/export/).

| Tình huống | Quy ước CMS | Kiểm chứng |
| --- | --- | --- |
| Page | Grid bắt đầu 0, API bắt đầu 1: `page = paginationModel.page + 1` | Trang grid 0 gửi API page 1 |
| Page size | `[20, 50, 100]`, mặc định 20 | Không gửi `-1` hoặc lớn hơn 100 |
| Tổng số dòng | `meta.total` từ API; giữ giá trị gần nhất khi refetch | Không nhảy về trang đầu vì total tạm undefined |
| ID/version | String xuyên suốt query, grid và form | ID > 2^53 vẫn nguyên vẹn |
| Sort | Một cột trong allowlist của endpoint; `email` là tăng, `-email` là giảm | Không gửi `field:direction` hoặc field tự nhập |
| Filters | Thanh lọc nghiệp vụ map DTO, debounce tìm kiếm 300 ms, đổi filter đặt page về 0 | Response cũ không ghi đè filter mới |
| Loading/error | Skeleton/loading overlay; lỗi có nút thử lại; empty khác lỗi | Không biểu diễn lỗi mạng bằng “không có dữ liệu” |
| Quyền | Ẩn/disable thao tác theo permissionCodes từ BE | BE vẫn từ chối request giả mạo |
| Row actions | Xem, thêm, sửa, xóa hoặc chuyển trạng thái qua drawer | Không bật inline editing song song |
| Selection | Chỉ chọn trên trang hiện tại trong v1; reset khi đổi page/filter | Không xuất nhầm ID đã chọn từ trang trước |
| Xóa dòng cuối | Refetch total; chuyển về trang hợp lệ nếu trang hiện tại rỗng | Không mắc kẹt trang rỗng sau xóa |

Các endpoint không cùng hỗ trợ sort/filter. Users hiện cho `id`, `email`, `createdAt`; roles cho `id`, `code`, `createdAt`; permissions cho `id`, `code`; public books cho `id`, `title`, `publicationYear`. Phải đọc DTO/service của admin books, cards, loans, purchases trước bật sort tương ứng; disable sort nếu endpoint chưa hỗ trợ. Không sắp xếp client một trang rồi trình bày như toàn bộ dữ liệu đã được sắp xếp.

Với trang dùng server pagination, sort/filter phải xử lý ở API hoặc bị tắt rõ ràng. Có thể dùng thanh lọc nghiệp vụ bên ngoài grid và `disableColumnFilter` để tránh hiển thị toán tử API không hỗ trợ. Không gửi nguyên `GridFilterModel` cho backend.

Query key ví dụ: `['users', 'list', { page, pageSize, q, status, sort }]`. Chi tiết: `['users', 'detail', id]`. Chuẩn hóa chuỗi rỗng và thứ tự tham số. `queryFn` dùng `axios.get(path, { params, signal })`; response danh sách lấy `{ data, meta }` từ `response.data`, không làm mất `meta` khi unwrap. Chỉ dùng `keepPreviousData` khi UI chỉ rõ đang tải; disable thao tác và export trong thời gian rows còn thuộc truy vấn trước.

## Thêm, sửa, xóa

Form tạo mới nhận defaultValues rỗng. Form sửa tải chi tiết theo ID, không lấy một row thiếu trường làm nguồn đầy đủ. Mount lại form bằng key `${mode}:${id ?? 'new'}` hoặc gọi RHF reset khi đổi bản ghi. Truyền `dirty`, `submitting`, lỗi và `onSubmit` vào `FormDrawer`.

Mutation gửi đúng version/expectedState/expectedName theo tài nguyên. DELETE role dùng `If-Match` có dấu nháy cho version. Không dùng xóa chung cho user/book/loan: user đổi status, book đổi state, loan dùng cancel/return/lost. Khi API từ chối 409, giữ giá trị người dùng, cho tải lại hoặc hủy; không âm thầm ghi đè bằng version mới.

## Xuất Excel

Helper [export-excel.ts](../src/utils/export-excel.ts) dùng dynamic import ExcelJS 4.4.0, tạo workbook trong bộ nhớ rồi tải `.xlsx`. Nó không đọc API và không tự lấy mọi trang.

```ts
import { exportExcel } from 'src/utils/export-excel';

await exportExcel({
  fileName: 'danh-muc-sach',
  sheetName: 'Sách',
  rows: displayedRows,
  columns: [
    { header: 'Mã sách', value: (row) => row.id },
    { header: 'Tên sách', value: (row) => row.title, width: 40 },
    { header: 'Năm xuất bản', value: (row) => row.publicationYear },
  ],
});
```

`displayedRows` do view cung cấp sau khi xác nhận đúng page/filter. Nút v1 ghi **Xuất trang hiện tại** hoặc **Xuất dòng đã chọn**. Caller quản lý `exporting`, disabled, try/catch và thông báo thất bại. Không gắn nhãn “Xuất tất cả” khi chỉ có dữ liệu một trang.

Giới hạn helper là 5.000 dòng mỗi lần. Đây là giới hạn bảo vệ bộ nhớ, chưa phải kết quả benchmark. Phương án xuất mọi kết quả cần task riêng: permission phía BE, truy vấn cùng bộ lọc, giới hạn tổng số dòng, tiến trình/hủy, tính nhất quán giữa các trang và kiểm thử trên thiết bị thực. Dữ liệu lớn nên chuyển job export về BE, vẫn dùng ExcelJS nếu tạo XLSX.

Khai báo allowlist cột bằng `value(row)`; không trải nguyên object từ API. Dữ liệu ô chỉ nhận string, finite number, boolean, Date hợp lệ hoặc null. ID là string để tránh mất độ chính xác. String bắt đầu `=`, `+`, `-`, `@` được ghi thành text, không chuyển thành formula. Không nhận object formula/hyperlink. Ngày báo cáo thuộc `Asia/Ho_Chi_Minh`; ngày lịch nên xuất chuỗi `dd/MM/yyyy`, không cắt ISO UTC để lấy ngày địa phương.

API báo cáo hiện trả JSON/CSV. CMS lấy JSON rồi ánh xạ cột và tạo XLSX bằng ExcelJS. CSV backend vẫn là contract riêng; không đổi đuôi CSV thành `.xlsx`, không thêm SheetJS/`xlsx`. Kiểm thử phải mở lại buffer bằng ExcelJS và so tên cột, kiểu ô, tiếng Việt, ID lớn, chuỗi giống công thức và tập dòng đã chọn.
