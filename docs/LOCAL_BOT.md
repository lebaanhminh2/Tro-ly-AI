# Bot Telegram: bản local

Trạng thái 2026-09-11: code + kiểm thử offline; chưa deploy, chưa nối bot thật hoặc Google Calendar.

## Phạm vi đã có

- Worker nhận POST `/telegram`, kiểm tra webhook secret và đúng user/private chat trước đọc/ghi nghiệp vụ.
- `/start`, `/help`, `/add tên việc`, `/tasks`, `/cancel`.
- Ghi việc cần bấm xác nhận; danh sách có nút đổi hạn và trang tiếp (10 việc/trang).
- Chọn việc → nhập `DD/MM/YYYY HH:mm` (UTC+7) → xem hạn cũ/mới → xác nhận.
- D1 lưu task/version, proposal/expiry, lựa chọn nhập ngày và update ID.
- Trigger SQL cập nhật task khi proposal được chấp nhận trong cùng transaction; sai version rollback.
- `trialChat` kết nối adapter AI qua dependency injection; đã test transport giả. Entrypoint không tạo Gemini client, `AI_MODE=off`. Không đọc `.env` để gọi AI ngầm.

## Chạy local

1. `npm.cmd ci --ignore-scripts` (đã có package-lock để tái lập dependency).
2. `npm.cmd run db:local`: áp dụng migration vào `.wrangler/state`, chỉ local.
3. Tạo `.dev.vars` từ `.dev.vars.example` bằng dữ liệu giả. Không sửa file mẫu để chứa secret thật.
4. `npm.cmd run dev`: server Workers local; không public/tunnel và không đăng ký webhook thật.
5. `npm.cmd test` kiểm tra offline, gồm Miniflare D1. `npm.cmd run typecheck` kiểm tra TypeScript.
6. `npm.cmd run build:check` chỉ dry-run đóng gói, không deploy.

`.env` dành cho thử AI trước đây, `.dev.vars` dành cho Worker local. Không tự sao chép khóa từ file này sang file kia.

## Cách kiểm tra

`tests/integration/telegram.test.ts` gửi webhook giả vào handler và dùng D1 của Miniflare, không gọi Telegram/Gemini.
Test bao gồm capture chưa confirm không ghi task, confirm/bấm lặp, update trùng/đồng thời, sai secret/user,
ngày sai, đề xuất cũ, expiry, rollback trigger, phân trang cơ bản và chat mock không mutation.
Sau cơ cấu: test mặc định 28 pass, experiments 25 pass (giữ đủ 50 cũ + 3 regression); typecheck và Workers dry-run pass. Các kết quả migration trước đây không được chạy lại trong đợt chỉ di chuyển file.

## Giới hạn trước khi public

- Mặc định vẫn preview qua webhook response. Chế độ `DELIVERY_MODE=outbox` cần `TELEGRAM_BOT_TOKEN` và phê duyệt kết nối; trả HTTP OK, lưu/gửi riêng `sendMessage` và `answerCallbackQuery`. Trong đợt này chỉ dùng transport giả.
- Migration 0002 lưu response và tạo outbox bằng trigger cùng transaction. Sender claim nguyên tử, lưu message_id khi Telegram xác nhận thành công (không chứng minh người dùng đã đọc).
- Chỉ retry lỗi 429 rõ ràng, theo retry_after, tối đa 3 attempts. Timeout/mạng/JSON hỏng/5xx → uncertain, không tự gửi lại; 4xx khác → failed. Sending mất tiến trình quá lease → uncertain.
- Update processing quá 60 giây → interrupted, tạo tin yêu cầu kiểm tra /tasks; không replay mutation vì có thể đã commit. Đây là phục hồi bảo thủ, không phải tự khôi phục hoàn toàn tác vụ.
- `scheduled` hook có recovery/flush nhưng chưa cấu hình Cron trong wrangler (chưa duyệt triển khai). Khi không có request mới, cần trigger local/manual để kiểm thử; production phải cấu hình lịch trước khi dùng.
- Chưa khóa luồng nhập theo owner: không khuyến khích gửi nhiều yêu cầu nhập/đổi selection đồng thời. Version bảo vệ task lúc confirm, không giải quyết mọi race của hội thoại.
- Chưa có nhắc giờ, Google Calendar, ngày tự nhiên, lịch sử chat, tự ghi task từ lời nói hoặc backup/export UI.
- Không đổi hạn trực tiếp từ lời AI; dùng nút và ngày rõ. Free tier/privacy vẫn phải giải quyết trước gửi dữ liệu thật.
- Config dùng database ID toàn số 0 để local; không deploy nguyên config đó. Chưa có D1/cloud resource được tạo.
- Đã override dependency của Miniflare: sharp 0.35.4, undici 7.29.0; giữ Miniflare 4, không chuyển alpha 5. Audit hiện 0 vulnerabilities; D1 test/typecheck/build pass. Cần xem lại overrides khi nâng Workers SDK; test hiện không kiểm tra xử lý ảnh của sharp.
- Tables chưa có retention/cleanup. Không xóa dedupe history tùy tiện vì có thể làm update cũ chạy lại.

## Bước tiếp theo cần người dùng

Hướng triển khai ngay bên dưới đã tạm gác: ưu tiên duyệt [kiến trúc và kế hoạch](archive/ARCHITECTURE_PLAN.md) trước, không đi cấu hình BotFather/deploy ngay.

Kết quả đợt delivery: 50 tests pass, typecheck, migration 0002 local, dry-run pass. Chưa live Telegram/Gemini/deploy.
Xin duyệt cấu hình kết nối/deploy và Cron; kiểm tra trước quotas, retention, lựa chọn nhập đồng thời và recovery thủ công cho uncertain/failed.
Người dùng tự tạo bot ở BotFather và tài khoản Cloudflare khi tới bước đó; không gửi token vào chat.
