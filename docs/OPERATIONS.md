# Vận hành và phục hồi

Cập nhật 21/10/2026. Stack hiện hành: Node 24, TypeScript strict với `erasableSyntaxOnly`, Cloudflare Workers/D1/Cron, Telegram, web ES modules và adapter Gemini. Hợp đồng sản phẩm ở [PRODUCT_BRIEF](PRODUCT_BRIEF.md), habit ở [HABITS](HABITS.md), Linh thú ở [đặc tả](LINH_THU_SPEC.md).

## Tìm đúng nơi sửa

| Thư mục                                              | Trách nhiệm                                                                |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `src/entrypoints/`                                   | HTTP/Telegram, auth context, router và scheduler của Worker                |
| `src/application/`                                   | Điều phối use case, nhận lệnh và hợp đồng nghiệp vụ                        |
| `src/domain/`                                        | Luật và phép tính nghiệp vụ                                                |
| `src/ports/`                                         | Hợp đồng lưu trữ/provider                                                  |
| `src/adapters/`                                      | SQL/D1, provider, delivery và guards giao dịch                             |
| `web/core/`, `features/`, `models/`, `views/`, `ui/` | Trạng thái/hạ tầng, luồng tương tác, mô hình, trình bày và dialog/hiệu ứng |
| `tests/unit/`, `integration/`, `browser/`            | Luật, giao dịch/API và hành vi trình duyệt                                 |
| `scripts/`                                           | Build/verify tài nguyên, benchmark, kiểm tra và diễn tập offline           |
| `experiments/ai-trial/`                              | Fixture/harness offline còn được tests dùng; không thuộc runtime Worker    |

Linh thú tách reader SQL, store giao dịch, chuẩn bị hiệu ứng và job bảo trì; [bản đồ chi tiết](LINH_THU_OPERATIONS.md). Không gom lại vào một module hoặc dùng store ghi khi chỉ cần đọc dữ liệu.

## Chạy và kiểm tra local

PowerShell tại thư mục dự án, Node >=24 và dependencies theo lockfile. Trên Windows dùng `npm.cmd`/`npx.cmd`; bản cấu hình mẫu ở `.dev.vars.example` và `.env.example`, không chép khóa thật vào tài liệu/Git.

`npm.cmd run dev` chạy Wrangler local. DB dùng thử phải riêng với dữ liệu người dùng; các integration tests tự dựng Miniflare và áp migrations vào DB tạm. Không chạy `db:local` vào state đang dùng chỉ để QA.

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:web
npm.cmd run lint
npm.cmd run format:check
npm.cmd run check:web
node scripts/build-linh-thu-assets.ts --require-complete
npm.cmd run test:all
node --test --test-concurrency=1 tests/browser/*.test.mjs
npm.cmd run build:check
npm.cmd run staging:check
```

Hai lệnh build chỉ dry-run, không publish. `test:all` gồm suite chính và experiments offline; không chứng minh dịch vụ thật. Browser cần Chrome/Edge và profile tạm; không skip hoặc nới assert khi thiếu môi trường. Chạy tuần tự giúp tránh nhiều profile Chrome cạnh tranh trên máy Windows; CI hiện gọi `npm run test:browser` theo cấu hình repository.

Formatter chỉ áp các tệp khai báo trong `scripts/format.mjs`, không tự chuẩn hóa toàn bộ source lịch sử. CI kiểm lint, format baseline, typecheck hai phía, cú pháp web, đủ ảnh, tests/browser và hai build dry-run; không deploy.

Log và báo cáo rà soát ở `.wrangler/goal-audit-20261021/`, tách khỏi `.wrangler/state`. Artifact local bị Git bỏ qua, không mặc định có khi clone mới. PowerShell có thể ghi log UTF-16LE; đọc bằng `Get-Content`.

Ảnh và báo cáo browser cho tiến hóa, triệu hồi, reveal, vai trò và tháp ghi vào `trial-results/linh-thu/<nhóm>/run-<PID>/`; Git đã bỏ qua `trial-results/`. Mỗi tiến trình có thư mục riêng, không ghi đè ảnh/báo cáo QA trong `output/`. Thư mục theo PID có thể được dùng lại nếu hệ điều hành tái sử dụng PID; chuyển kết quả cần giữ lâu dài sang nơi có tên riêng trước khi chạy lại.

`output/` giữ nguồn/prompt/provenance được tái sử dụng, hồ sơ phát hành và tư liệu có chủ đích đã được Git theo dõi. `output/linh-thu-reveal-preview/demo.html` là fixture v12 được browser test mở trực tiếp; giữ nguyên fixture, nguồn ảnh và review v22. Không bỏ qua hoặc xóa toàn bộ `output/`.

Đợt dọn 21/10/2026 lưu 1.837 tệp QA/demo/bản sao chưa theo dõi và 69 log cũ trong `.wrangler/output-cleanup-20261021/output-local-20261021.zip`, kèm `manifest.json` và SHA-256 từng tệp, rồi dọn bản gốc khỏi 45 thư mục đã rà soát. Bản nguyên tệp cũng được chuyển vào `.wrangler/output-cleanup-20261021/files/` với cùng cấu trúc đường dẫn để có thể hoàn tác. Cả hai bản lưu chỉ có trên máy thực hiện, không có khi clone repository. Các công cụ nghiệm thu v12/v22 cũ nằm trong bản lưu; muốn dùng lại, khôi phục đúng đường dẫn trong manifest và đối chiếu với mã hiện hành trước khi chạy. `.gitignore` chỉ bỏ qua đầu ra tại 45 thư mục QA/demo này, có ngoại lệ cho 19 tệp đã theo dõi cùng thư mục; nguồn tái sử dụng khác vẫn hiện trong Git. Mọi bằng chứng QA mới ghi vào `trial-results/`, không đưa run thử hoặc bản sao source vào commit.

## Scheduler và đồng bộ thưởng

Scheduler có ASSETS chia việc theo bốn pha mỗi phút; pha bảo trì tiếp tục xoay ba slot cho công việc nền, habit và Linh thú. Chốt ngày ngủ vẫn xử lý tối đa một ngày mỗi lượt trước các job khác; phản hồi hành động trực tiếp và quy tắc hoãn thông báo chủ động giữ nguyên.

Trong slot công việc nền, nếu có lệnh inbox chờ, scheduler xử lý tối đa một lệnh, gửi phản hồi và kết thúc lượt. Archive, đồng bộ vé, hết hạn bộ nhớ và thành tựu chờ slot công việc nền tiếp theo không có lệnh, thông thường cách 12 phút. Hàng đợi liên tục có lệnh có thể kéo dài thời gian chờ bảo trì. Nhánh tự kích hoạt lịch dùng lại kế hoạch vừa tạo, tránh gọi `ensure` lần thứ hai trong cùng lượt.

`HealthyStore.syncTaskTickets` phục hồi tối đa 25 vé trong một giao dịch, giữ receipt `ticket:<taskId>` cho từng việc và tăng version tài khoản theo số vé. Guard kiểm version tài khoản, cấu hình ngủ và trạng thái/version từng task; lỗi giữa batch hoàn tác cả số dư, receipt và dấu đã thưởng. Tranh chấp chưa được receipt xác nhận sẽ để lại backlog cho lượt sau. Migration 0015 đã đánh dấu việc lịch sử để không thưởng hồi tố; không xóa các dấu này. Webhook vẫn gọi đồng bộ sau khi gửi phản hồi.

`unlockAchievements` dùng hai truy vấn thống kê và ba statement ghi cho toàn bộ thành tựu đủ điều kiện. Mỗi thành tựu vẫn có khóa outbox riêng `achievement:<owner>:<code>`; mở khóa, tạo thông báo và đánh dấu notified cùng commit, chạy lại hoặc đồng thời không tạo thông báo trùng. Notified nghĩa là đã đưa vào outbox, không xác nhận Telegram đã nhận.

Ngân sách kiểm thử của dự án là 50 truy vấn cho một lượt trong các fixture được kiểm. Đo cả scheduler cùng tin chờ, backlog, thành tựu và archive; không chỉ đo store riêng lẻ. Dữ liệu chẩn đoán và giới hạn nằm trong `.wrangler/goal-audit-20261021/`.

## Benchmark và tài nguyên

```powershell
node scripts/benchmark-habit-runtime.ts --report .wrangler/habit-benchmark.json
node scripts/benchmark-linh-thu.ts
node scripts/benchmark-linh-thu-web.mjs --samples=3
node scripts/benchmark-linh-thu-web.mjs --throttled --samples=3
```

Benchmark habit dùng SQLite memory, 6/30 habit ×1095 ngày và backlog 7/365 ngày; kiểm số truy vấn, phân trang/report/replay và tài khoản điểm không đổi. Benchmark Linh thú kiểm service/store/API thật trên SQLite, số truy vấn thông thường/backlog; benchmark web dùng API fixture và bytes ảnh/module thật. Kết quả và giới hạn trong [kiểm chứng](LINH_THU_ACCEPTANCE.md), [phân trang và số đo trước/sau](LINH_THU_OPERATIONS.md).

Không suy thời gian local thành latency D1 remote, CPU Worker, CDN/cache hoặc độ mượt trên thiết bị người dùng. Kiểm hash/alpha/manifest không thay duyệt thị giác. Raw, prompt và các nguồn được tái sử dụng có vai trò tái lập; không xóa mọi thứ trong `output/` chỉ vì không được Worker phục vụ.

## Migrations và dữ liệu

Source có **42 migrations, 0001–0042**. Giữ nguyên lịch sử, kể cả bảng game đã ngừng dùng; không đổi tên/xóa migration đã áp. Trạng thái remote phải đối chiếu riêng trước phát hành, không suy từ số file local.

| Migration gần đây        | Vai trò                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| 0039 runtime hardening   | Số dư thời gian có dấu, con trỏ quét nhắc và chỉ mục                  |
| 0040 habit ticket awards | Sổ nhận vé habit và chỉ mục tuần, không backfill thưởng cũ            |
| 0041 Linh thú            | Cá thể/lượt luyện, vai trò, ngày, kỹ năng, tuyệt kỹ, tháp và lựa chọn |
| 0042 tiến hóa Linh thú   | Dạng đạt được và bảo toàn khám phá theo luật chuyển dạng              |

Habit hợp lệ nhận vé trong cùng transaction với log/receipt, có version guard cho habit và tài khoản vé. Quay thường ×10 dùng đúng mười vé và một receipt; client cũ không có `count` vẫn quay một lần. Retry trả kết quả cũ kể cả khi ngày, thiết lập hoặc trạng thái đã đổi.

Kế hoạch, đổi thứ tự và work log kiểm receipt trước điều kiện có thể thay đổi. Request ghi thời gian giữ ID xuyên ngày, không tạo tác dụng mới vào ngày khác. Refresh/bootstrap lấy trạng thái hiện hành; kết quả receipt không có nghĩa mọi màn đang hiển thị dữ liệu mới nhất.

Ngủ, điểm/ví, check-in, đột phá, fencing và atomic receipts vẫn thuộc hệ nền. Game chiến đấu cũ không được đọc để khóa hoặc kết toán các luồng này. Không DROP/reset DB, sửa migration cũ, hoàn tiền hoặc phân phối lại thưởng khi dọn code. Cleanup schema/data cần kế hoạch và xác nhận riêng.

## Scheduler và dữ liệu lớn

Cron staging chạy mỗi phút theo `wrangler.jsonc`. Các nhóm độc lập chia bốn phase; delivery có nhịp riêng. Phase bảo trì chia tiếp ba slot; slot Linh thú xoay bốn job, mỗi loại có nhịp 48 phút khi không bị backlog ngủ trì hoãn. GET liên quan cũng tiến bảo trì. Không xếp mọi job nặng vào cùng invocation.

Mỗi invocation chỉ chốt tối đa một ngày ngủ; trả lời trực tiếp được ưu tiên, thông báo chủ động chờ chốt vắng mặt. Tách lượt giữ ngày gốc và receipt, không bỏ quyết toán. Chi tiết/query budget ở vận hành Linh thú và benchmark.

Nhắc định kỳ quét tối đa 20 quy tắc hợp lệ ở phase 1, tiếp tục bằng con trỏ lưu bền; dữ liệu lớn có thể tăng độ trễ qua nhiều lượt. Danh sách tối đa 100 quy tắc/trang. Habit tối đa 30 mục hoạt động, archive 50/trang. Bootstrap/AI dùng 10 completion và 10 milestone gần nhất cùng tổng hợp toàn lịch sử; history có phân trang. Bộ sưu tập thú dùng overview theo loài và trang cá thể riêng, không vét kho để mở atlas.

## Môi trường và phát hành

Config thực thi từ `wrangler.jsonc`; owner và auth từ source/config, không hardcode theo tài liệu. Staging được cấu hình là Worker `personal-assistant-staging`, DB `assistant-staging`, API cùng origin; đăng nhập Telegram initData có HMAC/TTL hoặc ghép trình duyệt qua `/dangnhap MÃ` và cookie session.

[Phát hành Linh thú 19/10](LINH_THU_RELEASE.md) và [HANDOFF](HANDOFF.md) giữ ghi nhận lịch sử mới hơn. Đợt rà soát hiện tại chỉ local: không deploy, áp migration remote, đổi webhook hoặc gọi provider thật. Quyền sửa code/deploy/push trong các đợt cũ không áp dụng cho nhiệm vụ mới.

Trước một lần phát hành được duyệt: đối chiếu Worker/DB đích, migrations đã áp, version/schema và diff; backup mới; diễn tập restore/nâng cấp trên bản sao; chạy gates và dry-run. Sau phát hành đối chiếu version/assets/auth và luồng đã được phép kiểm. GET/auth/hash không chứng minh mutation có đăng nhập hoặc latency thực tế.

Secrets, private vars, DPAPI và SQL/SQLite backups không in nội dung hoặc đưa vào Git. Không tự dispatch outbox hoặc gửi Telegram trong QA.

## Phục hồi và điều tra lỗi

Utility offline:

```powershell
node scripts/rehearse-staging-upgrade.ts --backup <trusted-new.sql> --restore <new-copy.sqlite> --through <verified-baseline> --report <new-proof.json>
```

Dùng backup tin cậy, đường dẫn mới và baseline đúng với backup/listing đã xác minh. Utility exclusive-create, kiểm integrity/FK, áp migrations trong transaction và so count/hash các cột cũ; không gọi remote, Worker, cron hoặc outbox. Listing `d1_migrations` trong copy vẫn là lịch sử cũ, không dùng copy thay DB thật.

Backup lịch sử trong `.wrangler/cultivation-qa/staging/`, `.wrangler/cultivation-v2-final-qa/` và checkpoint ở HANDOFF được bảo toàn; chúng không chứa writes phát sinh sau lúc tạo. Không import backup cũ đè dữ liệu mới. Trích từng file nguồn ra vùng riêng, kiểm hash và diff; không reset/clean hoặc giải nén đè cả workspace.

Ưu tiên sửa tiến tới. Worker rollback phải hiểu toàn bộ schema/state/rules đã lưu; không đưa binary pre-v2 trở lại sau writes v2 hoặc rollback schema để chạy code cũ. Backup/restore phải gồm ví, receipts và outbox liên quan.

Điều tra theo inbound/auth → application → DB/receipt → job/outbox → provider. Phân biệt chưa commit/đã commit và sent/failed/uncertain; không reset uncertain rồi gửi lại hàng loạt. Replay kết quả không phải thực thi lại. Repair dữ liệu cần đối chiếu delta/receipt và kế hoạch riêng.

Lỗi vận hành chỉ log event/code/số đo định sẵn, không log stack/error thô, tài khoản, payload, token/initData hoặc nội dung AI. Quên nội dung xóa inbox/tool journal đã hoàn tất và vô hiệu nháp AI, giữ ID/trạng thái chống chạy lại; không xóa task/log nghiệp vụ. Owner, payload cap, SQL bind, version/day, lease/fencing/dedupe là các guard thực thi; prompt không phải security boundary.
