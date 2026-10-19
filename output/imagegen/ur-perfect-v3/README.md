# Hoàn mỹ UR — bản sửa v3

Ngày 19/10/2026, Asia/Saigon. Người dùng yêu cầu sửa dạng Hoàn mỹ của bộ hai UR. V3 là mẫu mới chờ nhận xét, không tự coi đã duyệt. Bản T4 thường, 95% và các dạng T1–T3 giữ nguyên.

## Xem ảnh

- [Hai bản mới cạnh nhau](ur-perfect-v3.png).
- [T4 thường → Hoàn mỹ v2 → Hoàn mỹ v3](perfect-before-after.png).
- [Kiểm ở 64/128px trên nền sáng/tối](thumbnail-review.png).
- [Pyrodaemon riêng](pyrodaemon-perfect-preview.png), [Meteorax riêng](meteorax-perfect-preview.png).

## Hướng sửa

Pyrodaemon giữ thân tối, mặt kem và ba biểu cảm; lửa đỏ/cam với lõi vàng thành ba luồng lớn. Vòng cổ gọn có ba điểm vàng và ấn tam diệm ở giữa. Bỏ bạch diệm tím nhạt cùng huy hiệu trăng của v2.

Meteorax giữ giáp nâu, bụng kem và tinh thể tím/lam đậm. Một lõi hình thoi lam được đặt trong phiến tinh thể sẵn có, phiến cao nhất nhấn dáng đầu nhọn. Bỏ bảng màu trắng bạc/xanh xám của v2.

Cả hai cùng nét 2D viền đậm, mảng màu lớn và ít bóng theo hướng đã duyệt. Những thay đổi này là đề xuất mỹ thuật; bộ kỹ năng và điều kiện 100% không đổi. Stormlion đã duyệt trước đó không thuộc lượt sửa này.

## Tạo và lưu nguồn

Dùng CLI chính thức của skill imagegen qua gateway Cockpit local đã được người dùng chỉ định, model gpt-image-2.5 theo cấu hình hiện có. Không dùng tên tool built-in image_gen để khai báo provenance. Không thay cấu hình gateway hoặc dùng khóa OpenAI mới.

- Đầu vào duy nhất từng loài: ảnh T4 thường trong output/imagegen/ur-preview-v2, không dùng bản Hoàn mỹ bị góp ý làm chuẩn.
- Prompt đầy đủ: [Pyrodaemon](pyrodaemon.prompt.txt), [Meteorax](meteorax.prompt.txt).
- `*-raw.png`: đầu ra lần tạo giữ nguyên.
- `*-preview.png`: bản RGBA 1024px, làm sạch alpha <8 về 0, >=250 về 255, giữ giá trị khác; crop theo alpha và thu vừa vùng 860px, căn giữa. Không vẽ hoặc thêm chi tiết bằng mã.
- [IMAGE_CHECKS.json](IMAGE_CHECKS.json): kích thước thật, alpha, lề và hash raw/preview/prompt/nguồn.

Đã xem cả hai ảnh, bảng trước/sau và thumbnail nền sáng/tối; kiểm được alpha thật và lề trong suốt ít nhất 82px. Kiểm kỹ thuật không thay người dùng duyệt thẩm mỹ.

Không thay code, registry, ảnh runtime, kỹ năng hoặc dữ liệu thật; bộ v2 được giữ để đối chiếu.
