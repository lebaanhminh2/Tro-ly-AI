# Tiếp tục từ đây
2026-09-13. User yêu cầu làm liên tục đến nghiệm thu Mini App + lịch + tu luyện. Đây là checkpoint đang làm, KHÔNG hoàn tất, không xin lại scope đã duyệt.

## Source mới đã có local
- web demo cập nhật cảnh giới đến1000/2000, giảm chuỗi≥10 như PRODUCT_BRIEF. /app/ có nhánh gọi API thật; root vẫn demo.
- src/domain/healthy.ts: +5 đúng giờ/−20 muộn hoặc không báo; floor0; dưới ngưỡng rank hạ1 bậc khi có phạt, trừ khi được bảo vệ72h; không trừ lifetime earned. Hết bảo vệ không tự hạ.
- 3 ngày không chat tối đa3 phạt rồi suspended; resume bỏ qua các ngày vắng, reset chuỗi; không truy thu.
- Random tables40/15/35/6/2/2, fuse80/60/40 mất1 trả2 khi fail; breakthrough70/85/100 có1 phù,1 lần/day; server crypto random.
- HealthyStore sổ state/version/receipt atomic; sleep assessment và task ticket ghi cùng batch, retry không roll/phạt lại.
- Migrations0013–0015 tạo mã task/steps, schedule settings/days, recurrence rules/occurrences, cultivation accounts/receipts/sleep assessments/ticket awards. CHƯA cloud.
- HMAC initData/auth_date/owner trên server, cross-origin rejected; API bootstrap/tasks/settings/reminders/schedule/cultivation local, không thêm SDK/dependency.
- Task hierarchy mutation hỗ trợ thêm/sửa/complete cha–con, soft delete; parent/child confirm và vé1 lần đã test.
- RecurrenceStore sinh occurrence ổn định, queue/drop khi rest, rule revision; outbox đã có nhánh recurring và check rest. Chưa cutover legacy appointments.
- ScheduleStore snapshot ngày, /ngu report, score closed days; queue morning/bedtime3 lần; có replan typed free/busy/estimates. Planner pure packing với nghỉ, không cap3 task.
- Worker chỉ mở API/scheduler mới khi env.ASSETS tồn tại. wrangler CHƯA cấu hình ASSETS nên bot cloud vẫn bản cũ, không phạt user.

## Kiểm thử đã làm
- Full109+25 đạt trước thêm vài phần cuối; full sau đó đạt (xem tool output session18010). Typecheck cuối đạt.
- Target healthy/auth/rules/ledger/hierarchy/api/planner đạt. SQLite fresh + upgrade giữ ID/mã, không lỗi FK.
- Chưa gọi Gemini live trong lượt này, chưa cloud mutation/deploy. Không dùng ngân sách user chat thay ngân sách agent.
- Frontend cú pháp JS đạt; nhánh live chưa end-to-end trong Telegram.

## BẮT BUỘC tiếp tục trước deploy
1. Rà phát sinh mới: schedule configure chưa idempotency receipt; replan nhận task estimates thiếu items có thể bỏ khỏi planned (phải hiện unplanned); xử lý deadline quá hạn theo mục tiêu xếp tiếp không bỏ; current end/start setting transition và không chấm trước ngày setup cần test.
2. Unify task changes chat/API: chat complete chưa award ticket mới, chat chưa hierarchy #id/steps; không để hai luật khác nhau. Parent complete API đã dừng running/planned sessions; cần integration chat/API cùng luật.
3. Frontend live còn placeholder: bulk delete, skip/reschedule occurrence, start session, share; achievements demoDay dùng client settings/hardcoded270 chưa server day; ensure không fake success/đọc mock khi live. Bỏ demo labels/timeline giả trong live, không deploy placeholder.
4. /lich parser có nhưng chưa route vào specialized prompt/tool/read lịch DB; morning reply chưa cùng phiên. /ngu chưa setup đã pause tới next start và không phạt; lỗi model phần kèm vẫn đáp báo nghỉ. Cần test end-to-end sau nối assets.
5. Scheduler rest final guard, queueCheckIns expiry/outage, suspension stop mọi cơ chế background, preserve recurring exceptions và tránh nhắc trùng old/new. Không backcharge missed days do restart/settings.
6. MiniApp input auth chuẩn nhưng session TTL15min cần UI reopen; API JSON types validate/rate payload. /api/settings GET bootstrap currently ensureDay mutates setup day; review scope.
7. Hoàn thiện UI prototype approved → live mappings, wire static assets /app + Telegram menu/web_app qua cùng Worker; chưa thêm tài nguyên.
8. Full test/workerd PNG/assets/live API on414px, backup/restore0013–15 rồi mới cutover. Không áp migration đang viết lên cloud.
- Đừng nói “chỉ chờ user nghiệm thu”: còn các việc trên cần làm, không blocker user choice.

## Cloud/git
- Cloud59549382-0a33-4a47-b0ed-d2f113ffdcf6, migrations0001–0012; không sửa lịch sử. Không quota/expiry pilot production.
- Giữ backup ignored và quyền secret. Git checkpoint local, không push vì môi trường trước từ chối xuất bản.
