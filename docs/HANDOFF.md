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

Checkpoint tiếp: recoverOnInteraction cho edit uncertain có message ID đã biết. Khi user bấm lại, xác minh owner/chat/message/token, tạo một card mới từ view ĐÃ COMMIT với action token mới, expire card cũ; không execute lại callback. Không auto retry edit vì request cũ có thể tới muộn; không recover send chưa rõ message ID. Test recovery sai owner/message, một replacement, stale sender bị fence và initial-send không retry đạt. Calendar cal-select đặt selected=0/1 rõ ràng có fence thay toggle mù, cal-toggle cũ trả stale; replay không đảo trạng thái. Full suite trước test bổ sung cuối: 59+25 đạt; test initial-send bổ sung đạt riêng, typecheck/dry-run đạt. CHƯA deploy hoặc áp 0008 remote. Còn Calendar side effect receipt/UI commit atomic gap và full matrix trước bật mode mới.

Checkpoint UI reliability: raw callbacks từ reminder đã sent được adopt vào ui_cards sau kiểm owner/chat/message/generation/planned và nút có thật trong payload. Raw callbacks card thường vẫn từ chối. Có early ACK riêng theo outbox ID trước nghiệp vụ, prepareUi dưới lease vẫn xác thực lại. editMessageText lỗi chính xác message-not-found/cannot-edit tạo replacement một lần, vô hiệu card cũ và phát lại actions bằng token mới; timeout không fallback send. Test:all 59 tests chính +25 experiments đạt; guard bổ sung nguồn reminder khi resume adoption được test riêng và typecheck đạt; staging dry-run đạt. CHƯA bật mode mới, CHƯA migration remote/deploy. Còn uncertain recovery, Calendar side effects/transition, full matrix/iPhone. Không yêu cầu user duyệt lại hoặc test bản chưa bật.

UI integration checkpoint mới: createWorker tham số thứ 5 cardsEnabled=false mặc định. Khi true, D1WorkStore.prepareUi resolve token gắn owner/message/revision trước planCommand; stale chỉ notice, không nghiệp vụ. Commit UI transition cùng business batch, flush UI sau outbox cả webhook/cron; 429 retry persistent tối đa 3. Test Worker capture/list/detail/back/wizard cùng message ID, replay không mutation. Chưa deploy/remote migration, chưa bật mặc định vì reminders vẫn raw callbacks (sẽ bị từ chối trong mode mới), ACK chưa tách sớm cho Calendar chậm, deleted-card fallback/uncertain recovery chưa xong. Tiếp tục trong phạm vi đã duyệt, không yêu cầu user test UI mới lúc này.

Kiểm tra checkpoint integration: test:all đạt (58 tests chính +25 experiments), typecheck và staging dry-run đạt. Không gọi Telegram/Gemini/Google thật trong đợt này; không deploy.

UI lifecycle tiếp tục trong phạm vi đã duyệt: thêm migrations/0008_ui_cards.sql (chưa cloud), domain/ui.ts, D1UiStore (create/resolve/update statement builders/claim/finish/recover), tests/integration/ui-lifecycle.test.ts. Telegram hỗ trợ editMessageText và exact-prefix no-op 400 thành sent chỉ cho edit, tests liên quan và workerd cập nhật. CHƯA tích hợp module UI mới vào worker/store/dispatcher, CHƯA chuyển màn, CHƯA deploy. Tiếp tục notice/ACK, deleted-card fallback, recovery edit uncertain rồi nối toàn bộ flow; không cần user duyệt lại. Không đọc secrets hay gửi tin cloud ở lượt này.

Kiểm tra checkpoint UI lifecycle: test:all đạt (56 tests chính +25 experiments), typecheck và staging dry-run đạt. Tình trạng card uncertain hiện chặn gửi tiếp; chưa triển khai reconcile. Không áp migration/deploy khi chưa tích hợp và kiểm thử toàn đợt.

Hội thoại-first được user tái khẳng định và đã ghi thành yêu cầu bắt buộc trong PRODUCT_BRIEF/DECISIONS: AI hiểu/ngữ cảnh → backend lưu/hỏi/xác nhận theo quyền; xác nhận bằng lời gắn proposal; nút/card hỗ trợ, wizard fallback. User duyệt tiếp tục UI_REMEDIATION_PLAN. Đã bắt đầu phần nền: ui-renderer.ts chung chuẩn hóa nhãn theo grapheme, rows và callback bytes; gọi trước commit và ở Telegram send/preview (bao phủ nhắc). 54 tests chính +25 experiments đạt, typecheck/dry-run đạt; test transport bổ sung text hợp lệ để không bỏ qua nhánh network sau validation. CHƯA hoàn thành A/B/C, CHƯA deploy đợt này. Còn card/flow revision + edit tại chỗ + notice/ACK + serialize/reconcile outbox và chuyển tất cả UI; không tuyên bố lỗi nút cũ đã giải quyết bằng renderer. Tiếp tục phạm vi đã duyệt, không yêu cầu user duyệt lại từng bước. Không bật AI/Calendar.

Yêu cầu mới: user nhấn mạnh rà toàn bộ source UI/callback, không vá từng ảnh và không nhầm LLM intent với UI. Đã lập [UI_REMEDIATION_PLAN.md](UI_REMEDIATION_PLAN.md): root cause View thiếu lifecycle, default sendMessage, clear theo change type, renderer phân tán, wizard thiếu step revision, outbox thiếu card ordering. Kế hoạch A hợp đồng/card delivery → B chuyển mọi UI kể cả Calendar/AI → C test ma trận + iPhone rồi deploy. Chỉ docs ở lượt này, chưa sửa code. Cần duyệt files/phạm vi trong plan trước triển khai.

Đợt UX được duyệt và triển khai 2026-09-12: task list/detail nút ngắn, ẩn focus khi AI off; wizard ngày/giờ/thời lượng dùng D1 input+expiry và callback, không migration; Today chọn từng buổi; nút theo trạng thái; một running session (application+DB guard); callback quên cũ không xóa context; gỡ keyboard card app qua outbox, silent repeat confirmations; bỏ quiet cả reminder và Calendar slot, giữ pause/no catch-up. UX_FLOWS mục 0 ghi phạm vi/giới hạn. Full suite sau thay đổi chính: 51 tests chính +25 experiments đạt, typecheck/dry-run đạt; bổ sung guard pause/DB test sau đó và chạy lại UX integration/typecheck đạt. Deploy staging e3ee96bd-b282-4431-8d74-b9b76d545333, AI/Calendar off. Cần user mở /tasks mới để nghiệm thu UI iPhone; không gọi đây là xong v1. Chưa picker phút tùy ý bằng nút, chưa task lifecycle/PATCH Google. Không sửa bản ghi task/nhắc cloud thủ công.

UX review 2026-09-12: user đã xác nhận bot trả lời /tasks và tạo việc được; ảnh bộc lộ callback spam, nút cắt, form lịch khó. User yêu cầu bỏ quiet và duyệt tự rà toàn bộ luồng rồi trình một đợt sửa. Kết quả/phạm vi file tại [UX_REVIEW.md](UX_REVIEW.md), chưa sửa code hay deploy trong lượt review. Tái hiện hàm: invalid session buttons ở 4 trạng thái, Today 2 sessions chỉ điều khiển s1, forget:missing vẫn lập side effect xóa context. Giữ pause chủ động + 2 lượt/lần hẹn, bỏ quiet; chưa coi yêu cầu này là cho phép reset jobs cũ. Chờ duyệt phạm vi code UX review; chưa bật AI/Calendar.

Kết quả sửa redirect: 50/50 tests chính + 25/25 experiments đạt; typecheck/staging dry-run đạt. Deploy staging version ca88ec98-0148-4507-bc83-c5ee7ca59d3f thành công, AI/Calendar off. Cần user gửi /tasks MỚI để xác nhận gửi thành công thật; chưa có bằng chứng outbound live sau sửa. Không cần nhập secrets hoặc setWebhook lại.

Sửa tương thích Workers được duyệt: bỏ redirect:error trong Telegram/Google/Gemini runtime, dùng manual và từ chối non-2xx/chuyển hướng; Telegram giữ uncertain khi redirect, không tự retry. Google transport được gọi qua closure tránh lỗi receiver của native fetch. tests/integration/workers-fetch.test.ts transpile code thật vào workerd, thay duy nhất mạng bằng outboundService giả: gửi thành công, redirect bị từ chối, không có request tới đích bẫy; cả Gemini đi qua entrypoint + D1. Đây là bài học từ mock fetch Node không phát hiện được API runtime khác biệt. Chờ nghiệm thu /tasks mới sau deploy, không reset outbox cũ.

Chẩn đoán chiều gửi Telegram được duyệt: API adapter log chỉ event/code/phase/httpStatus/apiStatus, không exception/raw response/token/URL/chat. tests/integration/telegram.test.ts thêm regression không lộ secrets; 4 test liên quan + typecheck đạt. Đã deploy version a36b60b5-6f25-41de-92a1-f5eb43223f33. Trước sửa: D1 có 4 command done, 4 outbox uncertain, endpoint không auth trả 403; inbound đã hoạt động nhưng chưa rõ nguyên nhân outbound. Không reset/retry uncertain. Đang mở wrangler tail và chờ user gửi /tasks mới để có mã lỗi. AI/Calendar vẫn off.

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
