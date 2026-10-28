# Thói quen — hợp đồng hiện hành

> Hệ thống Linh thú nhận kết quả `achieved/missed/neutral` đã chốt từ domain habit; không tự suy lại quota hoặc dùng task để luyện. Tab Thói quen giữ lối vào Tháp giao ước bốn tầng theo [đặc tả Linh thú](LINH_THU_SPEC.md). Đợt UI v2 giữ nguyên toàn bộ bên trong tháp.

Cập nhật 23/10/2026. Nguồn: `src/domain/habits.ts`, `src/application/habit-service.ts`, `src/adapters/d1/habit-store.ts`, `src/adapters/d1/journal-store.ts` và các module habit/journal ở web. Bằng chứng triển khai và phát hành ở [checkpoint v2](HABITS_V2_PROGRESS.md).

## Ghi nhận và ngày sinh hoạt

| Kiểu       | Tổng tự khai báo trong ngày         |
| ---------- | ----------------------------------- |
| Tick       | 0 hoặc 1                            |
| Thời lượng | Phút, ví dụ 15/20                   |
| Số lượng   | Giá trị và đơn vị, ví dụ 5/10 trang |

Ghi là **thay tổng hôm nay**, không cộng lại mỗi lần mở bảng. Giá trị không âm, hữu hạn, tối đa hai chữ số thập phân; domain lưu số nguyên nhân 100, web/tools dùng đơn vị thật. Tên tối đa 100 ký tự, đơn vị 20, ghi chú 300. Target dương; metric tick có target 1. Backend kiểm giới hạn và độ chính xác, không làm tròn partial thành đạt.

Lượng dưới mục tiêu và vượt mục tiêu vẫn là dữ liệu thực hiện; không suy hoàn thành từ timer, task, ACK, ngủ hay lời model. Mẫu chỉ hỗ trợ nhập, không tự tạo hoặc hoàn thành.

Ngày sinh hoạt là cửa sổ server chốt, UTC+7. Ngủ không đóng ngày, check-in vẫn theo ngày lịch riêng. Chỉ ghi/sửa log khi ngày hiện tại còn mở, đúng owner, habit version và log version. Ngày hết chỉ đọc ngay cả khi cron chưa kết toán. Đổi giờ không mở lại cửa sổ cũ.

Receipt của request đã commit có thể được đọc lại sau khi sang ngày; request cũ chưa commit phải báo conflict, không áp sang ngày mới. Ví dụ 15→20→15 phút với target 20: preview thay đổi chưa đạt→đạt→chưa đạt; kết quả chốt dựa trên tổng hợp lệ cuối.

## Vé quay khi hoàn thành

Khi một lần ghi mới đưa tổng hôm nay từ dưới mục tiêu lên đạt mục tiêu, habit nhận ngay **1 vé quay** dùng chung với task/check-in. Chỉ thưởng vào ngày cam kết có hiệu lực, đúng lịch và chưa lưu trữ; ngày theo dõi thử hoặc ngoài lịch không thưởng. Tối đa một vé cho mỗi habit/ngày. Habit linh hoạt theo tuần nhận tối đa quota vé trong tuần và không thưởng thêm khi số ngày đạt cam kết đã đủ quota, kể cả các ngày được ghi trước tính năng này.

Hoàn tác hoặc giảm tổng vẫn sửa log và kết quả báo cáo bình thường; vé đã cấp được giữ lại, hoàn thành lại cùng ngày không cấp thêm. Vé đã nhận vẫn tính vào giới hạn tuần khi hoàn tác. Ghi thêm vượt mục tiêu, sửa ghi chú, đọc báo cáo và kết toán cron không tạo vé. Không phát bù lịch sử. Log, sổ nhận vé và receipt cùng một giao dịch; retry, hai tab và mất phản hồi không tạo thêm vé.

Vòng quay có ×1 dùng một vé và ×10 dùng mười vé, cùng xác suất từng lượt. ×10 trả mười kết quả trong một giao dịch và một receipt; thiếu vé thì không trừ một phần. Giao diện gộp kết quả theo loại, chỉ chạy một hiệu ứng ngắn. Khi chưa xác nhận được lượt quay do mất mạng, cần kiểm tra lại lượt đó trước thao tác ghi khác trong phiên hiện tại. Tài khoản tạm ngưng vẫn theo quy tắc quay hiện hành; thưởng habit không tự kích hoạt lại tài khoản.

## Lịch và hiệu lực

| Lịch        | Cam kết bắt đầu            | Kết quả khi đóng ngày                                               |
| ----------- | -------------------------- | ------------------------------------------------------------------- |
| Hằng ngày   | Ngày sinh hoạt kế tiếp     | Đạt hoặc thiếu                                                      |
| Chọn thứ    | Ngày sinh hoạt kế tiếp     | Ngày được chọn đạt/thiếu; ngày khác trung tính                      |
| X ngày/tuần | Thứ Hai kế tiếp, quota 1–7 | Đạt được tính tối đa quota; chưa đủ nhưng còn cơ hội thì trung tính |

Có thể tracking ngay trước khi cam kết có hiệu lực; không phạt cho quá khứ. Weekly là số **ngày đạt khác nhau**, không phải số lần cộng trong một ngày. Đã đủ quota thì ghi thêm vẫn được theo dõi, không tạo thêm thành công cam kết.

Với tuần linh hoạt, Q là quota, C số ngày đạt được tính đến hết ngày d (tối đa Q), R số ngày còn lại sau d:

```text
thiếu_lũy_kế(d) = max(0, Q - C - R)
thiếu_mới(d) = thiếu_lũy_kế(d) - thiếu_đã_ghi_trước_d
```

Q=3, đạt ngày đầu rồi không đạt nữa: ngày 2–5 trung tính, ngày 6 thiếu một, ngày 7 thiếu thêm một. Nếu ngày 7 đạt thì không thiếu thêm, vẫn giữ phần thiếu ngày 6. Nếu không ngày nào đạt, ngày 5/6/7 mỗi ngày thiếu một. Trung tính không tính vào mẫu số như thành công.

Sửa định nghĩa có hiệu lực ngày kế tiếp; nếu lịch cũ hoặc mới là weekly thì thứ Hai kế tiếp. Giờ nhắc cập nhật ngay theo thao tác riêng. Lưu trữ/khôi phục có ngày hiệu lực tương ứng, giữ nghĩa vụ đã phát sinh và lịch sử. Bản thay đổi đang hẹn được hiển thị riêng, không giả là đã áp dụng cho hôm nay.

UI v2 tách trạng thái hiển thị trong `habit_presentation` khỏi lịch cam kết. Lưu trữ ẩn ngay khỏi danh sách đang làm, dừng nhắc và bỏ đặt chỗ hôm nay; xem/khôi phục tại ⋯ → Đã lưu trữ. Xóa có xác nhận, hỗ trợ nhiều mục, ẩn cả trong lịch sử/báo cáo phía người dùng. Các snapshot và nghĩa vụ đã phát sinh được giữ nội bộ để không thay điều kiện tháp hay thưởng đã cấp.

Với lịch tuần, Khác → Để hôm khác chỉ đổi nhóm hiển thị trong ngày hiện tại, không miễn quota hay xóa kết quả thiếu. Khác → Làm hôm nay đưa trở lại; lựa chọn hết hiệu lực khi sang ngày sinh hoạt mới. Ngoài lịch hoặc đã đủ quota nằm ở Không cần làm hôm nay, không có tick/ô ghi nhận; có thể chọn làm thêm khi cam kết cho phép, vẫn chịu giới hạn thưởng hiện hành. Thói quen khôi phục đang chờ ngày hiệu lực không có hành động ghi nhận chưa hợp lệ.

## Theo dõi, tiến bộ và thao tác hiện có

Danh sách luôn giữ các thói quen đang hoạt động, độc lập với số mục đã lưu trữ. API `GET /api/habits?archived=1&offset=0` trả thêm tối đa 50 mục lưu trữ cùng `archivePage.nextCursor`; giao diện có tải thêm ở danh sách và bộ lọc lịch sử. JSON export đọc các trang còn lại trước khi xuất để không mất định nghĩa cũ. Tìm kiếm companion phân trang tại DB, hỗ trợ tên tiếng Việt không dấu và tìm được mục nằm sau trang lưu trữ đầu tiên.

- Danh sách chính ưu tiên Cần thực hiện; Đã hoàn thành và Không cần làm hôm nay thu gọn bên dưới. Thẻ tổng kết dùng số hoàn thành trên số cần làm. Chọn nhiều/Thoát chọn, chọn tất cả và xác nhận xóa tương tự Hôm nay.
- Tick đầu dòng dùng cho cả ba metric: đặt đúng target hoặc về 0. Toast Hoàn tác 6 giây khôi phục tổng/ghi chú trước thao tác, có kiểm ngày, phiên, version và trạng thái đối chiếu. Cơ chế này độc lập với Hoàn tác ngủ 5 phút.
- Slider thời lượng và bộ đếm số lượng trong bảng ghi nhận đồng bộ ô nhập chính xác. Thao tác giữ ở bản nháp đến khi Lưu, hỗ trợ số lẻ/vượt target.
- Thêm/sửa giữ nháp khi đổi metric; ngày hiệu lực rõ; header/footer vẫn tiếp cận khi cuộn.
- Tiến bộ 7 ngày là bảng chung; 30 ngày là tỷ lệ và số đạt/cam kết cho từng habit. Chỉ dùng ngày đã kết thúc, loại trung tính khỏi mẫu số, chưa có kết quả dùng dấu —.
- Report theo habit tải khi mở Tiến bộ, gộp request đang chờ, cache tối đa 60 giây, bỏ response lỗi thời và vô hiệu hóa sau ghi. Lịch sử theo bộ lọc/cursor; export CSV/JSON nhất quán bộ lọc, chỉ đọc.
- Habit có thể không nhắc/không slot. Xếp thời gian riêng phải nằm trong ngày và không chồng lịch; slot không chứng minh đã thực hiện, không tự bật nhắc hoặc tạo task thưởng.
- Nhắc do user đặt vẫn theo chính sách ngủ/focus hiện hành, trừ pause/inactive. Không có luồng nối tự động ngủ/ACK thành log habit.

Kết toán habit tiếp tục để có lịch sử/báo cáo, chạy bounded và replay an toàn. Không còn job game, chuyển phần thưởng game hoặc đọc khóa/trận cũ. Các cột/schema lịch sử vẫn giữ để tương thích.

## Nhật ký ngày

Lối vào Nhật ký ngày nằm dưới danh sách; ⋯ → Nhật ký mở lịch sử theo ngày. Mỗi ngày có ba mục: Hôm nay làm được gì; Điều chưa tốt / bài học; Ngày mai cải thiện gì. Cần ít nhất một mục, tối đa 4.000 ký tự mỗi mục. Màn đọc giữ xuống dòng, bỏ mục trống, hiển thị như văn bản an toàn; có chỉnh sửa và xóa với xác nhận. Có thể viết bù ngày cũ, không viết ngày tương lai.

API `GET/POST /api/journals` dùng auth hiện hành và ngày sinh hoạt server. Lần lưu đầu tiên của hôm nay cấp cố định **+1 tu vi, +1 vé quay** vào ví thật, không nhân theo Linh thú. Nội dung, claim owner/ngày, ví và receipt commit trong cùng transaction. Sửa, retry, hai thiết bị, xóa/tạo lại không cấp thêm; ngày cũ không thưởng. Xóa làm rỗng nội dung và bản nháp tại trình duyệt thực hiện, giữ version/tombstone và claim. Bản nháp cũ ở thiết bị khác không được tự ghi đè bản mới: UI báo xung đột version, cho xem bản mới hoặc chủ động dùng lại nháp.

Nháp trình duyệt phân theo owner, giữ khi đóng/mở, đổi ngày hoặc reload. Lần lưu chưa xác nhận giữ request ID và nội dung gốc để phục hồi receipt; sửa tiếp sau lỗi không làm mất nội dung mới. Nháp không đồng bộ giữa các thiết bị; nhật ký đã lưu đồng bộ qua server. UI chỉ báo thành công sau receipt, lỗi lưu giữ nội dung và cho thử lại.

## Prototype được giữ

[Prototype habit](prototypes/habits/index.html) là HTML độc lập, dữ liệu mẫu/localStorage riêng, có reset và sáng/tối; không gọi API cá nhân. File được giữ nguyên qua đợt dọn.

[Demo v2 được duyệt](prototypes/habits-v2/index.html) là nguồn cho đợt triển khai này. Ứng dụng dùng dữ liệu API/D1 thật; không sao chép tháp mẫu hay dữ liệu localStorage mẫu. Tiến bộ và Lịch sử & báo cáo vẫn có trong menu ⋯. Bản demo được giữ nguyên.

## Kiểm chứng

Đối chiếu UI v2 có kiểm hình học và ảnh demo/app cùng dữ liệu cho tổng kết,
danh sách, chọn nhiều, chi tiết, ghi nhận, thêm/sửa, lưu trữ và nhật ký. CSS sheet
giới hạn theo feature và được xóa khi mở tháp. Kết quả sửa theo phản hồi nghiệm
thu và bản staging hiện hành ở [checkpoint v2](HABITS_V2_PROGRESS.md).

Giữ tests ba lịch, 128 mẫu tuần cho Q=1..7, bảo toàn quota, đổi lịch/lưu trữ/khôi phục, precision, hai tab, version, retry qua ngày, kết toán muộn, history/export/report, nhắc/slot và đọc AI không ghi. Browser fixtures kiểm luồng mobile, chữ lớn, mất mạng, draft và đối chiếu sau lưu. Kết quả local và giới hạn tại [HANDOFF](HANDOFF.md).
