# P2 — Today, buổi làm và nhắc

Ngày 2026-09-11. Chỉ nghiệm thu local; chưa Telegram thật, Cron cloud hoặc Gemini.

## Quy tắc người dùng đã chốt

Mỗi lần hẹn của một task có tối đa 2 lượt: đến giờ và nhắc thêm sau 15 phút nếu chưa phản hồi. Không giới hạn tổng theo ngày. Task khác/lần hẹn mới do user chủ động chọn vẫn áp dụng cùng quy tắc. Không tự tạo hẹn mới để tiếp tục nhắc.

## Có thể dùng trong luồng local

- `/tasks` → [Lên buổi] → nhập `DD/MM/YYYY HH:mm | 25` → xác nhận. Buổi draft chưa tạo nhắc.
- `/today`: buổi trong ngày Việt Nam, tên task/giờ/trạng thái và nút của buổi hiện tại.
- Bắt đầu, tạm dừng, làm tiếp, kết thúc buổi, bỏ buổi, hoãn 15 phút. Nút có session version, stale không thay đổi dữ liệu.
- `/settings`, `/quiet 22:00 07:00`, `/rest`, `/resume`. Quiet mặc định 22–07 là cấu hình thử được thông báo, không phải kết luận lịch ngủ thật.
- Kết thúc buổi không hoàn thành task hoặc tăng %. Actual time chỉ cộng các đoạn running.
- Session không được phản hồi sau khung hẹn thành unknown, không phải failed. Không dồn lời nhắc ngày trước sang hôm sau.

## Lưu trữ và giao dịch

Migration 0004 thêm sessions, reminder_preferences, session_input, reminders và outbox reminder reference; migrations trước giữ nguyên.
Session/preferences/job thay đổi cùng transaction command P1. Snooze tăng generation, cancel reminders cũ; có tối đa hai reminder rows/generation bằng unique constraint.
Dispatcher query jobs đến hạn có index/lô hữu hạn. Outbox gửi phải kiểm tra lại generation/status/quiet/pause trước và sau claim, kể cả retry 429. Không gọi AI để quyết định nhắc.
Follow-up chỉ sau primary được xác nhận sent và cách ít nhất 15 phút; primary uncertain/failed không kích hoạt follow-up. Primary trễ có thể khiến follow-up không còn phù hợp khung buổi, khi đó bỏ, không dồn.
Phản hồi của user sau primary hủy các follow-up đang chờ; khi không biết user đang trả lời buổi nào, v1 chọn giảm làm phiền: hủy các follow-up outstanding của owner, không hủy lần hẹn tương lai chưa nhắc chính.
Rest chỉ hủy pending/queued reminders có giờ đến hạn trước lúc hết nghỉ; lịch nhắc những ngày sau được giữ. Resume không hồi sinh các job đã hủy trong khoảng nghỉ; muốn hẹn lại dùng snooze/lên buổi mới.

Review fix: outbox lưu `sent_at` khi provider xác nhận thành công; follow-up cách ít nhất 15 phút từ mốc này, không dùng giờ tạo job/available. Bản ghi sent cũ không có sent_at không được dùng để đoán thời điểm follow-up.

## Kiểm thử

Kết quả local: **34/34 tests mặc định + 25/25 experiments pass**; typecheck, migration 0004 trên D1 local và Workers dry-run pass. Không API thật/deploy; các tests dùng thời gian và transport giả.

`tests/integration/sessions.test.ts`: ba lần hẹn cùng ngày → sáu tin; không trùng khi dispatcher chạy đồng thời; response suppression; snooze generation; pause/end/time; stale callback; quiet xuyên đêm; pause sau 429; không catch-up spam ngày mới; persistence qua restart và owner isolation.
Chạy `npm.cmd run test:all`, `npm.cmd run typecheck`, `npm.cmd run db:local`, `npm.cmd run build:check`.

## Giới hạn cần giữ rõ

- UTC+7, ngày giờ rõ và slash commands là UI local; ngày tự nhiên/memory/persona thuộc P3. Calendar và kiểm tra conflict thuộc P4.
- Today hiện là danh sách tối đa 30 buổi/ngày và action buổi hiện tại; chưa planner tự chọn Today Win hoặc mục tiêu dài hạn.
- Không tự phát hiện user đang nghỉ nếu chưa thao tác; không có dữ liệu cảm biến. Nút “đang kẹt” và hội thoại gỡ việc sẽ nối P3.
- Request đã gửi đi trước khi nghỉ/hoãn commit không thể thu hồi bảo đảm; các kiểm tra chặn tin CHƯA gửi và retry, không hứa hủy gói tin đang trên mạng.
- Outbox vẫn có uncertain/manual handling; không hứa exactly-once Telegram. Không gắn Cron cloud trong mốc này.
- Chưa đo CPU/time limit Workers production; dry-run không chứng minh hiệu năng. Owner workload rất lớn cần kiểm tra lô/pagination tại pilot.
