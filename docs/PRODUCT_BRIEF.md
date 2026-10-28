# Personal AI Assistant

**Trợ lý cá nhân tiếng Việt trên Telegram và web, kết hợp hội thoại theo ngữ cảnh, tự động lập lịch theo deadline, theo dõi thói quen và trò chơi hóa tiến trình.**

Dự án giải quyết ba nhu cầu liên quan trong quản lý cá nhân: xác định việc cần làm, phân bổ thời gian thực hiện và duy trì hành động hằng ngày. Công việc, lịch, thói quen và trạng thái sinh hoạt được sử dụng chung để xây dựng kế hoạch, điều phối lời nhắc và ghi nhận tiến bộ.

Telegram cung cấp kênh trò chuyện và nhận thông báo. Telegram Mini App và giao diện web phục vụ quản lý chi tiết, điều chỉnh kế hoạch và xem lịch sử.

## Năng lực sản phẩm

### Hội thoại AI có ngữ cảnh và khả năng thực hiện tác vụ

Tích hợp Gemini function calling để tra cứu, tạo và cập nhật công việc, quản lý cuộc hẹn, đặt lời nhắc và ghi nhận thói quen thông qua tiếng Việt.

Ngữ cảnh hội thoại kết hợp dữ liệu đang lưu, công việc được nhắc đến, lịch, tiến độ gần đây, trạng thái tập trung và trạng thái nghỉ. Hệ thống hỗ trợ lịch sử, tóm tắt hội thoại và ghi nhớ thông tin theo yêu cầu, với phạm vi tạm thời hoặc lâu dài; người dùng có thể xem và xóa bộ nhớ.

Các yêu cầu thiếu thông tin được hỏi lại. Quyền đọc và quyền ghi được tách riêng; backend kiểm tra điều kiện thực thi trước khi lưu và phản hồi kết quả.

### Quản lý công việc và tự động phân bổ lịch theo deadline

Công việc được quản lý cùng các bước thực hiện, deadline, mức ưu tiên, thời lượng còn lại và nhật ký làm việc. Planner sử dụng những dữ liệu này để lựa chọn công việc và phân bổ vào các khung giờ:

- **Xét mức độ cấp thiết:** đối chiếu thời gian đến hạn với khối lượng chưa hoàn thành, kết hợp mức ưu tiên.
- **Tôn trọng thời gian khả dụng:** loại trừ lịch bận, cuộc hẹn, thời gian dành cho thói quen và khoảng ngoài giờ sinh hoạt.
- **Phân bổ qua nhiều ngày:** chia công việc thành các khối làm việc và tạo dự báo trong phạm vi 14 ngày, có đánh dấu thời gian dựa trên giả định.
- **Kiểm soát sức tải:** kế hoạch tự động chọn tối đa ba công việc trọng tâm mỗi ngày, sử dụng 80% thời gian khả dụng và kiểm tra nguy cơ quá tải cộng dồn trước deadline.
- **Cập nhật theo tình hình thực tế:** tính lại khi deadline, ước tính, thời gian đã làm hoặc lịch khả dụng thay đổi. Người dùng có thể chủ động điều chỉnh danh sách và thời lượng cho hôm nay.

Thời gian đã làm được đối chiếu với khối lượng còn lại để phục vụ kế hoạch tiếp theo. Hoàn thành một phiên hoặc một bước được ghi nhận riêng với hoàn thành toàn bộ công việc.

### Nhắc thực hiện và hỗ trợ tập trung

Hệ thống chủ động nhắc theo các khung làm việc đã xếp, có giới hạn tần suất và ngừng nhắc tiếp khi nhiều lần không nhận được phản hồi. AI có thể soạn nội dung nhắc dựa trên công việc và các lời nhắc gần đây.

Chế độ tập trung tạm dừng lời thúc làm việc trong khoảng tương ứng. Lời nhắc người dùng chủ động đặt có chính sách riêng, hỗ trợ một lần hoặc định kỳ; có thể bỏ qua hay dời một lần xuất hiện mà vẫn giữ chuỗi.

### Theo dõi thói quen và nhìn lại mỗi ngày

Thói quen hỗ trợ ba cách đo: đánh dấu hoàn thành, số lượng và thời lượng. Lịch cam kết có thể là hằng ngày, theo thứ hoặc đủ số ngày mỗi tuần. Cơ chế đánh giá phân biệt ngày đạt, thiếu và trung tính, phù hợp với lịch tuần linh hoạt.

Người dùng có thể đặt thời gian thực hiện, xem tiến bộ 7/30 ngày, tra cứu lịch sử và xuất CSV/JSON. Thay đổi mục tiêu có ngày hiệu lực để bảo toàn ý nghĩa của kết quả trước đó.

Nhật ký ngày bổ sung ba nội dung: việc đã làm được, bài học và điều cần cải thiện ngày mai. Giao diện giữ bản nháp; nội dung đã lưu có lịch sử theo ngày và kiểm soát xung đột khi chỉnh sửa từ nhiều thiết bị.

### Quản lý nhịp sinh hoạt

Giờ bắt đầu ngày, giờ nghỉ và thời điểm báo ngủ do người dùng cung cấp được đưa vào trạng thái hoạt động của hệ thống. Khi người dùng báo ngủ, ứng dụng chuyển sang trạng thái nghỉ và dừng lời thúc công việc phù hợp.

Ngày sinh hoạt được xác định tại server theo múi giờ Việt Nam, làm căn cứ thống nhất cho kế hoạch, thói quen và ghi nhận kết quả.

### Trò chơi hóa gắn với tiến bộ thực tế

Các hoạt động hợp lệ liên kết với hệ thống điểm, vé thưởng, vật phẩm, cấp bậc nhân vật, chuỗi duy trì và thành tích.

Hệ thống linh thú gồm **18 loài với bốn dạng tiến hóa**, tách vai trò **đang luyện** và **đồng hành**. Kết quả thói quen đã chốt quyết định tiến trình luyện; kỹ năng đồng hành tương tác với công việc, thói quen, giấc ngủ và tài nguyên theo điều kiện của từng loài.

Bộ sưu tập, triệu hồi, luyện đan và Tháp giao ước mở rộng vòng tiến trình. Điều kiện tham gia và phần thưởng được xác định từ dữ liệu hoạt động đã ghi nhận tại backend.

## Kiến trúc và chất lượng triển khai

Backend sử dụng **TypeScript strict, Cloudflare Workers, D1 và Cron Triggers**; frontend sử dụng **JavaScript ES modules, HTML và CSS**. Kiến trúc **Ports and Adapters** tách luật nghiệp vụ và điều phối ứng dụng khỏi cơ sở dữ liệu, Telegram và provider AI.

Thuật toán lập lịch, đánh giá thói quen và tính thưởng chạy bằng logic xác định tại backend. Transaction, kiểm tra version, lease và biên nhận xử lý bảo vệ dữ liệu khi có cập nhật đồng thời hoặc yêu cầu được gửi lại. Inbox/outbox quản lý tiếp nhận lệnh và gửi thông báo; các chức năng cốt lõi tiếp tục hoạt động khi provider AI gián đoạn.

Repository có kiểm thử unit, integration và browser, cùng công cụ benchmark và diễn tập migration/phục hồi dữ liệu. GitHub Actions được cấu hình kiểm tra kiểu dữ liệu, lint, định dạng, kiểm thử và build dry-run.

Dự án phục vụ sử dụng cá nhân và có hồ sơ phát hành trên môi trường staging.
