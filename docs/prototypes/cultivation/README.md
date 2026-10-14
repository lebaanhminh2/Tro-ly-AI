# Bản thử Tu luyện v2

Mở trực tiếp [kiem-y-demo.html](kiem-y-demo.html) trong Chrome/Edge từ thư mục repo. JavaScript/CSS đã đóng gói trong HTML; hình ảnh lấy từ `web/assets/than-lo/` có sẵn. Giữ cấu trúc thư mục khi chuyển demo. Không cần chạy Worker, đăng nhập hoặc tạo dữ liệu trong app thật.

## Thử nhanh

1. **Hiện tại:** xem ảnh Kiếm Ý theo tầng, một số Sát thương, thuần khiết và thời gian. Mở Xem công pháp → Nâng cấp để so sánh tầng kế.
2. **Công pháp:** chọn phái → chọn môn. Tác dụng, Nâng cấp, điều kiện học, hai bản và lịch sử dùng các module của app.
3. **Thử nhanh:** chọn Tầng 1–4, Thông Thần, chờ cam kết tuần, hai bản, đã chuẩn bị, chiến đấu, cứu mạng, Nghịch Mệnh, chiến thắng, phát hiện bí tịch hoặc toàn bộ danh mục.
4. **Habit đạt trong ngày mẫu:** đặt 0/50/80/100%, sau đó Sang ngày. Nút Đến mốc tầng tiếp theo chốt đủ ngày của kỳ bằng tỷ lệ đang chọn; không tự bù kỳ cũ.
5. **Chuẩn bị và chiến đấu:** chọn boss → Chuẩn bị → chọn tối đa năm môn bằng ô tick, mở tác dụng và chọn đúng bản khi cần → xác nhận tại footer. Preset lỗi giữ bộ đang chọn. Trận có hiệu lực ngày sau → Chọn chiêu → chạm tên để xem tác dụng/dự kiến/cái giá → xác nhận ở cuối bảng → Sang ngày để kết toán. Chạm để xem chưa ghi lựa chọn; được đổi trước khi chốt. Preview chưa tính buff habit/task ngày, không lộ ý định ẩn. Không chọn ba ngày thì rút an toàn.
6. **Thành tựu:** xem chiến thắng thực sự được engine demo tạo, chiêu đã dùng, quyền mở và nhật ký. Bộ chiêu cuối và nội dung truyện mở xem riêng.

Trong Thử toàn bộ, quyền và bản luyện được cấp sẵn **chỉ để kiểm nội dung**; đây không phải lịch chơi đã kiếm được. Tình huống cứu mạng tăng HP/đòn boss để chắc chắn thử được việc bị hạ; không dùng độ khó của fixture đó để đánh giá cân bằng.

## Cấu trúc và cập nhật

- [demo.js](demo.js): lắp production views/actions vào shell của bản thử; chặn toàn bộ fetch ngoài adapter mẫu.
- [Session mẫu](../../../scripts/lib/cultivation-demo.ts): gọi domain luyện, profile, nâng cấp, discovery, chiến đấu và kinh tế cứu mạng; nằm ngoài thư mục asset deploy.
- [Builder](../../../scripts/build-cultivation-demo.mjs): `node scripts/build-cultivation-demo.mjs` tại repo root. Sinh lại HTML sau thay đổi domain/UI/session; không sửa công thức trực tiếp trong HTML đầu ra.
- Dữ liệu ở bộ nhớ của riêng trang; refresh/Đặt lại không chạm tài khoản thật. CSP chặn network API, không dùng bot/token/key.

**HTML hiện có354.409byte**, sinh từ source cuối sau sửa footer chữ lớn/crop ảnh/Nâng cấp. Fullbrowser44/44 gồm demo; agent đã mở xem ma trận320/360/390/1440,hai theme/chữ200%. Trạng thái phát hành và gates khác ở [checkpoint§5.9/§6](../../CULTIVATION_IMPLEMENTATION_PROGRESS.md). Agent review không thay nghiệm thu mỹ thuật của người dùng.

Factory production local và HTML hiện tại tạo bản v2 mới theo3/4/6/8 (thường21/cấm32/ngoài42ngày luyện), giữ requiredDays riêng của bản cũ. Sau mỗi thay source/sinh lại, kiểm các tầng, chờ tuần, luyện lại, prepared/active/cứu/kết quả và39/40. Mở thẻ chỉ một số Sát thương; Nâng cấp cho biết phần theo habit và đặc tính tăng đủ theo tầng.

Demo giúp kiểm luồng/cơ chế nhanh bằng dữ liệu riêng. Đọc [bản tổng hợp](../../CULTIVATION_FINAL_BRIEF.md) để biết thiết kế cuối cần có và [kế hoạch](../../CULTIVATION_IMPLEMENTATION_PLAN.md) để nối tiếp visual, nhịp chơi, tải và phát hành. Khi chạy triển khai, sinh lại demo và kiểm nguồn cuối sau sửa production.
