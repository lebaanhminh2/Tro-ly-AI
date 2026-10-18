# Thói quen — hợp đồng hiện hành

Cập nhật 18/10/2026. Nguồn: `src/domain/habits.ts`, `src/application/habit-service.ts`, `src/adapters/d1/habit-store.ts` và các modules habit ở web. Tài liệu này mô tả hành vi đã có; không còn phần đóng góp sang game.

## Ghi nhận và ngày sinh hoạt

| Kiểu | Tổng tự khai báo trong ngày |
| --- | --- |
| Tick | 0 hoặc 1 |
| Thời lượng | Phút, ví dụ 15/20 |
| Số lượng | Giá trị và đơn vị, ví dụ 5/10 trang |

Ghi là **thay tổng hôm nay**, không cộng lại mỗi lần mở bảng. Giá trị không âm, hữu hạn, tối đa hai chữ số thập phân; domain lưu số nguyên nhân 100, web/tools dùng đơn vị thật. Tên tối đa 100 ký tự, đơn vị 20, ghi chú 300. Target dương; metric tick có target 1. Backend kiểm giới hạn và độ chính xác, không làm tròn partial thành đạt.

Lượng dưới mục tiêu và vượt mục tiêu vẫn là dữ liệu thực hiện; không suy hoàn thành từ timer, task, ACK, ngủ hay lời model. Mẫu chỉ hỗ trợ nhập, không tự tạo hoặc hoàn thành.

Ngày sinh hoạt là cửa sổ server chốt, UTC+7. Ngủ không đóng ngày, check-in vẫn theo ngày lịch riêng. Chỉ ghi/sửa log khi ngày hiện tại còn mở, đúng owner, habit version và log version. Ngày hết chỉ đọc ngay cả khi cron chưa kết toán. Đổi giờ không mở lại cửa sổ cũ.

Receipt của request đã commit có thể được đọc lại sau khi sang ngày; request cũ chưa commit phải báo conflict, không áp sang ngày mới. Ví dụ 15→20→15 phút với target 20: preview thay đổi chưa đạt→đạt→chưa đạt; kết quả chốt dựa trên tổng hợp lệ cuối.

## Lịch và hiệu lực

| Lịch | Cam kết bắt đầu | Kết quả khi đóng ngày |
| --- | --- | --- |
| Hằng ngày | Ngày sinh hoạt kế tiếp | Đạt hoặc thiếu |
| Chọn thứ | Ngày sinh hoạt kế tiếp | Ngày được chọn đạt/thiếu; ngày khác trung tính |
| X ngày/tuần | Thứ Hai kế tiếp, quota 1–7 | Đạt được tính tối đa quota; chưa đủ nhưng còn cơ hội thì trung tính |

Có thể tracking ngay trước khi cam kết có hiệu lực; không phạt cho quá khứ. Weekly là số **ngày đạt khác nhau**, không phải số lần cộng trong một ngày. Đã đủ quota thì ghi thêm vẫn được theo dõi, không tạo thêm thành công cam kết.

Với tuần linh hoạt, Q là quota, C số ngày đạt được tính đến hết ngày d (tối đa Q), R số ngày còn lại sau d:

```text
thiếu_lũy_kế(d) = max(0, Q - C - R)
thiếu_mới(d) = thiếu_lũy_kế(d) - thiếu_đã_ghi_trước_d
```

Q=3, đạt ngày đầu rồi không đạt nữa: ngày 2–5 trung tính, ngày 6 thiếu một, ngày 7 thiếu thêm một. Nếu ngày 7 đạt thì không thiếu thêm, vẫn giữ phần thiếu ngày 6. Nếu không ngày nào đạt, ngày 5/6/7 mỗi ngày thiếu một. Trung tính không tính vào mẫu số như thành công.

Sửa định nghĩa có hiệu lực ngày kế tiếp; nếu lịch cũ hoặc mới là weekly thì thứ Hai kế tiếp. Giờ nhắc cập nhật ngay theo thao tác riêng. Lưu trữ/khôi phục có ngày hiệu lực tương ứng, giữ nghĩa vụ đã phát sinh và lịch sử. Không có xóa vĩnh viễn trong UI/API habit. Bản thay đổi đang hẹn được hiển thị riêng, không giả là đã áp dụng cho hôm nay.

## Theo dõi, tiến bộ và thao tác hiện có

- Danh sách giữ habit đang hoạt động, gồm ngoài lịch/chưa bắt đầu; phân biệt partial, đạt tự khai, trung tính, thiếu đã chốt và kỳ đang xử lý.
- Tick đầu dòng dùng cho cả ba metric: đặt đúng target hoặc về 0. Toast Hoàn tác 6 giây khôi phục tổng/ghi chú trước thao tác, có kiểm ngày, phiên, version và trạng thái đối chiếu. Cơ chế này độc lập với Hoàn tác ngủ 5 phút.
- Slider thời lượng và bộ đếm số lượng trong bảng ghi nhận đồng bộ ô nhập chính xác. Thao tác giữ ở bản nháp đến khi Lưu, hỗ trợ số lẻ/vượt target.
- Thêm/sửa giữ nháp khi đổi metric; ngày hiệu lực rõ; header/footer vẫn tiếp cận khi cuộn.
- Tiến bộ 7 ngày là bảng chung; 30 ngày là tỷ lệ và số đạt/cam kết cho từng habit. Chỉ dùng ngày đã kết thúc, loại trung tính khỏi mẫu số, chưa có kết quả dùng dấu —.
- Report theo habit tải khi mở Tiến bộ, gộp request đang chờ, cache tối đa 60 giây, bỏ response lỗi thời và vô hiệu hóa sau ghi. Lịch sử theo bộ lọc/cursor; export CSV/JSON nhất quán bộ lọc, chỉ đọc.
- Habit có thể không nhắc/không slot. Xếp thời gian riêng phải nằm trong ngày và không chồng lịch; slot không chứng minh đã thực hiện, không tự bật nhắc hoặc tạo task thưởng.
- Nhắc do user đặt vẫn theo chính sách ngủ/focus hiện hành, trừ pause/inactive. Không có luồng nối tự động ngủ/ACK thành log habit.

Kết toán habit tiếp tục để có lịch sử/báo cáo, chạy bounded và replay an toàn. Không còn job game, chuyển phần thưởng game hoặc đọc khóa/trận cũ. Các cột/schema lịch sử vẫn giữ để tương thích.

## Prototype được giữ và quyết định chưa áp dụng

[Prototype habit](prototypes/habits/index.html) là HTML độc lập, dữ liệu mẫu/localStorage riêng, có reset và sáng/tối; không gọi API cá nhân. File được giữ nguyên qua đợt dọn.

Phần nháp UX chưa commit trước đợt dọn đề xuất: composer ưu tiên tên rồi metric/lịch, Theo dõi/Tiến bộ, tên mở chi tiết còn menu mở quản lý, ô tick thống nhất kèm hoàn tác, slider thời lượng vẫn nhập số, bộ đếm ±1, bảng chung 7 ngày và tỷ lệ 30 ngày loại trung tính. Các quy tắc backend về ngày/hiệu lực vẫn phải giữ.

Một phần đã có trong app: tick/hoàn tác, slider/bộ đếm trong bảng ghi, tiến bộ 7/30 ngày. Slider trực tiếp dưới từng dòng, toàn bộ composer/chi tiết và cách quản lý của prototype vẫn là hướng thử nghiệm, chưa được áp toàn bộ. Đợt dọn không triển khai redesign mới. Kiểm tra prototype trước đây là dữ liệu mẫu; không dùng nó làm bằng chứng logic backend hoặc tốc độ staging.

## Kiểm chứng

Giữ tests ba lịch, 128 mẫu tuần cho Q=1..7, bảo toàn quota, đổi lịch/lưu trữ/khôi phục, precision, hai tab, version, retry qua ngày, kết toán muộn, history/export/report, nhắc/slot và đọc AI không ghi. Browser fixtures kiểm luồng mobile, chữ lớn, mất mạng, draft và đối chiếu sau lưu. Kết quả local và giới hạn tại [HANDOFF](HANDOFF.md).
