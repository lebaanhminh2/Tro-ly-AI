# Vận hành và ranh giới kỹ thuật

Cập nhật 2026-10-12. Habit/Thần Lộ đã migrate/deploy staging và kiểm sau publish; bằng chứng/version/giới hạn tại [RELEASE](HABIT_GAME_RELEASE.md). Trạng thái bàn giao tại [HANDOFF](HANDOFF.md) và [HABIT_GAME_PROGRESS](HABIT_GAME_PROGRESS.md).

## Stack và nguồn chuẩn

TypeScript strict, Cloudflare Workers/D1/Cron, Telegram và web modules hiện có; Gemini direct adapter. Domain/application/ports không SQL/fetch/config, adapters triển khai persistence/provider. Schema từ migrations, interfaces từ source; không dùng bảng prototype trong docs cũ để thay state thật.

Source migrations hiện tới0037;0031–0037 đã áp staging, listing sau release không còn pending. Trước đợt vận hành mới vẫn kiểm listing đúng target, không suy từ số file. Habit/luyện/battle đã phát hành và có owner API smoke200. Kiến trúc mở rộng tại [HABIT_GAME_ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md).

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

### Phục hồi bản đã phát hành

Runtime release `bcd22bb`, Worker `d3923c51-3959-474d-8e9a-6d4bfbaf7415`, schema0037. Nếu lỗi ở thay đổi mới, ưu tiên fix tiến tới và chạy gates. Khi cần dựng lại release, tạo checkout/worktree riêng ở commit đó, cài dependencies bằng `npm.cmd ci`, kiểm đúng config/target và chạy gates trước `npm.cmd run deploy:staging`. Không reset worktree của user; không áp lại/down migration0031–0037. Candidate `fb3e76f` có cùng backend/schema/rules, chỉ khác runtime UI `web/ui/sheets.js`; sẽ bỏ queued-close fix, cần review lỗi cụ thể trước dùng. Chưa có version cloud của candidate nên không gọi `wrangler rollback` với ID giả hoặc tự chọn version pre-habit.

Backup trước release: `D:/Tro-ly-AI-art/staging-before-habits-20261012-1.sql`, SHA256 trong RELEASE. Backup này **không có các ghi nhận sau release**. Restore riêng đã kiểm integrity/FK/legacyhash và productionreadflows; không chạy cron/outbox trên bản restore. Nếu có sự cố dữ liệu, export trạng thái hiện tại sang file mới trước, khoanh vùng delta/receipt và viết repair có kiểm chứng; không import backup cũ đè DB đang dùng hoặc phát lại thưởng/tin uncertain. Phục hồi mất dữ liệu thực sự cần kế hoạch bảo toàn các writes mới và quyền cụ thể của user.

### Backup và rehearsal offline

Sau khi xác minh đúng staging và baseline qua `wrangler d1 migrations list DB --env staging --remote`, xuất SQL ra **file mới ngoài Git**:

```powershell
npx.cmd wrangler d1 export DB --env staging --remote --output D:/Tro-ly-AI-art/staging-before-habits.sql
node scripts/rehearse-staging-upgrade.ts --backup D:/Tro-ly-AI-art/staging-before-habits.sql --restore D:/Tro-ly-AI-art/staging-rehearsal.sqlite --through 0030 --report D:/Tro-ly-AI-art/staging-rehearsal.json
```

Tên chỉ minh họa; chọn tên mới cho từng lần, không ghi đè backup. `0030` chỉ đúng khi listing/backup thật đã xác nhận baseline đó. Utility chỉ nạp SQL backup tin cậy, tạo SQLite bằng exclusive create, integrity/FK checks, áp migration trong transaction và kiểm count/hash mọi cột cũ trước commit. Không đọc secrets, chạy Worker/cron/transport hoặc gọi cloud; không dispatch outbox đã restore. Bản offline giữ `d1_migrations` cũ, report ghi các migration rehearsed; không dùng file đó để thay DB thật. Khi failure, giữ file riêng để kiểm tra; không tự xóa/ghi đè hoặc retry migration remote.

Test fixture/production-store restore smoke và backup thật đã đạt sau khôi phục login (chi tiết RELEASE/PROGRESS). Rehearsal SQL/SQLite có dữ liệu riêng tư phải nằm ngoài Git, giữ quyền truy cập phù hợp. Report chỉ ghi schema/count/hash, không nội dung dòng. Export có thể tạm làm D1 ngừng phục vụ; chọn thời điểm phù hợp. Không in private download URL từ output export. Lệnh remote vẫn cần gates/target và quyền đã cấp.

### Đo tải lâu dài bằng fixture riêng

```powershell
node scripts/benchmark-habit-runtime.ts --report D:/Tro-ly-AI-art/runtime-benchmark-new.json
node --test tests/integration/habit-runtime-scale.test.ts tests/integration/upgrade-rehearsal.test.ts
```

Benchmark chỉ tạo SQLite memory, dùng stores production và dữ liệu synthetic6/30habit×1095ngày; đo Node+SQLite wall/CPU/query/payload, drain7/365ngày bằng các call bounded và replay. Không phải Worker CPU/remote D1 benchmark; Windows CPU counter có thể làm tròn0ms. D1scale riêng kiểm3nămlogs và boundedresume, không chứng minh exhausted365ngày bằng Miniflare. Kết quả/giới hạn tại RELEASE; không seed benchmark vào DB user.

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
