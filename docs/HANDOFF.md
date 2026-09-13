# Tiếp tục từ đây
2026-09-13. User yêu cầu làm liên tục đến nghiệm thu Mini App + lịch + tu luyện. Đây là checkpoint đang làm, KHÔNG hoàn tất, không xin lại scope đã duyệt.

## Cửa phát hành hiện tại
- BLOCKER quyền: export DB staging vào .wrangler/staging-before-miniapp.sql bị môi trường từ chối vì cần user cho phép rõ payload công việc/hội thoại tải về local. Không retry/workaround cho tới user cấp lại quyền. Không deploy/migrate khi chưa backup/restore.
- wrangler đã thêm assets web/ASSETS/run_worker_first; dry-run đọc assets đạt. Cloud vẫn bản cũ không ASSETS vì chưa deploy.
- Worker local4174 dùng owner123/bot token giả/AI off + DB local migrations1–15; /app files200, API unauth401, signed bootstrap200; browser414px đã lưu settings và tạo Local UI QA report trong DB local. Không DB/user thật bị đổi.
- Local Edge automation dùng injected Telegram initData tổng hợp (không credential thật). First injection fail đã sửa Page.enable; subsequent setup/save/create thật local đạt.
- Sửa race frontend: giữ request id sau mutation success tới khi bootstrap refresh thành công; không roll lại nếu mất response reload. Parent completion có con mở qua chat yêu cầu confirmation như app.
- Setup lần đầu sau target ngủ không tạo day cũ/phạt hồi tố; test đạt. Theme Telegram sync, Today lọc ngàyVN, header Trợ lý của cậu đã sửa.
- Full129 tests chính +25 experiments đạt; typecheck và staging dry-run đạt. Không Gemini live trong lượt này.

## Rà soát chuyển ngày gần nhất
- Sửa next-day settings: dùng start/sleep mới cho ngày sau, không overlap/rút ngắn rest của snapshot cũ; khoảng chuyển giờ chưa mở ngày mới được coi resting. Target healthy-runtime7 đạt.
- Morning/bedtime outbox có cửa sổ hiệu lực: retry quá1h sáng/20phút nhắc ngủ không gửi bù; owner/day được kiểm.
- Chart live dùng nhãn ngày thực và empty state thay ảnh rỗng; không thêm Gemini request/deploy/cloud writes.
- Typecheck và staging dry-run đạt. Chưa bật ASSETS hoặc áp0013–15; không tuyên bố sản phẩm hoàn tất.

## Lượt tiếp tục sau gián đoạn
- Đã hoàn tất edit_task_step qua chat: prepareStep dùng mutateHierarchy chung, HealthyStore defer statements vào outer transaction. Tick con không hoàn thành cha/không nhận vé; test local đạt.
- schedule_dialogs thêm vào0014 CHƯA áp cloud: /lich bare mở phiên15phút gắn ngày; /huy thoát; morning reply hoặc phiên active cấp quyền replan. Kiểm foreign/expired/cancel đạt.
- Duplicate Telegram update không tính chat activity mới. Lệnh /kiemtra khi ASSETS bật queue setChatMenuButton (boolean receipt, không AI); asset/API routing đã test headers/auth.
- UI live: pause/finish/skip buổi đã nối; unplanned thật hiển thị; giờ địa phương không ISO; lưu thẻ PNG tại client, user chủ động tải. Chưa kiểm share/download trên iPhone thật.
- Chưa deploy hoặc áp0013–0015; không gọi Gemini trong lượt này. Full125 tests chính +25 experiments đạt; API/assets targeted4 đạt, typecheck đạt.

## Tối ưu lượt gần nhất
- Context tải song song các truy vấn độc lập (không đổi schema/không gọi thêm model); 13 assistant-flow tests +8 planner/API tests và typecheck đạt.
- ASSETS mode cung cấp task_codes gồm mã cha/con + UUID; model được nhắc không hoàn thành cha thay bước con. Đã có edit_task_step dùng cùng mutation UI (lượt mới nhất).
- Bootstrap trả resting thật; live UI không còn nút chỉ đổi resting ở browser. Không bật ASSETS/deploy/cloud trong lượt này.
- Preview http://127.0.0.1:4173 còn trả200 trên máy local, user có thể review UI; không phải sản phẩm live.
- Token user sắp hết: ưu tiên gates phát hành và lưu checkpoint, không mở thêm feature hoặc ngụy trang mock thành live.

## Tiến độ lượt mới nhất
- Morning reply kiểm owner + outbox sent message ID + ngày sinh hoạt hiện tại/asleep; worker và executor nhận cùng quyền phiên lịch. Tin hôm qua/foreign không được replan.
- Vé task hoàn thành qua chat: syncTaskTickets sau processInbox và cron khi ASSETS bật; migration0015 backfill awards cho task completed cũ để không phát vé hồi tố. Test chat/reopen không award2 lần đạt.
- API /session dùng sessionStatements chung, UI start đã nối; dời occurrence UI đã nối /api/reminder-instance. Chưa deploy/migrate cloud.
- Full122 tests chính đạt, experiments đang/kết quả tool; typecheck đạt. Không gọi Gemini/cloud trong lượt này.

## Tiến độ lượt tiếp tục
- /lich route/prompt riêng + allowlist2 tools replan_day/respond; nhận schedule snapshot. Plain chat không được replan. Replan statements deferred vào outer transaction, giữ deadlines, hủy future blocks cũ, omitted tasks vào unplanned.
- Planner xếp task quá hạn tiếp thay vì bỏ hẳn; không đổi deadline. Block đang chạy/cố định được trừ trước packing.
- Settings API dùng request receipt idempotent; bulk delete Mini App có all-or-nothing/version, confirm trong UI; skip/move occurrence API đã có, skip button đã nối.
- Một lần reminder đang sending/sent/uncertain không được đổi; thao tác move giữ slot ID và hủy pending outbox cũ.
- 2 Gemini requests thật cho /lich: prompt chung sai trường type thay busy (bị validate chặn), prompt riêng lần2 đúng free/busy/estimates/version+respond. Không cloud writes/deploy.
- Targeted planner5 tests và hierarchy/API/settings9 tests đạt; full120 tests chính +25 experiments đạt. Typecheck cuối đạt; web syntax đạt.

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
- Worker chỉ mở API/scheduler mới khi env.ASSETS tồn tại. wrangler source đã cấu hình ASSETS nhưng CHƯA deploy nên bot cloud vẫn bản cũ, không phạt user.

## Kiểm thử đã làm
- Full109+25 đạt trước thêm vài phần cuối; full sau đó đạt (xem tool output session18010). Typecheck cuối đạt.
- Target healthy/auth/rules/ledger/hierarchy/api/planner đạt. SQLite fresh + upgrade giữ ID/mã, không lỗi FK.
- Đã dùng2 Gemini requests trong lượt tiếp tục; chưa cloud mutation/deploy. Không dùng ngân sách user chat thay ngân sách agent.
- Frontend cú pháp JS đạt; nhánh live chưa end-to-end trong Telegram.

## BẮT BUỘC tiếp tục trước deploy
- User vẫn yêu cầu tới nghiệm thu, không hỏi lại scope. Ưu tiên kiểm UI live + migration/settings day rollover/rest trước bật ASSETS; không phát hành nửa vời.
- Các thay đổi lượt gián đoạn đã tiếp nối và kiểm thử; cần commit checkpoint ngay, không đọc lại cả lịch sử.
1. Rà phát sinh mới: schedule configure đã receipt; replan giữ omitted unplanned và xếp overdue; current end/start setting transition và không chấm trước ngày setup cần test.
2. Unify task changes chat/API: chat complete đã sync ticket khi ASSETS; chat hierarchy #id/steps đã có tool; cần test ngôn ngữ thật có ngân sách; không để hai luật khác nhau. Parent complete API đã dừng running/planned sessions; cần integration chat/API cùng luật.
3. Frontend live còn placeholder: bulk delete và skip đã nối; move UI/start session đã nối; share PNG và session controls đã nối, chưa iPhone live; achievements day đã dùng server day; ensure không fake success/đọc mock khi live. Bỏ demo labels/timeline giả trong live, không deploy placeholder.
4. /lich đã specialized prompt và replan tool, chỉ explicit command; morning reply cùng quyền phiên đã nối; /lich bare đã giữ phiên15phút tới /huy/commit/hết ngày. /ngu chưa setup đã pause tới next start và không phạt; lỗi model phần kèm vẫn đáp báo nghỉ. Cần test end-to-end sau nối assets.
5. Scheduler rest final guard, queueCheckIns expiry/outage, suspension stop mọi cơ chế background, preserve recurring exceptions và tránh nhắc trùng old/new. Không backcharge missed days do restart/settings.
6. MiniApp input auth chuẩn nhưng session TTL15min cần UI reopen; API JSON types validate/rate payload. /api/settings GET bootstrap currently ensureDay mutates setup day; review scope.
7. Hoàn thiện UI prototype approved → live mappings, wire static assets /app + Telegram menu/web_app qua cùng Worker; chưa thêm tài nguyên.
8. Full test/workerd PNG/assets/live API on414px, backup/restore0013–15 rồi mới cutover. Không áp migration đang viết lên cloud.
- Đừng nói “chỉ chờ user nghiệm thu”: còn các việc trên cần làm, không blocker user choice.

## Cloud/git
- Cloud59549382-0a33-4a47-b0ed-d2f113ffdcf6, migrations0001–0012; không sửa lịch sử. Không quota/expiry pilot production.
- Giữ backup ignored và quyền secret. Git checkpoint local, không push vì môi trường trước từ chối xuất bản.
