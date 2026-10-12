# Vận hành và ranh giới kỹ thuật

Cập nhật 2026-10-12. Source/commands đã đọc local; không audit/deploy cloud trong phiên docs. Trạng thái goal/release tại [HANDOFF](HANDOFF.md) và [HABIT_GAME_PROGRESS](HABIT_GAME_PROGRESS.md).

## Stack và nguồn chuẩn

TypeScript strict, Cloudflare Workers/D1/Cron, Telegram và web modules hiện có; Gemini direct adapter. Domain/application/ports không SQL/fetch/config, adapters triển khai persistence/provider. Schema từ migrations, interfaces từ source; không dùng bảng prototype trong docs cũ để thay state thật.

Source migrations hiện tới0037; số migration đã áp cloud phải kiểm lại bằng listing đúng target, không suy từ số file. Habit/luyện/battle đã có runtime local, remote release còn phải kiểm riêng. Kiến trúc mở rộng tại [HABIT_GAME_ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md).

## Commands local

Chạy PowerShell tại `D:\Tro-ly-AI`, dùng `npm.cmd`; kiểm `package.json` khi bắt đầu:

```powershell
npm.cmd run typecheck
npm.cmd run check:web
npm.cmd run test:all
npm.cmd run test:browser
npm.cmd run build:check
npm.cmd run staging:check
```

`test:all` gồm tests chính/experiments với provider fixture; không chứng minh Gemini/Telegram thật. `build:check`/`staging:check` là dry-run/gate, không deploy. `db:local` áp migration DB local, không cloud. Browser/gate discovery cần phủ files mới nếu tổ chức lại thư mục; xanh bộ cũ chưa đủ.

Không chạy `try:ai`, thay webhook, live messages hoặc cài model chỉ để kiểm tài liệu. Trong goal đã cấp quyền, dependency/art setup được dùng khi cần thực thi feature; kết quả/chi phí phải đúng điều kiện 0đ.

## Staging hiện có

- Worker `personal-assistant-staging`; DB `assistant-staging`, bindings/account/IDs theo `wrangler.jsonc` thực tế.
- Origin đang được tài liệu dự án dùng: `https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev`; xác minh target/config trước release.
- Bot `@Minh_Anh_cua_Minh_bot`, owner allowlist; không đăng ký lại webhook/menu hoặc tạo tài nguyên mới chỉ để “cho chắc”.
- Web `/app/`, API cùng origin. Telegram initData hoặc Chrome flow lấy mã → `/dangnhap MÃ` → cookie session theo source hiện tại; auth expired thì mở lại/đăng nhập lại.
- Secrets local/cloud không tải/in ra. `.env`/private vars/DPAPI/SQL backups ignored; `.env.example` chỉ có biến thật và cách điền, không giá trị.

## Migration và publish theo quyền

User đã cho tự commit/push/migrate/deploy staging cho nhiệm vụ Habit/Thần Lộ; quyền code theo lệnh goal, ngoài phạm vi theo user mới nhất. [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md) sở hữu phạm vi. Production/phá dữ liệu/force-push/dịch vụ trả phí không suy từ quyền này.

1. Kiểm workspace/diff/staged files, đúng target/account/DB, gates local và data upgrade compatibility.
2. Backup staging vào nơi riêng ngoài Git; test restore vào DB riêng không dispatch. Xem pending migrations/index/constraints và khả năng rollback code sau schema mới.
3. `npm.cmd run db:staging` áp schema remote; `npm.cmd run deploy:staging` publish Worker, chỉ sau gates/readiness đúng. Không sửa migration cũ hoặc làm destructive reset để chữa apply failure.
4. Kiểm migration listing/version/assets/API/auth và read-only smoke của bản publish. Trang gốc 404 có thể bình thường, thiếu auth 401 đúng; không lấy asset 200 làm chứng minh mutation đã đúng.
5. Ghi commit/migration/Worker version/target/backup/commands/evidence. Nếu fail, xác định đã commit/applied phần nào trước retry; không phát lại thưởng/tin uncertain.

Rollback code/config hoặc feature off có chủ đích, tương thích schema/data/jobs đang có. Không rollback schema bằng xóa dữ liệu hoặc deploy binary không hiểu state mới. Backup phục vụ phục hồi có kiểm chứng, không là nút ghi đè tự động vào data thật.

## Ranh giới bảo mật và giao dịch

- Owner từ auth context, initData HMAC/TTL hoặc browser cookies/Origin theo source; input/body cap, bind SQL, whitelist DTO, expected version/day, receipts.
- Mutation + receipt + delta kinh tế + intent delivery cần atomic boundary đúng; lease/fencing/dedupe bảo vệ job. Không bảo đảm exactly-once mạng ngoài hệ thống.
- Không secret/initData/token/chat/raw provider errors trong URL/log/browser bundle; không arbitrary code/SQL/network qua tool model. Prompt không là security boundary.
- Budget/retry/calls có giới hạn; hết quota provider không làm tắt luật deterministic, user-configured reminders hay UI. Không tự thêm paid fallback hoặc áp lại quota pilot cũ.
- `/ngu`/focus chặn lời chủ động phù hợp; nhắc user đã đặt vẫn theo lịch trừ pause/inactive. ACK/recurrence delivery khác hoàn thành habit/task.
- Export dữ liệu khác backup DB. Restore/import không reissue reward hoặc mở ngày cũ; soft-delete/archive giữ history/entitlements theo luật.

## Khi có lỗi

Đi từ inbound/auth → application → DB/receipt → job/outbox → provider; ưu tiên status/count/version trước đọc nội dung. Phân biệt chưa commit/đã commit, sent/failed/uncertain. Không reset uncertain rồi gửi lại hàng loạt; replay kết quả khác thực thi lại nghiệp vụ.

Issue user nhận nudge sau báo ngủ: audit lịch sử chưa chứng minh tin sau report. D1local đã tái hiện hai lỗi final-send: phase hết hạn sau claim và report được commit ngay sau rest-read sau claim. Outbox nay recheck `notificationAllowed` trước transport, hai ca từ fail→pass và personal reminders vẫn gửi. Không gọi đây là rootcause lịch sử đã xác nhận hoặc bảo đảm atomic giữa D1 và Telegram; tin đã vào transport không thu hồi được bằng `/ngu`. Evidence/commands tại PROGRESS.

Release gates/bảo toàn dữ liệu/hiệu năng/visual/bàn giao xem [HABIT_GAME_ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md). Local art/model không runtime dependency; vận hành pipeline tại [HABIT_GAME_LOCAL_ART](HABIT_GAME_LOCAL_ART.md).
