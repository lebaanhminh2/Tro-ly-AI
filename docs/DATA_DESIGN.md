# Backend, dữ liệu và bộ nhớ v1

Ngày 2026-09-11. Thiết kế đề xuất; chưa phải schema/code được phép tạo. Thuộc [DELIVERY_PLAN](DELIVERY_PLAN.md).

## 1. Cấu trúc module đích

```text
src/
  entrypoints/    webhook, scheduled, OAuth callback; không chứa nghiệp vụ
  application/    command handlers, query handlers, context builder, dispatcher
  domain/         task, session, proposal, memory, planner, notification policies
  ports/          interfaces cho clock, repositories, model, calendar, messenger
  adapters/       d1, telegram, google-calendar, gemini
  config/         parse/validate cấu hình, feature flags, không chứa secrets
tests/
  unit/          domain/policy với clock giả
  integration/   D1, webhook, jobs và fake external APIs
  acceptance/    kịch bản người dùng xuyên suốt
migrations/      SQL bất biến sau khi phát hành
```

Dependency: entrypoints → application → domain/ports; adapters thực hiện ports, nối tại entrypoint. Domain không import SDK/SQL/env/fetch.
Tên theo nghiệp vụ; tách hàm khi có trách nhiệm riêng, không tạo interface/base class cho mọi thứ. TypeScript strict, runtime validation ở biên; không dùng `any` hoặc ép kiểu để bỏ qua input sai.
Clock, ID generator và transport có thể thay bằng fake. Node chỉ cho tooling/test; cloud không import test fixture hoặc filesystem.

## 2. Nguồn dữ liệu và nhóm bảng đề xuất

| Nhóm | Trường/ràng buộc chính | Nguồn chân lý |
| --- | --- | --- |
| users/preferences | telegram_id unique, timezone IANA, quiet hours, intensity, version | Người dùng |
| tasks | owner_id, title, status, deadline nullable, estimate nullable, version | D1 |
| facts | entity/field, value, source ref, certainty, recorded_at, superseded_at | Nguồn đã xác nhận, không tự AI suy ra |
| sessions | owner/task, planned start/end, actual segments, status, version | D1; liên kết Calendar ngoài |
| temporary_context | owner, type, value, valid_until, source | Người dùng/interaction hiện tại |
| conversation | recent messages, entity refs, clarification scope + expiry | Lịch sử, không phải bằng chứng deadline mặc định |
| proposals/actions | owner, action, before/after, expected versions, expiry, status, unique command_id | Xác nhận người dùng |
| calendar_connections/cache | encrypted refresh token, scopes, selected calendars, cursor, last_sync, etag | Google cho lịch ngoài |
| plan/jobs/reminders | reason, due_at, generation, lease token, attempts, dedupe key | Backend |
| inbox/outbox/audit | update ID, command state, delivery status, receipt ID, reason | Backend và kết quả provider |

Tasks chứa confirmed current values; facts là provenance/history hoặc tentative candidate. Nếu lưu cả hai phải cập nhật cùng transaction, không cho hai đường ghi độc lập.
Chưa chốt số bảng; gộp/tách theo truy vấn và invariant tại P1. Owner bắt buộc trên mọi domain row hoặc suy ra qua foreign key được kiểm tra.
Index theo owner/status/due_at, unique external ID/dedupe/command ID. Parameterized SQL, giới hạn pagination. Không SELECT toàn bộ lịch sử mỗi Cron.
Thời điểm dùng UTC; timezone riêng để hiển thị/lặp. All-day dùng local date + timezone, không đổi thành nửa đêm UTC tùy tiện. Relative date gắn thời điểm tin gốc, không tính lại khi retry.

## 3. Bộ nhớ hiểu người dùng

| Loại | Ví dụ | Quy tắc |
| --- | --- | --- |
| Preferences lâu dài | Không thích trêu lúc căng, thời lượng thường dùng | Người dùng xác nhận/lệnh rõ; có màn xem/sửa/xóa |
| Context tạm | Nay đuối, nghỉ tới 18h, không xếp Finance chiều nay | Có scope/TTL; hết hạn không biến thành đặc điểm tính cách |
| Facts công việc | Hạn nộp, báo cáo đã xong phần nào | Source và certainty; sửa giữ lịch sử |
| Hội thoại gần | “cái này” trỏ task nào, câu hỏi đang chờ | Context theo phiên; không tự suy “đã hoàn thành” từ im lặng |
| Summary | Tóm mạch trao đổi trước | Dữ liệu hỗ trợ có version/source range, không ghi đè facts |

Context builder ưu tiên: quyền/task hiện tại → facts liên quan → user preferences → trạng thái chưa hết hạn → tối đa vài lượt gần đây. Không gửi credentials, toàn bộ calendar title/location hoặc backlog.
Đề xuất ngân sách context ban đầu tối đa 4.000 input tokens/lượt gồm prompt; không vừa thì giảm lịch sử xa trước, không cắt mất quyền hoặc facts cần thiết. Đo token thực tế, không ước bằng số ký tự tiếng Việt.
Tin người dùng đã xóa phải bị loại khỏi history/ref/summary liên quan; summary phụ thuộc dữ liệu đã xóa cần tái tạo hoặc xóa. Không “quên” ở UI nhưng còn gửi prompt.
Chưa dùng embeddings hay tự học preferences từ hành vi; không cần vector DB cho một người ở v1.

## 4. Luồng lệnh và xác nhận

1. Xác thực Telegram/owner → runtime validate → lưu inbox idempotent → ACK nhanh.
2. Claim job theo owner với generation/fencing token. Nếu worker cũ còn chạy, mọi commit phải bị điều kiện token/version chặn.
3. Nút: resolve opaque action ID server-side. Chat: AI trả candidate intent/evidence, backend resolve thực thể và kiểm tra quyền.
4. Thiếu dữ liệu: lưu clarification gắn owner/task/field, source turn/version và expiry; hỏi một phần. Người dùng đổi chủ đề thì không nuốt câu mới thành giá trị field cũ.
5. Capture rõ (nếu duyệt D2): tạo inbox task + audit + outbox trong một transaction; undo có version, không âm thầm xóa task đã được sửa tiếp.
6. Mutation quan trọng: persist proposal trước/sau; confirm kiểm tra owner, expiry, revision mới và giá trị typed. Không gọi AI lại khi confirm.
7. Commit mutation + mark command applied + outbox atomic. SQL trigger không mặc định bắt buộc; chọn kỹ thuật transaction có thể kiểm chứng trong D1.
8. External writes ngoài transaction: outbox intent → provider → receipt/reconcile. Không rollback dữ liệu bằng lời nói; hiển thị pending/failed rõ.

Confirmation trễ sau khi task đã đổi → stale, không áp dụng; cùng callback/update gửi lại → cùng kết quả nghiệp vụ. Replay window/watermark phải thiết kế trước cleanup, không xóa ledger rồi nhận lại mọi update cũ.

## 5. State machine tối thiểu

- Task: inbox/active/blocked/done/archived; task chưa có estimate vẫn hợp lệ.
- Session: planned → prompted → running ↔ paused → completed; skipped/cancelled/unknown là nhánh riêng. Actual segments chỉ ghi khi thao tác thật, không mặc định đã làm hết giờ.
- Proposal: pending → accepted/rejected/expired/stale; accepted là quyết định nội bộ, không chứng minh Calendar đã sync.
- Delivery: pending → sending → sent; rate-limited → pending có backoff; kết quả không rõ → uncertain; từ chối vĩnh viễn → failed.
- Job: pending → leased → applied/completed; retry gắn idempotency; generation ngăn lease cũ commit. Attempt cap và dead-letter/manual path có sẵn.

## 6. Planner, nhắc và Calendar

Planner lấy busy intervals đã sync + quiet/rest blocks + overrides → trừ buffer → tìm slot theo thời lượng đã chọn. Ưu tiên deadline có chứng cứ, việc người dùng chọn, rồi mục tiêu dài hạn; tie-break ổn định, không đảo lịch mỗi tin nhắn.
Chưa biết workload: đề xuất discovery session, không tuyên bố sẽ xong. Nhiều task cạnh tranh cùng slot phải xét chung. Thiếu chỗ → đưa lựa chọn giảm phạm vi/hoãn, không lấy giờ ngủ.
Nhắc phải kiểm tra lại session version/trạng thái/pause/quiet hours ngay trước gửi. Snooze tạo generation mới, job cũ thành no-op. Giới hạn đã chốt P2: hai lượt mỗi lần hẹn, không budget ngày; reserve nguyên tử khi nhiều worker.
Cron chạy jobs đến hạn từng lô nhỏ; không quét mọi task để nhờ AI quyết định. Những job chờ provider không giữ một transaction DB mở.
Calendar cache giữ last_successful_sync và cursor per calendar. Pagination/resync/410 không xóa task; unavailable thì báo lịch chưa cập nhật và ngừng hứa slot an toàn.
Event bot tạo có stable external identity + link session; retry cần kiểm tra event đã tồn tại. User edit/delete tạo override/tombstone, không tự tái tạo; remote change sau proposal yêu cầu revalidate trước ghi.

## 7. Retention và mở rộng

Đề xuất: chat 7 ngày; context mệt tới hết ngày địa phương, pause tới giờ user chọn; clarification 15 phút; proposal 5 phút; kỹ thuật log 14 ngày. Onboarding phải giải thích và cho đổi phù hợp.
Task/facts giữ tới khi xóa; backup luân phiên 7 ngày. Inbox/outbox chứa nội dung cần cleanup sau khi hoàn tất, giữ tombstone idempotency tối thiểu theo replay policy đã test.
Không cần event sourcing toàn hệ thống. Giữ audit đủ truy nguyên nhưng không log secrets hoặc nhân bản mọi cuộc chat.
Tính năng mới phải đi qua application command/query và cùng quyền owner, không mở đường DB trực tiếp từ UI/AI.
