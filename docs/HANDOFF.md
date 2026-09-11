# Tiếp tục dự án từ đây

Cập nhật: 2026-09-11. Phân biệt prototype, kế hoạch và sản phẩm đã triển khai.

## Quyền và quy trình

- Trình file/phạm vi và chờ xác nhận trước khi sửa, tạo, xóa hoặc format mã nguồn; làm liên tục trong phạm vi đã duyệt.
- Cuối lượt có thay đổi: kiểm tra staged diff/secrets và commit có chọn lọc; không empty commit. Người dùng đã yêu cầu xử lý push/PR; dùng nhánh review, không tự merge/force-push.
- Remote: https://github.com/lebaanhminh2/Tro-ly-AI.git. Checkpoint trước cơ cấu: `f37233c`.
- Không tự gọi API, bật billing, deploy hoặc đọc/in secrets. Đọc docs theo nhiệm vụ, không nạp hết mặc định.

## Trạng thái hiện tại

- Đã cơ cấu theo phê duyệt: code thử/memory/fixtures ở `experiments/ai-trial/`; unit ở `tests/unit/`, tích hợp D1 ở `tests/integration/`.
- `src/domain/time.ts` là nguồn hàm ngày dùng chung; runtime không import experiments/tests.
- P1 đã triển khai cấu trúc entrypoints/application/domain/ports/adapters/config và transaction command + task + outbox; xem [P1_ACCEPTANCE.md](P1_ACCEPTANCE.md).
- Không thêm chức năng sản phẩm hoặc gọi API trong đợt cơ cấu. Local bot vẫn là prototype, chưa deploy/Calendar thật.
- Live đã dừng: tổng 31 request toàn dự án, kết luận tại [MODEL_VERDICT.md](MODEL_VERDICT.md). Không mở lại chiến dịch cũ.
- Audit gần nhất trước cơ cấu: 0 với overrides sharp/undici; không coi là chứng nhận bảo mật.

## Bước tiếp theo

Đợt sửa review P4 đã được duyệt: hủy nhắc local khi remote đổi/xóa, fencing toàn bộ writer, tách lỗi đọc trước POST khỏi uncertain insert. Thay đổi tại Calendar service và regression tests; không API thật/deploy/merge.

P4 đã hoàn tất bàn giao code/local sau lượt bị ngắt: 40/40 tests mặc định, 25/25 experiments, typecheck/dry-run pass; migration 0007 local đã áp dụng. Xem P4_ACCEPTANCE trước bước tiếp theo: cần review giới hạn Calendar/session-link và cấu hình staging trước pilot, không tự bật live hoặc merge.

P4 được duyệt và triển khai local: Google adapter/OAuth+vault, sync/slots, confirmed write/reconcile; migration 0007. [P4_ACCEPTANCE.md](P4_ACCEPTANCE.md) ghi test và giới hạn. Calendar/AI thật vẫn off; chưa consent/live/deploy. Không tự merge PR.

Review P1–P3: đã sửa phạm vi nghỉ (giữ nhắc ngày sau), xác nhận xóa memory dùng một lần/expiry, phân trang memory và sent_at cho khoảng follow-up. Migration 0006; regression tại tests/integration/review-fixes.test.ts. Không merge/deploy/API thật trong đợt sửa.

Kết quả mới nhất: 36/36 tests mặc định + 25/25 experiments, typecheck/migration 0006 local/Workers dry-run đều pass. Bốn findings đã có regression; không coi đây là audit bảo mật toàn diện.

GitHub: [PR #1](https://github.com/lebaanhminh2/Tro-ly-AI/pull/1), base main=checkpoint f37233c, head review/p1-p3. Nhánh làm việc review/p1-p3, chưa merge. Kết quả P3: 35 tests + 25 experiments, typecheck/migration/dry-run pass. Tiếp theo review PR hoặc trình P4, không tự gọi AI thật.

P3 được duyệt và triển khai local: memory/history/focus/expiry, AI toggle, contextual adapter và quota D1. Xem [P3_ACCEPTANCE.md](P3_ACCEPTANCE.md). Không gọi API AI thật thêm. Người dùng đã yêu cầu xử lý push/PR GitHub; được phép đưa code đã scan lên remote và mở PR, không tự merge.

P2 người dùng đã duyệt với quy tắc **2 lượt mỗi lần hẹn, không trần theo ngày**. Đã triển khai local sessions/Today/nhắc/settings; bằng chứng và giới hạn tại [P2_ACCEPTANCE.md](P2_ACCEPTANCE.md). Không tự mở P3 hoặc gọi API/live.

1. P1 đã được người dùng duyệt và thực hiện local; ghi kết quả tại P1_ACCEPTANCE. Không tự suy đã duyệt D1–D6 toàn bộ.
2. Mốc tiếp theo P2 (Today/session/nhắc), trình phạm vi trước khi code. Không cấu hình BotFather hoặc deploy mặc định.
3. Dùng kết luận model đã có; giải quyết dữ liệu AI trước live cá nhân, không thử prompt vô hạn.

## Đọc theo nhu cầu

| Nhiệm vụ | Nguồn |
| --- | --- |
| Mốc, phạm vi và tiêu chí | [DELIVERY_PLAN.md](DELIVERY_PLAN.md) |
| Persona/người dùng | [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) |
| Module/database/nhớ | [DATA_DESIGN.md](DATA_DESIGN.md) |
| UI và luồng | [UX_FLOWS.md](UX_FLOWS.md) |
| Bảo mật/phát hành | [SECURITY_RELEASE.md](SECURITY_RELEASE.md) |
| Prompt giao việc | [VIBE_WORKFLOW.md](VIBE_WORKFLOW.md) |
| Prototype và cách chạy | [LOCAL_BOT.md](LOCAL_BOT.md) |
| Mục lục/nguồn lịch sử | [README.md](README.md) |
