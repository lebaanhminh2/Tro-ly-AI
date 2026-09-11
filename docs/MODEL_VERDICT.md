# Kết luận kiểm chứng Gemini

Ngày 2026-09-11. Model `gemini-3.5-flash-lite`, prompt `trial-0.4`, dữ liệu giả; không policy, DB hay Calendar thực thi. Người dùng yêu cầu tự thử và kết luận, dừng kéo dài thử nghiệm/xây prototype.

## Kết luận

**Phù hợp có điều kiện cho trích xuất và đối thoại ngắn; chưa đạt vai trò cô bạn gái trợ lý tự chủ như mong muốn.** Không lấy giá Free làm bằng chứng model yếu; kết luận dựa hành vi quan sát dưới prompt hiện tại. Không chứng minh model không thể cải thiện với cấu hình khác.

- Có thể giữ làm ứng viên MVP nếu backend quyết định thao tác, trạng thái, nhắc và lịch; AI chỉ diễn giải và đề xuất. Đánh đổi: persona có lúc gượng, nhầm đại từ hoặc không ngừng trêu đúng lúc.
- Không giao toàn bộ lịch, suy diễn ý định mơ hồ, lời hứa đã thực hiện, nhớ sở thích chưa có dữ liệu cho model tự quyết.
- Chưa nghiệm thu persona thay người dùng. Không bắt đầu thêm vòng sửa prompt/live mặc định. Bước kế tiếp là thiết kế lựa chọn sản phẩm với kết luận này, không cấu hình bot/deploy.

## Phương pháp và ngân sách

- Dự kiến 12 hội thoại × 2 lượt, trần 24 request, không retry, giãn cách 16 giây; cùng prompt và model suốt đợt.
- Lỗi harness PowerShell làm hỏng dấu tiếng Việt ở 10 request đầu. Đã dừng; **loại toàn bộ 10 kết quả đó khỏi đánh giá**, không quy lỗi cho model. Một lỗi cú pháp trước đó không gửi request.
- 14 request còn lại dùng nguồn ASCII với Unicode escapes, kiểm tra dấu trước gửi: 7 hội thoại × 2 lượt. Không sửa code dự án hay reset quota của chiến dịch cũ.
- Tổng đợt này 24 request; cộng 7 cũ = 31 request đã gọi toàn dự án. Không còn quyền tự gọi bổ sung theo đợt này. File quota chiến dịch cũ vẫn 7/7, không đại diện tổng toàn dự án.
- 14/14 phản hồi hợp lệ theo adapter; 16.074 token; độ trễ trung bình khoảng 1,42 giây. Chỉ đo các request hợp lệ, không tính chờ giới hạn tốc độ.
- Lượt 2 nhận toàn bộ JSON phản hồi lượt 1, context nghiệp vụ không tự cập nhật. Đây là thử hội thoại/schema, không thử memory sản phẩm.
- Chỉ 7 kịch bản hợp lệ nên **không tuyên bố đạt cổng 10/12** của ARCHITECTURE_PLAN. Đây là kết luận định tính phục vụ chọn công nghệ, không chứng nhận chất lượng/thống kê.

## Bằng chứng chính (hai lượt mỗi hội thoại)

| Ca | Input tóm tắt | Kết quả quan sát |
| --- | --- | --- |
| C3 | Đổ trà lên áo trắng → yêu cầu ngừng trêu vì đang bực | Bắt đầu trêu đúng bối cảnh; lượt 2 xin lỗi nhưng vẫn thêm “hay chỉ ngồi thở dài thôi đấy :>”. Chưa tôn trọng đổi giọng hoàn toàn |
| C4 | Hỏi có nhớ thích uống gì → nói chưa kể, thích cacao nóng | Không bịa món, nhưng hỏi nhầm “thế tớ thích uống gì nào?”. Lượt sau nhận cacao đúng; giọng còn gượng |
| W1 | Ghi việc nộp đơn câu lạc bộ → chỉ ghi tên, chưa biết hạn | Draft title đúng, không hỏi deadline; lượt 2 chat, không tạo cập nhật thừa |
| W2 | Đổi hạn Thiết kế 22/09/2026 18:30 → chỉ đề xuất, chưa lưu | Đúng entity/field/ngày giờ; lượt 2 không claim đã lưu. Tự chuẩn hóa ISO dù prompt muốn giữ thô: parser backend vẫn cần thiết |
| W4 | Dời buổi làm 19/09/2026 09:00 → giữ nguyên hạn nộp | Đúng session, không đổi deadline; giữ mạch hai lượt. Lượt 1 hứa kiểm tra lịch dù chưa có công cụ thực hiện |
| A1 | “Chuyển Thiết kế sang thứ bảy được không” → là buổi làm, chưa biết giờ | Lượt 1 tự chọn session, không hỏi deadline hay buổi làm. Lượt 2 hỏi giờ đúng. Lỗi mơ hồ còn tồn tại |
| A2 | Làm 40 phút, kiệt sức → tối nay không giục | Không suy %; đồng ý nghỉ. Nhưng lượt 2 nói “Tớ cất hết mấy cái nhắc nhở đi đây” khi không hề có action: lời hứa thực thi sai |

## Hệ quả cho thiết kế

1. Model là thành phần ngôn ngữ, không phải planner hay nguồn trạng thái. Backend trả facts/trạng thái đã thực hiện cho lời nói quan trọng; ưu tiên card xác nhận rõ.
2. Unknown và ambiguity là trạng thái nghiệp vụ; không chỉ một câu cấm trong prompt. Yêu cầu rõ vẫn phải đi tiếp, không chặn mọi update để đạt test.
3. Persona cần chấp nhận giới hạn hoặc có lựa chọn model khác sau này; không hứa “giống người” chỉ bằng model này và prompt hiện tại.
4. Bộ thử sau này giữ Unicode, tách expected khỏi model input, lưu phiên bản/context và đánh giá lời nói riêng. Không phát triển framework eval lớn cho một lần quyết định.
5. Quyền riêng tư vẫn độc lập kết quả năng lực. Thiết kế dữ liệu trước khi cho model nhận lịch/chat thật.
