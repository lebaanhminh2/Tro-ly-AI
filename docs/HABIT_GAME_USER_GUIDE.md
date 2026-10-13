# Dùng Thói quen và Tu luyện

Hướng dẫn redesign Tu luyện đã phát hành staging ngày 2026-10-13, source `07e9aa0`, Worker `db6b1f93-3532-4aac-972b-598fa48e5488`. URL nghiệm thu: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ . [RELEASE](HABIT_GAME_RELEASE.md) ghi bằng chứng và giới hạn; [checkpoint](HABIT_GAME_CULTIVATION_PROGRESS.md) ghi quyết định triển khai.

## Nghiệm thu bản mới

1. Mở URL trên, tải lại và đăng nhập nếu phiên hết hạn. Vào **Tu luyện**: kiểm bốn mục **Hiện tại → Công pháp → Vượt tầng → Thành tựu**.
2. **Hiện tại**: xem tiến độ/tầng/tinh thuần và lựa chọn ngày sau. **Công pháp**: xem phái, tìm môn, mở chi tiết/bản luyện và manh mối. Không cần tạo dữ liệu thử để đọc.
3. **Vượt tầng**: xem mục tiêu gần, nhóm tầng/cơ duyên; mở bảng chuẩn bị để đọc cơ chế và thử chọn bộ chiêu. Chỉ bấm xác nhận khi muốn ghi lựa chọn thật cho ngày sinh hoạt kế tiếp.
4. Nếu đang đánh, đọc ý định/giá chiêu và chọn cho hôm nay; kết quả chỉ chốt theo ngày thật. Cứu mạng có xác nhận chi phí. **Thành tựu** mở boss đã thắng với bản luyện/chiêu dùng thật; dữ liệu cũ và nhật ký còn giữ.
5. Thử trên điện thoại với theme đang dùng: tên/ảnh/nút/tiêu đề bảng có dễ đọc, đổi mục có rõ mục đích, có giữ được toàn cảnh tầng hay không. Chưa thắng thì Thành tựu hiển thị trạng thái rỗng; chưa phát hiện thì bí tịch không lộ tên/ảnh riêng.

Phiên browser kiểm remote của agent đã hết hạn; vòng này đã kiểm static/auth/cron, không giả owner login hoặc tự tạo log cá nhân. Nếu gặp lỗi, ghi mục đang mở/thao tác/giờ và ảnh màn hình; không gửi key hoặc token.

## Bắt đầu trong vài phút

1. Mở app và đăng nhập như trước. Trên trình duyệt ngoài Telegram, lấy mã trong app rồi gửi `/dangnhap MÃ` cho bot.
2. Mở **Thói quen → + Thêm**. Chọn một việc vừa sức, kiểu ghi nhận và lịch cam kết. Có thể bắt đầu với một habit; không cần tạo thêm để chơi.
3. Ô tick đầu mỗi habit đặt đủ mục tiêu; bỏ tick đưa tổng về 0. Bấm nút tiến độ để ghi một phần: thời lượng có thanh trượt, số lượng có bộ đếm, cả hai vẫn nhập số chính xác. Lưu **tổng đã làm hôm nay**; lần sửa thay tổng cũ. Hoàn tác ghi nhận xuất hiện ngắn sau thao tác, không sửa ngày đã qua.
4. Nếu muốn chơi, mở **Tu luyện → Cách chơi** hoặc **Công pháp** để chọn môn luyện. Võ Kỹ dùng ngay khi thử trận đầu.

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

- Chạm tên habit để xem đầy đủ và chỉnh sửa/lưu trữ. Dòng phụ được giữ gọn; **+N** mở các thông tin khác trong chi tiết. **Đã lưu trữ** cho tìm lại và khôi phục; lịch sử cũ được giữ.
- **Tiến bộ** có bảng 7 ngày và tỷ lệ 30 ngày cho từng habit; **Lịch sử** có lọc và xem thêm. Tỷ lệ dùng lần đạt và cam kết thiếu đã chốt; ngày trung tính không làm tăng tỷ lệ giả.
- **Xuất dữ liệu** tải JSON/CSV theo phạm vi chọn. Đây là bản xuất cá nhân; backup DB để phục hồi do quy trình vận hành quản lý.
- Giờ nhắc là tùy chọn. Đặt thời gian dành cho habit cũng là tùy chọn; có kiểm xung đột với công việc. Đặt chỗ không tự hoàn thành habit, tạo task bản sao hay cấp vé task.
- Nhắc đã chủ động đặt tiếp tục theo lịch khi ngủ/tập trung, trừ tạm dừng chủ động hoặc các giới hạn lịch sẵn có. Lời thúc task/habit/luyện chủ động tôn trọng ngủ/tập trung.

## Luyện công pháp

Mở **Tu luyện → Công pháp**. **Đã mở** chứa môn có quyền học; **Khám phá** chứa môn đã biết và manh mối còn niêm phong. Tìm theo tên hoặc cách dùng, có thể gõ không dấu. Chạm sách để xem công dụng, đường học và các bản luyện. Chọn môn/bản áp dụng từ ngày sinh hoạt kế tiếp. Một ngày đóng góp được xử lý theo chế độ của chính ngày đó.

Bốn tầng: **Nhập môn → Tiểu thành → Đại thành → Viên mãn**. Tiến độ là lượng luyện; tinh thuần là phẩm chất. Bỏ cam kết có thể tạo khuyết điểm tích lũy; luyện tốt các tầng sau không xóa khuyết điểm đã khóa. Muốn cải thiện cần luyện một bản mới từ tầng 1; bản cũ còn dùng được.

Với quota tuần, tầng có thể đủ tiến độ nhưng còn chờ chốt nghĩa vụ tuần. Đổi/dừng luyện hoặc đi chiến đấu không xóa nghĩa vụ đã dùng để luyện. Bản Nhập môn đã có thể dùng trong trận; không cần luyện hoàn mỹ mọi môn để đi tiếp truyện.

## Chuẩn bị và chiến đấu

1. Vào **Vượt tầng**, xem đối thủ tiếp theo và **Xem & chuẩn bị**. Các nhóm tầng giúp xem toàn cảnh; **Cơ duyên** là lối rẽ đã tìm thấy. Đọc cơ chế, đánh đổi và yêu cầu trước khi bắt đầu.
2. Võ Kỹ luôn có sẵn. Mang tối đa năm công pháp đã đạt Nhập môn, mỗi môn một bản. Mở **Chỉnh bộ chiêu** để đổi ô; **Chọn bản luyện khác** cho dùng một bản cũ. Có thể lưu bộ để dùng lại. Trận mới không chọn Thần binh.
3. Xuất chiến bắt đầu từ ngày sinh hoạt kế tiếp. Trong trận, xem **Đối thủ chuẩn bị** rồi chọn **Chiêu hôm nay**. Có thể đổi lựa chọn trước khi ngày kết thúc; chỉ lựa chọn cuối được chốt.
4. Habit đủ mục tiêu đóng góp khi chốt ngày; task góp thêm có trần. Luyện tạm dừng trong chế độ chiến đấu. **Nhật ký trận** giải thích đòn đánh, hiệu ứng và kết quả đã xác nhận.

Trước ngày xuất chiến có thể **Đổi bộ chiêu** hoặc **Hủy chuẩn bị**. Đổi bộ giữ nguyên trận và ngày bắt đầu. Hủy khôi phục lịch luyện theo ngày hiệu lực. Khi đã chuẩn bị hoặc đang đánh, cần hủy/kết thúc trận trước khi đổi lịch luyện; chọn một công pháp khác không tự hủy trận.

Các trận sau nhập môn có thể **đọc chiêu lặp**: dùng lại chiêu của lượt trước giảm sát thương trong lượt đó, gồm đòn trễ/phản thương. Màn trận báo mức giảm. Đổi chiêu phá thế đọc; phòng thủ và giá thi triển vẫn theo cơ chế của chiêu.

Không chọn chiêu thì trận chờ, không thi triển hay phản công thay người dùng. Ba ngày chưa chọn chiêu dẫn tới rút an toàn theo luật hiện có; nghĩa vụ habit vẫn theo lịch. Nếu có backlog, **Cập nhật kết quả** tải thêm kết quả đã chốt; không nhập bù habit ngày cũ. Trận đang chờ xử lý có thể khóa thao tác đến khi trạng thái cập nhật.

## Rút lui và cứu mạng

- **Rút lui** dùng khi trận còn cho phép; không dùng để bỏ qua kết quả tử trận đã chốt.
- Khi sinh lực cạn, xem giá và thời hạn trên màn **Sinh lực đã cạn**. Chọn **Hộ Mệnh** trả Tu Vi; **Nghịch Mệnh** chỉ hiện khi thực sự có điều kiện phù hợp và trả một cảnh giới.
- Quyền cứu chung dùng một lần trong trận. Sau cứu có thể chơi tiếp; tử trận lần sau không cho cứu lần nữa. Có thể **Chấp nhận tử trận**; app không tự mua cứu mạng.
- Các chiêu có đánh đổi cần đọc xác nhận. Ngủ/hoàn tác ngủ và đột phá không hoàn nguyên miễn phí giá đã trả trong trận.

## Bí tịch, truyện và thành tựu

Có 22 tầng chính, 18 cơ duyên, 15 chương tới DIỆT THẦN, năm phái và 39 công pháp. Công pháp đặc biệt đi qua **manh mối → tìm thấy thử thách → thắng mở quyền học → tự luyện từ Nhập môn**. Bí tịch chưa phát hiện được gom lại, chưa lộ tên/ảnh riêng. **Truyện đã mở** nằm trong Vượt tầng; kết chương hiện sau khi vượt các trận chính tương ứng. Đọc lại không phát thưởng.

Truyền thừa yêu cầu luyện các môn liên quan thực sự, không chỉ sở hữu bí tịch. Quyền mới không tặng bản hoàn chỉnh. **Thành tựu** giữ boss đã thắng, ngày thắng, số lượt, bộ chiêu, quyền học và truyện sau trận. Trận thua/rút vẫn có trong **Lịch sử tất cả trận**. Đánh lại không cấp lại quyền/thưởng đã nhận. Tuyến chính không yêu cầu luyện đủ cả 39 môn.

**Thành tựu** trong Tu luyện khác tab **Thành tích** ở thanh chính: Thành tích tiếp tục giữ cảnh giới, hỏa mạch và phần thưởng sinh hoạt hiện có. Vật phẩm và snapshot trận cũ được bảo toàn khi đổi thiết kế.

## Khi mất mạng hoặc phiên hết hạn

Nếu app chưa xác nhận lưu, giữ nháp và thử lại cùng thao tác sau khi có mạng; không coi lỗi mạng là bằng chứng dữ liệu chưa lưu. Retry được nhận diện để tránh ghi/nhận thưởng hai lần. Nếu dữ liệu đã thay đổi ở thiết bị khác, tải trạng thái mới rồi điều chỉnh.

Hết phiên thì đăng nhập lại. Giảm chuyển động/ẩn game là tùy chỉnh của trình duyệt; đổi thiết bị có thể cần chọn lại. Các kịch bản hiện được kiểm bằng Chrome emulation, chưa phải chứng nhận thiết bị iPhone/Android thật. Gemini/Telegram live chưa được chứng minh chỉ bằng các fixture local.
