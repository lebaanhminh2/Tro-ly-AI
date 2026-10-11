# Habit và Thần Lộ — khung sản phẩm đầy đủ

Cập nhật 2026-10-12. Đây là đặc tả đích cho phiên triển khai tương lai, chưa phải mô tả tính năng đang chạy. Đọc nhiệm vụ/quyền tại [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md), quyết định của user tại [REVIEW](HABIT_GAME_REVIEW.md).

## 1. Kết quả cần giao

Một ứng dụng quản lý công việc và thói quen dùng được hằng ngày, có hành trình tiên hiệp đủ chiều sâu để muốn quay lại. Người dùng tự chọn công việc/habit; AI thiết kế và hoàn thiện sản phẩm, user nghiệm thu cuối. Bản giao cuối bao gồm toàn bộ hệ thống và nội dung dưới đây; các bản nhỏ chỉ là bước kiểm chứng nội bộ.

| Phần | Phạm vi phải giao | Người dùng nhận được |
| --- | --- | --- |
| Habit | Thêm/sửa/xóa khỏi danh sách hoạt động, lưu trữ, lịch hằng ngày/chọn thứ/X ngày mỗi tuần, tick/định lượng/thời lượng, ghi và sửa ngày hiện tại | Dùng thuận tiện với khoảng 5–6 habit; không cần tham gia game |
| Theo dõi | Tổng quan hôm nay, tuần/tháng, lịch sử, xu hướng, ghi chú ngắn, tìm/lọc, giải thích cam kết và đóng góp | Thấy điều đã làm, còn cần làm, lý do một ngày trung tính hoặc thiếu |
| Lịch và nhắc | Giờ nhắc tùy chọn; tùy chọn đưa habit vào kế hoạch, kiểm xung đột/sức chứa | Không bắt mọi habit phải có giờ; không tạo task bản sao |
| Luyện | Một môn đang luyện, bốn tầng, tinh thuần nghiêm, nhiều bản luyện, luyện lại từ tầng 1 | Thấy tiến độ và phẩm chất riêng, dùng được bản chưa hoàn mỹ |
| Chiến đấu | Bộ tối đa năm môn, một lựa chọn/ngày giao chiến, intent, hiệu ứng qua ngày, log, thắng/rút/hết hạn/tử trận/cứu mạng | Lựa chọn công/thủ và thứ tự chiêu có tác dụng thật |
| Toàn bộ công pháp | 5 phái × 5 môn + 8 cấm thuật + 6 Ngoại Đạo = **39 môn**, thêm Võ Kỹ Cơ Bản nhập môn | Mọi môn có đường mở, có thể luyện và dùng; các môn có bản sắc khác nhau |
| Truyện và truyền thừa | **15 chương** tới DIỆT THẦN; mở đầu 3–5 encounter hoàn chỉnh; truyền thừa năm phái, săn cấm thuật, Kiếm Đồ, Dị Giáo, thần binh và chiến tích | Có điểm kết thúc tuyến chính và mục tiêu sưu tập dài hạn |
| Thư viện | Tàng Kinh Các, hồ sơ nhân vật/boss, nhật ký truyện, lịch sử bản luyện/trận, xem lại diễn biến | Mở lore theo nhu cầu; dễ tìm mục tiêu tiếp theo |
| Mỹ thuật | Nhân vật nguyên bản, chân dung boss, cảnh chương, nhận diện phái/bí tịch/thần binh, UI đồng nhất | Ảnh cuối đã tạo và tích hợp; tiên hiệp trầm, ít màu, rõ trên mobile |
| Chất lượng và vận hành | Hướng dẫn dùng, accessibility, lỗi mạng/phiên, xuất dữ liệu, backup/restore được kiểm chứng, chẩn đoán, phát hành staging | Dữ liệu có thể bảo toàn và sản phẩm có thể tiếp tục phát triển |

Không bắt người chơi sở hữu/luyện hoàn mỹ cả 39 môn để kết thúc truyện. Hành trình sưu tập có thể kéo dài 1–3 năm theo lựa chọn cá nhân; đây không phải thời gian chờ bắt buộc. Agent tự quyết số encounter ngoài các mốc trên, dựa trên giá trị chiến thuật/cốt truyện, không kéo dài bằng trận lặp đổi tên.

## 2. Các bổ sung có ích, đã đưa vào nhiệm vụ

- **Onboarding ngắn và có thể bỏ qua:** tạo habit đầu, hiểu ngày sinh hoạt, thử Võ Kỹ, biết đường quay lại. Người dùng cũ không bị bắt thiết lập lại task/giờ sinh hoạt.
- **Báo cáo cam kết:** kết quả tuần/tháng và lịch sử từng habit; phân biệt kỳ đã đóng với kỳ đang diễn ra. Hiển thị phần đã thực hiện và tỷ lệ đạt cam kết là hai thông tin khác nhau.
- **Giải thích tiến độ:** từ habit ngày nào → đóng góp gì → tầng/lượt nào hưởng; preview và kết quả đã khóa phân biệt rõ. Lý do khóa sửa/không thể nhận thưởng nằm cạnh hành động liên quan.
- **Khám phá có mục tiêu:** gợi ý một mục tiêu gần nhất từ dữ liệu thật, tìm/lọc thư viện, bộ chiêu lưu sẵn, hướng dẫn chiến thuật ngắn. Không dùng nhiệm vụ phụ để ép tạo thêm habit.
- **Nhật ký nhẹ:** ghi chú tự nhập cho habit/ngày, xem lại truyện và trận; không thêm một ứng dụng ghi chép phức tạp hoặc phân tích tâm lý tự động.
- **Xuất dữ liệu có phiên bản:** bản máy đọc được và CSV phù hợp cho habit/lịch sử, có giải thích các trạng thái. Xuất không đổi dữ liệu; nhập/khôi phục không tạo thưởng hoặc mở quyền sửa ngày cũ.
- **Khôi phục đáng tin:** backup trước migration, restore vào DB riêng để kiểm chứng; hướng dẫn phục hồi lỗi mạng/dữ liệu. Tính năng restore dữ liệu thật không được biến thành nút ghi đè nguy hiểm.
- **Tùy chỉnh trải nghiệm:** ẩn/thu gọn phần game, quản lý nhắc đã bật, theme và giảm chuyển động theo nền hiện tại. Habit vẫn dùng được khi không chơi.
- **Chẩn đoán gọn:** mã lỗi và trạng thái lần lưu/phiên có thể hỗ trợ sửa lỗi; log không có secrets hoặc nội dung riêng tư thừa. Không cần thêm SaaS telemetry trả phí.

Agent có thể hợp nhất/đổi cách thể hiện các bổ sung này nếu cùng giá trị và nghiệm thu được; phải ghi lý do trong [PROGRESS](HABIT_GAME_PROGRESS.md). Chức năng làm tăng tải nhập liệu nhưng không giúp theo dõi, chơi hoặc bảo toàn dữ liệu nên được loại khỏi thiết kế.

## 3. Hành trình cần thiết kế liền mạch

| Người dùng | Hành trình cần chạy được |
| --- | --- |
| Chỉ quản lý habit | Tạo → ghi một phần/đạt → sửa cùng ngày → xem tuần/tháng → đổi lịch kỳ sau/lưu trữ → xuất lịch sử |
| Người mới chơi | Xem một đoạn truyện ngắn → Võ Kỹ → boss nhập môn → nhận bí tịch → luyện môn đầu → chọn bộ chiêu → thắng/thua/rút |
| Người dùng lâu dài | Đầu tư vài môn → truyền thừa/nhánh phụ → chọn chiến thuật phù hợp → tới chương 15 → DIỆT THẦN → tiếp tục sưu tập |
| Người quay lại sau gián đoạn | Hiểu kỳ đã qua và trận đã chờ/rút → xem nguyên nhân → chọn mục tiêu tiếp theo; không nhận một đợt spam hoặc tự chết vì không mở app |
| Người không có habit | Task/ngủ/đột phá hiện tại dùng được; nhập môn bằng Võ Kỹ; giải thích quyền luyện cần habit hợp lệ |

Đường chính không cần LLM online. Gemini hỗ trợ trò chuyện/công cụ được phép và diễn giải dữ liệu; backend quyết định toàn bộ trạng thái và kết quả.

## 4. Tổ chức UI

AI tự thử và chọn điều hướng cuối. Xuất phát từ Hôm nay / Lời nhắc / Thành tích hiện có; habit có khu vực riêng, game có không gian riêng. Có thể thêm điểm vào hoặc điều hướng khi màn thật chứng minh cần, nhưng không nhồi mọi nội dung vào ba tab cũ.

- Hôm nay ưu tiên kế hoạch công việc, việc tiếp theo và nhóm habit gọn có đường mở danh sách đầy đủ. Task đã xong không quay lại danh sách xếp việc.
- Habit ưu tiên ghi nhận và cam kết, không ưu tiên huy hiệu. Một hàng đọc được tên, mục tiêu, thực hiện hôm nay và tình trạng tuần.
- Tu Tiên ưu tiên một hành động chính: luyện môn hiện tại hoặc chọn chiêu cho trận; thư viện/truyện/lịch sử mở theo nhu cầu.
- Giữ vị trí giờ ngủ hôm nay tại vùng Hỏa Mạch/Thành tích và điều khiển ngủ tại cài đặt như đã chốt. Thẻ trạng thái ngủ ở Hôm nay tiếp tục theo cơ chế hiện tại.
- Header/nút đóng sheet luôn truy cập được khi cuộn. Không chỉ dựa vào màu; chữ, trạng thái, focus và thao tác chạm phải rõ.
- Bộ chiêu lưu sẵn chỉ chuẩn bị; không tự kích hoạt trận, trả giá cấm thuật hoặc ghi hoàn thành habit.

Mẫu luồng/lời giải thích phải được thử trong UI thật với dữ liệu trống, 1 habit, 6 habit, tên dài và lịch sử nhiều; không nghiệm thu chỉ bằng mockup.

## 5. Quyền linh hoạt của agent

| Loại | Ví dụ | Quyền xử lý |
| --- | --- | --- |
| Luật user đã chốt | Ngày cũ chỉ xem; đủ mục tiêu mới đóng góp; đổi chế độ ngày sau; tinh thuần nghiêm; ngân sách 0đ | Bảo toàn. Nếu thật sự không thể đồng thời thỏa mãn, nêu mâu thuẫn và xin quyết định cụ thể |
| Khung giao sản phẩm | Đủ hệ thống, 39 môn, 15 chương, ảnh thật, bản staging | Chia chặng/đổi thứ tự; không âm thầm cắt xuống MVP hoặc mục “sắp ra mắt” |
| Chi tiết AI sở hữu | Schema/DTO, chỉ số, tên/cast, nhịp mở truyện, bố cục, công cụ art, độ dài log | Tự chọn, thử, sửa; ghi quyết định có lý do và cập nhật docs/test liên quan |
| Phát sinh | Migration mới, combo lỗi, máy thiếu VRAM, điều hướng quá chật | Xử lý theo bằng chứng và trong phạm vi quyền; tiếp tục việc độc lập; báo chặn thật |

Độ mở không phải để bỏ quy tắc hoặc tự mở rộng vô hạn. Một thay đổi tốt cần: vấn đề cụ thể, phương án, hệ quả dữ liệu/UX, cách kiểm chứng. Không cần ADR riêng cho đổi padding; cần quyết định bền vững cho thay công thức, ranh giới giao dịch, thời gian hoặc đường mở nội dung.

## 6. Ranh giới của đợt phát triển

Giữ runtime Workers/D1/Telegram và dữ liệu hiện có. Không thêm mạng xã hội, PvP, marketplace, thanh toán, mô hình thuê bao, Google integration, theo dõi GPS/focus bắt buộc hoặc game thời gian thực. Không tạo kinh tế mới trùng Tu Vi/vé/vật phẩm.

Refactor và dependency có thể được chọn khi giải quyết nhu cầu thật, có đường nâng cấp và vẫn nằm trong ngân sách/kiến trúc. Không mặc định phải thay frontend framework, viết lại planner hay chuyển hosting để giao feature. Nếu một thay đổi lớn vượt phạm vi dữ liệu/quyền hiện có, chuẩn bị phương án cụ thể rồi hỏi phần cần quyết định.

AI tự review, mô phỏng và sửa cho tới các tiêu chí [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md). Chỉ ghi hoàn thành khi cả tính năng, nội dung, art, dữ liệu, kiểm thử và staging đều đạt; không dùng lời hứa “sẽ bổ sung” cho hạng mục bắt buộc.
