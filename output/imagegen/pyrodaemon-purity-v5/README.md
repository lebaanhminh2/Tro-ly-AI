# Pyrodaemon — thiết kế lại độ thuần v5

Ngày 19/10/2026. Hồ sơ gốc của lần thiết kế lại 95% và 100% cho riêng Pyrodaemon ngày 19/10. Sau lần tạo, hai bản v5 đã được tái sử dụng có điều kiện trong catalog v3 và manifest hiện hành; xem [REUSED.json](../catalog-v3/REUSED.json) và [trạng thái duyệt](../../../docs/LINH_THU_ART_APPROVALS.md). Không suy thành duyệt thị giác cuối từng ảnh. Các bản UR độ thuần v2/v3/v4 vẫn bị loại; gameplay không đổi.

## Vấn đề của các bản trước

Nhận định mỹ thuật sau khi xem trực tiếp T4 thường, v3 và v4:

- Mảng lửa v3/v4 phình và nối thành nền sáng quá lớn. T4 thường có các khe tối chia nhịp, giúp ba khuôn mặt nổi rõ; các bản thử làm giảm khoảng thở này.
- Màu xanh cobalt/cyan v4 rất bão hòa, lại đi cùng tai đỏ, mũi cam, mặt kem và vàng trang trí. Có nhiều điểm tranh nhau thu hút ánh nhìn; độ nổi bật của màu chưa tạo thành vẻ sang hoặc khỏe.
- Chỉ đổi màu và thay đinh vòng cổ không tạo được dấu hiệu hình dáng đặc trưng cho trạng thái Hoàn mỹ. Tăng phụ kiện/chi tiết dễ làm mất nét gọn của thú gốc.
- Chỉnh tiếp từ bản đã lệch khiến các lần sau kế thừa mảng lửa phình. Bộ này lấy T4 thường làm nguồn duy nhất.

## Thiết kế đề xuất

### 95% — Thức tỉnh

Giữ gần như nguyên T4. Nhấn mắt giữa bằng hổ phách, một đinh vòng cổ vàng và một lõi lửa ngà rất nhỏ sau đầu giữa. Không thay hình dáng hay đổi bảng màu cả bộ. Mục tiêu là tinh hơn khi xem gần, không thêm một lần tiến hóa.

### 100% — Tam Diệm Vương

Giữ đúng thân, tư thế và ba biểu cảm. Tổ chức bờm lửa thành ba ngọn chính hướng ra sau, ngọn giữa cao nhất, gợi vương miện tự nhiên của ba đầu. Giữ khe tối, diện tích bờm gần T4; cạnh đỏ thẫm, ruột vàng hổ phách, ba lõi ngà nhỏ. Vòng cổ chỉ có ấn ba ngọn lửa gọn. Sự khác biệt cần đọc được qua hình lửa khi thu nhỏ, không dựa vào nền hào quang hoặc màu neon.

## Nguồn và thao tác

- Nguồn duy nhất: `../ur-preview-v2/pyropup/t4-pyrodaemon-preview.png`.
- Prompt: `95.prompt.txt`, `100.prompt.txt`.
- Đã thử image_gen tích hợp cho cả hai ảnh; cả hai báo 502 upstream không có ảnh đầu ra.
- Tiếp tục qua CLI chính thức của skill với gateway Cockpit local đã dùng trong dự án, giữ model cấu hình. Không ghi đầu ra CLI thành built-in image_gen.
- Raw được giữ riêng, không ghi đè nguồn. Không sửa code, CSS, HTML, manifest hoặc registry.
## Kết quả và giới hạn

- [T4 thường / 95% / 100% đặt cạnh nhau](pyrodaemon-t4-95-100-v5.png).
- [Kiểm 64/128px trên nền sáng và tối](thumbnail-review.png).
- [Bản 95% nền trong suốt](pyrodaemon-95-preview.png), [bản 100% nền trong suốt](pyrodaemon-100-preview.png).
- [Kích thước, alpha và hash nguồn/raw/prompt/preview](IMAGE_CHECKS.json).

Đã xem trực tiếp raw, bảng so sánh và thumbnail. Raw đều RGBA 1254×1254 có alpha thật; bản chuẩn hóa 1024×1024 có lề trong suốt tối thiểu 82px. Ba mặt, chân, tai và đuôi đủ trong khung. 95% cố ý khác nhẹ: ở 64px cần nhãn trạng thái. 100% đọc được các ngọn lửa và lõi ngà trên cả hai nền; hình lửa cao hơn T4, không coi điều này là đã được duyệt. Ảnh mắt 100% vẫn gần T4 hơn mắt hổ phách 95%; đây là giới hạn của đầu ra hiện tại, không tuyên bố giữ chính xác mọi chi tiết prompt.

Trạng thái lúc tạo là bộ thử chưa tích hợp; sau đó hai ảnh v5 đã được đưa vào bộ nguồn v3 để dùng tạm theo yêu cầu. Các bộ UR 95%/100% v2/v3/v4 vẫn bị loại. Nguồn tạo ảnh thực tế là CLI qua Cockpit, không phải built-in image_gen.
