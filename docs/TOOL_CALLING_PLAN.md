# Kế hoạch thay luồng trợ lý — phạm vi đã duyệt
Cập nhật 2026-09-13. Sản phẩm đã chốt; user đã duyệt danh sách thay source và ngân sách tối đa20 request trong lượt tiếp theo. Không coi tài liệu là code đã chạy.

Checkpoint triển khai và live QA xem HANDOFF; đã có bản để user nghiệm thu. Protocol JSON tổng hợp đã thử không đạt; triển khai native tools + respond(message), không duy trì hai protocol.

Checkpoint rà soát2026-09-13: đã deploy sửa /today phân trang event+session, priority task ngoài20, bảo toàn @index khi respond đứng trước, giới hạn summary theo snapshot. 88+25 tests và assistant-flow13 đạt. Còn giới hạn một nhóm confirmation hiện hành, planner không tự chạy AI nền; nghiệm thu người dùng chưa có.

Bổ sung đã duyệt và triển khai: board5 mục, filter/select/review/soft-delete, PNG7/28 ngày, streak/achievement, completion/milestone DB, Sửa bằng chat. Checkpoint/ngân sách mới nhất trong HANDOFF, không dùng kế hoạch cũ để sửa migration đã áp.

## 1. Đích và bằng chứng rà soát
- Giữ Telegram/Workers/D1/Gemini free/cron/outbox. Bỏ Google; không đổi provider/framework.
- Một lượt có thể đồng thời trò chuyện, làm nhiều việc rõ và hỏi phần còn thiếu: message + actions_now[] + pending[].
- Source hiện chặn nhiều write trong application/conversation-command.ts. Migration0010 còn unique một write/turn và một pending/owner.
- context-builder.ts chỉ lấy tối đa4 cặp history từ work-store; không summary. Snapshot thiếu nhắc đã gửi và đang chờ phản hồi.
- telegram/api.ts chưa lấy reply_to_message; acknowledgeAppointments hiện đánh dấu mọi hẹn đã gửi là responded khi có tin mới.
- Google còn nối worker/config/ports/router/store/test, không thể chỉ xóa thư mục adapter.
- Dữ liệu task/reminder bị gắn sai trong lần user thử chưa được truy vết cloud trong lượt này. Chưa chứng minh nguyên nhân cụ thể bằng receipt thật.

## 2. Luồng một lượt và quyền
Telegram → xác thực/dedupe + lưu tin → lấy snapshot → Gemini → kiểm dữ liệu → commit actions/pending/receipt/lịch sử/outbox → gửi Telegram.
- Gemini hiểu ngôn ngữ và chọn hành động; backend kiểm owner, schema, ID, ngày giờ, version, giới hạn và transaction. Không thêm model duyệt hoặc regex whitelist câu nói.
- Chọn một protocol production. Ứng viên: JSON có cấu trúc với message, actions_now, pending, read_requests và summary_update; không trộn thêm handler legacy.
- Thông thường một model request. Nếu cần đọc ngoài snapshot: lượt đầu chỉ đọc, không ghi; đưa kết quả vào đúng một request bổ sung. Hết ngân sách thì trả thiếu dữ liệu rõ, không đoán hoặc loop.
- Nhiều action độc lập chạy trong cùng transaction local; action có quan hệ dùng composite hoặc local_ref để backend cấp ID thật. Không để model đoán ID vừa tạo.
- Phần đủ thông tin được ghi cùng pending của phần chưa rõ. Ví dụ tạo task và lưu câu hỏi giờ nhắc; reminder chưa được tạo cho đến khi có giờ.
- Message là bản nháp chờ commit; action lỗi thì không gửi lời thành công. Lỗi gửi sau commit không lặp lại action; outbox giữ sent/failed/uncertain riêng.
- Câu đáp trước kết quả DB có thể lệch action dù JSON hợp lệ. Dùng kết quả thực thi cho chi tiết xác nhận thiết yếu và fallback; không tuyên bố backend hiểu đúng mọi ý định.
- Không tự hoàn thành task từ im lặng, không tự đổi deadline, không ép hỏi/confirm chỉ vì có nhiều action.

## 3. Dữ liệu: nguồn → dùng → kết thúc
| Dữ liệu | Nguồn và consumer | Vòng đời/chống mất mạch |
| --- | --- | --- |
| Tin nhận | Telegram update/message/reply IDs → context, receipt | Lưu trước xử lý; retry cùng ID không làm lại |
| Hội thoại + thông báo | User text, reply draft và trạng thái outbox → recent context | Phân biệt bot đã gửi/chưa gửi; gồm nhắc chủ động, không chỉ câu chat |
| Summary | History cũ + summary trước → context builder | Version + covered_through; chỉ nén đoạn nguồn đã đọc, không sự kiện tương lai |
| Pending | Model nêu phần thiếu/đề xuất → lượt sau hoặc nút | Nhiều pending có ID và liên kết; waiting → applied/cancelled/expired; sửa thay thế bản cũ |
| Memory | Lời user, nguồn turn và thời điểm → context | Tạm thời hết hạn; sở thích ổn định sửa/xóa được; suy đoán không thành sự thật |
| Task/event | Action rõ → context, planner | Task có deadline; event có giờ cố định/end tùy chọn; hoàn thành/hủy cập nhật version |
| Work block | Model đề xuất từ task + lịch biết được → scheduler | Ước lượng ghi rõ là ước lượng; đổi/hủy block hủy job cũ, không đổi deadline |
| Reminder/nudge | Yêu cầu user hoặc work plan → scheduler/outbox | scheduled → queued → sent → responded/closed; generation chặn nhắc lỗi thời |
| Receipt | Backend commit → retry/recovery | Kết quả thực thi là sự thật; giữ batch receipt cho nhiều action, không cần nhiều journal song song |

Thông số kỹ thuật đề xuất (không phải quota đã cấp): history thô30 ngày; pending clarification24h, confirmation15 phút; trạng thái tạm hết ngày. Receipt chống trùng giữ qua cửa sổ retry; không xóa khóa dedupe cùng nội dung chat.
Summary ưu tiên theo ngân sách context và số lượt chưa bao phủ, không tóm tắt mọi lần đổi chủ đề. Giữ đoạn gần nguyên văn và phần chưa summary; lỗi summary không chặn chat, không ghi đè bản tốt, không gọi lại tự động.
Summary ghép vào request khi cần vẫn tốn output token. Chỉ tóm tắt history đã chốt trước turn hiện tại; kết quả actions của turn hiện tại được backend lưu riêng sau commit.
Job dọn dữ liệu phải bao phủ cache tool_context/tool_reply/tool_steps, không chỉ conversation_turns. Không âm thầm kéo dài retention bằng bản sao ở bảng khác.

## 4. Context và chủ động vừa đủ
- Luôn có thời gian VN, câu hiện tại, persona, pending, summary, history gần, nhắc đã gửi và work snapshot.
- Với10–20 task: tải compact toàn bộ active task + event/block/reminder gần. Nếu cắt trang/ngân sách phải ghi rõ còn dữ liệu chưa tải; không giả tổng quan đầy đủ.
- Khoảng8–12 cặp chat là cấu hình khởi đầu theo ngân sách, không lời hứa nhớ vô hạn. Nguồn DB ưu tiên hơn summary khi mâu thuẫn.
- Thiếu lịch cố định sau bỏ Google: bot chỉ biết điều user nhập. Khoảng trống không đồng nghĩa user rảnh. Onboarding hỏi gọn giờ có thể làm việc; chỉ hỏi estimate khi nó ảnh hưởng kế hoạch.
- Lập/replan chủ yếu ghép vào lượt chat. Mỗi plan tạo next action + giờ trigger + nội dung nhắc dự kiến; không chỉ là văn bản trôi trong hội thoại.
- Cron gửi thông báo đã chuẩn bị, kiểm lại trạng thái trước gửi; không gọi model mỗi phút.
- Khi user im lặng: thực thi plan đã lưu, dừng đúng giới hạn. Nếu chưa có plan/giờ làm việc, không giả Gemini đang tự suy nghĩ nền; check-in nền riêng chỉ mở khi có ngân sách được duyệt.
- Tối đa nhắc chính + một follow-up sau15 phút từ sent thành công cho cùng vòng task; không tái tạo vòng để lách giới hạn. Không trần theo ngày, không giờ yên lặng tự động; giữ pause chủ động.
- Reply/button liên kết trực tiếp; chat thường Gemini dựa active reminders để gắn phản hồi. Không liên quan thì không acknowledge. Xong một bước không xong toàn task.
- Overview mặc định1–3 việc và bước tiếp theo; vẫn xem được toàn bộ khi user yêu cầu. Persona tự nhiên nhưng không đoán chắc mệt/lười hoặc tạo áp lực tình cảm.

## 5. Phạm vi file xin duyệt
Các nhóm dưới là phạm vi cho cả đợt; chỉ sửa phần liên quan, không format lại toàn repo.
- Xóa sau gỡ consumer: src/adapters/google-calendar/{client,service,vault}.ts, src/ports/calendar.ts, src/domain/calendar.ts, tests/integration/calendar.test.ts. Chuyển helper ngày giờ còn dùng sang domain/time.ts trước xóa.
- Sửa giao tiếp/protocol: src/ai/{contracts,gemini,persona,policy}.ts; src/application/{context-builder,conversation-command,tool-executor,plan-command,process-inbox,memory-command,session-command,ui-renderer}.ts.
- Sửa domain/ports: src/domain/{work,conversation,memory,session,time,ui}.ts, src/ports/work-store.ts.
- Sửa lưu trữ/gửi: src/adapters/d1/{conversation-store,work-store,memory,session-store,reminders,outbox,ui-store,database}.ts, src/adapters/telegram/api.ts, src/entrypoints/worker.ts, src/config/env.ts.
- File mới dự kiến: src/domain/event.ts, src/adapters/d1/event-store.ts, migrations/0011_assistant_flow.sql. Chỉ tạo module khi có trách nhiệm riêng; summary/pending giữ trong kho hiện hữu.
- Cấu hình/vận hành: wrangler.jsonc, .env.example (không .env thật), package.json nếu bỏ script cũ, scripts/telegram-setup.ps1.
- Tests: sửa tests/unit/{ai-adapter,policy,architecture,staging-config,time,conversation,migration-compat,ui-renderer}.test.ts và tests/integration/{conversation,memory,ai-runtime,command-transactions,sessions,telegram,ui-lifecycle,ux-flow,workers-fetch,review-fixes}.test.ts; thêm tests/integration/assistant-flow.test.ts cho chuỗi người dùng thật.
- experiments/ai-trial: chỉ sửa import/type bị ảnh hưởng trong file đang có; không mở rộng prompt/harness cũ, không thêm runtime fallback. Helper proposals/tasks chỉ xóa sau chứng minh không caller.
- Docs chỉ cập nhật file hiện hữu: PRODUCT_BRIEF, TOOL_CALLING_PLAN, HANDOFF, OPERATIONS, README khi routing cần đổi. Không thêm kho Markdown/archive.
- Không sửa migration0001–0010, không xóa task/cloud DB, không thay secret, không thêm dependency/provider nếu không trình lại.

## 6. Thứ tự và cửa kiểm tra nội bộ
1. Baseline local + xác định fixture hồi quy. Kiểm schema response gọn với đúng Gemini đang cấu hình trước khi chuyển runtime; tối đa8 provider request thật đề xuất, không tự lấy quota cũ để chạy.
2. Gỡ Google source/config/test liên quan; giữ chức năng nhắc/task cũ chạy trong local. Chưa deploy bản chuyển dở.
3. Migration data/pending/event/reminder: giữ ID task cũ; backfill reminder, giữ sent/responded/generation, không phát lại lời nhắc đã gửi. Kiểm nâng DB cũ lẫn DB mới.
4. Context + envelope + executor batch + pending; một path production. Ghi mutation/receipt/pending/delivery intent cùng transaction rồi mới gửi.
5. Planning/nudge/overview/persona nối cùng luồng, bỏ wizard chặn chat. Nút cũ hết hạn có đường mở lại, không phát lại nghiệp vụ.
6. Test lỗi/chuỗi hội thoại, typecheck và dry-run. Kiểm import/job/table hết consumer; không giữ hai scheduler cùng gửi reminder sau cutover.
7. Chuẩn bị cutover staging: backup và thử restore local, kiểm đúng DB/flags/quota, áp migration rồi deploy tương thích. Không tự downgrade code cũ lên dữ liệu mới; có rollback cụ thể trước phát hành.
8. Smoke thật và theo dõi đến hạn nhắc; chỉ bàn giao cuối khi có bằng chứng Telegram nhận, số request và không ghi nhầm/trùng. User nghiệm thu độ tự nhiên trên iPhone; test server không chứng minh push hiển thị trên điện thoại.

## 7. Nghiệm thu và quyền cloud
- Chuỗi bắt buộc: chat → thêm task + hỏi giờ → trả lời giờ → reminder → reply đúng item → xong bước → xong task.
- Thêm ca: nhiều action, hai pending, sửa ý, tên trùng, reminder độc lập, event, summary qua nhiều lượt, task ngoài snapshot,20 task overview, pause và bỏ lỡ.
- Lỗi bắt buộc: invalid JSON/ID, phủ định/giả định, quota429, timeout, DB rollback, crash sau commit, duplicate update, stale button, send uncertain, summary lỗi.
- Đo request/turn, latency từng chặng, token đầu vào/ra, reminder delivery và chất lượng hội thoại; không dùng số test pass thay chất lượng.
- Một-call là đường mục tiêu, không cam kết tất cả câu. Structured output đúng schema không bảo đảm đúng ý; nếu smoke không đạt thì báo đúng lỗi trước mở rộng, không prompt vô hạn.
- Config sau duyệt bổ sung đặt40 request/24h và trial end2026-09-13T11:42:18Z; chưa kiểm cloud/quota còn lại. Đây là trần app, không phải hạn mức Gemini free.
- Phạm vi đã được duyệt: tối đa8 request smoke protocol +12 request nghiệm thu tự động, gửi tin thử vào bot riêng, migration/deploy assistant-staging. Không tăng tổng ngân sách pilot, gia hạn runtime hay bật nền AI nếu chưa có đồng ý rõ; hết ngân sách báo blocker.
- Git local checkpoint; push vẫn đang bị môi trường chặn cần quyền xuất bản riêng. Không để Git push chặn rà soát/code local.

Tham khảo giao thức/quota: [Google structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Google rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Chưa gọi API Gemini thật trong lượt lập kế hoạch này.
