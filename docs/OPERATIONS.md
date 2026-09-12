# Vận hành và ranh giới kỹ thuật

## Stack và nguồn dữ liệu

- TypeScript strict, Cloudflare Workers/D1/Cron; Telegram là giao diện. Gemini và Calendar dùng adapter trực tiếp.
- entrypoints nối application/domain/ports/adapters. Không domain SQL/fetch, không runtime import experiments/tests.
- Schema thực tế: migrations; interface: src/ports; không chép lại toàn schema trong docs.
- D1 lưu tasks, sessions, appointments, memory, pending, receipts, inbox/outbox và UI revisions.
- Source production hiện dùng Gemini native tools, AI_MODE off/on; legacy harness chỉ experiments. Cloud vẫn bản cũ cho tới deploy được duyệt. Không dùng config on trước khi áp0010 và duyệt ngân sách live.

## Kiểm tra local

Chạy tại D:\Tro-ly-AI bằng PowerShell:
- `npm.cmd run test:all`: test chính và experiments, provider giả.
- `npm.cmd run typecheck`.
- `npm.cmd run staging:check`: kiểm cấu hình + dry-run, không deploy.
- `npm.cmd run db:local`: migration local; không dùng cho cloud.

Không đọc/in secrets chỉ để kiểm tra repo. Không gọi try:ai/live hoặc tự cài dependency khi chạy test.
Kiểm kết quả theo hành vi, không lấy số test/audit=0 làm chứng nhận an toàn.

## Cloud hiện có — không tạo lại

- Worker personal-assistant-staging; DB assistant-staging. UUID/flags trong wrangler.jsonc.
- Origin: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev
- Bot @Minh_Anh_cua_Minh_bot; private owner allowlist. Telegram webhook đã đăng ký.
- Migration0001–0010 đã áp; migration tiếp theo phải mới, không sửa lịch sử.
- Cloud có Telegram secrets và Gemini key. Không tải/in giá trị cloud secret.
- Local .dev.vars.webhook-secret.dpapi là bản webhook secret mã hóa cho user Windows hiện tại, ignored Git; không phải token bot.
- `scripts/telegram-setup.ps1`: -SelfTest offline; -RegisterWebhook thay kết nối thật, chỉ dùng khi có quyền, không chạy để “kiểm tra cho chắc”.

## Deploy chỉ khi được duyệt

1. Kiểm git diff, test/typecheck/dry-run, migration và account/DB đích.
2. `npm.cmd run db:staging` ghi schema remote; `npm.cmd run deploy:staging` phát hành Worker.
3. Kiểm migration list và endpoint; trang gốc404 bình thường, POST webhook thiếu secret phải bị từ chối.
4. Không giả deploy thành công = người dùng đã nhận tin/AI hiểu đúng.
5. Rollback code/config có chủ đích; không rollback schema hoặc xóa DB tùy tiện.

Quota/pilot deadline hiện tại đọc HANDOFF + wrangler; không tự gia hạn. Source mới vẫn chạy hẹn đã lưu khi AI off; không phụ thuộc lựa chọn model.
Calendar vẫn off; live OAuth/Google writes cần quyền riêng, không bật chung khi test AI.

## Checklist bảo mật bắt buộc

- Webhook secret, private owner, body cap, callback owner/message/version/TTL và replay guard.
- Bind SQL, validate DTO, không mass assignment. Tool model không có arbitrary SQL/network/code.
- Atomic mutation+receipt+delivery intent; lease fencing chặn worker cũ. External request đã rời hệ thống không thu hồi chắc chắn.
- Credentials chỉ secrets/ignored local; manual redirects + fixed API hosts; log mã lỗi/timing, không token/URL chứa token/chat/raw provider errors.
- Quota bền vững theo request, retries giới hạn; không paid fallback. ACK nhanh không bỏ xác thực lúc commit.
- Google refresh token AES-GCM owner-bound, state/cookie một lần; không sửa lịch ngoài hoặc tự tái tạo event user xóa.
- Không coi prompt là bảo mật. Test injection, owner sai, stale, crash, 429, timeout và kết quả gửi không rõ.
- Trước release: kiểm dependency/secrets, backup-restore vào DB riêng, TTL/export/forget, iPhone và nhắc khi tắt máy.

## Khi có lỗi

- Xác định inbound → command → DB → outbox/provider. Query trạng thái/count trước nội dung.
- Sent/failed/uncertain khác nhau; không reset uncertain để gửi lại hàng loạt.
- Sửa card mất kết quả: phục hồi trên card mới khi có tương tác đã xác minh, không thực thi lại nghiệp vụ.
- /rest chỉ dừng nhắc theo phạm vi, không phải tắt toàn hệ thống. Dừng webhook và cron là hai việc độc lập cần quyền.
- Nếu lộ key: thu hồi/rotate ở provider; Git ignore không thu hồi secret đã lộ.
- Backup/restore và pilot dài ngày chưa được nghiệm thu. Calendar local snooze chưa PATCH Google; không khẳng định đồng bộ hai chiều.
