# Trợ lý bạn đồng hành — yêu cầu đã chốt

## Mục tiêu

- Một người dùng, tiếng Việt, iPhone XS Max/iOS 18.3.2, giờ Việt Nam.
- Giảm gánh nặng tự tổ chức, giảm số quyết định và giúp bắt đầu sớm thay vì dồn sát deadline.
- Ưu tiên hoàn thành nhiều task nhất có thể trong thời gian và năng lượng thực tế; không nhồi lịch bất khả thi hoặc mặc định hoãn hết khi mệt.
- Telegram là giao diện chính. Không cần bật máy tính cá nhân liên tục.
- Gemini free là model duy nhất ở giai đoạn này; không tự chuyển sang provider/gói trả phí.

## Trải nghiệm chính

Cậu trò chuyện tự nhiên với Minh Anh như một người bạn. Gemini luôn nhận câu hiện tại cùng context do backend chuẩn bị, rồi tự chọn một trong các cách:

- chỉ trò chuyện;
- hỏi đúng phần còn thiếu;
- đọc dữ liệu;
- thực hiện một hoặc nhiều hành động backend;
- đề xuất hoặc điều chỉnh kế hoạch.

Yêu cầu rõ và có thể hoàn tác thì tự làm rồi báo. Chỉ xác nhận khi mơ hồ đáng kể, xóa/bulk, khó hoàn tác hoặc thay đổi do trợ lý tự đề xuất. Không bắt nhớ lệnh hay đi wizard; button chỉ dùng khi xác nhận, xem tổng quan hoặc thật sự tiện hơn chat.

Ví dụ:

- “Thêm bài báo cáo hạn 12h mai, 9h nhắc tớ làm” → tạo task, deadline và reminder trong một giao dịch.
- “18h48 nhắc tớ cắm cơm” → reminder độc lập, không gắn vào task ngẫu nhiên.
- “8h tối nay tớ họp tiếng Anh” → event nội bộ, không biến thành task thường.
- “Hôm nay tớ mệt quá” → trò chuyện theo ngữ cảnh; không tự ghi DB hoặc hoãn toàn bộ việc.

## Context và trí nhớ

Gemini API không tự nhớ giữa các request. Backend phải ghép một context nhỏ nhưng đủ dùng gồm:

- persona/rule;
- rolling summary của hội thoại cũ;
- các lượt chat gần đây;
- memory và sở thích liên quan;
- pending intent đang nói dở;
- trạng thái hôm nay và workload ngắn gọn;
- task, event, reminder và work plan liên quan;
- câu người dùng vừa gửi.

DB là nguồn sự thật cho nghiệp vụ. Summary chỉ giúp hiểu mạch trò chuyện, không tự cấp quyền sửa dữ liệu. Khi context đến ngưỡng, việc làm mới summary được ghép vào lần gọi Gemini đang có thay vì tạo một request riêng nếu có thể.

## Persona

- Minh Anh là cô bạn gái-trợ lý AI hư cấu trưởng thành; giọng Bắc tự nhiên, tớ–cậu.
- Hơi tinh nghịch/cà khịa, có chính kiến và chút charm; không CSKH, anime hay cố cute.
- Nhịp nói linh hoạt; không ép emoji, câu hỏi hoặc tách nhiều tin gây nhiều thông báo.
- Chat xã hội là chat xã hội, không cố biến mọi câu thành task.
- Không bịa ký ức hoặc đời sống ngoài đời; không dùng tình cảm gây áp lực.
- Phân biệt mệt thật, quá tải và né tránh dựa trên context; vẫn bảo vệ mục tiêu hoàn thành công việc.

## Nghiệp vụ tối thiểu

- **Task:** việc cần hoàn thành; có thể có deadline, ước lượng và next action.
- **Event:** cam kết xảy ra tại thời gian cố định, như họp/học/hẹn.
- **Reminder:** lời nhắc đúng giờ; có thể độc lập hoặc liên kết task/event.
- **Work plan/session:** khoảng dự kiến làm task, có thể điều chỉnh; không phải deadline.
- **Memory/conversation state:** sở thích, summary, recent turns và yêu cầu đang nói dở.

Date-only giữ ngày, không tự gán 23:59. Deadline không phải exact reminder. Tuy vậy, trợ lý được dùng deadline để tạo work plan và proactive nudge theo quyền chủ động đã chốt; không tự đổi deadline.

## Nhắc và theo sát

- Exact reminder là lời hứa đúng giờ do user yêu cầu hoặc đồng ý rõ.
- Proactive nudge do trợ lý tạo để giúp bắt đầu/tiếp tục task; được điều chỉnh theo kế hoạch và phản hồi.
- Mỗi hẹn có một nhắc chính và tối đa một follow-up sau 15 phút tính từ lúc gửi chính thành công nếu chưa có phản hồi liên quan.
- Giới hạn áp dụng theo từng task/reminder, không phải tổng số lần nhắc trong ngày.
- Phản hồi về việc khác không được tự đánh dấu mọi reminder là đã phản hồi.
- Không có giờ yên lặng tự động; user có thể chủ động pause/resume.
- Scheduler và outbox đảm bảo đúng giờ. Gemini không được gọi mỗi phút; lỗi/quota model không được làm mất exact reminder.

## Giới hạn và an toàn vừa đủ

Dữ liệu chỉ là công việc cá nhân nên không xây hệ policy/privacy nặng. Vẫn giữ các kiểm tra rẻ và bắt buộc: xác thực owner, bảo vệ secret/API key, schema tool, chống ghi lặp, transaction và không cho LLM chạy SQL/URL tùy ý.

Không tích hợp Google Calendar. Không tự thêm game/XP, voice/OCR, Mini App, đa người dùng, vector DB, agent framework hoặc nhiều provider trong bản đầu.
