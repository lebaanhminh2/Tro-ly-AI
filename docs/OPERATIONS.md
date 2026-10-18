# Vận hành và phục hồi

Cập nhật 18/10/2026. Stack: TypeScript strict, Cloudflare Workers/D1/Cron, Telegram, web ES modules và adapter Gemini. Domain/application/ports giữ ranh giới; adapters triển khai SQL/provider. Có 39 migrations local: 0001–0038 giữ nguyên, 0039 là migration cộng thêm của đợt hardening. Đã đối chiếu remote staging đủ 39 migration và không còn migration chờ áp; trạng thái môi trường khác phải kiểm tra riêng.

## Kiểm tra local

PowerShell tại `D:\Tro-ly-AI`, Node >=24, dependencies theo lockfile:

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:web
npm.cmd run lint
npm.cmd run format:check
npm.cmd run check:web
npm.cmd run test:all
npm.cmd run test:browser
npm.cmd run build:check -- --outdir .wrangler/cleanup-validation-20261018-956b03c/build
npm.cmd run staging:check -- --outdir .wrangler/cleanup-validation-20261018-956b03c/staging-build
```

Hai lệnh build là dry-run, không publish. `test:all` dùng DB/provider fixture và gồm experiments; không chứng minh dịch vụ thật. Browser cần Chrome/Edge với profile tạm riêng. Sandbox Windows có thể chặn tiến trình GPU/CDP; khi xảy ra, dùng quyền chạy local ngoài sandbox theo cơ chế môi trường, không sửa hoặc skip test để che lỗi.

Đợt dọn đặt TEMP/TMP và log/output trong `.wrangler/cleanup-validation-20261018-956b03c/`, tách khỏi `.wrangler/state`. Không chạy `db:local` vào DB người dùng để kiểm migration.

Benchmark offline, chỉ SQLite memory và synthetic data:

```powershell
node scripts/benchmark-habit-runtime.ts --report .wrangler/cleanup-validation-20261018-956b03c/habit-benchmark.json
```

Fixture 6/30 habit ×1095 ngày, backlog 7/365 ngày; query/payload bounded, pagination/report/replay và tài khoản điểm không đổi. Đo Node+SQLite, không phải CPU/network D1 cloud hoặc trải nghiệm điện thoại.

## Môi trường và quyền

Config thật từ `wrangler.jsonc`; owner allowlist và auth từ source/config, không hardcode từ tài liệu. Staging được tài liệu lịch sử ghi:

- Worker `personal-assistant-staging`, DB `assistant-staging`.
- URL: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/
- API cùng origin, Telegram initData HMAC/TTL hoặc browser login `/dangnhap MÃ` và cookie session.
- Secrets, .env/private vars, DPAPI và SQL/SQLite backups không đọc/in ra hoặc đưa vào Git.

Đợt dọn ban đầu chỉ local; sau đó người dùng yêu cầu deploy staging và commit/push bản cleanup lên nhánh `review/p1-p3`. Bản cleanup là version `4469dfad-7311-486c-b856-7c68e0fc12ad` ngày 18/10/2026; xem [HANDOFF](HANDOFF.md) để đối chiếu kiểm chứng. Sau khi người dùng duyệt hardening và yêu cầu tiếp tục, đã áp migration 0039 rồi phát hành staging version `a659e5d1-5cc7-403a-8592-d97d31c0ca48` cùng ngày. Mốc Time Travel trước migration: `0000091f-00000000-00005108-a7af28c207d13b45f5410c6206fd49e0`. Không reset DB, đổi webhook hoặc gửi tin thử/gọi AI trả phí trong lần kiểm tra phát hành. Quyền trong goal/tài liệu cũ không có hiệu lực cho nhiệm vụ mới; thay đổi schema/dữ liệu cần chỉ dẫn riêng.

## Dữ liệu và tương thích

Đợt hardening thêm migration `0039_runtime_hardening.sql`; đã áp thành công trên `assistant-staging` trước khi deploy runtime mới. Migration thêm số dư thời gian có dấu, con trỏ quét nhắc việc và chỉ mục, không sửa migration cũ hay xóa bảng. Đối chiếu sau migration: vẫn có 19 bản ghi kế hoạch, tất cả số dư khởi tạo khớp thời gian còn lại, bảng con trỏ và bốn chỉ mục mới đã tồn tại. Số phút vượt ước lượng từng bị bản cũ làm mất không thể phục hồi chắc chắn; số dư ban đầu giữ đúng thời gian còn lại hiện có. Cần áp 0039 trên từng môi trường đích trước khi chạy runtime mới.

Kiểm chứng hardening local: 258 test chính, 25 fixture AI và 26 browser test đều đạt; chạy lại 37 test bị ảnh hưởng sau các chỉnh sửa cuối. Lint, format, TypeScript backend/frontend, cú pháp web và hai build dry-run đạt. Sau deploy, `/app/` và 34 tài nguyên CSS/JS khớp SHA-256 với local; GET bootstrap, habits, reminders và history không có phiên đều trả 401. Kiểm tra live chưa bao gồm luồng ghi dữ liệu sau đăng nhập.

Nhắc việc xử lý tối đa 20 quy tắc hợp lệ mỗi lượt phase 1 (bốn phút), tiếp tục bằng con trỏ lưu bền; dữ liệu lớn có thể tăng độ trễ qua nhiều lượt. Mỗi trang danh sách có tối đa 100 quy tắc và `nextCursor`. Thói quen trả đủ tối đa 30 mục hoạt động cùng 50 mục lưu trữ mỗi trang. Bootstrap/AI nhận 10 completion và 10 milestone gần nhất cùng thống kê tổng hợp toàn lịch sử; xem dữ liệu cũ qua history có phân trang.

Yêu cầu sửa kế hoạch, đổi thứ tự và ghi thời gian được kiểm receipt trước trạng thái có thể đổi. Ghi thời gian dùng request ID xuyên ngày để trả lại kết quả cũ, không tự ghi thêm vào ngày mới. API schedule trả lại cùng kết quả đã ghi receipt; refresh/bootstrap cung cấp kế hoạch hiện hành.

Lỗi runtime được log bằng event/code định sẵn, không kèm error thô, stack, tài khoản, payload hay nội dung AI. Thao tác quên xóa nội dung inbox/tool journal đã hoàn tất và vô hiệu nháp AI, giữ ID/trạng thái chống thực thi lại; không xóa task hay log nghiệp vụ. CI kiểm lint, format trong phạm vi đã chuẩn hóa, TypeScript, JavaScript, test, browser và build dry-run; không deploy. Formatter chỉ áp các file khai báo trong `scripts/format.mjs`, tránh viết lại toàn bộ mã lịch sử trong một đợt sửa.

Giữ nguyên toàn bộ migrations đã áp, account, logs, receipts, outbox và bảng game cũ. Runtime mới không đọc/kết toán trận hay luyện cũ. Habit vẫn kết toán cho history/report; slot maintenance game được để trống để giữ nhịp các job nền. Check-in, thưởng/ngủ/đột phá và fencing/atomic receipts giữ nguyên, riêng khóa chiến đấu đã được tháo.

Không DROP/reset DB, sửa migration cũ, hoàn tiền hoặc chuyển thưởng. Schema/data cleanup nếu cần là nhiệm vụ có phê duyệt riêng. Bản cleanup giữ bảng cũ không có nghĩa binary cũ an toàn với dữ liệu mới.

Utility restore offline được giữ:

```powershell
node scripts/rehearse-staging-upgrade.ts --backup <trusted-new.sql> --restore <new-copy.sqlite> --through <verified-baseline> --report <new-proof.json>
```

Chọn đường dẫn mới, backup tin cậy và baseline đúng với backup/listing đã xác minh. Utility tạo file bằng exclusive create, kiểm integrity/FK, áp migration trong transaction và đối chiếu count/hash các cột cũ. Không remote apply hoặc chạy Worker/cron/outbox. `d1_migrations` của copy vẫn là listing cũ; không dùng copy này thay DB thật.

Backup lịch sử được bảo vệ gồm `.wrangler/cultivation-qa/staging/before-redesign-20261013.sql` và SQL/SQLite trong `.wrangler/cultivation-v2-final-qa/`. Chúng không chứa writes phát sinh sau thời điểm backup. Không tự import backup cũ đè dữ liệu thật hoặc dispatch outbox được restore.

## Phục hồi mã và xử lý lỗi

Checkpoint trước dọn ở [HANDOFF](HANDOFF.md). Dùng manifest SHA256 để trích đúng file cần vào vùng riêng rồi đối chiếu diff; không giải nén đè cả workspace đang có thay đổi mới. ZIP có tracked, untracked và output simulation đã duyệt xóa; lịch sử commit tra từ Git.

Nếu phát hành sau này cần phục hồi, ưu tiên sửa tiến tới. Candidate phải tương thích toàn bộ schema/state/rules đang lưu và kiểm trên bản sao trước release. Không đưa Worker pre-v2 trở lại sau writes v2, rollback schema hoặc làm mất dữ liệu để chạy binary cũ.

Điều tra inbound/auth → application → DB/receipt → job/outbox → provider. Phân biệt chưa commit/đã commit, sent/failed/uncertain. Không reset uncertain rồi gửi lại hàng loạt; replay kết quả không phải thực thi lại. Cần repair dữ liệu: bảo toàn trạng thái hiện tại, đối chiếu delta/receipt, lập kế hoạch riêng.

Giữ owner từ auth context, payload cap, bind SQL, version/day, lease/fencing/dedupe. Prompt không là security boundary. Không log token/initData/raw provider errors; không cho model arbitrary SQL/code/network.
