# Mẫu evidence

Sao chép nội dung bên dưới tới `planning/evidence/<TASK-ID>.md` khi nhận việc. Thay placeholder; không coi file mẫu là evidence. Không lưu secrets, token, password, dữ liệu cá nhân thật hoặc log nguyên bản chưa lọc.

```text
Task: S0-01
Verdict: IN_PROGRESS
Owner: ten-nguoi-thuc-hien
Date: YYYY-MM-DD
Revision: commit-hoac-sha256-artifact
Scope: file/module/hanh-vi-da-kiem-tra
Test cases: TST-S0-01
Commands: lenh-thuc-te-da-chay
Results: exit-code-va-ket-qua-thuc
Review: nguoi-review-va-pham-vi
Limitations: phan-chua-kiem-tra
```

Khi done, `Verdict: PASS`; Commands phải là lệnh thật hoặc `manual: <bước và người xác nhận>`, Results mô tả quan sát thật. Với code TDD thêm ca thất bại trước sửa, nguyên nhân thất bại, kết quả sau sửa và hồi quy. Với decision task thêm các lựa chọn đã chốt và nơi lưu xác nhận. Chưa có môi trường thì ghi NOT_RUN trong Results và không đổi done.
