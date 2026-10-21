# Quyết định mỹ thuật Linh thú

Cập nhật 21/10/2026. Đây là nơi ghi trạng thái duyệt và hướng vẽ còn hiệu lực; nguồn từng ảnh nằm trong [manifest](assets/linh-thu/art/MANIFEST.json). Luật sản phẩm theo [đặc tả](LINH_THU_SPEC.md), số kỹ năng theo [bộ kỹ năng](LINH_THU_SKILLS.md).

## Bộ hiện hành và trạng thái duyệt

- Đã tích hợp 108 ảnh của 18 loài: 72 dạng thường T1–T4, 18 Thức tỉnh và 18 Hoàn mỹ. Nguồn chuẩn hóa nằm ở `docs/assets/linh-thu/art/v3/`.
- Stormlion T4 thường/95%/100% đã được duyệt cụ thể. Bộ [approved-v2/zappur](assets/linh-thu/art/approved-v2/zappur/README.md) giữ raw, prompt, nguồn chuẩn hóa và hash, tiếp tục là chuẩn nét vẽ.
- Bộ hiện hành đã được duyệt để sử dụng và phát hành ngày 19/10/2026; các ảnh 95%/100% khác vẫn dùng tạm và có thể sửa riêng. Quyền sử dụng không đồng nghĩa người dùng đã duyệt thị giác từng ảnh.
- Pyrodaemon 95%/100% dùng hai bản v5, có [hồ sơ gốc](../output/imagegen/pyrodaemon-purity-v5/README.md); không dùng lại các bản độ thuần UR v2/v3/v4.
- Có 95 ảnh tạo mới trong catalog v3 và 13 ảnh tái sử dụng có hồ sơ: tám dạng UR thường, ba bản Stormlion T4 và hai bản Pyrodaemon v5. Xem [REUSED.json](../output/imagegen/catalog-v3/REUSED.json).
- Bộ SSR v1 và các bản độ thuần UR v2/v3/v4 đã bị loại. Các tệp SSR v1, UR v3/v4 được dọn khỏi cây làm việc; lịch sử trước đợt dọn vẫn ở commit `2493aad63a3ea60b38808a10c13363969294cb1c`. Các ảnh độ thuần cũ còn trong hồ sơ UR v2 chỉ là lịch sử, không phải ứng viên để tích hợp.

## Hướng nét vẽ

Giữ nhận diện loài, tỷ lệ đầu–thân, tư thế, bảng màu và các mảng lớn của nguồn. Mỗi dạng T1–T4 có cấu trúc riêng; không phóng lớn một dạng để thay các dạng còn lại.

Nét hoạt hình 2D, viền đậm có màu tối, mảng màu lớn, ít cấp bóng. Cải thiện có chọn lọc ánh mắt, chỗ chi chồng nhau, đường viền và dấu hiệu chính. Uy lực của UR đến từ khối, tư thế, vai/chân và ánh nhìn; tránh bóng nhựa, lông vụn, ánh viền mạnh, phân mặt dày và phụ kiện gây rối.

Stormlion đã duyệt:

| Biến thể | Nhận diện |
| --- | --- |
| Thường | Vàng cam, bờm sét, tỷ lệ chibi, ánh mắt tự tin |
| 95% | Mắt hổ phách, giữ hình thái và màu chủ đạo |
| 100% | Bạch Kim Lôi Vương: bờm ngà/vàng, thân nâu tím sẫm, ấn sét ba nhánh |

## Độ thuần và giới hạn

Chỉ mở biến thể khi luyện đầy dung lượng: R 60, SR 80, SSR 120, UR 160 điểm. Vừa vào T4 chưa đủ điều kiện; xét điểm gốc, không xét phần trăm giao diện làm tròn.

- Từ 95%: Thức tỉnh, nhấn nhỏ ở mắt hoặc dấu hiệu của loài; mở kỹ năng đã chốt.
- Chính xác 100%: Hoàn mỹ, biến thể riêng của T4 qua bảng màu và dấu ấn loài; không thêm T5. Giữ hiệu ứng 95% và mở tuyệt kỹ.
- Ví dụ SSR: 114 thực +6 xám =95%; 120 thực +0 xám =100%. UR: 152 +8 và 160 +0.
- Một số bản 100% như Rockong còn gần T4; đây là giới hạn đã ghi nhận, tiếp tục dùng tạm. Kiểm alpha/hash không chứng minh chất lượng mỹ thuật.

Các lần thử UR v3/v4 thay màu lửa/tinh thể chưa đạt thẩm mỹ mong muốn. Pyrodaemon v5 quay về T4 thường làm nguồn duy nhất, giữ ba biểu cảm và khe tối giữa ba ngọn lửa. Việc loại ảnh không thay gameplay, mốc độ thuần hoặc bản Stormlion đã duyệt.

## Sửa ảnh về sau

Giữ raw và prompt thực tế, nguồn/phiên bản/model và trạng thái duyệt. Xem trực tiếp từng ảnh toàn thân, alpha, đường viền và độ rõ ở 64/128px trên nền sáng/tối; so chuỗi cùng loài và điểm neo. Không ghi một ảnh mới là đã duyệt chỉ vì đạt kiểm tra kỹ thuật.

Thay riêng nguồn và entry manifest rồi dựng lại theo [hướng dẫn assets](assets/linh-thu/art/README.md), không đổi ID loài/cá thể, điểm, kỹ năng hoặc receipts. Thay đổi code và phát hành vẫn cần xác nhận theo yêu cầu hiện hành; hồ sơ ủy quyền cũ không cấp quyền cho lần sau.
