# Hai dòng SSR — bản xem thử v1

Phản hồi mới nhất: người dùng đánh giá bộ v1 kém tinh gọn và kém đẹp hơn bản gốc, có cảm giác AI rõ hơn. Bộ này không được duyệt để tích hợp. Hướng sửa: giữ tỷ lệ, nét viền đậm và mảng màu đơn giản của nguồn; chỉ chỉnh có chọn lọc. Mẫu đối chiếu tiếp theo ở ../ssr-preview-v2/.

Ngày 19/10/2026. Tạo qua **skill imagegen / CLI chạy với gateway Cockpit local đã được người dùng chỉ định**, dùng cấu hình ảnh hiện có: điều phối `gpt-6.1-sol`, upstream `gpt-image-2.5`. Không thay cấu hình gateway, không dùng khóa OpenAI mới và không gọi trực tiếp endpoint OpenAI bằng khóa riêng. Việc không có tool `image_gen` trong chat không đồng nghĩa luồng Cockpit này không hoạt động.

## Xem bộ đầy đủ

- `frostnip-full-states.png`: Frostnip → Frostpaw → Frostique → Frostluna; thêm cột Thức tỉnh 95% và Hoàn mỹ 100%.
- `zappur-full-states.png`: Zappur → Electroar → Blitzmane → Stormlion; thêm cột Thức tỉnh 95% và Hoàn mỹ 100%.
- Mốc 95% dùng lại hình T4 thường. 100% có ảnh riêng, vẫn là T4, không thêm T5. SSR vào T2/T3/T4 ở 20/50/80 điểm, hoàn tất lượt ở 120 điểm; hai mốc độ thuần chỉ mở sau khi hoàn tất.

## Các file trong mỗi dòng

- `*.prompt.txt`: prompt thực tế dùng cho từng ảnh.
- `*-key.png`: đầu ra gốc của lần tạo ảnh, giữ nguyên. Tên này xuất phát từ yêu cầu backdrop chroma key; một số ảnh trả về đã có alpha.
- `*-alpha.png`, nếu có: bản tách nền xanh bằng script chính thức `remove_chroma_key.py` của skill. Không dùng tách nền cho ảnh gốc đã có alpha.
- `*-cutout.png`: bản xem thử 1024 × 1024, toàn thân, alpha, có khoảng thở. Bản này làm sạch alpha rất thấp ở nền và chuẩn hóa phần gần đục, cắt theo bounding box rồi thu vừa vùng 860px. Đầu ra gốc không bị ghi đè.
- `IMAGE_CHECKS.json`: kiểm kê kích thước, alpha, lề và hash của bộ xem thử. Đây là kiểm kỹ thuật, không thay người dùng duyệt thiết kế.

Đây là **10 bản vẽ mới để review**, gồm 8 dạng thường và 2 bản hoàn mỹ. Chưa thay registry, chưa gắn vào runtime hoặc ghi là mỹ thuật đã được người dùng duyệt. Ảnh tham chiếu trong `docs/assets/linh-thu/reference` giữ nguyên.

Frostluna T4 được tạo trước làm chuẩn nét vẽ cho cả dòng băng. Stormlion T4 dùng tham chiếu riêng của loài và chuẩn chất lượng từ Frostluna; ba dạng nhỏ của mỗi loài lấy mẫu gốc đúng dạng cộng ảnh T4 mới làm chuẩn nét vẽ. Hai bản hoàn mỹ được tạo từ chính T4 thường mới của loài đó.
