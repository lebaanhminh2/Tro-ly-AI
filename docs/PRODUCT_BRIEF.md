# Trợ lý bạn đồng hành — yêu cầu đã chốt

## Mục tiêu

- Một người dùng, tiếng Việt, iPhone XS Max/iOS 18.3.2, giờ Việt Nam.
- Telegram là giao diện trò chuyện chính; không bắt nhớ lệnh hoặc bấm nhiều nút.
- Minh Anh là người bạn-trợ lý: nói chuyện tự nhiên, giọng Bắc kiểu tớ–cậu, hơi tinh nghịch, có chính kiến, không CSKH hay cố cute.
- Giảm quyết định, giúp bắt đầu sớm, theo sát và hoàn thành nhiều task nhất trong khả năng thực tế.
- Gemini free là model duy nhất; không paid fallback. Hệ thống không yêu cầu bật máy tính cá nhân.
- Bỏ tích hợp Google Calendar.

## Trải nghiệm chính

Backend gửi cho Gemini context hiện tại cùng câu vừa nhận. Gemini tự quyết định kết quả cho cả lượt, không bị ép chọn một chế độ riêng:

- trò chuyện hoặc phản hồi;
- thực hiện một hay nhiều hành động đã rõ;
- lưu phần chưa đủ thông tin hoặc cần xác nhận;
- đồng thời hỏi đúng phần còn thiếu.

Kết quả lượt có ba phần logic:

```text
message + actions_now[] + pending[]
```

Ví dụ “thêm bài báo cáo hạn mai, sáng nhắc tớ nhé”:

- tạo task ngay;
- lưu pending reminder;
- trả lời đã thêm task và hỏi muốn nhắc mấy giờ.

Chỉ báo phần đã làm sau khi backend commit. Phần đang chờ phải nói rõ là chưa thực hiện.

## Context và trí nhớ

Gemini API không tự nhớ. Mỗi request nhận context do backend ghép từ:

- persona/rule;
- rolling summary của hội thoại cũ;
- 8–12 lượt gần nhất trong ngân sách;
- memory/sở thích;
- pending đang nói dở;
- task, event, reminder, work plan và nudge liên quan;
- thời gian hiện tại và câu vừa gửi.

Task/event/reminder trong D1 là sự thật. Summary chỉ giúp hiểu mạch nói chuyện. Khi cần làm mới summary, ưu tiên lấy `summary_update` trong chính request đang có thay vì gọi model riêng.

## Dữ liệu nghiệp vụ

- **Task:** việc cần hoàn thành, có thể có deadline/next action/ước lượng.
- **Event:** cam kết xảy ra vào giờ cố định như họp, học, hẹn.
- **Reminder:** lời nhắc đúng giờ, độc lập hoặc liên kết task/event.
- **Work plan/session:** khoảng dự kiến làm task, có thể điều chỉnh và không phải deadline.
- **Pending:** phần yêu cầu còn thiếu dữ liệu hoặc chờ xác nhận.
- **Memory/conversation state:** thông tin giúp duy trì ngữ cảnh và cách giao tiếp.

Deadline không tự trở thành exact reminder. Trợ lý được dùng deadline để lập work plan và proactive nudge, nhưng không tự đổi deadline.

## Quyền và giới hạn

Yêu cầu rõ, nội bộ và có thể hoàn tác thì tự làm; được thực hiện nhiều action trong một lượt. Hỏi/xác nhận khi thiếu dữ liệu, nhiều đối tượng cùng phù hợp, xóa/bulk/khó hoàn tác hoặc thay đổi lớn do trợ lý tự đề xuất.

Dữ liệu công việc không nhạy cảm nên không xây policy nặng. Vẫn giữ owner authentication, bảo vệ secret/API key, schema action, idempotency, transaction và không cho LLM chạy SQL/URL tùy ý.

Exact reminder do scheduler/outbox gửi, không phụ thuộc Gemini đang còn quota. Mỗi hẹn có một nhắc chính và tối đa một follow-up sau 15 phút nếu chưa có phản hồi liên quan; giới hạn tính theo từng task/reminder, không theo ngày.

## Bảng và động lực
- Xem toàn bộ → bảng DB5 việc/trang, lọc; không AI dump danh sách dài. Chọn nhiều → review → xác nhận xóa, hủy nhắc liên quan. Soft-delete giữ thành tích; sửa tên/hạn qua nút focus + chat.
- Tiến bộ: PNG backend vẽ số hoàn thành7 ngày, hoạt động28 ngày; streak tính ngày VN có completion/mốc nhỏ, không tính nhắn tin/đặt lịch.
- Thành tựu1/10/30 task và3/7/14/30 ngày; mở khóa một lần và giữ khi chuỗi đứt. Không dữ liệu lịch sử thì không suy ngược từ status.
- Lời khen cute/thân mật kiểu bạn gái theo mốc thật, không dùng tình cảm gây áp lực. Gọi model chỉ khi trò chuyện, không khi xem/chuyển bảng.
