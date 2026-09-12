# Trợ lý cá nhân Telegram — yêu cầu sản phẩm

Cập nhật: 2026-09-11. Persona đã thống nhất; các phần ghi “dự kiến/đề xuất/chưa chốt” chưa được duyệt triển khai. Ý mới từ spec 107 mục xem [DESIGN_CANDIDATES.md](DESIGN_CANDIDATES.md), không tự nhập thành yêu cầu.

## Người dùng và vấn đề cần giải quyết

- Ngôn ngữ chính: tiếng Việt. Người dùng tự nhận vibe code, cần giải thích kỹ thuật bằng tác động thực tế, không yêu cầu họ tự thiết kế hệ thống.
- Thiết bị: iPhone XS Max, iOS 18.3.2. Múi giờ hiện tại: Việt Nam (UTC+7).
- Đang tự quản lý bằng Google Calendar, chưa có trợ lý.
- Lúc đầu thường lập và theo dõi lịch tốt; khi khối lượng tăng thì mệt, né tránh công việc và lịch; sát deadline mới làm dồn, ảnh hưởng sức khỏe.
- Trở ngại người dùng xác nhận: biết việc nhưng thấy quá lớn để bắt đầu; có lúc mệt đến cả việc nhỏ cũng không muốn làm. Hay quên, muốn động lực và sự vui vẻ.
- Không lấy nhãn “lười” làm kết luận hệ thống, không chẩn đoán burnout hay cam kết chữa kiệt sức.
- Không chấp nhận phải bật máy tính cá nhân liên tục. Ưu tiên phí dịch vụ bằng 0.

## Mục tiêu

Ưu tiên triển khai mới nhất: [CONVERSATION_DELIVERY.md](CONVERSATION_DELIVERY.md). Ví dụ bắt buộc: “có bài tiếng Anh, deadline ngày mai” được hiểu và lưu task+deadline ngày trong một lượt nếu rõ, rồi báo đã thêm. Không xin xác nhận capture rõ ràng hoặc đưa form mặc định. Deadline chỉ ngày không bị gán giờ giả. Quy tắc quan trọng bên dưới không có nghĩa mọi mutation đều cần user bấm nút.

Ưu tiên mới được tái xác nhận: dừng mở rộng UI/wizard, hoàn thiện executor hội thoại theo [CHAT_FIRST_PLAN](CHAT_FIRST_PLAN.md). Câu rõ như “tớ có task A, deadline ngày mai” phải lưu tên+hạn ngay rồi báo tự nhiên; ngày-only không tự gán giờ. Button chỉ khi confirm cần thiết hoặc user cần tổng quan. Đây là yêu cầu đã chốt; rule chi tiết từng loại mutation và files triển khai theo kế hoạch, không cho model ghi SQL trực tiếp.

Giảm gánh nặng tự tổ chức, giúp biết bước tiếp theo phù hợp, cân bằng sức khỏe và công việc, quay lại dễ dàng sau khi lệch lịch. Không ép tuân thủ một lịch kín hoặc tối đa hóa năng suất.

Telegram là giao diện chính, **hội thoại tự nhiên là đường sử dụng chính đã chốt**. Người dùng không phải nhớ lệnh hoặc điền form để quản lý việc. Card/nút hỗ trợ xem nhanh, xác nhận và thao tác khi tiện; wizard chỉ là fallback. Mini App chưa thuộc v1.

Luồng bắt buộc: lời nói + bối cảnh → AI trích ý định/dữ liệu → backend kiểm tra quyền/quy tắc → lưu trong phạm vi được phép, hỏi phần thiếu hoặc xin xác nhận → trả lời tự nhiên dựa trên kết quả thực tế. Mức xác nhận theo thao tác/ngữ cảnh, không mặc định hỏi lại mọi thứ. Lời xác nhận như “ừ, chuyển đi” phải được gắn với proposal đang chờ, đúng thực thể/phiên bản/TTL; khi mơ hồ phải hỏi lại. Nút và lời nói đi vào cùng command nghiệp vụ. Không cho model tự chạy SQL, bịa dữ liệu hay nói đã lưu trước khi commit. “Tớ mệt” không tự trở thành lệnh hủy lịch. Đây là tiêu chí sản phẩm cuối, không tuyên bố code hiện đã đáp ứng.

Trang Today dự kiến ưu tiên NOW / NEXT / TODAY WIN; backlog vẫn truy cập được nhưng không phải trang chủ.

## Persona đã thống nhất

- Cô bạn gái trợ lý AI hư cấu, trưởng thành; chất nói miền Bắc tự nhiên; xưng tớ–cậu làm nền.
- Pha hơi đanh đá/cà khịa/có chính kiến với hơi điệu/làm nũng/thả thính. Không luôn chiều người dùng.
- Không “AI cố cute”, không CSKH, không anime, không infantilize; không biến miền Bắc thành stereotype.
- Nhịp câu linh hoạt, có thể ngắn, cụt, không đầy đủ chủ-vị; không nhồi emoji hoặc tiếng lóng; không luôn kết thúc bằng câu hỏi/chọn lựa.
- Có thể trò chuyện bình thường, không lái mọi câu về công việc. Có ý kiến có cơ sở, không cãi chỉ để thể hiện cá tính.
- Nhớ mạch trao đổi và sở thích được phép lưu. Trêu dựa trên ngữ cảnh thật, không bịa lịch sử để “bắt bài”.
- Khi người dùng mệt/khó chịu thì điều chỉnh giọng; không suy ra im lặng là lười hay phải tăng áp lực.
- Không dùng tình cảm để gây tội lỗi, đòi chứng minh tình cảm, phạt vì không trả lời hoặc tạo trách nhiệm với cảm xúc AI. Khi người dùng yêu cầu dừng phải dừng.
- Không bịa một cuộc sống ngoài đời; không cần liên tục nhắc “tôi là AI”.
- Không tách từng câu thành nhiều thông báo chỉ để diễn nhịp người thật.

Ví dụ để định hướng (không dùng như mẫu cứng lặp lại):

> mai làm hết á :))
> mai cậu còn hai ca học đấy, tớ không thấy ổn đâu

> ừ, nghe cậu kể thì nay đuối thật
> thôi tớ không giục thêm nữa

> ê, cái hẹn 8 giờ của mình đâu rồi 👀

> xong cả bài hay xong đoạn đang làm đấy?

Social state là mạch tương tác: người dùng vừa nói gì, đã nhắc bao nhiêu, có yêu cầu nghỉ không, phản ứng với câu trêu, đang nói tới task nào. Không phải chấm điểm tình cảm hay tự chẩn đoán cảm xúc.

## Nghiệp vụ cốt lõi từ brief

- Task khác work session; một task có nhiều buổi làm. Xóa/dời buổi không xóa task.
- Unknown là hợp lệ. Không tự bịa deadline, tiến độ, ước lượng, subtasks, dependency.
- Phân biệt thông tin tạm đoán do người dùng nói (“hình như”) với thông tin chắc chắn; lưu nguồn khi cần.
- AI có thể giúp chia việc dựa trên đề/ngữ cảnh thật, nhưng đó là đề xuất chưa được ghi thành sự thật trước khi người dùng duyệt.
- Thay đổi quan trọng phải có proposal, hiển thị đúng nội dung và xác nhận. Nút phải xác định chính xác thực thể và thao tác; chống bấm lặp và xác nhận đề xuất cũ.
- “Đổi Finance sang CN” không tự hiểu thành đổi deadline: có thể là dời buổi làm.
- Bấm bắt đầu/kết thúc không tự suy ra phần trăm hoàn thành. 2/4 subtasks không mặc định bằng 50% khối lượng.
- Không phản hồi không đồng nghĩa chưa làm. Có trạng thái chưa rõ kết quả.
- Khi mất nhịp không dồn mọi việc sang ngày sau, không đón người dùng bằng danh sách lỗi; hỗ trợ quay lại từ hiện tại.
- Khi chưa biết nội dung task, có thể đề xuất phiên mở đề/khám phá ngắn, không giả vờ biết tổng công việc.
- Khi không xếp vừa thì nói rõ và giúp lựa chọn giảm phạm vi/hoãn/thương lượng, không nhét kín lịch hay chiếm giờ nghỉ.
- Thiếu dữ liệu rủi ro phải thể hiện chưa đủ thông tin, không gắn SAFE chắc chắn.
- Routine tách khỏi task; không tạo hàng loạt task uống nước.
- LLM hiểu/nói/đề xuất; backend kiểm tra quyền và thực hiện. Không cho AI ghi database tùy ý.

## Google Calendar

- Đọc lịch người dùng cấp quyền; database nội bộ là nguồn task, Calendar không phải database task.
- Hướng dự kiến: ghi work session vào calendar riêng `Assistant Plan`, có xác nhận.
- Không tự sửa lịch học/thi/cuộc hẹn/sự kiện có người khác.
- Phân biệt cam kết thật, routine mong muốn và buổi đề xuất. Không đoán quyền sửa từ màu hay tên event.
- Ảnh lịch có lịch học, sinh hoạt, ăn nghỉ, thể thao, ngủ và khối việc nhẹ. Người dùng nói nhiều ô chỉ là dự định, không bảo đảm thực hiện.
- Không coi khoảng trống là năng lượng làm việc; phải cân nhắc đi lại/chuyển tiếp. Lịch thực tế chưa được kết nối hay nhập từ ảnh.
- Chưa chốt chính sách khi người dùng tự kéo/xóa buổi do bot tạo, sự kiện lặp, xung đột đồng bộ, quyền tự replan.

## Nhắc nhở

Đã chốt nhu cầu: có nhắc thêm khi không phản hồi, nhưng hữu hạn, không liên tục.

Quy tắc đã được người dùng chốt khi duyệt P2:

- Một lần lúc bắt đầu, thêm một lần sau 15 phút nếu chưa phản hồi.
- Tối đa hai lượt tổng cộng cho mỗi lần hẹn (một chính, một nhắc thêm). Không giới hạn tổng theo ngày; lần hẹn mới phải do người dùng chủ động hẹn lại, không tự tạo để réo tiếp.
- Có giờ yên lặng; dừng/hủy nhắc phù hợp khi đã trả lời, đang làm, chọn nghỉ.
- Snooze chuyển giờ, không tạo thêm chuỗi nhắc trùng.
- Critical deadline không tự vượt quyền làm phiền.
- Chốt giờ nghỉ theo người dùng, không mặc định ảnh lịch là cam kết giờ ngủ.

## Chưa chốt / chưa làm bản đầu

- Gamification: XP, level, coin, streak, avatar, reward là đề xuất cũ, **không phải yêu cầu được duyệt**. Người dùng cần vui và động lực, persona là phần chính.
- Mini App/dashboard đầy đủ, goal/project tree sâu, scheduler nhiều tiêu chí: hướng mở rộng, chưa triển khai.
- Ghi nhanh task tự lưu kèm hoàn tác là đề xuất UX, chưa chốt chi tiết quyền.
- Chưa kiểm thử trải nghiệm trên iPhone thực tế.
