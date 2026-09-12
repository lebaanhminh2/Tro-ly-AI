> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# P1 — nền backend và công việc

Ngày 2026-09-11. Phạm vi người dùng đã duyệt: cơ cấu nền, task/proposal, authorization, giao dịch inbox/outbox, kiểm thử local; không API thật/push/deploy.

## Kết quả nghiệm thu kỹ thuật local

Đã chạy: **32/32 tests mặc định, 25/25 experiments**, typecheck, migration 0003 trên D1 local, Workers dry-run đều đạt. `npm audit`: 0 vulnerabilities được báo cáo. Đây là bằng chứng local, không phải SLA/bảo đảm an toàn tuyệt đối.

| Tiêu chí P1 | Bằng chứng |
| --- | --- |
| Module có trách nhiệm rõ | entrypoints nhận request, application lập command plan/xử lý inbox, domain types/rules, ports giao diện store, adapters D1/Telegram, config env |
| Ghi/xem/sửa việc | Integration webhook: capture → xác nhận → danh sách → chọn hạn → ngày rõ → xác nhận |
| Atomicity | Fault injection ở cuối D1 batch: task/proposal/command/outbox rollback cùng nhau, rồi retry commit thành công |
| Chống xử lý trùng | Duplicate update/confirm, retry commit sau mất receipt không tạo task/version/outbox trùng |
| Owner/version | Query và callback sai owner không truy cập; proposal cũ không ghi đè version mới |
| Concurrency | Lease theo owner, token fencing; worker cũ commit/release không ảnh hưởng lease mới; lệnh chọn ngày/nhập ngày xử lý tuần tự |
| Recovery | Inbox pending đã lưu được xử lý sau tiến trình mới; attempts cap trả kết quả lỗi rõ, không có partial mutation |
| Persistence | Miniflare D1 lưu trên disk: dispose runtime và mở lại, task/result/outbox còn nguyên |
| Tương thích | Typecheck, test legacy experiments, migration 0003 local và Worker dry-run |

## Luồng mới

- Webhook lưu `command_inbox` theo owner/update ID. Duplicate không chạy lại command.
- Worker claim owner lease; đọc state và tạo Plan không ghi. D1 adapter commit Plan trong batch transaction, có guard token/version.
- Task mutation, proposal resolution, command result, audit và outbox cùng commit. Không còn khoảng hở “đã ghi task nhưng chưa ghi kết quả command”.
- Gửi Telegram ngoài transaction; sender có claim token, vẫn giữ uncertain khi không rõ đã gửi. Không hứa exactly-once delivery.
- Migration 0001/0002 được giữ nguyên; 0003 bổ sung schema và giữ ledger cũ để không replay prototype updates.

## Cách kiểm tra

Từ root: `npm.cmd test`, `npm.cmd run test:experiments`, `npm.cmd run typecheck`, `npm.cmd run db:local`, `npm.cmd run build:check`.
`tests/integration/command-transactions.test.ts` chứa kịch bản crash/rollback/restart; `telegram.test.ts` giữ luồng webhook và delivery.
Không dùng `.env`/token thật trong tests. Test DB riêng, không xóa database hiện tại.

## Giới hạn không thuộc kết luận P1

- Capture vẫn cần xác nhận; chưa đổi sang auto-capture/undo (D2 chưa chốt riêng).
- Ngày vẫn dạng rõ UTC+7; UI cuối cùng, chat/ngày tự nhiên, Today và nhắc thuộc P2/P3.
- Adapter AI cũ ở `src/ai` còn phục vụ prototype, không được bật mặc định; không refactor lại model ở P1.
- `adapters/d1/tasks.ts` và `proposals.ts` là helper tương thích tests cũ; luồng sản phẩm đi qua WorkStore transaction, không dùng chúng để bypass command.
- Job xử lý theo thứ tự update đã nhận và lưu; không thể sắp lại update thấp hơn đến muộn sau khi command trước đã commit. Chưa bật pruning dedupe nên không vô tình cho replay sau cleanup.
- Scheduled hook có sẵn để drain nhưng chưa đăng ký Cron/cloud. Preview trả OK khi command bị hoãn; không phải UX delivery production.
- Chưa có benchmark CPU/latency production, chưa backup/export thật. Retention/observability release vẫn cần P5.

P1 đạt nền kỹ thuật local khi checks đã chạy đạt; không đồng nghĩa sản phẩm cuối hoàn thành hoặc được phép deploy. Mốc tiếp: P2 theo DELIVERY_PLAN, cần duyệt phạm vi riêng.
