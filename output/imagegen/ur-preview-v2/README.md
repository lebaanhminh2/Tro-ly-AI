# Hai dòng UR — nguồn thường v2 và bản thử độ thuần lịch sử

Cập nhật trạng thái 21/10/2026; hồ sơ tạo ảnh gốc ngày 19/10/2026. Tám dạng thường T1–T4 của hai dòng UR đã được tái sử dụng trong bộ nguồn v3. Các ảnh 95%/100% UR v2 trong thư mục này đã bị loại, chỉ giữ để đối chiếu lịch sử; không dùng làm nguồn hoặc ứng viên tích hợp.

[REUSED.json](../catalog-v3/REUSED.json) ghi tám entry thường còn dùng. [Manifest nguồn](../../../docs/assets/linh-thu/art/MANIFEST.json) và [quyết định mỹ thuật](../../../docs/LINH_THU_ART_APPROVALS.md) xác định bộ hiện hành: Pyrodaemon độ thuần dùng v5 có điều kiện, Meteorax độ thuần lấy từ catalog v3. Các bản thử UR v3/v4 đã được dọn khỏi cây làm việc; tra lịch sử ở commit `2493aad63a3ea60b38808a10c13363969294cb1c`.

## Phạm vi gốc

- Pyropup → Pyrohound → Hellhound → Pyrodaemon.
- Rubblet → Cobbledon → Rockzilla → Meteorax.
- Mỗi dòng đã tạo bốn dạng T1–T4 và hai đề xuất độ thuần ở T4, tổng 12 ảnh. Không có T5/T6.
- Khi tạo, đây là bộ đề xuất chưa tích hợp; việc tái sử dụng tám ảnh thường diễn ra sau đó. Không tự coi từng ảnh đã được người dùng duyệt thị giác.

## Nguồn và cách tạo

Dùng CLI chính thức của skill imagegen qua gateway Cockpit local theo cấu hình lúc tạo, model `gpt-image-2.5`; không khai báo thành built-in image_gen. Không có bước huấn luyện mô hình.

T4 thường lấy đúng ảnh tham chiếu loài/dạng làm nguồn nhận diện. T1–T3 dùng đúng mẫu từng dạng, thêm T4 mới cùng loài làm hướng nét vẽ; không lấy cấu trúc T4 thay dạng con. Hai đề xuất độ thuần chỉnh từ T4 thường. Nguồn tham chiếu ở `docs/assets/linh-thu/reference/ur/`, hash đối chiếu `SOURCES.csv`.

Mỗi thư mục loài chứa raw, prompt và preview chuẩn hóa riêng. T4 thường dùng tên tiến hóa, ảnh độ thuần dùng `t4-95`/`t4-perfect`. Giữ raw nguyên gốc, không ghi đè bằng ảnh chuẩn hóa.

`IMAGE_CHECKS.json` và `PROVENANCE.csv` ghi hash raw/preview/pixel/prompt, vai trò ảnh đầu vào và chuẩn hóa. Tám nguồn UR khớp hash tham chiếu. Raw Rubblet T1 là 1380×1140; raw còn lại 1254×1254. Preview 1024px RGBA, có alpha và lề ít nhất 82px; không mô tả kích thước preview là kích thước đầu ra gốc.

## Xem tư liệu

- [Tám dạng UR thường còn được tái sử dụng](ur-t1-t4-only.png).
- [T4 gốc và T4 mới, kèm thumbnail](ur-t4-source-and-thumbnail-review.png).
- [Bảng 12 trạng thái lịch sử, có ảnh độ thuần đã loại](ur-full-states.png).
- [Pyropup lịch sử](pyropup-full-states.png) · [Rubblet lịch sử](rubblet-full-states.png).
- [Kiểm alpha/thumbnail lịch sử](alpha-and-thumbnail-review.png).

Hai đề xuất Hoàn mỹ v2 từng thử bạch diệm tím nhạt cho Pyrodaemon và giáp xanh đá tối/tinh thể ngọc tím cho Meteorax; người dùng chưa duyệt và yêu cầu sửa. Việc loại ảnh không thay các ngưỡng gameplay: luyện đầy 160 điểm mới xét 95%/100%, không mở biến thể chỉ vì đạt T4 ở 110 điểm. Luật và kỹ năng hiện hành ở [đặc tả](../../../docs/LINH_THU_SPEC.md) và [bộ kỹ năng](../../../docs/LINH_THU_SKILLS.md).

Ảnh/bảng có nguồn gốc và kiểm kỹ thuật rõ ràng không tự chứng minh chất lượng thiết kế hoặc duyệt thị giác. Khi sửa ảnh dùng [quy trình nguồn v3](../../../docs/assets/linh-thu/art/README.md), giữ ID, tiến độ, luật và dữ liệu người dùng.
