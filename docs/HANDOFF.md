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

Webhook registration được duyệt: scripts/telegram-setup.ps1 có -RegisterWebhook, nhập token ẩn, đọc .dev.vars.webhook-secret.dpapi bằng DPAPI cùng user Windows. Khóa đúng bot ID/username và staging URL, từ chối webhook khác, không drop_pending_updates, max_connections=1; kiểm tra getWebhookInfo sau đăng ký, không tự retry timeout. 12 self-tests offline đạt. User đã lưu TELEGRAM_USER_ID; agent đã tạo/upload TELEGRAM_WEBHOOK_SECRET 64 hex và bản mã hóa ignored. Chưa thực sự đăng ký webhook: cần user chạy script -RegisterWebhook rồi thử /tasks. Không cần lấy lại ID hoặc tạo lại secret.

Telegram setup mới nhất: user đã lưu TELEGRAM_BOT_TOKEN trên cloud, đã thu hồi token từng lộ trong chat. HTTPS đã kiểm tra được GET / 404, POST /telegram 503 khi thiếu cấu hình. Chưa xác nhận user ID/webhook secret. getMe do user chạy xác nhận @Minh_Anh_cua_Minh_bot, getUpdates báo rỗng. Đã được duyệt tạo scripts/telegram-setup.ps1: prompt token ẩn, getMe/getWebhookInfo/getUpdates không offset, không mutation; mã mới xác định ID, không đoán owner. 6 self-tests offline đạt trên Windows PowerShell; chưa chạy bằng token thật. Hướng dẫn user chạy file, gửi mã mới vào đúng bot, Enter rồi đọc kết quả. Không lặp lại snippet copy-paste dài; không đọc token từ chat.

Mới nhất 2026-09-12: user duyệt tự xử lý lỗi migration và tiếp tục deploy. Bọc CASE trong 0001, bỏ dấu chấm phẩy trong comment 0003 (không đổi logic); test mới tests/unit/migration-compat.test.ts. Cả 7 migrations remote đã áp, migrations list báo không còn pending. Đã deploy personal-assistant-staging, version ae096766-6020-43de-aec3-1f96f9161e28, cron mỗi phút, URL https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev. Wrangler tự đăng ký workers.dev subdomain ở lần deploy đầu. Secrets list rỗng, AI/Calendar off, chưa Telegram webhook. 48 tests chính + 25 experiments đạt; typecheck đạt. HTTPS smoke ngay sau deploy lỗi TLS handshake bằng Node và curl, chưa xác nhận endpoint hoạt động (có thể propagation, chưa kết luận). Bước tiếp: kiểm tra HTTPS lại, hướng dẫn user nhập token MỚI trực tiếp qua wrangler secret put; không dùng token từng lộ trong chat. Chưa nghiệm thu P5.

Lượt migrations/deploy được duyệt 2026-09-12: `db:staging` thất bại ngay 0001 với D1 `incomplete input` (7500). Read-only xác nhận cả 7 migrations còn pending, sqlite_master chỉ có _cf_KV và d1_migrations; chưa bảng nghiệp vụ. Chưa deploy. Nghi trigger có CASE...END không bọc ngoặc (Cloudflare workers-sdk issue #4727); splitter Wrangler local vẫn trả đúng 7 statements, nên chưa chứng minh nguyên nhân server. Cần duyệt sửa migrations/0001_initial.sql bọc biểu thức CASE và thêm tests/unit/migration-compat.test.ts trước khi thử lại cloud; không bỏ trigger/guard hoặc đánh dấu migration đã áp thủ công.

Cloud setup 2026-09-12 (được duyệt): Wrangler đăng nhập thành công, một account; đã tạo D1 `assistant-staging` region APAC và cập nhật UUID staging trong wrangler.jsonc. Chưa áp migrations remote, chưa deploy/secrets/webhook, AI/Calendar vẫn off. Tiếp theo cần duyệt migrations và deploy staging ban đầu; không tạo DB lần nữa.

Cập nhật staging 2026-09-12: đã chuẩn bị env staging riêng trong wrangler, cron mỗi phút/outbox, flags off, UUID placeholder; scripts check/deploy/migration có guard placeholder trước remote. Hướng dẫn tại [STAGING_SETUP.md](STAGING_SETUP.md). 46/46 tests chính + 25/25 experiments đạt, typecheck và dry-run local/staging đạt; kiểm tra readiness cố ý từ chối placeholder (exit 1). Chưa tạo cloud resource, đăng ký webhook hay gọi API provider thật. Tiếp theo hỏi tình trạng Cloudflare/bot và xin duyệt thao tác cloud với đích cụ thể; không tự deploy.

Cập nhật 2026-09-12: đã duyệt nối AI runtime trong worker/env và tests/integration/ai-runtime.test.ts, không live/deploy. Runtime dùng contextualChat + Gemini adapter + quota D1; hướng dẫn và giới hạn tại [P5_RUNTIME.md](P5_RUNTIME.md). Các đoạn P1–P4 bên dưới là lịch sử; sau đợt này tiếp tục chuẩn bị staging trong P5, không mở lại kiểm chứng model.

Nghiệm thu đợt runtime: 43/43 tests mặc định, 25/25 experiments, typecheck và Workers dry-run đạt. Chưa nghiệm thu toàn bộ P5; chưa cloud/pilot.

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
