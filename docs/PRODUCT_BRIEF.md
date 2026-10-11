# Minh Anh — sản phẩm nền và hướng mở rộng

Cập nhật 2026-10-12. Brief này giữ trải nghiệm nền; source khảo sát `51f5ffd`, trạng thái thực tế xem [HANDOFF](HANDOFF.md). Đây không phải bảng cân bằng hoặc lời khẳng định tất cả luồng đã được audit live.

## Mục tiêu

- Trợ lý cá nhân tiếng Việt, tăng năng suất trong sức tải thực tế, giúp bắt đầu sớm và giảm quyết định. Không hard-cap số task/ngày tùy tiện.
- Telegram cho trò chuyện/nhận nhắc; web cho quản lý và thao tác rõ. Web cơ bản không cần Gemini khi lọc/tick/form.
- Minh Anh là bạn gái-trợ lý hư cấu trưởng thành, tớ–cậu, giọng Bắc tự nhiên, trêu/động viên nhẹ; không đe dọa hoặc dùng tình cảm gây tội lỗi.
- Múi giờ sinh hoạt hiện tại UTC+7; mobile ưu tiên iPhone, desktop dùng được. Không đòi máy cá nhân chạy liên tục để task/nhắc/game runtime hoạt động.
- Gemini free theo cấu hình được xác minh, không paid fallback/ngân sách mới. Model đề xuất/diễn giải, server quyết định quyền và trạng thái.

## Task, kế hoạch và lời nhắc

- Task có ID/mã ổn định, cha–con, deadline/estimate/work log/ghi chú theo source hiện tại. Task dở giữ identity và deadline; không nhân bản để xếp lại.
- Cha–con có confirmation rõ ở thao tác ảnh hưởng cả nhóm; không suy “xong một bước” là xong cha. Thưởng task hợp lệ lần đầu theo source gốc, không nhân khi mở lại.
- Hôm nay giúp thấy việc tiếp theo và toàn cảnh/thời gian tới deadline. Task đã xong không vào chỉnh xếp thời gian, history vẫn giữ.
- `/lich` hoặc web chỉnh lịch là ý định thay đổi kế hoạch rõ; câu chat “bận” không tự dời task. Planner giữ free/busy/fixed/capacity/buffer, không giả mọi khoảng trống là sức tải 100%.
- Lời nhắc riêng do user đặt khác lời thúc task tự động. Nhắc một lần/định kỳ có occurrence/version riêng; sửa/bỏ lần này khác sửa chuỗi, không send bù dồn sau outage.
- ACK nhắc không tự hoàn thành task; chat thường đọc/trò chuyện theo policy hiện có, không âm thầm mutation.

## Ngủ, tập trung và tiến trình nền

- `/ngu` và web sleep báo trạng thái do user tự khai, không đo giấc ngủ. Sau đó ngừng lời thúc ngủ/task, context model biết state chuẩn; focus dùng ranh giới tương đương.
- Lời nhắc user cấu hình vẫn chạy khi ngủ/focus, trừ manual pause/inactive theo source. Không chặn toàn outbox bằng sleep flag.
- Ngủ không đóng ngày sinh hoạt. Undo 5 phút ghi “Hoàn tác”, giữ guards và đảo delta ngủ; không rewind đột phá/inventory/account. Không thêm giới hạn 1 lần/ngày.
- Giờ ngủ hôm nay ở vùng Hỏa Mạch/Thành tích; điều khiển ngủ ở cài đặt. Hôm nay hiện thẻ sleep state theo cơ chế đã chốt.
- Healthy, streak ngủ, rewards/checkin/gacha/items/rank/breakthrough hiện có tiếp tục theo domain/backend. Không sao chép bảng prototype cũ thành luật mới; `src/domain/healthy.ts` là nguồn hằng số hiện tại.
- Ngày sinh hoạt tùy start/target/end snapshot; checkin theo ngày lịch Việt Nam. Đổi giờ không sửa lịch sử hoặc mở lại kỳ đã khóa.

## UI và UX cần giữ

- Màn chính ngắn/gọn, thứ bậc chữ rõ, spacing theo nhóm thông tin, few accent colors, cả dark/light. Điều hướng có thể phát triển khi tính năng mới cần, có bằng chứng từ flow thật.
- Touch targets khoảng≥44 px, safe-area, không overflow ngang hoặc chỉ dùng hover/màu để phân biệt. Header/nút đóng sheet luôn tiếp cận khi cuộn; focus/labels/reduced motion rõ.
- Loading/empty/error/saving/read-only/conflict/auth expired có hướng xử lý. Success chỉ sau commit; POST đã lưu nhưng refresh lỗi phải reconcile, không retry nhân tác dụng.
- Lore/trang trí không cản ghi task/habit. Không đặt thuật ngữ receipt/SQL/version trong luồng user nếu không giúp quyết định.

## Mở rộng đã giao AI

Toàn Habit/Thần Lộ tại [HABIT_GAME_PRODUCT](HABIT_GAME_PRODUCT.md): habit độc lập/lịch tùy chọn, tracking, luyện và battle, đủ 5 phái/39 môn/15 chương, các tuyến phụ và art nguyên bản. [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md) sở hữu quyền/mốc/prompt goal, [REVIEW](HABIT_GAME_REVIEW.md) giữ lựa chọn user.

Phần game có không gian riêng và có thể thu gọn; người không chơi vẫn quản lý task/habit/ngủ tốt. Không thay persona trợ lý bằng NPC game hoặc tạo currency/tích hợp nền tảng mới chưa cần thiết. AI tự chọn chi tiết thiết kế trong khung, tự test/review/sửa để user nghiệm thu cuối.
