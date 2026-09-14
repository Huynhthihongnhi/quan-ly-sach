# Sơ đồ kiến trúc BE

Sơ đồ minh họa thiết kế, không thể hiện thành phần đã triển khai. Mermaid dùng strict mode, không callback hoặc nguồn ảnh ngoài. Trạng thái kiểm tra: **syntax-reviewed**, chưa parse/render bằng runtime Mermaid trong task này.

## 1. Thành phần chính

```mermaid
---
config:
  securityLevel: strict
  theme: base
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
flowchart LR
    FE("FE độc giả") --> Proxy("Proxy HTTPS")
    CMS("CMS thủ thư") --> Proxy
    Proxy --> API("NestJS API")
    API --> DB[("MySQL")]
    API --> Files[("Kho file riêng")]
    Worker("Worker") --> DB
    Worker --> Mail("Dịch vụ email")

    classDef step fill:#8ECAFF,stroke:#444444,stroke-width:2px,color:#111111
    classDef data fill:#63E6BE,stroke:#444444,stroke-width:2px,color:#111111
    classDef external fill:#FFA94D,stroke:#444444,stroke-width:2px,color:#111111
    class FE,CMS,Proxy,API,Worker step
    class DB,Files data
    class Mail external
    linkStyle default stroke:#444444,stroke-width:1.5px
```

Màu xanh dương là thành phần ứng dụng; xanh ngọc là nơi lưu dữ liệu; cam là dịch vụ email. API và worker dùng chung codebase, giao việc gửi mail qua MySQL outbox. Worker xử lý file nếu được bật sẽ cần cùng quyền đọc vùng quarantine.

## 2. Một phiếu mượn

```mermaid
---
config:
  securityLevel: strict
  theme: base
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
flowchart TD
    Request(["Yêu cầu hợp lệ"]) --> Reserved("reserved: giữ chỗ")
    Reserved -->|Nhận sách| Borrowed("borrowed: đang mượn")
    Reserved -->|Hủy| Cancelled(["cancelled: đã hủy"])
    Reserved -->|Hết giữ chỗ| Expired(["expired: hết chỗ giữ"])
    Borrowed -->|Trả| Returned(["returned: đã trả"])
    Borrowed -->|Báo mất| Lost(["lost: đã mất"])

    classDef step fill:#8ECAFF,stroke:#444444,stroke-width:2px,color:#111111
    classDef terminal fill:#111111,stroke:#444444,stroke-width:2px,color:#FFFFFF
    classDef success fill:#8CE99A,stroke:#444444,stroke-width:2px,color:#111111
    classDef danger fill:#FF8787,stroke:#444444,stroke-width:2px,color:#111111
    class Request,Cancelled,Expired terminal
    class Reserved,Borrowed step
    class Returned success
    class Lost danger
    linkStyle default stroke:#444444,stroke-width:1.5px
```

Xanh dương là trạng thái giữ bản sách; xanh lá là đã trả; đỏ là mất; nền đen là đầu vào hoặc kết thúc khác. `overdue` là điều kiện thời gian của borrowed. Mất sách đồng thời chuyển condition copy sang lost để copy không quay lại tồn khả dụng.

Chi tiết khóa, quyền và transaction nằm trong [business flows](06-business-flows.md). Quan hệ bảng xem [sơ đồ database gốc](../../planning/database/schema-diagrams.md).
