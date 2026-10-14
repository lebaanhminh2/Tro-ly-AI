# Dùng Thói quen và Tu luyện

Hướng dẫn Tu luyện v2 ngày 2026-10-14. Trạng thái phát hành, source và Worker được ghi tại [RELEASE](HABIT_GAME_RELEASE.md); [checkpoint](CULTIVATION_IMPLEMENTATION_PROGRESS.md) ghi bằng chứng và phần còn lại. URL staging: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ .

## Nghiệm thu bản mới

1. Mở URL trên, tải lại và đăng nhập nếu phiên hết hạn. Vào **Tu luyện**: kiểm bốn mục **Hiện tại → Công pháp → Thử thách → Thành tựu**.
2. **Hiện tại**: trạng thái luyện/chuẩn bị/giao chiến/kết quả; khi luyện có ảnh, Tầng 1–4, một số Sát thương, thuần khiết và thời gian. **Công pháp**: chọn phái → chọn môn → **Tác dụng / Nâng cấp**. Không cần tạo dữ liệu thử để đọc.
3. **Thử thách**: xem boss theo tuyến và cơ duyên; mở hồ sơ rồi chuẩn bị bộ chiêu. Chọn tối đa năm môn khác nhau, mở tác dụng khi cần. Chỉ xác nhận khi muốn ghi lựa chọn thật cho ngày sinh hoạt kế tiếp.
4. Nếu đang đánh, đọc ý định/giá chiêu và chọn cho hôm nay; kết quả chỉ chốt theo ngày thật. Cứu mạng có xác nhận chi phí. **Thành tựu** mở boss đã thắng với bản luyện/chiêu dùng thật; dữ liệu cũ và nhật ký còn giữ.
5. Thử trên điện thoại với theme đang dùng: tên/ảnh/nút/tiêu đề bảng có dễ đọc, đổi mục có rõ mục đích, có giữ được toàn cảnh tầng hay không. Chưa thắng thì Thành tựu hiển thị trạng thái rỗng; chưa phát hiện thì bí tịch không lộ tên/ảnh riêng.

Để thử nhanh toàn bộ trạng thái mà không chờ ngày thật, mở [demo HTML](prototypes/cultivation/kiem-y-demo.html) trực tiếp trong trình duyệt. **Thử nhanh** chọn tầng/chờ tuần/luyện lại/chuẩn bị/trận/cứu/kết quả; **Sang ngày** chạy ngày mẫu. Có thể ghi habit mẫu, chọn chiêu và đặt lại demo. Demo dùng cùng domain và giao diện app, dữ liệu riêng, không gửi API cloud. Nếu gặp lỗi ở app thật, ghi mục/thao tác/giờ và ảnh màn hình.

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

Mở **Tu luyện → Công pháp → phái → môn**. Năm phái có vai trò riêng; Cấm thuật/Ngoài phái chỉ công bố nội dung theo quyền đã phát hiện. Tìm tên không dấu được. Chọn môn/bản áp dụng từ ngày sinh hoạt kế tiếp. Ngày được xử lý theo chế độ của chính ngày đó; báo ngủ không tự kết toán game.

**Tầng 1–4** mở theo số ngày sinh hoạt ở chế độ luyện, kể cả khi habit không đạt. Bản v2 mới có các kỳ 3/4/6/8 ngày (21 ngày luyện); cấm thuật 32, ngoài phái 42. Bản đã lưu giữ lịch riêng. Đi đánh hoặc dừng luyện thì đồng hồ luyện dừng.

Habit quyết định **phần sát thương nhận thêm của từng kỳ**. Ví dụ đang có 100, kỳ tối đa +20, đạt 50% thì lên 110; kỳ sau đạt 100% nhận đủ +20 thành 130. Phần cũ không giảm; xuyên phòng thủ, tỷ lệ và tác dụng mở theo tầng vẫn tăng đủ. Habit định lượng chưa đủ mục tiêu không có đóng góp.

**Độ thuần khiết** phản ánh chất lượng cả bản, giữ khuyết điểm kế thừa. Thanh 100% phân biệt đã đạt, phần còn có thể đạt và phần đã mất; **Trần tạm tính** là dự báo khi còn kỳ/tuần chưa chốt. Mốc đã chốt 80/90/100% là **Tinh Thuần / Chí Thuần / Thông Thần**, thưởng sát thương 5/10/15%, chỉ mức cao nhất.

Với quota tuần, tới hạn vẫn mở tầng/đặc tính, nhưng phần sát thương và chất lượng có thể **Chờ kết toán**. Đổi/dừng luyện hoặc đi đánh không xóa nghĩa vụ đã dùng; kết toán muộn không sửa snapshot trận đã bắt đầu. Tầng 4 chờ tuần khác bản đã hoàn tất. Muốn cải thiện khuyết điểm phải **Luyện lại từ tầng 1**; tối đa hai bản được duy trì, lịch sử và snapshot cũ vẫn giữ. Bản tầng 1 đã có thể dùng trong trận.

**Tác dụng** chỉ có một số Sát thương lớn: tổng đòn chính chắc chắn trước phòng ngự, không cộng Chảy máu, đòn trễ hoặc đòn thêm có điều kiện. Mỗi đòn/số đòn ở chữ nhỏ; các nhóm Đòn đánh, Đặc tính, Hiệu ứng, Điều kiện và Cái giá cùng cách đọc. Nội tại mang môn khác tác dụng sau thi triển. **Nâng cấp** cho biết hiện tại → tầng kế, phần sát thương có thể nhận, tỷ lệ tăng đầy đủ, tác dụng mới và thời gian; lộ trình bốn tầng mở thêm. Tầng cuối không có tầng 5 giả.

## Chuẩn bị và chiến đấu

1. Vào **Thử thách**, xem đối thủ tiếp theo và **Xem & chuẩn bị**. Các nhóm giúp xem toàn cảnh; **Cơ duyên** là lối rẽ đã tìm thấy. Đọc cơ chế, đánh đổi và yêu cầu trước khi bắt đầu.
2. Võ Kỹ luôn có sẵn. Mang tối đa năm công pháp đã đạt tầng 1, mỗi môn một bản đang duy trì. Bảng bộ chiêu có ô chọn, tìm tên, xem chi tiết và chọn bản; có thể lưu bộ để dùng lại. Trận mới không chọn Thần binh.
3. Xuất chiến bắt đầu từ ngày sinh hoạt kế tiếp. Trong trận, xem **Đối thủ chuẩn bị** rồi **Chọn chiêu** → tác dụng/dự kiến HP/cái giá → xác nhận. Có thể đổi trước hạn; chỉ lựa chọn cuối được chốt. Dự kiến có giới hạn theo thông tin boss đã công bố, không tiết lộ ý định ẩn.
4. Habit đủ mục tiêu đóng góp khi chốt ngày; task góp thêm có trần. Luyện tạm dừng trong chế độ chiến đấu. **Nhật ký trận** giải thích đòn đánh, hiệu ứng và kết quả đã xác nhận.

Trước ngày xuất chiến có thể **Đổi bộ chiêu** hoặc **Hủy chuẩn bị**. Đổi bộ giữ nguyên trận và ngày bắt đầu. Hủy khôi phục lịch luyện theo ngày hiệu lực. Khi đã chuẩn bị hoặc đang đánh, cần hủy/kết thúc trận trước khi đổi lịch luyện; chọn một công pháp khác không tự hủy trận.

Trong trận, đổi một ô dùng đúng bản hợp lệ và giữ HP/lượt/trạng thái/tài nguyên; không làm mới quyền cứu. Cái giá và quyền đổi theo trận hiện tại. Trận chụp cảnh giới, bản luyện, luật và nội dung khi bắt đầu; đột phá hoặc nâng cấp sau đó không tự tăng chỉ số giữa trận.

Phòng ngự xử lý từng đòn: **Sát thương thô → Giảm thương → Phòng thủ sau xuyên → Giáp Ảo → Khiên → HP**. Xuyên 50% của Kiếm Ý chỉ xuyên Phòng thủ. Hút máu dựa trên HP thật lấy được. Nhật ký mặc định gọn; **Chi tiết sát thương** mở lượng thô, giảm, hấp thụ và HP mất. Log cũ giữ nội dung gốc.

Các trận sau nhập môn có thể **đọc chiêu lặp**: dùng lại chiêu của lượt trước giảm sát thương trong lượt đó, gồm đòn trễ/phản thương. Màn trận báo mức giảm. Đổi chiêu phá thế đọc; phòng thủ và giá thi triển vẫn theo cơ chế của chiêu.

Không chọn chiêu thì trận chờ, không thi triển hay phản công thay người dùng. Ba ngày chưa chọn chiêu dẫn tới rút an toàn theo luật hiện có; nghĩa vụ habit vẫn theo lịch. Nếu có backlog, **Cập nhật kết quả** tải thêm kết quả đã chốt; không nhập bù habit ngày cũ. Trận đang chờ xử lý có thể khóa thao tác đến khi trạng thái cập nhật.

## Rút lui và cứu mạng

- **Rút lui** dùng khi trận còn cho phép; không dùng để bỏ qua kết quả tử trận đã chốt.
- Khi sinh lực cạn, xem giá và thời hạn trên màn **Sinh lực đã cạn**. Chọn **Hộ Mệnh** trả Tu Vi; **Nghịch Mệnh** chỉ hiện khi thực sự có điều kiện phù hợp và trả một cảnh giới.
- Quyền cứu chung dùng một lần trong trận. Sau cứu có thể chơi tiếp; tử trận lần sau không cho cứu lần nữa. Có thể **Chấp nhận tử trận**; app không tự mua cứu mạng.
- Các chiêu có đánh đổi cần đọc xác nhận. Ngủ/hoàn tác ngủ và đột phá không hoàn nguyên miễn phí giá đã trả trong trận.

## Bí tịch, truyện và thành tựu

Có 22 trận chính, 18 cơ duyên, 15 chương tới DIỆT THẦN, năm phái và 39 công pháp. Công pháp đặc biệt đi qua **manh mối → tìm thấy thử thách → thắng mở quyền học → tự luyện từ tầng 1**. Bí tịch chưa phát hiện được gom lại, chưa lộ tên/ảnh riêng. **Truyện đã mở** nằm trong Thử thách; kết chương hiện sau khi vượt các trận chính tương ứng. Đọc lại không phát thưởng.

Truyền thừa yêu cầu luyện các môn liên quan thực sự, không chỉ sở hữu bí tịch. Quyền mới không tặng bản hoàn chỉnh. **Thành tựu** giữ boss đã thắng, ngày thắng, số lượt, bộ chiêu, quyền học và truyện sau trận. Trận thua/rút vẫn có trong **Lịch sử tất cả trận**. Đánh lại không cấp lại quyền/thưởng đã nhận. Tuyến chính không yêu cầu luyện đủ cả 39 môn.

**Thành tựu** trong Tu luyện khác tab **Thành tích** ở thanh chính: Thành tích tiếp tục giữ cảnh giới, hỏa mạch và phần thưởng sinh hoạt hiện có. Vật phẩm và snapshot trận cũ được bảo toàn khi đổi thiết kế.

## Khi mất mạng hoặc phiên hết hạn

Nếu app chưa xác nhận lưu, giữ nháp và thử lại cùng thao tác sau khi có mạng; không coi lỗi mạng là bằng chứng dữ liệu chưa lưu. Retry được nhận diện để tránh ghi/nhận thưởng hai lần. Nếu dữ liệu đã thay đổi ở thiết bị khác, tải trạng thái mới rồi điều chỉnh.

Hết phiên thì đăng nhập lại. Giảm chuyển động/ẩn game là tùy chỉnh của trình duyệt; đổi thiết bị có thể cần chọn lại. Các kịch bản hiện được kiểm bằng Chrome emulation, chưa phải chứng nhận thiết bị iPhone/Android thật. Gemini/Telegram live chưa được chứng minh chỉ bằng các fixture local.
