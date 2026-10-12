# Dùng Habit và Thần Lộ

Hướng dẫn bám source hiện tại ngày 2026-10-12. Phần mới đã chạy local; **chưa phát hành staging**. Trạng thái phát hành và bằng chứng tại [RELEASE](HABIT_GAME_RELEASE.md).

## Bắt đầu trong vài phút

1. Mở app và đăng nhập như trước. Trên trình duyệt ngoài Telegram, lấy mã trong app rồi gửi `/dangnhap MÃ` cho bot.
2. Mở **Thói quen → + Thêm**. Chọn một việc vừa sức, kiểu ghi nhận và lịch cam kết. Có thể bắt đầu với một habit; không cần tạo thêm để chơi.
3. Habit dạng tick dùng **Đánh dấu**. Habit số lượng/thời lượng dùng **Ghi nhận**, nhập **tổng đã làm hôm nay**; lần sửa thay tổng cũ.
4. Nếu muốn chơi, mở **Thần Lộ → Cách chơi** hoặc **Công pháp** để chọn môn luyện. Võ Kỹ Cơ Bản dùng ngay khi thử trận đầu.

Hôm nay vẫn ưu tiên công việc và kế hoạch; danh sách habit đầy đủ ở Thói quen. Phần game có thể ẩn trong cài đặt trải nghiệm mà không mất dữ liệu habit.

## Hiểu ngày và cam kết

Ngày sinh hoạt theo giờ bắt đầu ngày đã lưu trong cài đặt. Qua nửa đêm chưa chắc đã sang ngày sinh hoạt mới. Ghi nhận chỉ sửa được khi ngày đó còn mở; ngày cũ chỉ xem.

| Lịch | Cách tính |
| --- | --- |
| Hằng ngày | Mỗi ngày có một nghĩa vụ |
| Chọn các thứ | Chỉ các ngày đã chọn có nghĩa vụ; ngày khác trung tính |
| X lần mỗi tuần | Tự chọn ngày thực hiện; tối đa một lần đạt mỗi ngày được tính vào quota |

Tuần bắt đầu thứ Hai theo ngày sinh hoạt. Habit mới hằng ngày/chọn thứ được ghi ngay, cam kết bắt đầu từ ngày sau; quota tuần bắt đầu từ thứ Hai kế tiếp. Khi sửa lịch/mục tiêu hoặc lưu trữ/khôi phục, app hiển thị ngày có hiệu lực; không đổi nghĩa vụ đã phát sinh.

Ví dụ quota **3 ngày/tuần**, chỉ ngày 1 đạt:

- Ngày 2–5 không đạt: không cộng, chưa thiếu cam kết; các ngày này không được giả tính là đã làm.
- Cuối ngày 6 vẫn chỉ đạt một ngày: thiếu một, vì ngày 7 còn lại không thể bù đủ ba ngày.
- Ngày 7 không đạt: thiếu thêm một. Nếu ngày 7 đạt: cộng ngày đó, phần thiếu đã chốt ngày 6 vẫn giữ.

Đạt 15/20 phút vẫn được lưu để theo dõi, nhưng chưa đóng góp cho luyện/trận. Đạt đủ mới tính; phần vượt mục tiêu không nhân thưởng. Nhiều lần ghi cùng ngày không tạo thêm ngày đạt. Không có miễn trừ nghỉ/ốm cho nghĩa vụ đã có lịch.

## Chỉnh habit, xem lại và đặt giờ

- **···** cạnh habit mở phần chỉnh sửa/lưu trữ. **Đã lưu trữ** cho tìm lại và khôi phục; lịch sử cũ được giữ.
- **Nhịp đã qua** có báo cáo 7/30 ngày, lọc habit/kết quả và **Xem thêm**. Tỷ lệ giữ cam kết dùng lần đạt và cam kết thiếu; ngày trung tính không làm tăng tỷ lệ giả.
- **Xuất dữ liệu** tải JSON/CSV theo phạm vi chọn. Đây là bản xuất cá nhân; backup DB để phục hồi do quy trình vận hành quản lý.
- Giờ nhắc là tùy chọn. Đặt thời gian dành cho habit cũng là tùy chọn; có kiểm xung đột với công việc. Đặt chỗ không tự hoàn thành habit, tạo task bản sao hay cấp vé task.
- Nhắc đã chủ động đặt tiếp tục theo lịch khi ngủ/tập trung, trừ tạm dừng chủ động hoặc các giới hạn lịch sẵn có. Lời thúc task/habit/luyện chủ động tôn trọng ngủ/tập trung.

## Luyện công pháp

Mở **Thần Lộ → Công pháp**, tìm/lọc môn và xem quyền mở khóa. Chọn môn luyện; đổi môn/bản hoặc đổi chế độ áp dụng từ ngày sinh hoạt kế tiếp. Một ngày đóng góp được xử lý theo chế độ của chính ngày đó.

Bốn tầng: **Nhập môn → Tiểu thành → Đại thành → Viên mãn**. Tiến độ là lượng luyện; tinh thuần là phẩm chất. Bỏ cam kết có thể tạo khuyết điểm tích lũy; luyện tốt các tầng sau không xóa khuyết điểm đã khóa. Muốn cải thiện cần luyện một bản mới từ tầng 1; bản cũ còn dùng được.

Với quota tuần, tầng có thể đủ tiến độ nhưng còn chờ chốt nghĩa vụ tuần. Đổi/dừng luyện hoặc đi chiến đấu không xóa nghĩa vụ đã dùng để luyện. Bản Nhập môn đã có thể dùng trong trận; không cần luyện hoàn mỹ mọi môn để đi tiếp truyện.

## Chuẩn bị và chiến đấu

1. Vào **Hành trình**, xem chương và **Xem và chuẩn bị** ở trận đã mở. Đọc cơ chế, đánh đổi và yêu cầu trước khi bắt đầu.
2. Chọn tối đa năm công pháp/bản luyện và thần binh đang sở hữu; có thể lưu bộ chiêu để dùng lại. Lưu bộ chỉ chuẩn bị, không tự xuất chiến hay trả giá.
3. Xuất chiến bắt đầu từ ngày sinh hoạt kế tiếp. Trong trận, xem **Đối thủ chuẩn bị** rồi chọn **Chiêu hôm nay**. Có thể đổi lựa chọn trước khi ngày kết thúc; chỉ lựa chọn cuối được chốt.
4. Habit đủ mục tiêu đóng góp khi chốt ngày; task góp thêm có trần. Luyện tạm dừng trong chế độ chiến đấu. **Nhật ký trận** giải thích đòn đánh, hiệu ứng và kết quả đã xác nhận.

Các trận sau nhập môn có thể **đọc chiêu lặp**: dùng lại chiêu của lượt trước giảm sát thương trong lượt đó, gồm đòn trễ/phản thương. Màn trận báo mức giảm. Đổi chiêu phá thế đọc; phòng thủ và giá thi triển vẫn theo cơ chế của chiêu.

Không chọn chiêu/vắng app được xử lý theo chính sách chờ/rút an toàn hiện trong trận; không tự thi triển hoặc trả giá thay người dùng. Nếu có backlog, **Cập nhật kết quả** tải thêm kết quả đã chốt; không nhập bù habit ngày cũ. Trận đang chờ xử lý có thể khóa thao tác đến khi trạng thái cập nhật.

## Rút lui và cứu mạng

- **Rút lui** dùng khi trận còn cho phép; không dùng để bỏ qua kết quả tử trận đã chốt.
- Khi sinh lực cạn, xem giá và thời hạn trên màn **Sinh lực đã cạn**. Chọn **Hộ Mệnh** trả Tu Vi; **Nghịch Mệnh** chỉ hiện khi thực sự có điều kiện phù hợp và trả một cảnh giới.
- Quyền cứu chung dùng một lần trong trận. Sau cứu có thể chơi tiếp; tử trận lần sau không cho cứu lần nữa. Có thể **Chấp nhận tử trận**; app không tự mua cứu mạng.
- Các chiêu có đánh đổi cần đọc xác nhận. Ngủ/hoàn tác ngủ và đột phá không hoàn nguyên miễn phí giá đã trả trong trận.

## Truyện, quyền mở khóa và sưu tập

Có 15 chương tới DIỆT THẦN; năm phái, 39 công pháp, các tuyến truyền thừa/cấm thuật/Ngoại Đạo và mục tiêu thần binh/chiến tích. **Đọc truyện** chỉ mở nội dung được phép; kết chương hiện sau khi vượt các trận chính tương ứng. Đọc lại không phát thưởng.

Truyền thừa yêu cầu luyện các môn liên quan thực sự, không chỉ sở hữu bí tịch. Quyền mới cho phép bắt đầu luyện, không tặng bản hoàn chỉnh. Đánh lại không cấp lại quyền/thưởng đã nhận. Sưu tập dài hạn là tùy chọn; tuyến chính không yêu cầu sở hữu/luyện đủ cả 39 môn.

## Khi mất mạng hoặc phiên hết hạn

Nếu app chưa xác nhận lưu, giữ nháp và thử lại cùng thao tác sau khi có mạng; không coi lỗi mạng là bằng chứng dữ liệu chưa lưu. Retry được nhận diện để tránh ghi/nhận thưởng hai lần. Nếu dữ liệu đã thay đổi ở thiết bị khác, tải trạng thái mới rồi điều chỉnh.

Hết phiên thì đăng nhập lại. Giảm chuyển động/ẩn game là tùy chỉnh của trình duyệt; đổi thiết bị có thể cần chọn lại. Các kịch bản hiện được kiểm bằng Chrome emulation, chưa phải chứng nhận thiết bị iPhone/Android thật. Gemini/Telegram live chưa được chứng minh chỉ bằng các fixture local.
