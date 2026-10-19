# Bộ Linh thú v3 — bản dùng tạm để nghiệm thu hệ thống

Ngày 19/10/2026, Asia/Saigon. Người dùng cho phép làm liên tục đến hoàn thiện; ưu tiên T1–T4 chắc, đúng hình; ảnh 95%/100% dùng tạm rồi sửa riêng sau. Stormlion T4 là chuẩn nét đã duyệt, Pyrodaemon v5 dùng tạm. Không dùng lại các bản SSR v1 hoặc độ thuần UR v2/v3/v4 đã bị loại.

## Xem bộ ảnh

- [Trang xem đầy đủ](index.html): lọc UR/SSR/SR/R, đổi nền sáng/tối, chọn ảnh mở1024px.
- Bốn dạng thường: [UR](ur-t1-t4.png), [SSR](ssr-t1-t4.png), [SR](sr-t1-t4.png), [R](r-t1-t4.png).
- T4 thường /95%/100%: [UR](ur-purity-review.png), [SSR](ssr-purity-review.png), [SR](sr-purity-review.png), [R](r-purity-review.png).
- 64/128px trên hai nền: [UR](ur-thumbnail-review.png), [SSR](ssr-thumbnail-review.png), [SR](sr-thumbnail-review.png), [R](r-thumbnail-review.png).

Đã đủ **108 ảnh nguồn và runtime: 72 thường  +18 thức tỉnh  +18 hoàn mỹ**. Không lấy ảnh tham chiếu để giả là thành phẩm. Số lượng và trạng thái từng ảnh nằm trong manifest nguồn và [tiến độ](../../../docs/LINH_THU_ART_PROGRESS.md).

## Nguồn, prompt và phiên bản

Ảnh mới được chỉnh bằng CLI chính thức của skill imagegen qua Cockpit local đã được chỉ định, model thực tế ghi trong kết quả mỗi job. Không ghi nguồn CLI thành built-in image_gen. Không thay cấu hình gateway, dùng khóa mới hoặc huấn luyện trọng số mô hình.

- [JOBS.json](JOBS.json):63ảnh T1–T4 mới, mỗi ảnh có prompt cạnh raw.
- [PURITY_JOBS.json](PURITY_JOBS.json):32ảnh độ thuần mới, từ T4 thường của đúng loài.
- [REUSED.json](REUSED.json):13ảnh tái sử dụng, gồm8dạng UR,3ảnh Stormlion và2ảnh Pyrodaemon v5. Giữ nguyên hồ sơ gốc.
- [IMPORT_CHECKS.json](IMPORT_CHECKS.json):hash, kích thước, alpha, neo và vấn đề cần xử lý.
- [VERIFICATION.json](VERIFICATION.json):kết quả kiểm chứng thực tế, log và giới hạn kiểm tra local.

T1–T4 dùng đúng mẫu từng dạng làm nguồn duy nhất, giữ cấu trúc, tư thế, bảng màu, viền đậm và mảng gọn. 95% chỉnh nhẹ một chi tiết mắt/dấu hiệu đã có. 100% tổ chức lại đặc trưng của loài, không thêm T5; thẩm mỹ này vẫn có thể sửa sau.

Raw giữ nguyên. Nguồn v3 dùng canvas1024px, fit860px, neo đáy y942 và có lề alpha. Không lấy ảnh quá nhỏ phóng lớn thành bản vẽ mới. Bộ dựng tạo WebP512/128px và tên có hash để tránh cache cũ.

## Giới hạn

Bộ này là bộ đã được phép sử dụng tạm, chưa tự ghi nhận người dùng đã nghiệm thu mỹ thuật từng ảnh. 95% cố ý gần T4 và cần nhãn khi xem64px. Một số bản100% như Rockong khác nhẹ; giữ làm bản đầu theo yêu cầu để hoàn thiện hệ thống rồi chỉnh riêng. Kiểm kỹ thuật không tự chứng minh chất lượng mỹ thuật.

Thay ảnh sau này chỉ cập nhật entry nguồn/prompt/phiên bản rồi dựng lại. Không đổi cá thể, lượt luyện, điểm, xám hoặc kỹ năng. Người dùng đã duyệt bản hiện tại và phát hành staging ngày19/10/2026; 0041 đã áp. [Hồ sơ phát hành](../../../docs/LINH_THU_RELEASE.md). Các luồng ghi dữ liệu chỉ được kiểm bằng API/D1 tạm, không thao tác tài khoản thật để QA staging. Ảnh95%/100% tiếp tục dùng tạm.
