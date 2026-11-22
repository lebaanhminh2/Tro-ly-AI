# Kiểm chứng bản chốt — 16/11/2026

Bản kiểm: [index.html](index.html). SHA-256:

```text
5a406bd64347177f5094858414302739a846b6cc48473f12e7da174fa56bfe6f
```

Môi trường: Windows, Node.js 24.19.0, **Chrome 157.0.8103.51** qua CDP và harness có sẵn ở `tests/browser/app-harness.mjs`. Chạy local qua file URL; không gọi dịch vụ thật.

## Hành vi đã kiểm trực tiếp

**18 nhóm kiểm tra đạt:**

1. Thả chuột sớm: không timer, không thưởng, không canvas dư.
2. Giữ chuột thật: ở 2770 ms chưa có lượt; đủ khoảng 3000 ms mới tạo đúng một lượt, `endsAt - startedAt = 300000`, không thưởng lúc bắt đầu.
3. Menu ba chấm có “Hủy lượt đang làm”; chọn hủy có xác nhận. “Tiếp tục làm” giữ nguyên id và thời hạn; “Hủy lượt” xóa lượt, không cộng thưởng.
4. Tải lại sau hủy vẫn không có lượt.
5. Tải lại khi chạy giữ nguyên id và `endsAt`.
6. Hết giờ không tự thưởng; xác nhận đã làm cấp đúng một tu vi và một vé; bấm lặp không thưởng trùng cùng lượt.
7. Lượt tự xác nhận tiếp theo trong cùng ngày tiếp tục được thưởng.
8. Giữ phím Space thật tạo timer đúng luồng.
9. Chạm giữ thật bằng CDP touch events tạo timer đúng luồng.
10. Kéo con trỏ quá 45 px hủy thao tác.
11. Escape hủy thao tác giữ.
12. Giảm chuyển động: không lấy Canvas context, giữ chữ đọc được; đủ 3 giây vẫn tạo timer.
13. Canvas 2D không khả dụng: điều khiển và đếm số vẫn dùng được, thả sớm vẫn hủy.
14. Resize lúc giữ: hủy thao tác và dọn canvas.
15. Window blur lúc giữ: hủy thao tác.
16. Tab bị ẩn lúc giữ: hủy thao tác và scene.
17. Mở hủy ngay lúc vừa bắt đầu: bước xác nhận không bị timeout kết thúc launch ghi đè.
18. Lượt đã hết giờ nhưng chưa nhận thưởng vẫn có thể hủy, không phát thưởng.

Các luồng nhận thưởng trong kiểm thử dùng “Tua tới 3 giây cuối” hoặc đặt `endsAt` đã qua bằng dữ liệu QA; không bắt người kiểm ngồi đủ 5 phút. Thao tác giữ chuột/Space/touch được gửi bằng sự kiện input CDP thật và đợi thời gian thực.

## Kiểm tra hình ảnh

- Đã mở và duyệt ảnh chụp bản HTML: nút idle, sao băng chuyển vàng, pha launch, đồng hồ, menu hủy, xác nhận hủy, màn hình nhỏ sáng/tối, cảnh giữ tại desktop.
- Viewport đã kiểm: **320, 375, 390, 768, 1440 px**, cả theme sáng và tối; không tràn ngang.
- Card giữ chiều cao **113 px** ở tất cả các kích thước trên. Chiều rộng tương ứng 288, 331, 346, 504, 504 px.
- Có ảnh gốc và GIF 72 frame từ chính renderer đã ghép vào HTML, không lấy video khác gắn vào để minh họa.
- So ảnh chuyển vàng tại `p = 2/3` với preview đã duyệt: sai lệch tuyệt đối trung bình mỗi kênh **0,857/255**. Bản preview chụp crop ×2, bản HTML chụp DPR 2 rồi crop; khác biệt raster hóa nhỏ không thay hình học hay nhịp. Ảnh và GIF triển khai hiện tại là mốc nghiệm thu cho lần ghép app tiếp theo.
- Ảnh tĩnh/GIF đặt renderer ở mốc cố định để so thiết kế. Luồng nhập được kiểm riêng với animation/timing chạy thực; không dùng chụp `captureBeyondViewport` giữa một lần giữ vì trình duyệt có thể resize viewport tạm để chụp, làm cơ chế hủy do resize kích hoạt.
- Các phiên kiểm hoàn tất không ghi nhận lỗi JavaScript của trang.

## Kiểm tra tệp và bàn giao

- Inline JavaScript biên dịch được bằng `new Function`.
- Không có script hoặc font tải ngoài; HTML mở độc lập không cần build.
- Kiểm whitespace của thay đổi và liên kết local trong tài liệu mới.
- [manifest.json](reference/manifest.json) ghi SHA-256 của HTML, tài liệu và tư liệu để AI sau xác định đúng bản thiết kế.
- [Mục lục dự án](../../README.md) đã có lối vào bộ bàn giao này.

Chỉ thay mã của demo HTML; thêm tài liệu/tư liệu thiết kế. Chưa triển khai tính năng vào frontend/backend thật, chưa commit/push/deploy. Kiểm Chrome local không thay cho nghiệm thu trực tiếp trên Telegram/iPhone/Android.
