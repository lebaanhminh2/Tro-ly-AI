# Stormlion SSR T4 — bộ hình đã duyệt

Người dùng duyệt hướng chỉnh nhẹ T4 v2, sau đó duyệt cả bảng Thức tỉnh 95% và Hoàn mỹ 100% trong cuộc trò chuyện ngày 19/10/2026 (Asia/Saigon).

- `t4-normal.png`: T4 thường, giữ tỷ lệ chibi và nét gốc.
- `t4-awakened95.png`: Thức tỉnh, mắt hổ phách; cùng hình thái T4.
- `t4-perfect.png`: Bạch Kim Lôi Vương; bờm ngà/vàng, thân nâu tím sẫm, ấn sét ba nhánh; vẫn là T4.
- `raw/`: đầu ra gốc giữ nguyên, không chỉnh pixel.
- `prompts/`: prompt đầy đủ dùng khi tạo từng bản.
- `PROVENANCE.csv`: hash các tệp và đường dẫn nguồn xem thử.
- `purity-comparison.png`: bảng đối chiếu đã được người dùng xem.

Thực thi bằng CLI chính thức của skill imagegen qua gateway Cockpit local đã được người dùng chỉ định, model ảnh `gpt-image-2.5` theo cấu hình tại thời điểm tạo. Đây không phải công cụ built-in `image_gen`; không khai báo nhầm provenance thành công cụ đó.

Các bản `t4-*.png` chuẩn hóa RGBA 1024px, giữ alpha, thu trong vùng 860px. Ngưỡng alpha <8 về 0, >=250 về 255; giá trị trung gian giữ lại. Tham chiếu gốc ở docs/assets/linh-thu/reference/ssr/zappur/t4-stormlion.webp giữ nguyên.

Ba ảnh T4 thường/95%/100% trong thư mục này đã được tái sử dụng làm nguồn của bộ hiện hành `v3/zappur/`. [Manifest sản phẩm](../../MANIFEST.json) đăng ký ba biến thể này; registry web trỏ tới các bản WebP v3 đã build. Thư mục này giữ nguồn đã duyệt, raw, prompt và provenance để đối chiếu; không phải bộ ảnh đang chờ tích hợp. Trạng thái chung ở [README tài nguyên](../../README.md).
