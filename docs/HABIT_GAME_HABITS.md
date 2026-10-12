# Habit — cam kết, ghi nhận và theo dõi

Cập nhật 2026-10-12. Hợp đồng habit đã triển khai và phát hành staging; bằng chứng tại [RELEASE](HABIT_GAME_RELEASE.md). Luật user nằm tại [REVIEW](HABIT_GAME_REVIEW.md); giao dịch tại [ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md), phần game tại [GAMEPLAY](HABIT_GAME_GAMEPLAY.md).

## 1. Định nghĩa và dữ liệu người dùng

Một habit có tên, mục tiêu ngày đạt, lịch cam kết, mốc hiệu lực, trạng thái vòng đời; tùy chọn ghi chú, giờ nhắc và thời lượng/chỗ trong kế hoạch. Mục tiêu, lịch, nhắc và slot là các khái niệm riêng.

| Kiểu ghi | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| Tick | Tự xác nhận đã thực hiện cam kết | Thiền hôm nay |
| Số lượng | Tổng đã thực hiện trong ngày, đơn vị rõ | 5/10 trang |
| Thời lượng | Thời lượng tự nhập, không giả là đã đo focus | 15/20 phút |

- Người dùng tự chọn và thêm/sửa/xóa habit. Mẫu gợi ý có thể giúp nhập nhanh, không có nghĩa template tự đăng ký hoặc tự hoàn thành.
- Giá trị hợp lệ, giới hạn, độ chính xác và quy tắc đơn vị do AI chọn; lưu/tính nhất quán, không để số âm, NaN hoặc làm tròn UI biến chưa đạt thành đạt.
- Cho xem phần thực hiện/vượt mục tiêu. **Đạt đủ mới có đóng góp game; chưa đủ tính 0% cho habit đó.** Vượt mục tiêu không nhân thêm ngày đạt hoặc damage không giới hạn.
- Bản ghi là tự khai báo. Không dùng LLM, tin nhắc đã đọc, GPS hoặc ước lượng task làm bằng chứng hoàn thành.
- Mỗi habit có tối đa một trạng thái đạt được tính cho một ngày sinh hoạt; nhiều phiên cùng ngày có thể cộng số lượng nhưng không bù những ngày đã đóng.
- Ghi chú ngắn có giới hạn và hiển thị an toàn. Không biến ghi chú thành chỉ dẫn cho model hoặc hành động nghiệp vụ.

## 2. Ngày sinh hoạt và quyền sửa

Ngày theo cửa sổ start/end do server chốt từ giờ sinh hoạt hiện có, múi giờ UTC+7. Ngủ không đóng ngày. Không đổi hệ điểm danh đang theo ngày lịch Việt Nam.

1. UI tải ngày hiện tại, mốc bắt đầu/kết thúc và revision cần dùng.
2. Người dùng ghi/sửa tổng hôm nay; server kiểm ngày, owner, payload và version.
3. Phần theo dõi và preview game đổi sau khi lưu được xác nhận. Chưa chốt thì preview có thể thay đổi.
4. Khi ngày hết, quyền ghi hết ngay theo thời gian server, dù cron chưa chạy. Ngày cũ chỉ đọc.
5. Kết toán đóng góp dựa trên giá trị cuối hợp lệ và snapshot cam kết/chế độ của ngày; cùng ngày không được kết toán hai lần.

Ví dụ 15 → 20 → 15 phút với mục tiêu 20: lịch sử theo dõi lưu thực hiện; preview đóng góp 0 → đạt → 0; kết toán cuối cùng là chưa đạt. Không giữ phần thưởng từ lần ghi 20 trước đó.

Retry của lần đã commit được trả lại receipt cũ khi sang ngày; đây là đọc lại kết quả, không phải quyền ghi bù. Thao tác cũ chưa commit phải báo ngày đã thay đổi, không tự áp dụng sang ngày mới. UI cần giữ nội dung nháp để user quyết định nhập lại cho hôm nay.

Thay giờ sinh hoạt không mở lại ngày đã khóa hoặc khiến cửa sổ chồng nhau tính hai lần. AI quyết định thời điểm hiệu lực và xử lý cửa sổ chuyển tiếp trong P0, có ví dụ qua nửa đêm.

## 3. Ba kiểu lịch

| Lịch | Cam kết | Khi một ngày chưa làm kết thúc |
| --- | --- | --- |
| Hằng ngày | Một ngày đạt mỗi ngày hiệu lực | Một thiếu nếu chưa đạt |
| Chọn thứ | Một ngày đạt vào mỗi thứ đã chọn | Thiếu khi đến lịch; thứ khác trung tính |
| X ngày mỗi tuần | Q ngày đạt khác nhau trong kỳ tuần | Trung tính khi còn đủ cơ hội; chỉ ghi thiếu mới khi không còn đủ ngày |

Đối với tuần linh hoạt, ngày làm đạt được cộng ngay trong ngày đó. Ngày chưa làm không được coi là đã hoàn thành. Thiếu không mặc định là trừ Tu Vi/HP/vé; đó là một kết quả cam kết để game xử lý theo luật đã đặc tả.

### Quy tắc thiếu dần

Sau khi đóng ngày d, đặt Q = cam kết tuần, C = số ngày đạt được tính tới hết d (tối đa Q), R = số ngày hợp lệ còn lại **sau d**:

```text
thiếu_lũy_kế(d) = max(0, Q - C - R)
thiếu_mới(d) = thiếu_lũy_kế(d) - thiếu_đã_ghi_trước_d
```

Phải có snapshot Q và lịch ngày hợp lệ. Với một cam kết tuần cố định, thiếu lũy kế không giảm; chỉ ghi phần thiếu mới. Không cộng toàn bộ thiếu lũy kế thêm mỗi ngày.

Ví dụ Q=3, ngày 1 đạt và sau đó không đạt:

| Hết ngày | C | R | Thiếu mới | Diễn giải |
| --- | --- | --- | --- | --- |
| 1 | 1 | 6 | 0 | Được tính đạt ngày 1 |
| 2–5 | 1 | 5–2 | 0 | Còn đủ cơ hội, ngày chưa đạt trung tính |
| 6 | 1 | 1 | 1 | Không còn đủ ngày đạt 3/3 |
| 7 | 1 | 0 | 1 | Thiếu thêm một, tổng thiếu hai |

Nếu ngày 7 đạt: ngày 7 được cộng, thiếu mới 0, giữ thiếu ngày 6. Nếu không ngày nào đạt: ngày 5/6/7 mỗi ngày ghi một thiếu. Nếu đã đạt đủ Q đầu tuần: phần vượt vẫn theo dõi; mặc định sau đó không có thêm đóng góp game.

Mặc định trần Q ngăn cam kết 3 ngày biến thành 7 ngày thưởng. AI được điều chỉnh cơ chế thưởng phần vượt chỉ khi không làm đổi ví dụ đã chốt, không tạo thêm thành công giả hoặc kẽ hở farm; phải có quyết định và kiểm chứng trước khi áp dụng.

## 4. Trạng thái cần phân biệt

Trạng thái trên UI có thể ngắn hơn các thuật ngữ bên dưới, nhưng dữ liệu/logic không được gộp sai:

- **Chưa đạt hôm nay:** vẫn có thể làm; có thể đang 15/20, chưa phải thiếu đã chốt.
- **Đạt:** đạt mục tiêu tự khai báo; quyền được tính đóng góp còn theo lịch/trần hiệu lực.
- **Trung tính:** không đến lịch, còn đủ cơ hội của tuần linh hoạt, hoặc đã đủ Q; không vào mẫu số như một thành công.
- **Thiếu:** phần cam kết chắc chắn bỏ lỡ được ghi khi đóng ngày; có lý do và kỳ nguồn.
- **Kỳ đang xử lý:** ngày đã hết nhưng kết toán chưa xong; ngày vẫn chỉ đọc. Không dùng số tạm để báo thưởng đã chốt.
- **Chưa có lịch sử:** trước mốc hiệu lực/không có dữ liệu; không tự điền hoàn thành hoặc failure cho quá khứ trước khi habit tồn tại.
- **Đã lưu trữ:** không nằm trong danh sách hoạt động, lịch sử vẫn xem được; nghĩa vụ còn hiệu lực vẫn phải xử lý.

Một ngày của tuần linh hoạt có thể ghi thực hiện chưa đạt nhưng vẫn trung tính đối với game. UI nên hiện được cả phần thực hiện lẫn lý do tính cam kết, thay vì ép chúng vào một nhãn duy nhất.

## 5. Vòng đời và thay đổi giữa kỳ

Không có pause miễn tinh thuần vì ốm/nghỉ phép khi cam kết vẫn tồn tại. Thay mục tiêu/lịch hoặc xóa phải giữ cam kết đã phát sinh, lịch sử và đóng góp đã khóa. User vẫn có quyền chấm dứt một habit cho tương lai; không giữ nghĩa vụ vô hạn sau khi xóa.

Hướng mặc định để AI hoàn thiện:

| Thay đổi | Hướng hiệu lực | Điều phải bảo toàn |
| --- | --- | --- |
| Tên/ghi chú/giờ nhắc | Có thể cập nhật ngay với revision | Không đổi cam kết hoặc giả sửa kết quả cũ |
| Mục tiêu/kiểu ghi/lịch | Ngày/kỳ kế tiếp; với quota tuần ưu tiên tuần kế tiếp | Không hạ mục tiêu của ngày đã đóng, không xóa thiếu tuần hiện tại |
| Habit mới giữa tuần | Tracking dùng ngay; AI chốt kỳ cam kết ngắn hợp lệ hoặc bắt đầu quota tuần sau | Không phạt cho ngày chưa tồn tại; không tăng tốc tức thì chỉ vì thêm dòng |
| Lưu trữ/xóa khỏi hoạt động | Có ngày ngừng hiệu lực rõ | Quyết toán các nghĩa vụ còn lại, giữ history; giải thích trên UI |
| Khôi phục habit lưu trữ | Phiên bản cam kết tương lai | Không phục hồi thưởng, reminder cũ hoặc mở lại ngày cũ |

P0 phải chọn tuần bắt đầu vào ngày nào, xử lý tuần đầu, thay lịch/hủy, đổi giờ sinh hoạt và thay đơn vị. Ghi các lựa chọn vào [PROGRESS](HABIT_GAME_PROGRESS.md), cập nhật đặc tả này và test bằng timeline cụ thể. Các hướng mặc định ở bảng là điểm bắt đầu, không phải yêu cầu schema cố định.

## 6. Theo dõi và báo cáo

- Danh sách hôm nay có cả habit chưa đủ và đã đạt; habit đã đạt có thể thu gọn, không biến thành việc cần xếp lại. Tuần linh hoạt luôn xem được Q, C và cơ hội còn lại.
- Báo cáo tuần/tháng tách kỳ đang diễn ra và kỳ đã đóng. Tỷ lệ đạt cam kết dựa trên số đạt/thiếu được tính; trung tính không tăng mẫu số hoặc tạo success.
- Có thể hiển thị số phút/trang thực hiện riêng, kể cả phần chưa đạt hoặc vượt Q; không gọi tỷ lệ 15/20 là tỷ lệ đóng góp game.
- Streak phụ trợ theo **cam kết**, không đòi đạt mọi ngày đối với lịch chọn thứ/tuần linh hoạt. AI chọn cách gọi/định nghĩa rõ trước khi hiển thị.
- Lịch sử lọc theo habit/kỳ/trạng thái, phân trang; xem định nghĩa mục tiêu/lịch đã có hiệu lực khi đó. Tên hiện tại có thể đi kèm tên snapshot khi cần.
- Insight ngắn từ dữ liệu đủ lớn, ví dụ tuần này giữ 2/3 ngày; không kết luận xu hướng từ một ngày, không suy đoán sức khỏe/năng suất đã đo thực tế.
- Bộ lọc và xuất thống nhất với nguồn đọc. Export không ghi nhận, không nhận thưởng; history cũ vẫn chỉ xem khi xuất/nhập/khôi phục.

## 7. Nhắc và đưa vào kế hoạch

Habit có thể chỉ nằm trong danh sách, có giờ nhắc, có slot, hoặc cả hai. UI không tự bật nhắc khi user chỉ đặt mục tiêu.

- Slot cần duration và kiểm free/busy/capacity; conflict có lời giải thích và lựa chọn thật. Đặt mục tiêu đọc 20 phút không chứng minh slot dài 20 phút đã được làm.
- Liên kết ổn định theo habit/ngày/slot; không tạo task con để nhận thêm vé. Đổi slot hoặc replan không sinh nhiều lời nhắc cho một nguồn.
- Nhắc do user chủ động cấu hình tiếp tục trong trạng thái ngủ/tập trung theo cơ chế hiện có; manual pause/inactive vẫn áp dụng. Nhắc chủ động thúc habit/task/game phải dùng chính sách quiet hiện có, không đánh thức người đã báo ngủ.
- Ngủ, ACK nhắc hoặc đánh dấu reminder “đã phản hồi” không tự hoàn thành habit. Liên kết ngủ/điểm danh chỉ là opt-in rõ, chung nguồn có ID chống lặp và hỗ trợ hoàn tác ngủ hiện có.
- Trước khi tích hợp liên kết tự động, AI phải kiểm quyết toán/undo: báo ngủ rồi hoàn tác trong 5 phút làm preview rút đúng; không tác động tầng/lượt đã khóa và không nhân thưởng gốc.

## 8. Đóng góp sang game

Mỗi sự kiện đạt/thiếu mới có nguồn, ngày/kỳ, phiên bản cam kết, trọng số đủ điều kiện, trạng thái dự báo/đã khóa và nơi hưởng. Một nguồn trong một ngày chỉ thuộc chế độ đã snapshot của ngày đó.

Ngày trung tính không cộng tiến độ, không làm hỏng tinh thuần và không được tính là đã làm. Một lần thiếu weekly được gắn ngày phát sinh, không quay về sửa tầng đã khóa. Khi đổi môn/tầng/chế độ giữa tuần, AI phải chốt quy tắc phân bổ và chống né nghĩa vụ trong P0 theo [GAMEPLAY](HABIT_GAME_GAMEPLAY.md); không để các thiếu phát sinh bị bỏ qua chỉ vì hiện không chọn môn.

Tăng tốc nhiều habit phải có trần/điều kiện trưởng thành hợp lý; đủ 1 habit vẫn luyện được mọi môn và có thể đạt 100% tinh thuần. Không dùng phán xét LLM để cấm habit “quá nhỏ”; giới hạn cơ học đủ để không farm từ thêm/xóa/chia bản sao.

## 9. Ví dụ và kiểm chứng bắt buộc

Kiểm theo hàm production cho cả ba kiểu lịch; toàn bộ 128 mẫu tuần với Q=1..7; tính thiếu lũy kế không giảm và cuối tuần counted successes + misses = Q. Kiểm thêm tuần đầu, đổi lịch, xóa/restore, đơn vị, hai tab, retry qua ngày, ngủ/undo và kết toán muộn.

Ngày đã đóng không sửa được qua bất kỳ web/bot/LLM/API/import nào. Nghiệm thu các tình huống và bằng chứng tại [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md).
