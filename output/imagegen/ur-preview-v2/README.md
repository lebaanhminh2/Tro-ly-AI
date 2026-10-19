> Cập nhật mới nhất 19/10/2026: theo yêu cầu người dùng, chỉ xem [tám dạng UR T1–T4](ur-t1-t4-only.png). Các ảnh 95%/100% UR của v2/v3/v4 bị loại khỏi phương án hiện tại; nội dung về chúng bên dưới chỉ là lịch sử. Không dùng các ảnh đó để tích hợp.

# Hai dòng UR — bộ hình theo hướng v2

## Phản hồi về hai bản Hoàn mỹ

Người dùng nhận xét hai dạng Hoàn mỹ UR chưa đẹp và yêu cầu sửa lại. Hai ảnh t4-perfect trong bộ v2 này chưa được duyệt; bảng 12 trạng thái bên dưới giữ để đối chiếu lịch sử. Bản chỉnh tiếp theo được lưu riêng ở [ur-perfect-v3](../ur-perfect-v3/README.md), làm từ T4 thường với hướng thử giữ màu lửa đỏ/cam và tinh thể tím/lam. Không lấy nhận xét này để đổi các mốc gameplay.

Ngày 19/10/2026, Asia/Saigon. Làm tiếp sau khi người dùng duyệt Stormlion T4 v2 và hai trạng thái độ thuần. Quyết định chuẩn nằm tại [LINH_THU_ART_APPROVALS.md](../../../docs/LINH_THU_ART_APPROVALS.md).

## Phạm vi

- Pyropup → Pyrohound → Hellhound → Pyrodaemon.
- Rubblet → Cobbledon → Rockzilla → Meteorax.
- Mỗi dòng: bốn dạng T1–T4, thêm Thức tỉnh 95% và Hoàn mỹ 100% của T4; không có T5/T6.
- Đây là bộ ảnh UR mới để xem xét theo hướng đã chốt, chưa được duyệt từng ảnh hoặc tích hợp runtime.

## Cách tạo

Dùng CLI chính thức của skill imagegen qua gateway Cockpit local đã được người dùng chỉ định, model ảnh gpt-image-2.5 theo cấu hình hiện có. Không dùng tool built-in image_gen và không khai báo nhầm provenance. Không sửa cấu hình gateway hoặc dùng khóa OpenAI mới.

T4 thường lấy đúng ảnh tham chiếu loài/dạng làm nguồn nhận diện và nét vẽ. T1–T3 lấy đúng mẫu từng dạng, thêm T4 mới cùng loài để giữ nét viền và cách chia mảng; T4 mới không được dùng để thay cấu trúc dạng con. Hai trạng thái độ thuần chỉnh từ T4 mới.

Giữ raw nguyên gốc, prompt đầy đủ và bản chuẩn hóa riêng. Không ghi đè ảnh nguồn. Nguồn nằm ở docs/assets/linh-thu/reference/ur; hash nguồn đối chiếu SOURCES.csv.

## Hai bản hoàn mỹ đề xuất

- Pyrodaemon — Nhật Thực Tam Diệm: giữ ba đầu và ba biểu cảm, bạch diệm có bóng tím nhạt/viền đỏ, thân tối, một ấn nhật thực gọn trên vòng cổ.
- Meteorax — Tinh Vẫn Đế Giáp: giữ giáp và hình quạt tinh thể, đổi sang giáp xanh đá tối, tinh thể ngọc tím sáng và một ấn tinh vẫn gọn trong phiến tinh thể lớn.

95% chỉ nhấn mắt, giữ bảng màu và hình thái T4 thường. Hai mốc chỉ mở sau khi luyện đầy 160 điểm của UR; T4 bắt đầu ở 110 điểm chưa mở. 152 thực +8 xám đạt 95%; 160 thực +0 xám đạt 100%.

## Gameplay giữ nguyên

Theo docs/LINH_THU_SKILLS.md:
- Pyrodaemon 95%: 20 task hợp lệ tích lũy nhận 1 vé triệu hồi. 100%: lần triệu hồi tiếp theo sau kích hoạt trong tuần hiện 3 ứng viên, chọn 1; vẫn tiêu 1 vé, bảo hiểm cập nhật theo cá thể được chọn một lần.
- Meteorax 95%: 5 ngày tích lũy vừa đủ habit vừa ngủ đúng giờ nhận 1 vé triệu hồi. 100%: 2 lượt bảo hộ ngủ và 1 lượt hoàn tu vi thực trừ khi đột phá thất bại; cuối tuần mỗi lượt dư đổi 5 tu vi, tối đa 15.
- Toàn tài khoản một tuyệt kỹ/tuần lịch. Task không tham gia điểm luyện; habit quyết định luyện và tạp chất.

## Đầu ra

Mỗi thư mục loài chứa `*-raw.png`, `*.prompt.txt` và `*-preview.png`. T4 thường dùng tên tiến hóa, hai bản độ thuần dùng t4-95 và t4-perfect. Đã xong 12 ảnh riêng: 8 dạng thường, 2 bản Thức tỉnh 95% và 2 bản Hoàn mỹ. Đây là kết quả tạo ảnh/kiểm kỹ thuật, chưa thay người dùng duyệt từng bản.

Không sửa code, HTML, CSS, registry runtime hoặc dữ liệu thật trong lượt làm mỹ thuật này.

## Xem nhanh bộ đầy đủ

- [Cả hai dòng UR, đủ 12 trạng thái](ur-full-states.png).
- [Pyropup → Pyrodaemon, đủ sáu trạng thái](pyropup-full-states.png).
- [Rubblet → Meteorax, đủ sáu trạng thái](rubblet-full-states.png).
- [T4 gốc và T4 mới, kèm thumbnail](ur-t4-source-and-thumbnail-review.png).
- [Kiểm alpha và độ rõ ở 64/128px trên nền sáng/tối](alpha-and-thumbnail-review.png).

## Kết quả kiểm

Đã xem trực tiếp 12 ảnh và hai bảng toàn chuỗi/thumbnail. Kiểm đạt: 12 ảnh khác nhau theo hash pixel, 1024px RGBA có alpha thật, lề trong suốt tối thiểu 82px, toàn thân không cắt đầu/chân/đuôi. Tám nguồn tham chiếu UR khớp hash trong SOURCES.csv. Raw đầu ra giữ nguyên; riêng Rubblet T1 trả về 1380×1140, các raw còn lại 1254×1254 dù yêu cầu 1024×1024; kích thước thực được ghi lại, không mô tả nhầm là đầu ra gốc 1024.

`IMAGE_CHECKS.json` và `PROVENANCE.csv` lưu hash raw, preview, pixel và prompt; vai trò từng ảnh đầu vào và cách chuẩn hóa được ghi rõ. Mốc 95% cố ý thay đổi nhỏ ở mắt; ở thumbnail nhỏ cần đọc cùng nhãn trạng thái, không dùng thay đổi hình thái lớn.

Bộ này chưa đăng ký manifest hoặc thay ảnh ứng dụng. Sau UR, thứ tự sản xuất tiếp theo là SSR → SR → R; theo dõi trong [bảng tiến độ mỹ thuật](../../../docs/LINH_THU_ART_PROGRESS.md).