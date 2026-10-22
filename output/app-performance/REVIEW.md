# Nghiệm thu hiệu năng và trải nghiệm app

Ngày thực hiện: 22/10/2026, múi giờ Asia/Saigon. Thay đổi nằm ở app thật trong `web/` và API; không sửa bản minh họa `output/collection-ui-demo/index.html`.

## Kết quả đo trước/sau

Trình duyệt Chrome thật, rộng 390 px, cùng fixture có 8 thói quen. Giả lập 350 ms cho POST; lượt tải lại thói quen/khởi tạo sau lưu 800 ms. Đây là số đo local để so sánh luồng xử lý, không phải độ trễ production hay cam kết tốc độ trên mọi thiết bị.

| Hành vi | Trước | Sau |
|---|---:|---:|
| Tick hiện lên giao diện | 1.222 ms | 6 ms |
| Ô tick bị khóa khi đang lưu | 8/8 | 0/8 |
| Sửa công việc: gửi đến lúc giao diện hiển thị tên đã xác nhận | 1.224 ms | 391 ms |
| Nút điều hướng bị khóa khi lưu công việc | 5/5 | 0/5 |
| Request của một lần tick | POST habits + GET habits + GET tower | POST habits |
| Request cần chờ để xác nhận sửa công việc | POST tasks + GET history + GET bootstrap | POST tasks |
| Khởi tạo màn Hôm nay | 1.340 ms, bootstrap và history | 383 ms, bootstrap |
| Quay lại danh sách thói quen có sẵn, sau khi vừa tick | 10,5 ms, 2 GET | 2,9 ms, 1 GET tower để cập nhật điều kiện vừa đổi |

Chuyển tab có cache còn mới và không có thay đổi liên quan không phát thêm GET; kiểm tra riêng trong `app-performance.test.mjs`. Dữ liệu được làm mới sau tối đa 15 giây cache khi tương tác, khi người dùng yêu cầu tải lại, khi quay lại cửa sổ/Telegram hoặc khi có thay đổi liên quan.

Nguồn trước sửa: commit `a1f64e7`; nguồn sau: worktree hiện tại. Source của bản trước được nạp sẵn trước khi bấm giờ, để thời gian chạy git không làm sai số khởi tạo. Kết quả gốc: [before-comparable.json](before-comparable.json), [after-comparable.json](after-comparable.json). Script tái hiện: `node scripts/benchmark-app-ux.mjs <output.json> [baseline-ref]`.

Đường khởi tạo server được đo với Miniflare/D1 local, 8 công việc, 20 ms độ trễ giả lập cho mỗi thao tác DB, 5 lần đo trên ngày đã khởi tạo. Trung vị giảm từ **1.293 ms xuống 977 ms, khoảng 24%**. Tổng số thao tác DB giữ ở 41; phần giảm đến từ đọc song song các dữ liệu độc lập sau các bước có quan hệ phụ thuộc. Chi tiết: [server-before.json](server-before.json), [server-after-final.json](server-after-final.json). Script: `node scripts/benchmark-app-server.mjs <output.json>`.

## Thay đổi hành vi

- Tick/bỏ tick và Hoàn tác thói quen hiện ngay. Ý định người dùng nằm riêng với dữ liệu đã xác nhận. Hàng đợi lưu giữ phiên bản và mã biên nhận; nhiều thao tác trên cùng thói quen được gộp về trạng thái cuối khi chưa gửi.
- Lỗi bị server từ chối trả giao diện về trạng thái đã xác nhận. Mất phản hồi không được xem là chắc chắn lưu thất bại: app cho kiểm tra lại đúng biên nhận, không cộng thưởng trùng. Các lần lưu chưa xác nhận và thao tác còn trong hàng đợi được giữ qua reload trong cùng phiên trình duyệt.
- Công việc hoàn thành phản hồi ngay sau xác nhận thao tác; công việc chỉnh sửa dùng task/version/ví thật từ phản hồi POST để hiển thị ngay khi lưu xong. Các bản đọc nền cũ không được ghi đè lần sửa mới.
- Các thao tác lưu chung trả kết quả ở lúc server xác nhận; tải lại dữ liệu liên quan chạy sau. Chỉ editor đang gửi bị khóa; điều hướng và thao tác đọc vẫn dùng được. Không chặn toàn bộ app để tải lại bootstrap/lịch sử.
- Khởi tạo không đợi lịch sử công việc. Lịch sử được tải khi mở danh sách. Luồng dữ liệu được gộp request đang chạy, có cache ngắn theo phần chức năng và được vô hiệu hóa khi dữ liệu thay đổi.
- Đăng xuất hủy transport cũ, loại bỏ các ý định trong phiên cũ. Phản hồi muộn không khôi phục dữ liệu hay xóa mã thử lại của phiên mới.
- Tháp chờ các lần lưu liên quan hoàn tất trước khi đọc điều kiện; tránh mở kết quả cũ khi người dùng vừa tick rồi vào tháp.
- Các hiệu ứng mở thưởng vẫn dựa vào kết quả thật và không buộc người dùng đợi lượt tải lại không liên quan.

## Thông báo

Thông báo có icon, nội dung, nút hành động tùy trường hợp và nút Đóng. Phần thưởng chỉ hiện khi server xác nhận; vé từ nhiều lần tick gần nhau được gộp, nút Hoàn tác ghi rõ nếu áp dụng cho lần cuối. Một thông báo hiển thị tại một thời điểm, không hiện trùng ở hộp thoại và dưới trang.

Vị trí tính theo thanh điều hướng và safe area. Nền và chữ theo giao diện sáng/tối. Nút có vùng bấm tối thiểu 44 px; thông báo có live region, không lấy focus; thời gian tự ẩn dừng khi focus/hover. Vùng nền thông báo không chặn thao tác với nội dung bên dưới. Thông báo dài có bố cục riêng.

Đã xem ảnh và kiểm tra hình học trên màn hình 320, 390, 1280 px, hai giao diện và trong hộp thoại; kiểm tra thêm chữ 200%, giảm chuyển động và safe area 20 px. Ảnh: [mobile sáng](notice-320-light.png), [mobile tối](notice-390-dark.png), [desktop](notice-1280-light.png), [hộp thoại](notice-dialog-390.png), [chữ 200%](notice-320-large-text.png). Dữ liệu: [notice-geometry.json](notice-geometry.json).

## Kiểm chứng

Kết quả kiểm chứng:

| Bộ kiểm tra | Kết quả |
|---|---|
| Toàn bộ trình duyệt thật | **134/134 đạt** |
| Nghiệm thu hiệu năng/async/thông báo | **11/11 đạt** |
| Kiểm tra bổ sung thông báo chữ lớn và task receipt sau chỉnh cuối | **2/2 đạt** |
| API task receipt với D1 thật tạm thời | **1/1 đạt** |
| Module web và lỗi transport/phiên đăng nhập | **14/14 đạt** |
| Hồi quy auth/recovery bổ sung | **3/3 đạt** |
| Unit/integration toàn repo | **469/472 đạt; 3 lỗi cũ đã tái hiện trên bản trước** |
| Typecheck web/server, lint, format, syntax web, build dry-run | **Đạt** |

Bằng chứng chuyên biệt:

- 11 tình huống trình duyệt về hiệu năng, hàng đợi, Hoàn tác, reload, lỗi, mất phản hồi, đảo tick trong lúc mất phản hồi, đăng xuất và thông báo: [acceptance-final.log](acceptance-final.log).
- Kiểm tra API thật với D1 tạm cho phiên bản công việc, completion, ví, biên nhận replay và xung đột phiên bản: [api-receipts-final.log](api-receipts-final.log).
- Kiểm tra phiên đăng nhập/transport và module web: [web-modules-final.log](web-modules-final.log), [session-final.log](session-final.log).
- Bố cục thông báo sau chỉnh cuối và kiểm tra task receipt: [notice-accessibility-final.log](notice-accessibility-final.log).
- Hồi quy toàn bộ trình duyệt: [browser-final.log](browser-final.log).
- Unit/integration toàn repo: [unit-integration-final.log](unit-integration-final.log).
- Build thử: [build-final.log](build-final.log).

Trong lần chạy toàn repo ban đầu, có 3 lỗi integration cũ ở `tests/integration/habit-tickets-and-draw.test.ts`: giả định đường quay chỉ có 3 lượt DB, kỳ vọng sự kiện v1 và kích hoạt tuyệt kỹ v1 trong dữ liệu v2. Đã tái hiện cả 3 trên worktree sạch tại commit trước sửa; bằng chứng: [baseline-existing-failures.log](baseline-existing-failures.log). Không thay luật v2 hay nới kiểm tra để che các lỗi đó. Hai mock test giao diện Hôm nay cũ cũng thiếu `insertBefore` và giữ bố cục trước đây; đã sửa mock/selector để kiểm tra đúng bố cục hiện tại.

## Phạm vi bàn giao và giới hạn

Các file chính: `web/core/{http,live-data,mutations,state,lifecycle}.js`, `web/features/{habits,tasks,browser-login,linh-thu}.js`, `web/views/{habits,today}.js`, `web/ui/{feedback,sheets,beast-tower}.js`, `web/app.js`, `web/styles.css`, `src/entrypoints/mini-app/{bootstrap,tasks}.ts` cùng các test và script benchmark tương ứng.

Đã tối ưu luồng và xác minh local. Chưa deploy; không có số đo mạng/DB production. Thao tác ngẫu nhiên, thưởng, số dư và dữ liệu cần server xác thực vẫn phải chờ phản hồi POST thật. Hàng đợi không thay thế service worker hay hệ thống đồng bộ offline nhiều thiết bị. Thay đổi trên Telegram/bot được đọc lại khi app lấy lại focus hoặc cache hết hạn; server vẫn kiểm tra phiên bản cho mọi lần ghi.
