# P4 — Google Calendar local

Ngày 2026-09-11. Người dùng duyệt code + kiểm thử Google API giả, không cấp quyền tạo Google resource/deploy hay dùng lịch thật.

## Phạm vi được triển khai

- `domain/calendar.ts`: interval, all-day theo IANA timezone, overlap và tìm tối đa 3 slot; không có AI trong planner.
- `ports/calendar.ts`: CalendarProvider/TokenProvider/TokenVault/CalendarCommands. Adapter Google endpoint cố định, timeout, không redirect hoặc in lỗi có credential.
- OAuth: ticket từ owner đã xác thực ở Telegram; start chuyển sang state mới và cookie HttpOnly/Secure/SameSite=Lax; callback state+cookie dùng một lần, TTL 10 phút, gắn revision kết nối.
- Refresh token AES-GCM, nonce ngẫu nhiên và AAD gắn owner/version; không lưu access token. Thiếu scopes/revoke thì kết nối yêu cầu xử lý lại.
- Chọn lịch đọc từ danh sách Google, tối đa 3 lịch ngoài + lịch app; danh sách phân trang 10. Không cho user/AI truyền tùy ý calendar ID ghi.
- Incremental sync theo từng calendar, pagination, nextSyncToken; 410 chuyển full sync. Cache chỉ thay sau khi hoàn tất, lỗi đặt synced_at null, không xóa task.
- Tìm busy range mới bằng `singleEvents=true`, Google mở rộng recurrence/exception; all-day end exclusive, transparent/cancelled không chặn slot. Cache recurrence không được giả vờ là occurrence đã tính sẵn.
- Assistant Plan do app tạo sau nút xác nhận, identity lưu riêng; không tìm calendar theo tên rồi tự nhận quyền ghi.
- Slot proposal gắn session/version/connection revision/expiry; xác nhận kiểm tra lịch ngoài, các buổi local, quiet/rest và version. Buổi local đổi atomically với intent ghi Google.
- External insert dùng stable event ID, private marker; persist uncertain trước POST. Mất response thì GET/reconcile, không insert lại mù quáng. Event user sửa/xóa → needs_review, không ghi đè/tái tạo.
- /calendar hiển thị trạng thái pending/synced/uncertain/needs_review. Không nói “đã sync” cho intent mới nhận.
- Disconnect có xác nhận một lần, xóa token local/cancel pending trước revoke; revoke thất bại được báo rõ, không xóa event Google đã tạo.

## Cách nối (chỉ thực hiện sau khi duyệt live)

Hiện `CALENDAR_MODE=off`, `CALENDAR_WRITES=off` trong wrangler. Không lấy khóa từ `.env` tự động.
Đến staging: cấu hình `PUBLIC_ORIGIN` HTTPS đúng origin, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (32 bytes hex), rồi cấp cờ enabled theo quyền đã duyệt. Không đưa secret vào file mẫu/Git/chat.
Redirect URI cố định: `<PUBLIC_ORIGIN>/oauth/google/callback`. Chọn scope calendarlist.readonly, events.readonly, calendar.app.created; không scope calendar toàn quyền.
Luồng: `/calendar connect` → mở link từ bot → consent → `/calendar list` → chọn lịch đọc → `/calendar setup` và xác nhận → `/calendar sync` → chọn buổi → chọn slot để xác nhận.
`/calendar disconnect` có xác nhận. Chưa hỗ trợ đổi tài khoản khi đang connected: ngắt trước rồi kết nối lại để tránh lẫn calendar ID/token.

## Kiểm thử và nguồn

Review fix P4: sync cursor/cache và đánh dấu needs_review/hủy reminders/outbox cũ cùng transaction. Session planned đúng version chuyển unknown, không sửa lại thời gian Google hoặc coi task thất bại. Running/completed không bị đổi trạng thái.

Kết quả sau sửa: 41/41 tests mặc định + 25/25 experiments pass, typecheck và Workers dry-run pass; không gọi provider thật.
Writer kiểm tra calendar lease token + connection revision + job state trước mỗi ghi DB, kể cả trước POST và khi xử lý lỗi. Worker cũ không ghi đè cancelled/synced của tiến trình mới; request đã rời hệ thống không thể thu hồi bảo đảm.
Lỗi đọc trước POST giữ pending để thử lại (tối đa 3 attempts, rồi failed); chỉ uncertain nếu có khả năng insert đã bắt đầu. No blind reinsert sau uncertain. Không cần migration mới cho đợt sửa này.

Kết quả khi tiếp tục sau ngắt: **40/40 tests mặc định + 25/25 experiments pass**, typecheck và Workers dry-run pass. Migration 0007 local đã áp dụng thành công trước khi ngắt; không áp lại hoặc tạo tài nguyên Google thật. Các kiểm thử vẫn dùng fake provider, chưa chứng minh hoạt động production.

`tests/integration/calendar.test.ts` dùng fake Google + Miniflare, không gọi ngoài: AES tamper/wrong owner, cookie/state thiếu/replay/expiry, selected calendars, pagination, 410, cache deletion, conflict mới, confirm replay, writes off, lost insert response, remote edits/deletion, refresh revoked, disconnect.
Unit-like tests trong cùng file: DST all-day 23 giờ, end exclusive, slot buffer; adapter request body không attendees, sendUpdates=none, no redirects, missing scope và lỗi che token.
Nguồn đã đối chiếu: [events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server), [scopes](https://developers.google.com/workspace/calendar/api/auth).

## Giới hạn trước P5/live

- Đây là nghiệm thu local chức năng, chưa chứng minh consent screen/publishing status, refresh 7 ngày Testing, browser cookie Telegram iOS hoặc quota/CPU production.
- Worker command có owner lease 30 giây; calls quá lâu có thể khiến reply commit bị fence chặn. Calendar intent có ID/state riêng để không tự ghi trùng, nhưng async UX/job pagination cần pilot đo trước public.
- Sync tối đa 10 trang/1000 events mỗi lịch trong một lượt; vượt giới hạn thì fail closed. Chưa có cursor job tiếp tục qua nhiều lượt; không hứa hỗ trợ calendar lịch sử rất lớn ở free tier.
- Tìm slot 7 ngày, giờ 08–21 Việt Nam, buffer 10 phút và quiet settings; chưa routine ăn/đi lại riêng, energy scoring hoặc target finish. Đề xuất không phải bảo đảm xung đột tuyệt đối vì Calendar có thể đổi giữa check và POST.
- Mỗi session chỉ một lần link Google; local snooze/update sau link chưa tự PATCH remote. Session thay đổi trước write thì needs_review; không triển khai auto-reschedule hai chiều ngoài quyền hiện tại.
- Calendar creation không có client ID idempotency: trạng thái creating không rõ kết quả cần kiểm tra thủ công, không tự tạo calendar mới. Reconnect cần rà calendar app cũ để tránh trùng.
- Nếu remote GET sau uncertain trả missing, dừng needs_review dù có thể POST chưa tới Google. Ưu tiên không tái tạo event người dùng đã xóa.
- Events cache/connection tombstones chưa cleanup đầy đủ; rotation encryption key cần quy trình P5. Không ghi log authorization URL/code/token; ticket vẫn là bearer secret trong Telegram, không chia sẻ link.
- OAuth/browser binding bảo vệ luồng callback, không chứng minh tài khoản Google là tài khoản user muốn; user phải kiểm tra account ở consent. Chưa tích hợp xác nhận danh tính Google account bổ sung.
- Không gắn Cron cloud hoặc deploy. Scheduled hook gọi sync/flush khi bật cờ; hiện off. Ngân sách AI không thay đổi.
