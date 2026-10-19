> Quyết định mới nhất 19/10/2026: người dùng xác nhận “Duyệt bản hiện tại và cho phép phát hành staging”; [đã áp0041 và phát hành](LINH_THU_RELEASE.md). Ưu tiên chắc T1–T4; các ảnh95%/100% được dùng tạm và sẽ chỉnh riêng sau. Pyrodaemon v5 dùng tạm, Stormlion đã duyệt tiếp tục là chuẩn nét. Việc duyệt bản hiện tại không tự thay hồ sơ duyệt thị giác từng ảnh. Các checkpoint dưới đây giữ lịch sử lựa chọn và các bộ đã bị loại.

> Cập nhật mới nhất 19/10/2026: người dùng yêu cầu xem riêng T1–T4 của hai dòng UR và bỏ các bản ảnh 95%/100% đã thử trước đó, gồm v2/v3/v4, khỏi phương án mỹ thuật hiện tại. Các ảnh cũ chỉ lưu lịch sử, không tiếp tục dùng làm ứng viên hoặc tích hợp. T1–T4 vẫn chờ nhận xét. Yêu cầu này xử lý ảnh UR, không tự thay cơ chế độ thuần/kỹ năng hoặc bản Stormlion đã duyệt.

# Các quyết định mỹ thuật Linh thú đã chốt

Cập nhật 19/10/2026, Asia/Saigon. Tài liệu này ưu tiên hơn các ý tưởng thăm dò cũ trong LINH_THU_ART_DIRECTION.md. Gameplay tiếp tục theo LINH_THU_SPEC.md và LINH_THU_SKILLS.md.

## 1. Nét vẽ và cách cải thiện

Người dùng nhận xét bộ SSR v1 kém đẹp, mất vẻ tinh gọn của bản gốc và có cảm giác AI rõ. Bộ v1 không được duyệt; giữ để đối chiếu, không dùng làm chuẩn nét vẽ hoặc tích hợp.

Đã duyệt Stormlion T4 v2 cùng hai mốc 95%/100%:

- Giữ nhận diện loài, tỷ lệ đầu–thân, tư thế và các mảng lớn của nguồn.
- Nét hoạt hình 2D, viền đậm có màu tối, mảng màu lớn, rất ít cấp bóng.
- Cải thiện có chọn lọc: ánh mắt, chỗ chi chồng nhau, độ rõ đường viền và biểu tượng chính.
- Uy lực của UR đến từ khối lớn, tư thế, vai/chân và ánh nhìn theo cấu trúc nguồn. Không tăng độ rối để biểu thị rank.
- Hạn chế bóng nhựa, lông vụn, phản chiếu kim loại, ánh viền mạnh, phân mặt dày và phụ kiện không có chủ đích.
- Mỗi dạng T1–T4 giữ hình thái tiến hóa riêng; không lấy một dạng phóng to thành các dạng còn lại.

## 2. Hai mốc độ thuần

Chỉ mở khi luyện đầy dung lượng của rank: R 60, SR 80, SSR 120, UR 160 điểm. Mới vào T4 chưa được mở; đối chiếu bằng điểm gốc, không theo phần trăm giao diện làm tròn.

- Từ 95%: Thức tỉnh, giữ hình thái/màu gốc và chỉ nhấn nhỏ ở mắt hoặc dấu hiệu chủ đạo của loài. Mở kỹ năng 95% đã chốt.
- Chính xác 100%: Hoàn mỹ, giữ cùng T4; một biến thể thực sự khác biệt qua bảng màu được chọn lọc và dấu ấn loài. Không thêm T5. Giữ hiệu ứng 95% và mở tuyệt kỹ.
- Hiệu ứng động sau này phải tôn hình nhân vật; chưa coi ảnh tĩnh là hoạt ảnh đã triển khai.
- Ví dụ SSR 114 thực + 6 xám = 95%; 120 thực + 0 xám = 100%. UR tương ứng 152 + 8 và 160 + 0.

Stormlion đã duyệt cụ thể:
- Thường: vàng cam, bờm sét, tỷ lệ chibi, ánh mắt tự tin.
- 95%: mắt hổ phách; Tam Lôi, task hợp lệ thứ ba/ngày +2 vé thường.
- 100%: Bạch Kim Lôi Vương, bờm ngà/vàng, thân nâu tím sẫm, ấn sét ba nhánh. Lôi Vương Bảo Khố: sau kích hoạt hoàn thành 5 task hợp lệ trong tuần, chọn 2 vé triệu hồi hoặc 40 tu vi.
- Toàn tài khoản một tuyệt kỹ mỗi tuần lịch. Task chỉ kích hoạt thưởng kỹ năng; việc luyện thú chỉ dùng habit.

## 3. Nơi lưu bản đã duyệt

Bộ nguồn bảo quản: [Stormlion đã duyệt](assets/linh-thu/art/approved-v2/zappur/README.md), gồm ảnh chuẩn hóa, raw nguyên gốc, prompt và hash. Bản đối chiếu cũ vẫn ở output/imagegen/ssr-preview-v2.

Duyệt này áp dụng cho Stormlion T4 và hướng mỹ thuật chung. T1–T3 Stormlion, Frostnip v1 và các loài khác chưa tự động được coi là đã duyệt.

## 4. Thứ tự làm tiếp

UR → SSR → SR → R, đủ 18 loài: 2 / 4 / 6 / 6.

1. UR Pyropup → Pyrohound → Hellhound → Pyrodaemon; Rubblet → Cobbledon → Rockzilla → Meteorax.
2. Làm T4 thường trước, rồi T4 hoàn mỹ và ba dạng nhỏ theo nguồn cùng loài. Bảng đối chiếu gồm T1/T2/T3/T4/95%/100%.
3. Từng ảnh xem trực tiếp, kiểm alpha thật, đủ đầu/chân/đuôi và đường viền; xem thêm ở 64/128px trên nền sáng/tối.
4. Lưu riêng đầu ra gốc, prompt, bản chuẩn hóa và nguồn tham chiếu. Ghi rõ hình mới là đề xuất hay đã duyệt.
5. Sau UR tiếp tục các loài SSR còn thiếu theo đúng hướng đã chốt, rồi SR và R. Không hỏi lại quy tắc đã duyệt.

## 5. Phạm vi thao tác

Được lưu tài liệu và tạo ảnh theo yêu cầu hiện tại. Chưa sửa code, CSS, HTML, cấu hình runtime hoặc registry khi chưa trình rõ tệp/thay đổi và nhận xác nhận, theo AGENTS.md người dùng cung cấp. Không deploy hoặc thay dữ liệu thật.

## 6. Tiến độ sau khi lưu quyết định

Đã tạo và kiểm 12 ảnh cho hai dòng UR, gồm 8 dạng T1–T4, 2 bản 95% và 2 bản 100%. Đây là bộ đề xuất mới theo hướng đã duyệt, chưa tự coi từng ảnh UR được người dùng duyệt. Xem [bảng tiến độ](LINH_THU_ART_PROGRESS.md), [bảng UR đầy đủ](../output/imagegen/ur-preview-v2/ur-full-states.png) và [hồ sơ tạo ảnh](../output/imagegen/ur-preview-v2/README.md).

## 7. Yêu cầu sửa Hoàn mỹ UR

Sau khi xem bộ hai dòng UR, người dùng nhận xét dạng Hoàn mỹ chưa đẹp và yêu cầu sửa. Hai bản Hoàn mỹ UR v2 không được xem là đã duyệt. Đang thử v3 từ T4 thường: giữ đặc trưng màu lửa và tinh thể, tạo điểm nhấn hình dáng/biểu tượng có chọn lọc. Phản hồi này không phải quyết định thay bộ kỹ năng hoặc yêu cầu đổi bản Stormlion đã duyệt.

## 8. Hướng sửa màu Hoàn mỹ UR theo yêu cầu trực tiếp

Người dùng nhận xét v3 đẹp hơn v2 nhưng chưa đủ khác T4, vẫn chưa đạt thẩm mỹ; yêu cầu khuyển dùng lửa xanh và cụm tinh thể tỏa ra của khủng long chuyển đen. Thực hiện ở output/imagegen/ur-perfect-v4: Pyrodaemon lửa xanh lam/lõi xanh băng; Meteorax tinh thể đen tím với viền tím để không chìm trên nền tối. Hướng màu được chỉ định, ảnh mới chưa tự coi được duyệt. Không sửa các kỹ năng hoặc bản Stormlion đã duyệt.

## 9. Thử thiết kế lại riêng Pyrodaemon sau khi loại các bản độ thuần cũ

Người dùng yêu cầu phân tích vì sao các bản trước xấu/không phù hợp và thiết kế lại 95%/100% cho Pyrodaemon. Không phục hồi các bộ đã bị loại. Bộ thử v5 dùng duy nhất T4 thường làm nguồn: 95% nhấn nhẹ mắt, lõi lửa và đinh giữa vòng cổ; 100% tổ chức bờm thành ba ngọn lửa chính với khe tối, đỏ–vàng và lõi ngà. Giữ thân và ba biểu cảm. Xem [thiết kế, lý do và đầu ra](../output/imagegen/pyrodaemon-purity-v5/README.md). Đã tạo/kiểm, chờ nhận xét; chưa duyệt và không đổi gameplay hoặc ảnh runtime. Meteorax không nằm trong lượt thử này.
