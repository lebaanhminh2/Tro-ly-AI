# Tiếp tục từ đây
2026-09-13. User chốt chuyển sang Mini App + lịch lặp + task con + healthy. Đang thiết kế; chưa thay source cho đợt mới.

## Đã chốt / chưa chạy
- Mini App3 tab: Hôm nay (Lịch/Danh sách), Lời nhắc user đặt, Thành tích. Settings start mặc định04:30 và giờ nghỉ user chọn.
- /kiemtra,/lich,/ngu,/huongdan,/huy; /lich đọc lịch DB để patch; chat báo bận không tự đổi lịch.
- Healthy đến giờ nghỉ nhắc ngủ, /ngu mới bật nghỉ, chat vẫn hoạt động; tự hết nghỉ ngày bắt đầu mới. Khi im lặng tối đa3 tin cách20 phút.
- Streak chỉ báo /ngu đúng giờ: Luyện Khí3,Trúc Cơ7,Kết Đan14,Nguyên Anh30; không chuyển chuỗi công việc thành giấc ngủ.
- Task #24 và con #24.1 cố định, checkbox cha–con có confirm. Task dở giữ ID/deadline; xong qua ngày ẩn nhưng giữ history.
- Recurrence rule lâu dài + occurrences riêng, không setup lại hằng ngày. Đây đều là thiết kế đích, chưa có đủ trong code.
- PRODUCT_BRIEF là nguồn mục tiêu. TOOL_CALLING_PLAN chứa wireframe, lifecycle, danh sách file mới/sửa mục5–6 và gates mục7.
- User đã duyệt hướng, nhưng chưa thấy danh sách file Mini App trước lượt này: cần duyệt phạm vi cụ thể trước tạo/sửa source theo AGENTS.

## Code/cloud đang có
- Worktree sạch trước lượt; chỉ docs thay trong lượt này.
- Worker version59549382-0a33-4a47-b0ed-d2f113ffdcf6; migration0001–0012 đã áp. Không sửa migration lịch sử.
- Telegram board/progress PNG, task đơn, session, nhắc một lần, milestone/task achievements; Google source đã bỏ.
- Gemini native tools + respond, tối đa2 calls/turn, owner/dedupe/atomic writes. Không trần40/ngày,4/phút hay pilot expiry production.
- Mini App/auth/recurrence/day planner/sleep log/task hierarchy CHƯA triển khai.
- Các test cũ đạt không chứng minh phiên bản Mini App hoặc healthy mới.

## Quyền và dữ liệu
- Không live Gemini, cloud writes hoặc source edits trong lượt thiết kế. Budget agent tách khỏi quyền user chat, không tự mở API calls vô hạn.
- Chưa xóa bảng/source UI cũ cho tới cutover có replacement. Backup trước0012: .wrangler/staging-before-0012.sql ignored, không in/commit.
- Chỉ commit docs chọn lọc; không push khi môi trường từng từ chối xuất bản. Không merge/force-push hoặc sửa secret.
- Việc tiếp theo: duyệt phạm vi → prototype local để nhìn UI → triển khai tuần tự theo plan; không deploy nửa chừng.
