# Mini App + planner + healthy — phạm vi xin duyệt
2026-09-13. Hướng sản phẩm đã chốt; chưa duyệt danh sách source mới bên dưới. Không triển khai hoặc gọi API thật trong lượt thiết kế này.

## 1. Công nghệ và ranh giới
- Giữ TypeScript/Workers/D1/cron/Telegram/Gemini direct REST; frontend HTML/CSS/JS modules nhỏ, chưa thêm React/build framework/dependency.
- Static Assets trên Worker hiện có, API cùng origin; không tạo host/DB thứ hai.
- Telegram initData được xác minh HMAC phía server + auth_date/owner; không tin initDataUnsafe. Phiên API ngắn, request mutation có key chống lặp/version; không secret trong JS/URL.
- Frontend: danh sách DOM an toàn (textContent), CSP phù hợp SDK, CORS same-origin, kiểm origin mutation, không nhúng HTML từ task/LLM.
- Chat và API dùng chung application executor; không bê nguyên payload Telegram/inbox làm public API. Scheduler chỉ backend, không phụ thuộc Mini App đang mở.
- Nguồn chính thức: https://core.telegram.org/bots/webapps ; https://developers.cloudflare.com/workers/static-assets/

## 2. Bố cục mẫu để duyệt trước triển khai
- Khung: header ngắn + nút cài đặt; nội dung cuộn; bottom tabs Hôm nay/Lời nhắc/Thành tích luôn thấy, có safe-area.
- Hôm nay: card “Làm tiếp” nổi bật → toggle Lịch/Danh sách → timeline hoặc hàng task có mã/checkbox → nhóm Chưa xếp. Không hai bản task.
- Task detail dạng bottom sheet: #24/tên/deadline → checkbox con #24.1… → thêm bước/sửa/xóa. Confirmation cha–con nêu rõ số mục ảnh hưởng.
- Lời nhắc: segmented Một lần/Định kỳ → mỗi hàng tên/giờ/quy tắc/lần tiếp theo; editor giờ + ngày lặp + từ/đến. Tắt/sửa chuỗi phải khác “bỏ lần này”.
- Thành tích: số hoàn thành/đúng hạn → chart theo kỳ → chuỗi ngủ → huy hiệu. Mốc sau cùng đã mở không có số lần; chỉ mốc kế tiếp có progress.
- Empty state có CTA thật, không số0/0 hoặc hình rỗng. Nhắc: “Chưa có lịch lặp — Thêm lời nhắc”; thành tích: “Báo /ngu để bắt đầu ghi nhận”.
- Settings chỉ start giờ/target nghỉ. Onboarding chưa chọn giờ nghỉ thì chưa kích hoạt healthy/planner, không tự đoán giờ nghỉ.
- Review viewport414×896 và chữ lớn; target≥44px, no hover-only, focus/label đầy đủ; animation≤200ms, reduced-motion. Lưu thành công sau receipt, lỗi có retry không ghi trùng.
- Chart SVG/canvas tại client có nhãn; thẻ chia sẻ render từ số liệu server, không dùng AI ảnh. Không thêm game/tiền ảo.

## 3. Nguồn dữ liệu và vòng đời
| Nhóm | Nguồn → consumer | Quy tắc |
| --- | --- | --- |
| Task code/con | Backend cấp mã → chat + Mini App | Một tầng, unique counter/parent; không tái sử dụng; giữ UUID cũ |
| Phiên /lich | Lệnh hoặc reply vào morning message → model chuyên lịch | Gắn ngày/version/expiry; phần rõ commit, phần thiếu pending |
| Giờ hoạt động | Settings mặc định + overrides ngày từ /lich/form → planner | Phân biệt confirmed/assumed; chưa biết tạm rảnh trong khung, trừ busy/fixed |
| Plan | Model chọn ưu tiên/bước + backend kiểm sức chứa → work blocks | Chỉ task mở; DB event là cố định; dời plan hủy job cũ, không sửa deadline |
| Recurrence rule | User chat/form → scheduler | local timezone, days/times/start/end, enabled/revision; không reset hằng ngày |
| Occurrence | Rule + ngày/giờ → outbox | unique(rule,slot); skip/move riêng; sửa rule cancel occurrence cũ; restart không phát lại |
| Ngày sinh hoạt | Settings snapshot đầu ngày → healthy/planner | start,target_sleep,wake_next, trạng thái; qua00h vẫn cùng ngày sinh hoạt |
| Sleep log | /ngu timestamp server → streak | một bản/ngày, repeated command không tăng; lịch sử giữ target snapshot |
| Achievements | Sleep log chuẩn → dashboard/share/outbox | namespace sleep mới, không convert achievement công việc; unlock một lần |
- Task xong qua ngày ẩn view, không erase dữ liệu; task dở cùng ID xếp tiếp. Deadline quá hạn giữ nguyên và cảnh báo.
- Nghỉ suppress occurrence đến hạn, không xóa rule; đánh dấu skipped_rest để không gửi bù. Kiểm nghỉ lần cuối trước send.
- Khi /ngu đến đồng thời send đã rời server, không thể thu hồi tin đang bay; ghi trạng thái trung thực, chặn các tin tiếp theo.
- Daily start chỉ reset nghỉ/hỏi một lần/ngày; outage không spam câu hỏi lịch cũ.
- Không dùng cả bộ nhắc cũ và mới cho cùng occurrence: migration mapping sent/uncertain/response cần kiểm trước cutover.

## 4. AI và kế hoạch thực tế
- /lich nhận toàn lịch hiện tại + yêu cầu; thực hiện patch, không replace toàn DB. Parser thời gian là model; schema/time/version là backend.
- Khi user chỉ báo bận trong chat: không auto replan. /ngu và yêu cầu dừng rõ được backend ưu tiên; không bắt user thương lượng với persona.
- Morning prompt gửi template0 call; trả lời /lich dùng model có context hiện tại, tối đa2 calls. Không model cron mỗi phút.
- Healthy context: ngày sinh hoạt, giờ mục tiêu, độ trễ, nhắc đã gửi, /ngu, recent replies. Có thể soạn lời nhắc trong lượt /lich; mốc đến giờ dùng nội dung đã lưu/fallback. Không bịa đã đọc user đang ngủ.
- Tạm rảnh không đồng nghĩa cường độ100%; công việc xếp theo estimate với nghỉ/đệm, hiển thị lượng chưa xếp; không hard-cap3 task.
- Tick tay đáng tin về intent hơn suy đoán; bot hỗ trợ #24/#24.2, không coi số vị trí trang là định danh.
- Khi hết Gemini quota: giao diện, /ngu, occurrence, nhắc đã lưu vẫn chạy; chưa lập được plan mới phải báo rõ.

## 5. Source mới dự kiến — cần duyệt
- Frontend: web/index.html, web/styles.css, web/app.js, web/api.js, web/views/{today,reminders,achievements}.js; vẽ SVG/canvas bằng code, không assets AI.
- API/auth: src/entrypoints/mini-app.ts, src/adapters/telegram/mini-app-auth.ts.
- Domain/application: src/domain/{availability,recurrence,healthy}.ts, src/application/{schedule-command,daily-planner,healthy-command}.ts.
- D1: src/adapters/d1/{schedule-store,recurrence-store,healthy-store}.ts.
- Migration tiếp theo:0013_task_hierarchy.sql,0014_schedule_recurrence.sql,0015_healthy.sql. Không sửa0001–0012 đã áp.
- Tests mới: tests/unit/{recurrence,healthy,mini-app-auth}.test.ts; tests/integration/{mini-app,task-hierarchy,daily-planner,healthy-runtime}.test.ts; web UI fixture trong tests/fixtures/mini-app.json nếu cần.
- Không module chỉ bọc một hàm; có thể không tạo file dự kiến nếu phần đó tái dùng tốt. Thêm file ngoài danh sách phải trình lại.

## 6. Source hiện hữu sửa/loại bỏ — cần duyệt
- src/entrypoints/worker.ts,src/config/env.ts,wrangler.jsonc,tsconfig.json: serve frontend/API và bind assets; package.json chỉ script test nếu cần, không cài dependency chưa duyệt.
- src/ai/{contracts,policy,persona}.ts,src/application/{context-builder,conversation-command,tool-executor,plan-command,process-inbox,memory-command,session-command}.ts: routing phiên và executor chung.
- src/domain/{work,conversation,session,progress,time,ui}.ts,src/ports/work-store.ts: mã/task con/sleep/stat contracts.
- src/adapters/d1/{work-store,conversation-store,session-store,progress-store,memory,reminders,outbox,ui-store}.ts,src/adapters/telegram/api.ts: transitions/counters/recurrence/rest và menu web_app.
- src/application/{progress-renderer,ui-renderer}.ts: bỏ bảng/ảnh chính khỏi chat khi Mini App đã thay thế; chỉ giữ callback cũ báo mở ứng dụng, không hai CRUD UI chạy song song.
- tests/integration/{assistant-flow,ai-runtime,conversation,command-transactions,sessions,telegram,ui-lifecycle,ux-flow,work-progress,workers-fetch}.test.ts và tests/unit/{architecture,ai-adapter,policy,progress,time,staging-config,ui-renderer,conversation,migration-compat}.test.ts: cập nhật hồi quy, không xóa test vì fail.
- scripts/telegram-setup.ps1: đăng ký nút menu nếu thực sự dùng; docs hiện có cập nhật trạng thái/vận hành. Không chỉnh secrets thật.
- UI preview local không ghi data thật. Không xóa tài nguyên Google/cloud hoặc dữ liệu user dưới danh nghĩa dọn source.

## 7. Trình tự và nghiệm thu
1. UI prototype ba tab + empty/populated/loading/error + task sheet/rule editor; xem trên viewport iPhone trước nối DB.
2. Auth/API typed + migration local/backfill task codes; kiểm owner giả, initData sai/hết hạn, CSRF, duplicate write.
3. Task hierarchy/checkbox/bulk delete + stats và archived task ngày mới; kiểm cha–con/undo giữ số liệu đúng.
4. Recurrence + date overrides + pause/rest + delete/snooze; advance clock nhiều ngày, restart và partial failure; không phải chờ nhiều ngày thật.
5. /lich/morning/day planner/healthy + /ngu ưu tiên; đặt giờ sau00h, trước04:30, sau mục tiêu, đổi setting giữa ngày, lịch mâu thuẫn, hết provider quota.
6. Sleep streak + cultivation achievements/share; không convert old task streak. Chỉ data có bằng chứng, không nhãn “ngủ thực tế”.
7. Full test/typecheck/workerd/dry-run, review UI 414px/text lớn/reduced-motion; backup/restore kiểm schema cũ→mới giữ task/history và không nhắc lặp.
8. Cutover staging/menu: nguồn cũ ngừng dispatch item đã migrate; kiểm tuần tự chat→Mini App→tick→/lich→nhắc→/ngu. User nghiệm thu toàn luồng.
- Luôn ghi vấn đề test và giới hạn thật, không dùng deploy thành công thay nghiệm thu trải nghiệm.
- Quyền live smoke/deploy/menu chưa suy từ duyệt ý tưởng: đề xuất tối đa8 Gemini requests cho đợt mới, không paid fallback, không tái áp trần user chat.
