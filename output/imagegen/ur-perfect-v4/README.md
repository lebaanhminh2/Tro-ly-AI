# Hoàn mỹ UR — lửa xanh và tinh thể hắc diệu v4

Ngày 19/10/2026, Asia/Saigon. Người dùng nhận xét bản Hoàn mỹ v3 khá hơn v2 nhưng chưa khác rõ T4 và vẫn chưa đẹp; yêu cầu trực tiếp khuyển đổi sang lửa xanh, cụm tỏa ra của khủng long chuyển đen.

## Yêu cầu đang thực hiện

- Pyrodaemon: giữ ba đầu và ba biểu cảm, thân tối và mặt kem; chuyển lửa sang xanh cobalt/xanh lam với lõi xanh băng. Ấn lửa trên vòng cổ đồng bộ xanh; giữ vài điểm vàng nhỏ làm tương phản.
- Meteorax: giữ thân đá nâu và bụng kem; chuyển các phiến tinh thể sau lưng thành hắc diệu đen tím, viền tím để vẫn nhìn rõ trên giao diện tối, lõi hình thoi lam nhỏ. Đuôi và đầu ngón tinh thể cùng bảng màu.
- Giữ nét 2D viền đậm, mảng lớn và ít cấp bóng, không thêm T5 hoặc đổi kỹ năng.

Đây là hướng màu do người dùng chỉ định; ảnh đầu ra vẫn chờ nhận xét. Bản v3 giữ để đối chiếu, không ghi đè.

## Nguồn và cách tạo

Hai ảnh đầu vào là bản Hoàn mỹ v3 từng loài trong output/imagegen/ur-perfect-v3. Đã xem trước khi chỉnh. Đã thử công cụ tạo ảnh tích hợp image_gen, nhưng nhận lỗi 502 upstream did not return image output, không có ảnh đầu ra dùng được. Chuyển lại CLI chính thức của skill qua gateway Cockpit local đã được người dùng chỉ định ở các đợt trước, giữ nguyên cấu hình model ảnh hiện có. Provenance của ảnh hoàn tất phải ghi CLI/Cockpit; không ghi nhầm thành built-in image_gen. Không thay cấu hình gateway hoặc dùng khóa OpenAI mới.

Prompt đầy đủ: [Pyrodaemon](pyrodaemon.prompt.txt), [Meteorax](meteorax.prompt.txt).

Chỉ tạo ảnh và lưu hồ sơ mỹ thuật. Không sửa code, HTML, CSS, registry, gameplay hoặc dữ liệu thật.

## Bộ ảnh đã tạo

- [Hai bản Hoàn mỹ v4](ur-perfect-v4.png).
- [T4 thường và Hoàn mỹ v4 đặt cạnh nhau](t4-vs-perfect-v4.png).
- [Pyrodaemon — Thanh Diệm](pyrodaemon-perfect-preview.png).
- [Meteorax — Hắc Diệu](meteorax-perfect-preview.png).
- [Kiểm ở 64/128px trên nền sáng/tối](thumbnail-review.png).
- [Kích thước, alpha, nguồn và hash](IMAGE_CHECKS.json).

Cả hai raw trả về RGBA 1254×1254; đã giữ nguyên raw. Bản xem chuẩn hóa 1024×1024, lề trong suốt ít nhất 82px. Đã xem trực tiếp hai ảnh và bảng thumbnail. Cụm đen của Meteorax có đường viền tím để đọc được trên nền tối; lửa xanh của Pyrodaemon có ba mảng màu lớn và giữ rõ các khuôn mặt.

V4 đã tạo và kiểm, chưa tự ghi là được người dùng duyệt. Không cập nhật ảnh sản phẩm hoặc tuyên bố đã hoàn tất bộ mỹ thuật.
