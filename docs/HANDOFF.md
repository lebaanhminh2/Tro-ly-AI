# Tiếp tục từ đây
2026-09-13. User đã duyệt phạm vi Mini App + lịch lặp + task con + healthy. Đã tạo prototype local, chưa nối backend hoặc deploy.

## Đã chốt / chưa chạy
- Mini App3 tab: Hôm nay (Lịch/Danh sách), Lời nhắc user đặt, Thành tích. Settings start mặc định04:30 và giờ nghỉ user chọn.
- /kiemtra,/lich,/ngu,/huongdan,/huy; /lich đọc lịch DB để patch; chat báo bận không tự đổi lịch.
- Healthy đến giờ nghỉ nhắc ngủ, /ngu mới bật nghỉ, chat vẫn hoạt động; tự hết nghỉ ngày bắt đầu mới. Khi im lặng tối đa3 tin cách20 phút.
- Streak chỉ báo /ngu đúng giờ: Luyện Khí3,Trúc Cơ7,Kết Đan14,Nguyên Anh30; không chuyển chuỗi công việc thành giấc ngủ.
- Task #24 và con #24.1 cố định, checkbox cha–con có confirm. Task dở giữ ID/deadline; xong qua ngày ẩn nhưng giữ history.
- Recurrence rule lâu dài + occurrences riêng, không setup lại hằng ngày. Đây đều là thiết kế đích, chưa có đủ trong code.
- PRODUCT_BRIEF là nguồn mục tiêu. TOOL_CALLING_PLAN chứa wireframe, lifecycle, danh sách file mới/sửa mục5–6 và gates mục7.
- User đã duyệt danh sách file mục5–6 và bắt đầu prototype. Không xin lại phạm vi này; cần phản hồi bố cục trước nối DB như kế hoạch.
- Prototype: web/index.html,styles.css,app.js,api.js,views/{today,reminders,achievements}.js. HTML/CSS/JS native, không dependency/network/storage. Có banner DEMO rõ, reload khôi phục dữ liệu mẫu.
- Chạy xem: python -m http.server 4173 --bind 127.0.0.1 --directory web. Server local session9206 đã mở; kiểm còn sống trước chạy lại.
- Đã chụp Edge headless giả lập414×896,320px không overflow ngang; ảnh .wrangler/miniapp-{today,reminders,achievements,dark}.png ignored. Mở task sheet3 checkbox và recurring form được xác minh DevTools.
- Chưa là UI chức năng thật: lịch timeline/số liệu demo cố định, form chỉ memory, chưa editor availability, API auth, recurrence/sleep backend hoặc chia sẻ ảnh. Không dùng mock như số liệu thật.

## Prototype tu luyện bổ sung
- Đã sửa web/index.html,api.js,app.js,styles.css,views/achievements.js theo duyệt: thương hiệu Trợ lý của cậu; số dư/lifetime qi, vé, kho, quay, ghép, breakthrough và bảo vệ72h.
- Pure demo functions trong web/api.js; xác suất40/15/35/6/2/2. Test inline deterministic đạt boundaries,total100,ticket-once,fusion-fail return2,daily attempt/protection/lifetime.
- Edge headless chụp .wrangler/cultivation-preview.png; click quay giảm vé và kho6 loại mở đúng. Không live Gemini/deploy/cloud writes.
- Toàn bộ chỉ state in-memory reload reset. Ngủ đúng+5/muộn−20 hiển thị luật; KHÔNG chấm giấc ngủ demo do chưa chốt no-report và xử lý số âm. Không backend inventory/rewards.
- Chi tiết luật/mốc demo trong PRODUCT_BRIEF. Mốc demo chưa cân lại với+5/day; đừng coi luật chưa chốt là authorization.
- Tiếp theo user xem prototype; cần chốt2 edge cases trước triển khai ledger thưởng/phạt thật.

## Code/cloud đang có
- Worktree sạch trước lượt; lượt này thêm prototype web và cập nhật docs, không đổi cloud.
- Worker version59549382-0a33-4a47-b0ed-d2f113ffdcf6; migration0001–0012 đã áp. Không sửa migration lịch sử.
- Telegram board/progress PNG, task đơn, session, nhắc một lần, milestone/task achievements; Google source đã bỏ.
- Gemini native tools + respond, tối đa2 calls/turn, owner/dedupe/atomic writes. Không trần40/ngày,4/phút hay pilot expiry production.
- Mini App/auth/recurrence/day planner/sleep log/task hierarchy CHƯA triển khai.
- Các test cũ đạt không chứng minh phiên bản Mini App hoặc healthy mới.

## Quyền và dữ liệu
- Không live Gemini/cloud writes trong lượt prototype. Budget agent tách khỏi quyền user chat, không tự mở API calls vô hạn.
- Chưa xóa bảng/source UI cũ cho tới cutover có replacement. Backup trước0012: .wrangler/staging-before-0012.sql ignored, không in/commit.
- Chỉ commit docs chọn lọc; không push khi môi trường từng từ chối xuất bản. Không merge/force-push hoặc sửa secret.
- Việc tiếp theo: user xem prototype → nối auth/API và migration local theo plan; không deploy mock lên bot hoặc giả auth.
