# Stormlion T4 — chỉnh nhẹ v2

Mẫu đối chiếu sau phản hồi bộ v1 mất vẻ tinh gọn của nguồn. Giữ tỷ lệ chibi, dáng lao tới, bờm sét và nét viền dày; chỉ chỉnh nhẹ ánh mắt và các chân chồng nhau. Người dùng đã duyệt hướng chỉnh nhẹ của mẫu T4 v2. Người dùng cũng đã duyệt hai mẫu Thức tỉnh 95% và Hoàn mỹ 100% trong bảng đối chiếu. Bộ nguồn bảo quản tại docs/assets/linh-thu/art/approved-v2/zappur; chưa tích hợp runtime.

- `stormlion-original-vs-v2.png`: nguồn bên trái, v2 bên phải, căn theo cùng vùng hiển thị.
- `stormlion-t4-preview.png`: bản alpha chuẩn hóa 1024px, chừa lề 82px trở lên.
- `stormlion-t4-raw.png`: đầu ra giữ nguyên của lần tạo ảnh.
- `stormlion-t4.prompt.txt`: prompt đầy đủ.
- `IMAGE_CHECKS.json`: kích thước, alpha và hash phục vụ đối chiếu nguồn.

Tạo bằng CLI chính thức của skill imagegen qua gateway Cockpit local đã được chỉ định, dùng model ảnh theo cấu hình hiện có. Không sửa cấu hình gateway. Bộ v1 không dùng làm tham chiếu. Nguồn gốc giữ nguyên. Không sửa code hoặc đăng ký asset runtime.

## Đối chiếu độ thuần Stormlion

- `stormlion-purity-comparison.png`: T4 thường, Thức tỉnh 95%, Hoàn mỹ 100% đặt cạnh nhau.
- `stormlion-t4-95-preview.png`: giữ hình T4, nhấn mắt hổ phách; ảnh đề xuất.
- `stormlion-t4-100-preview.png`: biến thể Bạch Kim Lôi Vương, bờm ngà/vàng, thân nâu tím sẫm và ấn sét ba nhánh; ảnh đề xuất, vẫn là T4.
- Hai file `*-raw.png` giữ nguyên đầu ra; hai file `*.prompt.txt` lưu prompt; `PURITY_IMAGE_CHECKS.json` lưu đối chiếu kỹ thuật.

Hai mốc kỹ năng chỉ mở khi luyện đầy thanh: SSR 120 điểm. 114 thực + 6 xám đạt 95%; 120 thực + 0 xám đạt 100%. Không áp dụng khi mới vào T4 ở 80 điểm.

Kỹ năng theo LINH_THU_SKILLS.md, không thay luật gameplay:
- Từ 95%: Tam Lôi, task hợp lệ thứ ba trong ngày +2 vé thường, tối đa một lần/ngày.
- 100% giữ Tam Lôi và mở Lôi Vương Bảo Khố: sau kích hoạt, hoàn thành 5 task hợp lệ trong tuần, chọn 2 vé triệu hồi hoặc 40 tu vi. Toàn tài khoản dùng một tuyệt kỹ/tuần.

Các biến thể độ thuần đã được người dùng duyệt trong cuộc trò chuyện 19/10/2026; chưa đăng ký vào runtime. Xem docs/LINH_THU_ART_APPROVALS.md để lấy quyết định mới nhất.
