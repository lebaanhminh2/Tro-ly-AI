# Trợ lý hội thoại — yêu cầu đã chốt

## Người dùng và mục tiêu

- Một người dùng, tiếng Việt, iPhone XS Max/iOS18.3.2, giờ Việt Nam.
- Khó bắt đầu việc lớn, dễ kiệt sức/né lịch và làm dồn sát deadline.
- Giúp giảm gánh nặng tự tổ chức, bắt đầu việc nhỏ và cân bằng sức khỏe; không tối đa hóa năng suất hay chẩn đoán tâm lý.
- Không phải bật máy tính cá nhân liên tục. Ưu tiên miễn phí, không hứa miễn phí vô hạn.

## Trải nghiệm chính

Trò chuyện tự nhiên → Gemini hiểu bối cảnh, đọc DB qua công cụ khi cần → điền tham số công cụ → backend kiểm tra và lưu → cô ấy trả lời kết quả.
Không bắt nhớ lệnh hoặc đi wizard. Card/nút chỉ hỗ trợ xác nhận, tổng quan và thao tác khi tiện.

Ví dụ: “Thêm cho tớ việc rửa bát deadline 7h tối nay nhé” → task rửa bát, hạn19:00 hôm nay (nếu còn phù hợp), lưu xong mới báo.
Không hỏi lại “có thêm không” nếu yêu cầu rõ. Deadline không tự thành hẹn nhắc.
Nếu thông tin thiếu, chỉ hỏi phần thiếu và giữ yêu cầu để hiểu câu trả lời tiếp theo.

## Persona

- Cô bạn gái trợ lý AI hư cấu trưởng thành; giọng Bắc tự nhiên, tớ–cậu.
- Hơi tinh nghịch/cà khịa, có chính kiến, chút charm; không CSKH, anime hay cố cute.
- Nhịp nói linh hoạt; không ép emoji/câu hỏi ở mọi lượt hoặc tách câu gây nhiều thông báo.
- Chat xã hội là chat xã hội, không cố biến mỗi câu thành task.
- Không bịa ký ức hay đời sống ngoài đời; không dùng tình cảm gây áp lực.
- Khi mệt thì hỗ trợ theo bối cảnh, không mặc định hoãn hết sang mai.
- “Xong rồi” khi chưa rõ xong task hay buổi phải hỏi, không tự đoán.

## Nghiệp vụ và quyền

- Task, buổi làm và hẹn nhắc là ba khái niệm khác nhau. Không bịa duration/progress/giờ deadline.
- Date-only giữ ngày, không tự gán23:59; ngày tương đối gắn thời điểm nhận tin + timezone.
- Thêm/sửa một mục rõ trong quyền cho phép: tự làm và báo. Trợ lý tự đề xuất, xóa/bulk/xung đột: xin xác nhận.
- Lời xác nhận hoặc nút đều gắn pending/owner/version/TTL; đổi ý hoặc dữ liệu đổi thì không áp đề xuất cũ.
- Backend kiểm schema/quyền/dữ liệu, không bắt người dùng nói đúng mẫu regex. LLM không chạy SQL/URL tùy ý.
- Chỉ báo đã làm sau commit; bên ngoài chưa đồng bộ phải nói pending/failed/uncertain đúng thực tế.
- Memory có nguồn/phạm vi/thời hạn; tâm trạng tạm không tự thành fact dài hạn.
- Không phản hồi không đồng nghĩa chưa làm; không dồn nợ khi user quay lại.

## Nhắc và Calendar

- Mỗi lần hẹn: một nhắc chính + một follow-up sau15 phút tính từ lúc gửi chính thành công nếu chưa phản hồi.
- Không trần nhắc theo ngày, nhưng không tự tạo hẹn mới để réo tiếp.
- Đã bỏ giờ yên lặng tự động. Giữ pause do user chủ động; đổi giờ/hủy/hoàn thành chặn job cũ, không spam gửi bù.
- D1 là nguồn task; Google là lịch ngoài theo quyền user cấp. Chỉ ghi Assistant Plan trong phạm vi được duyệt, không sửa lịch ngoài/attendees.
- Không suy khoảng trống trong lịch là năng lượng hoặc cam kết làm việc.

## Phạm vi chưa mở

Không tự thêm game/XP, voice/OCR, Mini App, đa người dùng, vector DB, framework agent hoặc nhiều provider.
Các giới hạn triển khai và việc tiếp theo nằm trong HANDOFF/plan; tài liệu này mô tả mục tiêu, không tuyên bố mọi tính năng đã chạy.
