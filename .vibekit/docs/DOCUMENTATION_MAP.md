# Bản đồ tài liệu và trạng thái sử dụng

Rà soát: 2026-09-16. Phạm vi: tài liệu trong kho nguồn MVCK Premium, bao gồm tài liệu được cài vào dự án. Các tab của dự án khác không thuộc phạm vi này.

**Đọc trước:** [hướng dẫn tiếng Việt về bàn giao](PREMIUM_DELIVERY.vi.md), [bán quốc tế](PREMIUM_GLOBAL_SALES.md), [hồ sơ pháp lý đang chờ](PREMIUM_LEGAL_REVIEW.md), rồi [review 4P](PREMIUM_REVIEW_4P.md). Không cần đọc lại toàn bộ hồ sơ nghiên cứu để cài hoặc tặng kit.

## Tài liệu đang dùng tại `.vibekit/docs/`

| File / nhóm file | Khi nào dùng | Trạng thái |
| --- | --- | --- |
| `CONTEXT.md`, `DOCUMENTATION_MAP.md` | Từ vựng, vị trí code, chọn tài liệu | Giữ cập nhật |
| `PREMIUM_START_HERE.md`, `PREMIUM_GUIDE.md`, `INSTALL.md` | Bắt đầu, dùng CLI, cài cả kit | Đang dùng |
| `PREMIUM_DELIVERY.vi.md`, `PREMIUM_FRIEND_HANDOFF.md` | Chủ sở hữu giao file; bạn bè cài và cập nhật | Đang dùng; tiếng Việt giải thích luồng, bản đầy đủ chứa các nhánh kỹ thuật |
| `PREMIUM_SELLING.md`, `PREMIUM_COUPONS.md`, `PREMIUM_GLOBAL_SALES.md` | Chuẩn bị sản phẩm, thanh toán, giảm giá và thị trường | Việc chưa hoàn tất; cấu hình production chưa tồn tại |
| `PREMIUM_LEGAL_REVIEW.md`, `PREMIUM_LICENSE.md`, `PREMIUM_RELEASE.md` | Gửi luật sư, kiểm tra phạm vi giấy phép, chuẩn bị phát hành | Đang dùng; legal/commercial gates còn pending |
| `PREMIUM_ARCHITECTURE.md`, `PREMIUM_MIGRATION.md` | Hiểu thiết kế, nâng cấp và khôi phục | Tham chiếu hiện hành |
| `PREMIUM_SECURITY.md`, `PREMIUM_ENFORCEMENT.md`, `SECURITY_MODEL.md` | Ranh giới bảo mật, chữ ký, quyền provider | Tham chiếu hiện hành; proposal không chứng minh runtime enforcement |
| `PREMIUM_QUALITY.md`, `quality-scope.example.json` | Đo chất lượng code khi có nhu cầu | Hướng dẫn và ví dụ; không phải kết quả đo mới |
| `PREMIUM_COMMANDS.md` | Tra lệnh CLI | Sinh từ code bằng `check-premium.mjs`; không sửa tay |
| `PREMIUM_SOURCES.md` | Nguồn chính thức, phiên bản và thời hạn kiểm tra | Tham chiếu có ngày; phải kiểm tra lại nguồn dễ thay đổi |
| `PREMIUM_REVIEW_4P.md` | Kết quả review 0.6.2 và các việc còn mở | Hồ sơ review có phạm vi; không tự chứng nhận bản sửa sau này |
| `SKILL_PROVENANCE_REVIEW.md` | Đổi tên skill giải thích lại trong 0.6.3, nguồn gốc, MIT và cách chuyển đổi | Review hiện hành cho thay đổi này; chưa phải ý kiến pháp lý |
| `BACKBONE_REFERENCE.md`, `backbone.schema.json` | Định nghĩa và kiểm tra cấu hình dự án | Giữ |
| `TOOLING_GUIDE.md`, `ORCHESTRATION_MODES.md`, `CURSOR_SDK.md` | Tích hợp công cụ và điều phối khi được phép | Giữ; không suy ra quyền chạy từ sự tồn tại của tài liệu |
| `templates/CONTEXT_TEMPLATE.md`, `templates/PRD_TEMPLATE.md` | Khởi tạo tài liệu cho dự án mới | Template đang dùng |
| `premium-schemas/README.md`, `task-brief.schema.json`, `skill-manifest.schema.json` | Hợp đồng dữ liệu và ví dụ | Schema đang dùng; hai JSON nằm trong `premium-schemas/` |
| `licenses/LICENSE`, `licenses/THIRD_PARTY_NOTICES.md` | Mang đúng điều khoản vào dự án khách mà không ghi đè LICENSE của họ | Bắt buộc giữ và đồng bộ byte với bản gốc |
| `RESEARCH_NOTES.md`, `AUTORESEARCH_LEDGER.md` | Tìm lý do thiết kế và kết quả thử cũ | Lịch sử; không dùng số pass cũ làm kết quả hiện tại; installer không chép hai file này |

## Nghiên cứu và hồ sơ tại `docs/premium-minimal/`

Thư mục này có trong kho nguồn và archive của kit, nhưng installer không chép nó vào dự án khách. Các đường dẫn bên dưới là vị trí trong kho nguồn. Hướng dẫn hành động hiện hành nằm tại `.vibekit/docs/`.

| File | Trạng thái và cách dùng |
| --- | --- |
| `README.md` | Mục lục nghiên cứu; dẫn về hướng dẫn hiện hành |
| `00-EXECUTIVE-SUMMARY.md` | Tầm nhìn và đề xuất ban đầu; tham chiếu lịch sử |
| `01-REPO-AUDIT-AND-BLIND-SPOTS.md` | Audit baseline cũ; không phải danh sách lỗi hiện tại |
| `02-PREMIUM-PRODUCT-ARCHITECTURE.md` | Thiết kế đề xuất; đối chiếu ADR hiện hành |
| `03-NPX-SKILL-INTEGRATION-PLAN.md` | Kế hoạch phân phối; ví dụ không chứng minh package đã publish |
| `04-CLOSED-LOOP-ENGINEERING-SKILL.md` | Thiết kế skill; runtime dùng bản canonical trong `.vibekit/skills/` |
| `05-TASK-START-INTERVIEW-AND-CONTEXT-FRESHNESS.md` | Thiết kế bước đầu tác vụ; đối chiếu code và schema hiện hành |
| `06-TASK-END-DECISION-REPORT.md` | Thiết kế báo cáo cuối; không phải hồ sơ tác vụ đang mở |
| `07-CODEX-CONFIG-AND-MULTI-AGENT.md` | Nghiên cứu cấu hình; kiểm tra nguồn hiện tại trước khi áp dụng |
| `08-PROVIDER-SAFETY-POLICIES.md` | Đề xuất chính sách; không chứng minh quyền được cưỡng chế |
| `09-GIT-GH-WORKTREE-WORKFLOW.md` | Thiết kế workflow Git; dùng CLI và hướng dẫn hiện hành |
| `10-COMMIT-PR-HISTORY-REVIEW.md` | Thiết kế review lịch sử; tham chiếu |
| `11-LICENSE-ACTIVATION-AND-UPDATE-SECURITY.md` | Thiết kế dịch vụ; còn phần chưa triển khai |
| `12-IMPLEMENTATION-ROADMAP-AND-TEST-MATRIX.md` | Roadmap gốc; không đánh dấu toàn bộ đã xong |
| `13-REFERENCE-SOURCES.md` | Danh mục nguồn tại thời điểm nghiên cứu; cần làm mới khi dùng |
| `14-IMPLEMENTATION-STATUS.md` | Snapshot triển khai 0.6.0, đã hoàn tất vai trò ghi nhận bản đó |
| `15-CLAUDE_MODS_MVCK_INTEGRATION_ASSESSMENT.md` | Assessment đã viết; tích hợp live chưa hoàn tất và đang để sau |
| `16-PREMIUM_REVIEW_RESULTS.md` | Kết quả review 0.6.0, giữ làm bằng chứng lịch sử |
| `17-LEGAL_REVIEW_BRIEF.md` | Snapshot brief 0.6.1; brief đang dùng chuyển sang `PREMIUM_LEGAL_REVIEW.md`; việc luật sư review vẫn chưa xong |

## Các vị trí còn lại

| Vị trí | Quy tắc sử dụng |
| --- | --- |
| Root `AGENTS.md`, `CLAUDE.md`, `backbone.yml` | Chỉ dẫn và hợp đồng dự án, luôn giữ |
| Root `LICENSE`, `THIRD_PARTY_NOTICES.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` | Điều khoản, nguồn gốc và chính sách hiện hành; không xóa vì một đợt review đã xong |
| Root `README.md`, `docs/README.*.md`, `CHANGELOG.md` | Trang vào, bản dịch và lịch sử phiên bản; badge hiện hành phải khớp package |
| `.vibekit/init/` | Template và runbook cho repo nguồn; chỉ dọn trong dự án khách theo luồng finalize được cho phép |
| `.vibekit/skills/`, `.vibekit/commands/` và các mirror provider | Nội dung runtime. Hoàn thành một tác vụ không làm skill/reference hết giá trị; không xóa mirror như bản sao thừa |
| Các README/instruction trong `.claude`, `.cursor`, `.agents`, `.codex`, `.codex-plugin`, `.opencode`, `.grok`, `.kimi-code`, `.github` | Tích hợp và discovery theo provider; giữ đồng bộ với manifest |
| `.vibekit/tasks/`, `.vibekit/reports/`, `MEMENTO.md` nếu có trong dự án | Xem trạng thái từng tác vụ; refresh trước khi dùng lại evidence |
| `.vibekit/local/releases/0.6.0/`, `0.6.1/`, các bản kế tiếp | Archive và evidence riêng tư; giữ bất biến. Không dùng receipt bản cũ để xác nhận bản mới |
| `.vibekit/local/review-2026-09-16/` | Bằng chứng cho đợt rà soát này; không đi vào package |

## Có thể bỏ tài liệu nào khỏi việc đọc hằng ngày?

Có thể bỏ khỏi danh sách đọc hằng ngày: `RESEARCH_NOTES.md`, `AUTORESEARCH_LEDGER.md`, nghiên cứu 00-13 và snapshot 14, 16, 17. Giữ chúng tại chỗ để bảo toàn liên kết và lịch sử. Assessment 15 chỉ cần khi quay lại việc tích hợp Claude Mods.

Chưa xác nhận file nào an toàn để xóa vĩnh viễn. Tài liệu đã hoàn tất vai trò ghi nhận vẫn có giá trị truy xuất. Danh mục này giảm tài liệu phải đọc, không xóa bằng chứng, điều khoản, schema hoặc reference của skill.
