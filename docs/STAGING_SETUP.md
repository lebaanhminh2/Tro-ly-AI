# Chạy thử trên cloud — P5

Ngày 2026-09-12. **Hiện mới chuẩn bị local, chưa deploy.** Không cần bật máy cá nhân sau khi cloud chạy; vẫn phải kiểm tra nhắc thực tế trên iPhone.

## 1. Bản đã chuẩn bị

| Local | Staging |
| --- | --- |
| Worker personal-assistant-trial | Worker personal-assistant-staging |
| DB assistant-local, UUID toàn 0 | DB assistant-staging, UUID toàn 1 là placeholder |
| Không public, không cron | workers.dev, không preview URLs, cron mỗi phút |
| AI/Calendar off | AI/Calendar off; gửi Telegram bằng outbox |

Bindings và vars được khai báo riêng cho staging vì không kế thừa tự động. Cron chỉ có hiệu lực sau deploy; thay đổi có thể mất tới 15 phút để lan truyền. Nhắc giờ do backend quyết định, không gọi Gemini mỗi phút. [Environments](https://developers.cloudflare.com/workers/wrangler/environments/), [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 2. Bạn cần chuẩn bị gì trước?

1. Tài khoản Cloudflare của bạn; chưa cần chọn gói trả phí hay thêm billing cho dự án.
2. Một bot Telegram thử riêng: mở đúng `@BotFather`, dùng `/newbot`, đặt tên và username. Giữ token riêng, không gửi token vào cuộc chat hoặc chụp màn hình chứa token. [Hướng dẫn Telegram](https://core.telegram.org/bots/tutorial).
3. ID số Telegram của chính bạn. Không phải username hay ID bot. Nếu chưa biết, tới bước nối thật sẽ đọc `message.from.id` từ tin bạn gửi cho bot, chỉ sau khi duyệt gọi Telegram; không đưa token cho bot tra ID bên thứ ba.

Chỉ cần báo đã có tài khoản/bot, không gửi mật khẩu, API key hay token. Google và Gemini để bước sau khi task/nhắc đã chạy thật.

## 3. Kiểm tra local — được phép chạy ngay

Chạy từ thư mục dự án trong PowerShell:

```powershell
npm.cmd run staging:check
npm.cmd run typecheck
npm.cmd run test:all
```

`staging:check` chạy test cấu hình và Wrangler dry-run, không deploy. `db:local` vẫn dùng DB local. Không dùng `wrangler dev --remote` trong đợt chuẩn bị.

Kết quả đợt chuẩn bị: 46/46 tests chính + 25/25 experiments đạt, typecheck và dry-run local/staging đạt. Kiểm tra `--require-ready` trả exit 1 đúng dự kiến khi UUID còn placeholder; không chạy phần lệnh cloud để thử guard.

## 4. Kết nối cloud — chỉ sau khi duyệt thao tác thật

Các lệnh dưới đây cần mạng/quyền tài khoản, có thể tạo hoặc thay đổi tài nguyên. Không chạy tất cả như một script. Trước mỗi giai đoạn kiểm tra đúng account và đích staging; không bật paid tự động.

1. Đăng nhập bằng `npx.cmd wrangler login`; kiểm tra account bằng `npx.cmd wrangler whoami`. Nếu có nhiều account, chọn chính xác account cho dự án trước khi tạo DB. Không chia sẻ output chứa thông tin tài khoản không cần thiết.
2. Tạo database staging qua Cloudflare dashboard, tên `assistant-staging`. Ghi nhận UUID của DB đó. Chỉ thay `env.staging.d1_databases[0].database_id` trong `wrangler.jsonc`; giữ nguyên local. Việc agent sửa file cần duyệt riêng. UUID DB không phải khóa truy cập.
3. Chạy `npm.cmd run staging:check`, rồi sau khi xác nhận đích cloud chạy `npm.cmd run db:staging` để áp migrations lên DB staging. Chưa có backup/restore được nghiệm thu; không dùng DB chứa dữ liệu thật hiện có.
4. Chạy `npm.cmd run deploy:staging` sau khi duyệt deploy. Worker ban đầu thiếu secrets nên chưa xử lý webhook/cron. Hai lệnh remote đều có chốt từ chối UUID placeholder; chốt không thay thế việc kiểm tra quyền sở hữu DB hoặc ngân sách.
5. Nhập từng binding bằng giao diện Cloudflare hoặc prompt tương tác bên dưới. Không đặt giá trị secret ngay trên dòng lệnh, không paste vào config/Git:

```powershell
npx.cmd wrangler secret put TELEGRAM_USER_ID --env staging
npx.cmd wrangler secret put TELEGRAM_WEBHOOK_SECRET --env staging
npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN --env staging
```

Webhook secret là chuỗi ngẫu nhiên riêng, tối thiểu 24 ký tự, chỉ chữ/số/`_`/`-`; không dùng token bot làm webhook secret. Tạo bằng trình quản lý mật khẩu. Secret put là thao tác thay đổi cloud, không phải kiểm tra local. [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [D1 migrations](https://developers.cloudflare.com/workers/wrangler/commands/d1/).

6. Ghi nhận URL HTTPS thật của Worker. Khi được duyệt gọi Telegram, đăng ký `setWebhook` tới `<URL>/telegram`, `secret_token` khớp binding, `allowed_updates` gồm `message` và `callback_query`. Không bật `drop_pending_updates` tùy tiện. Không dán URL chứa token vào browser, log hay Git. Chưa có script đăng ký webhook an toàn trong đợt này; thực hiện cùng agent ở bước live. [Telegram API](https://core.telegram.org/bots/api#setwebhook).

## 5. Thứ tự nghiệm thu thật

- **Telegram trước:** /add → xác nhận → /tasks → lên buổi → nhận nhắc → phản hồi/snooze/rest. Kiểm tra sai owner/secret bị từ chối, bấm lặp không tạo trùng. Thử tắt máy tính và nhận thông báo iPhone; kiểm tra notification/Focus trên máy.
- **Gemini sau:** khai báo key bằng secret, model đã kiểm chứng và ngân sách rõ; duyệt request smoke riêng. Xem [P5_RUNTIME](P5_RUNTIME.md). Tests hiện khóa flags off cho đợt chuẩn bị; cập nhật tests/config có duyệt khi bật provider, không xóa test để vượt chốt.
- **Google sau nữa:** Google project/consent, redirect `<URL>/oauth/google/callback`, token key và scopes theo [P4_ACCEPTANCE](P4_ACCEPTANCE.md). Bắt đầu calendar thử, writes off; chỉ bật ghi sau khi duyệt. Không giả định account/consent đã có.

Chưa hoàn tất P5 cho tới khi đo CPU/quota/độ trễ, backup-restore và giám sát có bằng chứng, xử lý hạn chế Calendar đã công bố, rồi pilot 3 ngày. Free là mục tiêu, chưa đo cloud thì chưa cam kết miễn phí lâu dài.

## 6. Dừng chạy / lỗi

- Thiếu secrets → webhook trả 503, scheduled không xử lý; không phải lỗi model. Trang gốc `/` trả 404 là bình thường, không phải health check.
- Cron chưa nhắc: kiểm tra propagation, migrations, bindings, quiet/rest, session và outbox trước khi gửi lại thủ công.
- `/rest` là nghỉ theo phạm vi sản phẩm, **không phải công tắc dừng toàn hệ thống**. Khi có sự cố, ngắt webhook và đặt cron `[]` rồi deploy cấu hình đã duyệt; cron dừng không ngăn webhook, ngược lại cũng vậy. Các thao tác đang gửi đi có thể vẫn hoàn tất.
- Không tự rollback schema hay xóa DB. Giữ trạng thái uncertain để đối chiếu; không gửi lại hàng loạt. Backup/restore/rollback chi tiết còn ở bước P5 tiếp theo.
