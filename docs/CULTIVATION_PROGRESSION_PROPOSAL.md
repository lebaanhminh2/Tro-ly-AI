# Tu luyện — phương án thống nhất cơ chế và giao diện

Cập nhật 2026-10-14; giữ các quyết định đã chốt ngày 13/10.

**Trạng thái:** khung cơ chế/UI đã tổng hợp; domain/D1 v2 đang triển khai local, chưa phát hành. Người dùng đã chốt **hết số ngày quy định thì lên tầng**, **sát thương nhận thêm theo kết quả habit của từng kỳ, không bị trần độ thuần tầng trước giới hạn**, còn khuyết điểm giữ trong độ thuần/trần danh hiệu. Hiệu ứng mở/tăng đủ theo tầng; màn hình chỉ có một số Sát thương nổi bật. HTML/UI thật chưa đồng bộ toàn bộ; trị số vẫn cần kiểm chứng/cân bằng. Điểm vào: bản chốt mục 0 của [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md), trạng thái thực tại [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md), prompt chạy tiếp [GOAL](CULTIVATION_GOAL.md).

## 1. Tài liệu nào sở hữu phần nào

- **Tài liệu này:** cơ chế nâng cấp mới, công thức thử, ví dụ và quy tắc UI. [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md) sở hữu phạm vi, các quyết định cố định, inventory, chuyển dữ liệu và kế hoạch triển khai.
- [EFFECT GLOSSARY](CULTIVATION_EFFECT_GLOSSARY.md): tên, nhóm và nghĩa cố định của thuộc tính/hiệu ứng.
- [SOURCE REVIEW](CULTIVATION_EFFECTS_REVIEW.md): kiểm kê tác dụng gốc 39 môn/40 boss và công thức baseline v1, phục vụ đối chiếu tương thích. Trạng thái v2 local ghi riêng trong PROGRESS.
- Các HTML lịch sử là bản thử phương án cũ, không là đặc tả mới. `kiem-y-demo.html` hiện đã được builder sinh từ domain/views/actions production v2 local; tiếp tục dùng source đó, không copy công thức cũ vào demo. Full API/D1, cân bằng và release vẫn cần kiểm riêng theo PROGRESS.
- Các phần thiết kế cũ về nhân hệ số chất lượng lên toàn bộ sát thương, khóa hiệu ứng bằng Q và “Hiệu lực” thay mọi trị số được thay bằng tài liệu này. Source cũ vẫn được mô tả để bảo toàn lịch sử.

## 2. Những điểm đã rõ và các số đang đề xuất

| Nội dung | Quyết định / trạng thái |
| --- | --- |
| Thời điểm lên tầng | **Người dùng chốt:** hết số ngày luyện quy định. Không đợi đủ điểm từ habit. |
| Phần sát thương tăng thêm | **Người dùng chốt:** nhận theo kết quả habit riêng của từng kỳ; kỳ trước đạt 50%, kỳ sau đạt 100% thì kỳ sau nhận đủ phần tăng tối đa. Phần bỏ lỡ của kỳ trước không được bù. |
| Đặc tính/hiệu ứng | **Người dùng yêu cầu:** mở và tăng đủ theo tầng; không bị khóa thêm bởi độ thuần. |
| Độ thuần tổng | Giữ thanh 100%, phần đã đạt, phần còn có thể đạt, phần không thể đạt; bốn tầng hoàn hảo góp 25 điểm mỗi tầng. |
| Khuyết điểm tầng đầu | **Người dùng chốt:** giữ trong độ thuần tổng/trần danh hiệu, không dùng trần này để giảm phần sát thương nhận thêm của kỳ sau. |
| Bản luyện | Tối đa hai bản/môn: bản mạnh nhất đã giữ và bản đang luyện lại; không ghép tầng hai bản. |
| Tên mốc | Tinh Thuần 80%, Chí Thuần 90%, Thông Thần 100%. |
| Thời lượng, hệ số, trị số hiệu ứng | **Số đề xuất để demo/cân bằng**, không tự coi là thông số đã được người dùng duyệt. |

## 3. Một mô hình thông tin cho tất cả công pháp và boss

Dùng năm phần chiến đấu: **Đòn đánh → Đặc tính → Hiệu ứng → Điều kiện → Cái giá**. Danh sách cụ thể và định nghĩa ở GLOSSARY.

- Đòn đánh chính: sát thương mỗi đòn + số đòn. Tổng đòn chính là số suy ra.
- Đặc tính đòn: chí mạng, xuyên Phòng thủ, xuyên Giáp Ảo, hút máu. Chỉ hiện thuộc tính thực có.
- Hiệu ứng: chảy máu, đòn bổ sung/trễ, khiên, giảm thương, phản thương, hồi phục, buff/debuff, điều khiển.
- Chủ động là chiêu phải chọn thi triển. Tác dụng có điều kiện và tác dụng kéo dài sau thi triển vẫn thuộc chiêu chủ động. **Nội tại** là tác dụng do mang môn vào bộ chiêu, không cần chọn chính môn đó ở lượt kích hoạt. Không gộp hai loại vào cùng nhãn.
- Tài nguyên Cương Kình/Hư Ảnh/Bốn ấn chỉ hiện ở môn/trận có sử dụng.
- Tầng, thuần khiết và thời gian là phần Luyện riêng.

Engine hiện chưa có Chí mạng hoặc Xuyên Giáp Ảo. Định nghĩa dự phòng không biến thành một buff đang tồn tại. Không thêm hai cơ chế đó vào mọi môn/boss chỉ để lấp bảng. Các nhận xét “engine hiện chưa có” về ba tác dụng mới trong các bảng dưới nói về baseline v1; code v2 đang thử chúng theo PROGRESS, chưa được coi là bản đã cân bằng/phát hành.

### 3.1. Chính/phụ và chủ động/nội tại

Đây là cách phân loại chung để trình bày và đọc tác dụng của các môn; không tạo thêm chỉ số chiến đấu:

1. **Chính/phụ:** xác định vai trò chiến thuật để giải thích trong chi tiết, không tạo thêm nhiều ô chỉ số nổi bật. Một môn có một vai trò chính, có thể có hai tác dụng cùng tạo nên vai trò đó, ví dụ đòn đánh + hút máu. Tác dụng phụ hỗ trợ vai trò chính.
2. **Chủ động/nội tại:** xác định cách kích hoạt. Cả 39 môn của baseline v1 đều cần thi triển để tạo tác dụng; mang môn không tự cấp hiệu ứng cho chiêu khác. V2 local thêm nội tại Khiên có điều kiện của Huyền Quy, ghi riêng tại mục7.2; không coi mọi hiệu ứng kéo dài là nội tại.
3. **Có điều kiện/kéo dài:** ghi trực tiếp dưới tác dụng liên quan. Đòn trễ tự nổ, chảy máu tự chạy hoặc phản thương sau đòn boss là kết quả chiêu đã dùng. Không gọi chúng là một nội tại do trang bị.
4. **Cái giá/tài nguyên:** luôn tách rõ. Tiêu ấn/Hư Ảnh/Cương Kình là tiêu tài nguyên chiến thuật; hiến HP/cảnh giới là cái giá. Tác dụng chính không che rủi ro.
5. **Nội tại mới:** chỉ thêm khi có vai trò rõ; tối đa một nội tại độc lập/môn ở phương án này, không bắt cả 39 môn phải có. Trần/snapshot/giới hạn nguồn dùng chung vẫn áp dụng.

Phân loại tất cả 39 môn ở mục 7.4. Các chỉ số Đòn đánh/Đặc tính/Hiệu ứng vẫn giữ cùng nhóm chung, không bị phân lại tùy màn hình.

## 4. Lên tầng theo thời gian

### 4.1. Lịch factory bản v2 mới và lịch đã lưu

| Loại môn | Tầng 1 | Tầng 2 | Tầng 3 | Tầng 4 | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: |
| Môn phái, trấn phái | 3 ngày | 4 ngày | 6 ngày | 8 ngày | 21 ngày |
| Cấm thuật | 5 | 6 | 9 | 12 | 32 |
| Ngoài phái | 6 | 8 | 12 | 16 | 42 |

Đơn vị là **ngày sinh hoạt ở chế độ Tu luyện**; hệ số cấm thuật ×1,5 làm tròn lên từng kỳ, ngoài phái ×2. Thường mở tầng ở mốc cộng dồn3/7/13/21; ngày chiến đấu/dừng luyện và đợi hiệu lực không thuộc tổng này. Nhiều habit không tự rút ngắn thời gian; kết quả của chúng thay đổi phần sát thương kiếm được.

**Quyết định A08 local14/10:** đã áp lịch trên cho `newTimePracticeVersion`, sau baseline120/candidate120/mastery/mixed/repetition; targeted domain25/25 và D1 lịch cũ/ngân sách2/2 có bằng chứng. **Chưa phát hành.** Mỗi bản lưu requiredDays riêng: bản thường3/6/10/15 trước đó vẫn mở ở3/9/19/34; cấm/ngoài cũ giữ52/68. UI đọc thời hạn thật của bản; lộ trình tham chiếu của môn chưa học mới dùng factory mới. [BALANCE](HABIT_GAME_BALANCE.md) sở hữu report/giới hạn, [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md) §5.8/§6 sở hữu checkpoint/next action. Số cân bằng còn mở để AI điều chỉnh có bằng chứng, giữ luật theo ngày và dữ liệu đã lưu.

- Bắt đầu/đổi môn có hiệu lực từ ngày sinh hoạt kế tiếp như hiện tại.
- Ngày ở chế độ Tu luyện tăng một ngày thời gian, dù habit đạt hay thiếu. Ngày ngoài lịch không tạo thất bại giả.
- Xuất Chiến/dừng luyện tạm dừng đồng hồ của bản; không biến ngày chiến đấu thành ngày thiếu luyện.
- Hết ngày cuối kỳ: mở tầng và đặc tính của tầng, tầng sau bắt đầu từ ngày luyện tiếp theo.
- Không chốt vì bấm ngủ hoặc đóng/mở app. Dùng mốc ngày và kết toán server; cron chạy muộn phải xử lý lần lượt.
- Bản chưa có tầng 1 chưa được mang vào trận. Sau khi đạt tầng 1 dùng được dù chưa đạt 100% chất lượng.
- Thiếu toàn bộ cam kết vẫn lên tầng đúng hạn, nhận 0 phần sát thương tăng thêm và nhận đặc tính tầng đó. Đây là hệ quả của cách lên tầng người dùng vừa chọn, không lén thêm gate hoàn thành habit.

### 4.2. Cam kết tuần vượt qua mốc tầng

Không sửa kết quả tuần đã chốt, không ghi ngày trung tính thành đã làm, không tính việc hoàn thành một phần như một success.

**Mở tầng** và **chốt phần sát thương của tầng** là hai sự kiện khác nhau khi còn cam kết tuần:

1. Đến hạn, tầng và hiệu ứng của tầng vẫn mở.
2. Nếu kỳ cam kết liên quan chưa kết thúc/đủ quota, phần thưởng sát thương của tầng chưa có số cuối.
3. UI ghi đúng một trạng thái: **Tầng 2 · Sát thương chờ kết toán tuần**. Sát thương hiện có vẫn dùng phần đã chốt.
4. Tuần được chốt thì tính phần nhận thêm; không thu hồi lượng đã chốt ở tầng cũ.
5. Độ thuần của tầng sau chờ trần chất lượng tầng trước nếu chưa quyết toán. Phần sát thương của tầng sau được chốt độc lập ngay khi kết quả habit của chính kỳ đó đã đủ; không chờ trần độ thuần tầng trước.
6. Trận đã chuẩn bị chỉ mang phần thưởng đã chốt tại snapshot. Kết toán tuần sau không tự sửa trận đang đánh.

Như vậy “hết thời gian lên tầng” không bị biến lại thành “chờ habit mới lên tầng”.

## 5. Habit, phần sát thương và độ thuần

### 5.1. Kết quả của kỳ luyện

Một cam kết đạt đầy đủ mới là success; 15/20 phút vẫn là 0 đóng góp cho cam kết đó. Ngày trung tính/ngoài lịch không là success hoặc miss.

Đề xuất với mỗi habit có cam kết trong kỳ:

- Tỷ lệ habit = số cam kết đạt / (số đạt + số thiếu đã phân bổ vào kỳ).
- Tỷ lệ kỳ R là trung bình tỷ lệ các habit có nghĩa vụ hợp lệ, trọng số bằng nhau. Habit hằng ngày không lấn át habit 3 lần/tuần chỉ vì có nhiều ô lịch hơn.
- Danh sách habit đóng góp chốt khi bắt đầu kỳ tầng. Habit thêm giữa kỳ vẫn tracking nhưng tham gia luyện từ kỳ tầng sau. Sửa/xóa không xóa các nghĩa vụ đã ràng buộc.
- Đạt vượt mục tiêu, tick lại, tạo bản sao hoặc đổi đơn vị không tăng thêm số success.
- Chỉ dùng kết quả đã quyết toán; không dùng số tự nhập đang chỉnh hay phán xét của LLM.

Cam kết tuần giữ ledger/audit: success thuộc kỳ luyện nhận nó vào ngày thực hiện; thiếu cuối tuần phân bổ một lần theo **số ngày luyện đã ràng buộc** của từng bản/tầng trong tuần, thay cho trọng số nỗ lực cũ. Mọi ngày luyện với quota đang hiệu lực đều tạo ràng buộc, kể cả hôm đó chưa đạt habit. Có success + thiếu phân bổ theo phần ngày thì tỷ lệ vẫn tính trên các đơn vị đó. Tuần không có kỳ luyện ràng buộc không sinh khuyết điểm luyện giả.

Đổi môn/chế độ không hủy audit của bản trước. Không lấy success của ngày Xuất Chiến để cấp thêm sát thương luyện. Thiếu tuần còn ràng buộc với bản trước vẫn được chốt như cơ chế audit hiện tại.

Nếu toàn kỳ thực sự không có nghĩa vụ hợp lệ: không ghi failure 0% giả, không cấp đóng góp thuần/sát thương; giữ trần kế thừa cho kỳ sau. UI hướng dẫn thêm cam kết thay vì tự cấp 100%. Đây khác với có nghĩa vụ mà bỏ hết: trường hợp bỏ hết có R=0 và trần kế thừa bằng 0.

### 5.2. Tách kết quả habit khỏi chất lượng kế thừa

**Đã chốt:** Rᵢ dùng để nhận phần sát thương của kỳ i; qᵢ dùng để ghi chất lượng và trần danh hiệu. Không thay R bằng q khi cấp phần sát thương.

Đề xuất phép tính chất lượng đơn giản:

- q₀ = 100%.
- qᵢ = min(Rᵢ, qᵢ₋₁) cho tầng có kết quả hợp lệ.
- Không lấy công thức phi tuyến practice-v1 rồi gọi nó là “50% habit → 50% sát thương”.
- q đã chốt bất biến. Kỳ sau không chữa tầng cũ; cải thiện bằng luyện lại từ tầng 1.

Ví dụ: tầng 1 đạt 50%, tầng 2 đạt 100% → R₂=100%, q₂=50%. Tầng 2 nhận **100% phần sát thương tăng thêm**, nhưng chỉ góp **12,5 điểm** vào độ thuần tổng. Trần chất lượng của bản vẫn giữ khuyết điểm tầng 1; người dùng đã chọn đúng cách tách này.

q và Q có thể ảnh hưởng thưởng danh hiệu G ở mục 5.5; không ảnh hưởng lần nữa vào phần sát thương cơ bản của kỳ.

### 5.3. Chỉ cộng vào phần tăng thêm

Công thức chung:

**Sức mạnh sau tầng = sức mạnh đã có + phần tăng tối đa của tầng × R của chính kỳ đó.**

Ví dụ minh họa độc lập với catalog: đang có sát thương 100, tầng kế cho tối đa +20; R=50% → nhận +10, thành 110. Nếu R=100% dù trần độ thuần chỉ 50% thì nhận đủ +20, thành 120. Xuyên phòng thủ từ 35% lên 40% vẫn lên đủ 40% trong cả hai trường hợp.

Đề xuất hệ số lực sát thương của bốn tầng, giữ mốc hoàn hảo của engine cũ:

| Tầng | Phần hệ số lực nhận thêm tối đa | Tổng hoàn hảo |
| --- | ---: | ---: |
| Nền kỹ năng | 0,40 | Chưa đủ tầng 1 thì chưa dùng môn |
| 1 | +0,60 × R₁ | 1,00 |
| 2 | +0,18 × R₂ | 1,18 |
| 3 | +0,18 × R₃ | 1,36 |
| 4 | +0,18 × R₄ | 1,54 |

K = 0,40 + 0,60R₁ + 0,18R₂ + 0,18R₃ + 0,18R₄, chỉ cộng các phần đã chốt.

Không nhân toàn bộ K với chất lượng tầng mới. Không nhân lần nữa với độ thuần tổng. Không giảm phần đã kiếm ở tầng 1 khi tầng 2 có kết quả thấp hơn.

Ví dụ Kiếm Ý, Công 100, hệ số đòn 110%, không buff/phòng ngự; habit các kỳ R = 100/50/100/100%, chất lượng kế thừa q = 100/50/50/50%:

| Tầng | Habit kỳ R | Chất lượng q | K | Sát thương thô sau làm tròn | Độ thuần tổng |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 100% | 100% | 1,00 | 110 | 25% |
| 2 | 50% | 50% | 1,09 | 119 | 37,5% |
| 3 | 100% | 50% | 1,27 | 139 | 50% |
| 4 | 100% | 50% | 1,45 | 159 | 62,5% |

Tầng 3 và 4 nhận đủ phần tăng sát thương. Phần thiếu của tầng 2 và trần độ thuần 62,5% vẫn giữ; không cấp danh hiệu 80/90/100% cho bản này.

Dùng số nguyên để lưu tỷ lệ và phần đã nhận; chỉ làm tròn xuống ở các bước lực → lượng đòn. Hiển thị không được làm tròn lên điều kiện mốc.

### 5.4. Thanh Độ thuần khiết tổng

Q = tổng(25 × qᵢ) của các tầng đã chốt. Kỳ không có nghĩa vụ đóng góp 0 vào tổng nhưng không làm hạ trần chất lượng các kỳ sau.

Trần Qmax gồm phần đã chốt + phần các kỳ chưa chốt còn có thể đạt. Với mỗi kỳ chưa chốt, giả định mọi cam kết còn lại đều đạt, giữ mọi thiếu đã phát sinh và trần kế thừa. Không giả vờ xóa lỗi cũ.

- Đậm: Q đã chốt.
- Nhạt: Qmax − Q còn có thể nhận.
- Phần trung tính có vạch: phần ngoài trần hiện tại. Khi Qmax đã chốt, 100 − Qmax không thể đạt ở bản này.
- Số hiện tại và số có thể đạt luôn có chữ; không chỉ phân biệt bằng màu.
- Chờ audit: ghi **Trần tạm tính**, không báo mở danh hiệu bằng số chưa chốt.

**Phân biệt dự báo và khuyết điểm đã chốt:** Qmax khi kỳ/tuần đang mở còn phụ thuộc lịch đã ghi và giả định luyện liên tục. Không gọi toàn bộ 100−Qmax tạm tính là mất vĩnh viễn. Local DTO có `permanentLossBp` riêng, chỉ phản ánh thiếu chắc chắn từ kết quả đã chốt và trần kế thừa. Caption phải nói rõ phần mất đã biết, còn dự báo/giả định mở xem trong chi tiết; sửa lịch hoặc dừng luyện không được xóa thiếu cũ.

Ví dụ q₁=100%, q₂=50%, sau đó làm tốt nhất: Q đang có 37,5%, Qmax=62,5%. Không cần đoán vì thanh cho thấy rõ phần đã mất.

**Trần độ thuần khác trần sát thương.** Với ví dụ này, hai kỳ sau vẫn có thể nhận đầy đủ phần sát thương của từng kỳ. Preview sát thương tính từ các R đã chốt và R tối đa còn có thể đạt, không lấy q/Qmax làm tỷ lệ giới hạn phần tăng của kỳ sau. Khi so sánh bản hoàn hảo, tính thêm khác biệt thưởng danh hiệu G.

### 5.5. Mốc chất lượng

| Q đã chốt | Tên | Thưởng đề xuất |
| --- | --- | --- |
| 80% đến dưới 90% | Tinh Thuần | Sát thương công pháp +5% |
| 90% đến dưới 100% | Chí Thuần | Sát thương công pháp +10% |
| 100% | Thông Thần | Sát thương công pháp +15% |

Lấy mức cao nhất, không cộng 5+10+15. Thưởng chỉ tăng lượng sát thương do công pháp tạo và các trần sát thương tính từ lực của nó; không tự tăng tỷ lệ xuyên, hút máu, điểm khiên, số lượt hoặc quyền cứu. Sát thương phản thương/chuyển lực/theo HP không nhân vào cả giá trị nguồn rồi nhân thêm vào kết quả; dùng giới hạn ở mục 6.

Độ thuần không khóa đặc tính hay nội tại theo tầng. Bỏ các điều kiện Q≥40/65/90/100 để mở những hiệu ứng đó. Tên “Hiệu lực” không dùng làm một chỉ số mới trên UI.

## 6. Hai nền tính lượng, một thứ tự chiến đấu

### 6.1. Nền sát thương và nền hiệu ứng

- A = Công snapshot của trận.
- B = bonus habit/task ngày giao chiến, theo nguồn hiện hành.
- G = thưởng mốc chất lượng 0/5/10/15%.
- **Lực sát thương D = A × K × (1+G) × (1+B).**
- **Lực hiệu ứng F = A × [1+0,18×(tầng−1)] × (1+B).**

D dùng cho đòn chính, đòn bổ sung, chảy máu/đòn trễ tính từ Công và trần sát thương tương ứng. F dùng cho điểm Khiên, Giáp Ảo, Hồi phục và lượng Giảm phòng thủ tính từ Công. Không lấy D thấp vì habit rồi lén giảm cả Khiên/Hồi phục.

Các **thông số hiệu ứng** đi đủ theo tầng: tỷ lệ xuyên, hút máu, phản thương, giảm thương, số đòn, thời hạn, mở nội tại. Ví dụ Chảy máu được nâng từ 20% lên 25% lực thì nhận đủ hệ số 25%; lượng sát thương cuối vẫn dùng D. Hút máu 50% vẫn là 50% HP thật đã lấy, lượng hồi thấp hơn khi đòn gây ít HP thật là kết quả chiến đấu, không phải giảm tỷ lệ hút.

Đòn theo HP boss/chuyển lực/sao chép/phản thương dùng đúng nguồn đã công bố và trần. D chỉ nâng trần/lượng tính từ Công; không tự nhân thưởng G vào nguồn HP hoặc sát thương boss lần nữa. Phản thương theo % HP thật đã mất, không tăng thêm chỉ vì bản luyện có danh hiệu.

Buff Tăng sát thương trong trận giữ phạm vi đòn trực tiếp đã công bố và trần +60%. Điểm khiên/hồi phục không tự nhận buff đó. Lượng trễ chốt khi tạo, không tự đổi khi ngày sau tăng tầng/đóng góp.

### 6.2. Phòng ngự

Giữ thứ tự đã kiểm chứng: sát thương thô → giảm thương → trừ Phòng thủ sau xuyên → Giáp Ảo giảm/hấp thụ → Khiên hấp thụ → HP.

Mỗi đòn xử lý riêng. Hiện chưa kích hoạt Xuyên Giáp Ảo hoặc Chí mạng. Không gọi Chảy máu là sát thương chuẩn bỏ qua mọi lớp; nó hiện chỉ xuyên Phòng thủ.

### 6.3. Luồng đánh boss

1. Chuẩn bị boss + tối đa 5 môn đã có tầng 1, chọn đúng một bản/môn; có Võ Kỹ riêng.
2. Chốt chỉ số, lực đã nhận, hiệu ứng theo tầng, luật và nội dung. Trận bắt đầu ngày sinh hoạt kế tiếp.
3. Mỗi ngày xem hành động boss đã báo; chọn 1 chiêu, được đổi trước hạn khóa.
4. Kết toán ngày: hiệu ứng đến hạn → trả giá và thi triển → boss còn sống/hồi sinh thì phản công → hiệu ứng cuối lượt.
5. Boss chết thật thì thắng, không nhận phản công. Đồng quy/phản thương xử lý theo quyền cứu, không tự ghi thắng khi người chơi đang 0 HP.
6. Không chọn chiêu thì chờ; ba ngày không chọn rút an toàn. Hiệu ứng không tiêu lượt khi đang chờ.
7. Cứu/thua/giới hạn lượt giữ các quy tắc đã có; không thêm giá mới trong đợt chuẩn hóa.

Trong trận, bonus ngày có thể chưa chốt. Dự kiến phải nói rõ theo dữ liệu nào; không hứa số HP mất chính xác khi cam kết vẫn đang chỉnh.

## 7. Lộ trình hiệu ứng cho cả 39 môn

Không còn một engine nâng cấp cho ba môn và engine khác cho 36 môn. **Mọi môn dùng cùng thời gian, K, Q, Qmax và cách xem lộ trình.** Bản sắc từng môn vẫn lấy bộ tác dụng riêng đã kiểm kê trong SOURCE REVIEW.

### 7.1. Quy tắc trị số đề xuất để thử

| Loại thông số | Tầng 1–4 đề xuất |
| --- | --- |
| Hệ số đòn chính, số đòn nền | Giữ hệ số riêng trong catalog; sát thương tăng bằng K đã kiếm. Không nhân giảm hệ số đòn lần thứ hai. |
| Xuyên Phòng thủ của đòn | 70 / 80 / 90 / 100% mức tối đa đã công bố cho đòn đó. Ví dụ Kiếm Ý 35/40/45/50% xuyên. |
| Hút máu, Phản thương, Giảm thương có lợi, Tăng sát thương | 70 / 80 / 90 / 100% mức tối đa của hiệu ứng đó; đi đủ theo tầng, không theo q. |
| Hệ số Chảy máu | 70 / 80 / 90 / 100% mức tối đa của hiệu ứng; lượng dùng D. |
| Khiên, Giáp Ảo, Hồi phục, Giảm phòng thủ theo Công | Giữ hệ số tác dụng riêng; lượng tăng theo F của tầng, không theo q. |
| Đòn trễ/đòn thêm theo Công | Giữ hệ số riêng; lượng tăng theo D, điều kiện/thời điểm mở không theo q. |
| Chuyển lực, sao chép, % HP boss | Giữ tỷ lệ nguồn đã công bố; trần theo D tăng, không tăng tỷ lệ nguồn vô hạn. |
| Số đòn, thời hạn, ngưỡng HP, tài nguyên, hồi chiêu | Giữ định nghĩa riêng; chỉ đổi khi có dòng nâng cấp công bố cụ thể. Không tự tăng tất cả theo tầng. |
| Cái giá và hạn chế | Giữ nguyên trong bản thử: không giảm giá HP/cảnh giới theo q hoặc tự giảm ở tầng cao. |
| Cương Kình, Hư Ảnh, Bốn ấn | Giữ số lượng/trần, mọi tầng dùng cùng nghĩa và nguồn tạo/tiêu. |
| Niêm phong, đổi chiêu, xem trước, cứu mạng | Giữ phạm vi/thời hạn riêng; không có “tầng cao khóa boss mãi”. |

Các mức 70/80/90/100% là **đường thử để cân bằng**, chưa là kết quả mô phỏng. Chảy máu/phản thương xuyên 100% Phòng thủ vẫn là luật chung cố định; không áp dãy này để làm khác nghĩa cùng tên hiệu ứng. Giảm 40% của Giáp Ảo cũng giữ cố định; điểm lớp tăng theo F.

Danh mục đầy đủ gồm 25 môn phái, 8 cấm thuật, 6 ngoài phái. Mọi môn có bốn bản thông số dẫn xuất, kể cả khi một thông số giữ nguyên. Không cần bịa thêm một nội tại riêng cho mỗi tầng.

### 7.2. Ba tác dụng mới trong demo cũ — phân loại lại cách kích hoạt

| Môn | Loại kích hoạt | Tầng 1 | Tầng 2 | Tầng 3 | Tầng 4 | Điều kiện chung |
| --- | --- | --- | --- | --- | --- | --- |
| Kiếm Ý | Chủ động, buff sau thi triển | Chưa mở | Tăng sát thương +5% | +10% | +15% | Sau thi triển, chiêu Thiên Kiếm khác ở lượt giao chiến kế tiếp nhận buff đòn trực tiếp; một lần, không stack. |
| Huyền Quy | Nội tại khi mang môn | Chưa mở | Khiên 20% HP tối đa | 25% | 35% | Sau đòn boss mà còn sống, HP ≤35%; 2 lượt, 1 lần/trận; không kích từ hiến HP. Không cần chọn Huyền Quy ở lượt kích hoạt. |
| Thôn Thiên | Chủ động có điều kiện | Chưa mở | Hút máu thêm 5 điểm % | +10 điểm % | +15 điểm % | Thi triển môn này khi HP ≤40%; chỉ đòn trực tiếp của chính môn. |

Đây là nội dung mới đề xuất, đã có trong domain v2 local, projection/API và demo dùng chung source. Chưa hoàn thiện trình bày mọi trạng thái trận hoặc simulation toàn bộ. Khi người dùng phát [GOAL](CULTIVATION_GOAL.md), AI được kiểm/cân bằng và chọn chúng trong phần thiết kế còn mở; không phải dừng xin duyệt từng trị số. Khác nhau về tác dụng là bản sắc; giống nhau về thời điểm lên tầng, cách đọc và không có gate độ thuần.

### 7.3. Ví dụ Kiếm Ý để thấy rõ ý nghĩa nâng cấp

Công 100; tầng 1 hoàn hảo, tầng 2 đạt 50%; không buff/phòng ngự:

| Nhóm | Hiện tại, tầng 1 | Sau tầng 2 |
| --- | --- | --- |
| Đòn đánh | 110 ×1 | 119 ×1; phần tăng đã nhận 50% |
| Đặc tính | Xuyên Phòng thủ 35% | 40%, tăng đủ 5 điểm % |
| Hiệu ứng sau thi triển | Chưa mở | Tăng sát thương +5% cho kiếm thức nối lượt |
| Chất lượng | Q=25% | Q=37,5%; trần bản 62,5% |
| Thời gian | Tầng 1 đã hoàn tất | Bản mới hết4ngày luyện kỳ này thì mở tầng2; bản đã lưu dùng requiredDays riêng |

Nếu tầng 2 đạt 100%, sát thương là 129; xuyên vẫn 40%, buff sau thi triển vẫn +5%. Hiệu ứng không bị giảm thành một nửa ở bản 50%.

### 7.4. Phân vai trò chính/phụ cho toàn bộ công pháp hiện có

Các hàng dưới phân loại **tác dụng của baseline v1**, chưa tự cấp một nội tại mới. Tất cả 39 môn có chiêu chủ động; điều kiện và tác dụng kéo dài thuộc chiêu đó. Trị số gốc giữ ở SOURCE REVIEW; ba tác dụng v2 đang thử ở mục 7.2 và PROGRESS. Những ô ghi “chưa có trong engine” ở bảng này nói về baseline v1, không phủ nhận patch v2 local.

**Tác dụng chính/phần hỗ trợ** trong bảng này phân vai trò chiến thuật để tổ chức phần giải thích. Theo chỉnh sửa UI mới nhất của người dùng, trên màn hình chỉ **Sát thương** là số chiến đấu nổi bật, không biến từng vai trò hoặc số đòn thành một ô chỉ số lớn. Các tác dụng vẫn nằm trong nhóm Đòn đánh/Đặc tính/Hiệu ứng khi mở xem. **Điều kiện/cái giá** phải đọc trước thi triển, kể cả đang ở chế độ thu gọn.

#### Thiên Kiếm

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Kiếm Ý | Một đòn xuyên Phòng thủ | Engine hiện chưa có buff nối chiêu; đề xuất mới xếp buff đó sau thi triển | Xuyên chỉ áp dụng đòn của môn |
| Liên Vân Kiếm | Chuỗi ba đòn | Xuyên Phòng thủ của từng đòn | Mỗi đòn bị trừ Phòng thủ riêng |
| Tuyệt Mệnh Kiếm | Đòn Kết liễu khi boss yếu | Đòn thường và xuyên Phòng thủ | Tăng sát thương chỉ khi boss ≤30% HP |
| Vô Hồi Kiếm | Đòn bùng nổ mạnh | Không có tác dụng hỗ trợ có lợi riêng | Nhận thêm sát thương ở lượt thi triển |
| Kiếm Vực Khai Thiên | Đòn trễ mạnh sau khi đặt | Đòn ban đầu, Tăng sát thương trong hai lượt | Đòn trễ đến sau một lượt; buff đặt sau đòn chính |

#### Bất Diệt

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Bất Diệt Kim Thân | Giảm thương và tích Cương Kình | Đòn đánh ban đầu | Cương Kình tạo khi thi triển, không phải khi bị đánh |
| Huyền Quy Chân Kinh | Khiên kéo dài | Đòn đánh ban đầu | Khiên chủ động phải thi triển; Khiên khi HP thấp là nội tại mới riêng, chưa có trong engine |
| Phản Chấn Quyết | Phản thương | Đòn đánh ban đầu | Phản HP thật mất từ boss trong thời hạn; cần thi triển để tạo trạng thái |
| Trấn Sơn Quyền | Đòn thêm từ Cương Kình | Đòn đánh ban đầu | Tiêu điểm đang có; thiếu điểm vẫn có đòn ban đầu |
| Bất Diệt Chiến Thể | Tăng sát thương kèm Khiên trong hai lượt | Đòn ban đầu, tạo Cương Kình | Buff đặt sau đòn ban đầu, không tự tăng đòn đã đánh |

#### U Minh

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Thôn Thiên Ma Công | Đánh và Hút máu | Đề xuất hút thêm khi HP thấp là tăng đặc tính có điều kiện của chiêu | Phải thi triển môn; hút từ HP thật mất của đòn được phép |
| Huyết Sát Quyết | Đòn mạnh bằng hiến HP | Chảy máu | Cần đủ HP để trả; không tự trả khi chưa xác nhận |
| Minh Hà Huyết Chú | Chảy máu nhiều lượt | Đòn đánh ban đầu | Phải đặt bằng chiêu; các lượt sau tự chạy trong thời hạn |
| Tàn Mệnh Chỉ | Sát thương tăng theo HP đã mất | Xuyên Phòng thủ | Không phải buff luôn mạnh nhất hoặc chí mạng |
| Huyết Hải Phần Thiên | Đòn mạnh và Chảy máu kéo dài | Hút máu | Giảm HP tối đa trong phần còn lại của trận |

#### Thái Hư

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Thái Hư Bộ | Giảm thương và tạo Hư Ảnh | Đòn đánh ban đầu | Phải thi triển; Hư Ảnh là tài nguyên |
| Hư Không Tạng | Hồi phục nhờ Hư Ảnh | Tạo/giữ Hư Ảnh, đòn ban đầu | Cần có Hư Ảnh trước khi thi triển để hồi |
| Không Minh Trảm | Tiêu Hư Ảnh để đánh thêm mạnh, xuyên cao | Đòn ban đầu có xuyên riêng | Thiếu Hư Ảnh vẫn có đòn ban đầu; không tự hưởng đòn thêm |
| Hoán Hình Thuật | Né một đòn phản công | Đòn đánh ban đầu | Cần tiêu Hư Ảnh; không né toàn chuỗi nhiều đòn |
| Vạn Pháp Quy Hư | Giải trừ và Giảm Phòng thủ boss | Giảm thương, tạo/giữ Hư Ảnh, đòn ban đầu | Chỉ xóa đúng các buff được liệt kê; không xóa Hồi sinh/Giáp Ảo |

#### Thiên Cơ

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Quan Thiên Chỉ | Xem trước thêm hành động boss | Đòn đánh ban đầu | Phải dùng chiêu để mở thông tin; mang môn không tự thấy |
| Lạc Tử Ấn | Đặt đòn trễ có thể tiêu ấn | Đòn đánh ban đầu | Dấu ấn cần hai lượt để nổ nếu không bị tiêu |
| Dẫn Kiếp Chỉ | Chuyển lực đòn boss đã báo | Giảm thương và đòn ban đầu | Dùng lực đã báo, có trần; không dựa HP thật đã mất |
| Thất Tinh Sát | Tiêu ấn để đánh thêm | Đòn đánh ban đầu | Cần ấn cho đòn thêm; ấn đã tiêu không nổ lại |
| Nghịch Thiên Kỳ | Đổi thứ tự hai hành động boss | Đòn đánh ban đầu | Cần có lượt kế; không xóa đại chiêu |

#### Cấm thuật

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Nghịch Mệnh Hoán Sinh | Chuẩn bị quyền cứu bằng cảnh giới | Đòn đánh ban đầu | Phải thi triển ở lượt bị hạ, rồi chọn cứu; mang môn không tự cứu; trả cảnh giới khi chọn cứu |
| Thâu Thiên Hoán Mệnh | Đòn thêm theo HP tối đa boss | Đòn ban đầu có Hút máu | Giảm HP tối đa; đòn thêm theo HP boss không Hút máu |
| Táng Nhật Nhất Kích | Đòn bùng nổ rất mạnh, xuyên cao | Không có hỗ trợ có lợi riêng | Sau thi triển còn 1 HP; boss sống vẫn phản công |
| Đồng Mệnh Huyết Khế | Phản thương kéo dài | Đòn đánh ban đầu | Hiến HP; phản thương do trạng thái đã tạo, không phải nội tại mang môn |
| Cửu U Đoạt Hồn | Sao chép lượng sát thương hành động boss trước | Đòn đánh ban đầu | Cần có hành động trước; có trần; không chép toàn bộ hiệu ứng |
| Thiên Táng Phong Thần | Niêm phong tuyệt kỹ | Đòn đánh ban đầu | Giảm HP tối đa, hồi chiêu; boss vẫn đánh thường |
| Tam Nhật Đoạn Mệnh | Đòn trễ lớn | Đòn đánh ban đầu | Hiến HP; dấu ấn duy nhất, nổ sau ba lượt |
| Nghịch Luân Chuyển Sinh | Giảm Phòng thủ vừa tăng và Giải trừ Tăng sát thương | Đòn đánh ban đầu | Giá trị tùy lợi thế boss trước đó; không tua toàn bộ trận |

#### Ngoài phái

| Môn | Tác dụng chính | Phần hỗ trợ | Điều kiện/cái giá đáng chú ý |
| --- | --- | --- | --- |
| Vô Môn Dịch Kinh | Mở quyền đổi một ô công pháp | Đòn đánh ban đầu | Đổi vào ngày giao chiến sau; không tự đổi/bỏ giá/trạng thái |
| Sơn Hà Hộ Kiếm | Giáp Ảo | Đòn ban đầu, tạo Sơn Ấn | Tạo qua thi triển; giảm 40% khi lớp còn ở đầu đòn |
| Huyết Triều Khai Kiếm | Đòn thêm theo HP tối đa boss | Chảy máu, đòn ban đầu, tạo Huyết Ấn | Đòn theo HP có trần |
| Chấn Kiếp Kiếm Thức | Chuyển lực đòn boss đã báo | Giảm thương, đòn ban đầu, tạo Kiếp Ấn | Có trần; cần thi triển |
| Vạn Cổ Kiếm Âm | Tái hiện sát thương ở lượt sau | Hồi phục, đòn ban đầu, tạo Cổ Ấn | Không tự tạo vòng tái hiện; lượng chốt khi đặt |
| Tứ Ấn Vấn Thiên | Đòn bùng nổ từ đủ Bốn ấn | Đòn ban đầu có xuyên Phòng thủ | Cần đủ 4 ấn khác nhau, tiêu để bùng nổ một lần/trận |

### 7.5. Một số Sát thương nổi bật, các thông số khác mở xem

**Yêu cầu UI mới nhất của người dùng:** màn hình chỉ có một con số chiến đấu nổi bật mang nhãn **Sát thương**. Không đặt Tổng ba đòn, Sát thương mỗi đòn và Số đòn thành ba ô lớn. Dùng cùng thứ bậc chữ cho mọi công pháp, cả môn thiên về Khiên hoặc điều khiển.

Đề xuất số này là tổng sát thương thô của nhóm đòn chính chắc chắn có trong một lần thi triển, ở điều kiện so sánh đã công bố. Ví dụ minh họa Liên Vân có 46 mỗi đòn ×3: ngoài thẻ chỉ **138 · Sát thương**. Mở xem mới thấy **Mỗi đòn 46 · Số đòn 3**, cùng tỷ lệ xuyên. Không cộng Chảy máu, đòn trễ hoặc đòn thêm có điều kiện vào một tổng giả luôn gây được. Trong trận HP dự kiến mất được tính theo boss và ghi nhãn riêng, không đánh tráo với số Sát thương thô của công pháp.

- Thẻ danh sách: tên/tầng và một số Sát thương; phần giải thích tác dụng nằm trong chi tiết. Không rải 4–5 badge hiệu ứng quanh ảnh.
- Thẻ Hiện tại đang luyện: ảnh/tên/tầng → Sát thương → thuần khiết → tiến độ thời gian. Số đòn và hiệu ứng không tạo thêm khối lớn cạnh Sát thương.
- Chi tiết **Tác dụng**: phần thông số phụ dùng các dòng chữ cùng cỡ, phân nhóm Chủ động → Đòn đánh/Đặc tính/Hiệu ứng; Nội tại nếu có; Cái giá luôn rõ. Phân nhóm giúp đọc khi mở xem, không phải tạo thêm nhiều thẻ/ô chỉ số trên màn hình chính.
- Chủ động được thi triển bằng một lựa chọn/ngày. Không thêm nút để bật riêng từng hiệu ứng phụ.
- Hiệu ứng kéo dài ghi rõ bắt đầu khi nào và còn bao nhiêu lượt; không cần chọn lại môn để mỗi tick Chảy máu chạy.
- Nội tại có một dòng trạng thái: chưa mở / sẵn sàng / đã dùng trong trận. Mốc mở/tăng theo tầng nằm trong Nâng cấp, không thêm một thanh luyện nội tại riêng.
- Trước thi triển: điều kiện thiếu, cái giá và rủi ro quyết định hành động luôn đọc được. Phần giải thích công thức/cộng dồn có thể thu gọn.
- Mọi thông số, chính hay hỗ trợ, vẫn lấy cùng hồ sơ dẫn xuất để tính preview. Phân vai trò không thay đổi engine.

## 8. Boss phải công bố những gì

Source có **40 encounter**, không phải 40 bộ hiệu ứng đầy đủ. Boss hiện có: HP/Công/Phòng thủ, đòn đơn/nhiều đòn, hồi phục sau phản công, tăng Phòng thủ, Hồi sinh hữu hạn, Đọc chiêu lặp. Không gán ngầm Chí mạng, Hút máu, Chảy máu hoặc Giáp Ảo cho các boss chưa có.

### Hồ sơ boss

- HP, Phòng thủ, số lượt tối đa, điều kiện mở.
- Đòn/chiêu: mỗi đòn bao nhiêu, mấy đòn, đặc tính nếu có.
- Hiệu ứng: trị số và thời điểm, ví dụ Hồi phục 10 HP sau phản công.
- Nội tại: Hồi sinh 1 lần với 35% HP; Đọc chiêu lặp giảm 75% sát thương gây ra trong lượt lặp.
- Một cơ chế chính, tối đa một cơ chế phụ ưu tiên trên thẻ; toàn bộ cơ chế thực vẫn có trong chi tiết.
- Phần thưởng và bí tịch mở được; không cần đánh để đoán boss sẽ có hồi sinh hay không.

Các chiêu boss dùng cùng tên/đơn vị/luồng phòng ngự như người chơi khi cùng loại tác dụng. Trước mắt giữ cơ chế của catalog hiện có; không nhân số hiệu ứng cho mọi boss.

### Hành động sắp tới trong trận

Ví dụ: **Khóa cầu · 12 ×2**; **Tăng Phòng thủ +2 sau phản công, trần 11**.

Phòng thủ hiện tại nằm ở hồ sơ; lượng tăng nằm ở hiệu ứng chiêu. Không viết “tăng giáp” rồi khiến người chơi tưởng boss tạo Giáp Ảo.

Đọc chiêu lặp phải có cảnh báo ở lựa chọn gây lặp; không giấu mức giảm 65/75/85% trong lore. Hồi sinh có số lần còn lại ngay gần thanh HP.

## 9. Giao diện thống nhất, ít thông tin hơn ở màn hình chính

### 9.1. Hiện tại — đang luyện

Một ảnh công pháp, một tên/tầng, một con số Sát thương; thanh thuần và tiến độ thời gian. Các thông số phụ nằm sau Xem công pháp:

> Kiếm Ý · Tầng 1/4<br>
> **110** · Sát thương<br>
> Độ thuần khiết 25% · Có thể đạt 100%<br>
> Luyện tầng 2: ngày 3/4<br>
> Xem công pháp

Số preview sát thương chỉ nêu **có thể nhận**, không ghi như đã sở hữu. Phần sát thương tối đa còn có thể nhận tính theo kết quả/cam kết của từng kỳ; trần độ thuần hiển thị riêng, không dùng để giảm preview sát thương của kỳ sau. Không hiện toàn bộ bảng hiệu ứng, lịch sử, công thức và menu bản luyện ở đây.

### 9.2. Chi tiết công pháp

Dùng hai mục **Tác dụng** và **Nâng cấp**:

- **Tác dụng:** Sát thương là con số nổi bật duy nhất. Thông số phụ trình bày bằng các dòng chữ cùng cỡ: mỗi đòn/số đòn, đặc tính, hiệu ứng chủ động và nội tại nếu có. Điều kiện sát tác dụng liên quan; Cái giá thành khối riêng nếu có. Không hiển thị ô Nội tại trống, nhiều ô chỉ số lớn hoặc số Tổng đòn chính lặp lại.
- **Nâng cấp:** thời gian, thanh Q/Qmax, tầng tiếp theo với từng dòng thay đổi, sau đó mở toàn lộ trình bốn tầng.
- Dòng nâng cấp luôn có **hiện tại → kế tiếp**, lượng tăng, và loại: nhận theo habit / tăng đủ theo tầng / vừa mở.
- Thông số không đổi không tạo một hàng so sánh thừa; có thể xem trong lộ trình đầy đủ.
- Lịch sử/công thức/cộng dồn đặt trong phần mở rộng; không làm thẻ cao thêm ba màn hình.
- Cùng một số và nhãn giữa thẻ Hiện tại, chi tiết, lộ trình, bộ chiêu và trận.

Công pháp đi theo luồng Phái → Môn → Chi tiết. Cấm thuật/ngoài phái là nhóm riêng ở danh sách chọn; điều kiện mở ghi chính xác. Chưa học vẫn xem được tác dụng và lộ trình, không giả có một bản hoàn hảo trong tài khoản.

### 9.3. Đang chiến đấu

Thẻ Hiện tại chuyển sang trận: HP hai bên → hành động boss → chiêu đã chọn → kết quả dự kiến. Một nút Chọn chiêu. Chi tiết hiệu ứng đang có nằm sau “Hiệu ứng”, không rải thành nhiều badge màu quanh ảnh.

Nhật ký tách **gây sát thương / bị hấp thụ / hồi phục / trả giá**. Không gọi số Khiên mất là HP boss mất. Cùng một preview dẫn xuất phục vụ chọn chiêu và màn hình trận.

### 9.4. Hoàn tất và luyện lại

- Tầng 4: **Hoàn tất 4 tầng**; không luôn gọi là tối đa sức mạnh.
- Q dưới 100% và hết khả năng tăng: **Bản này đã đạt giới hạn · Luyện lại để cải thiện**.
- Q=100%: **Thông Thần** và thưởng +15% đã tính vào sát thương.
- So sánh hai bản bằng sát thương/đặc tính/Q/trần; khác tầng thì ghi rõ.
- Luyện lại giữ bản mạnh nhất; thay bản đang luyện cần xác nhận. Không nhập tầng tốt của hai bản thành một bản.
- Bản mạnh nhất xét sức mạnh đã chốt; quy tắc chọn phải tính cả tầng và đặc tính, không mặc định bản Q cao hơn nhưng tầng thấp là mạnh hơn.

## 10. Dữ liệu và kiểm chứng trước khi code thật

Một hàm tính hồ sơ công pháp dẫn xuất từ bản luyện + tầng + catalog + ngữ cảnh. Một hàm tính preview đòn. UI không tự có ba hàm viết lại thông số; mô tả sinh từ cùng bộ tác dụng engine.

Bản luyện cần lưu: phiên bản luật, lịch tầng, số ngày luyện, nguồn cam kết/ràng buộc tuần, tỷ lệ habit R từng kỳ, chất lượng kế thừa q từng tầng, phần lực đã nhận từ R, chất lượng tổng/trần Q, trạng thái chờ audit. Không dùng chung một trường để lưu cả R và q. Trận snapshot hồ sơ đã chốt và phiên bản catalog.

Mọi môn phải qua validator: trường/đơn vị hợp lệ, mốc tầng có thứ tự, điều kiện đạt được, hiệu ứng không rỗng, tham chiếu đúng, không vòng đệ quy. Mọi boss công bố đúng các lớp phòng ngự/đặc tính đang dùng.

Các ca bắt buộc:

- Đạt 0/50/100% nhận 0/50/100% phần tăng; phần cũ không giảm.
- Hết ngày quy định lên tầng dù không làm; thiếu tuần chỉ trì hoãn phần thưởng sát thương, không trì hoãn mở hiệu ứng.
- Tầng 1 đạt 50%, tầng 2 đạt 100%: tầng 2 nhận đủ phần sát thương tăng thêm, q₂ vẫn 50%. Tầng 2 không hồi phần sát thương đã mất của tầng 1.
- Độ thuần tầng trước chờ audit không chặn cấp phần sát thương của tầng sau nếu R của kỳ sau đã chốt.
- Trần kế thừa 0 khác kỳ không có nghĩa vụ; ngày trung tính không trở thành miss hoặc success.
- Q, Qmax và các mốc 80/90/100 dùng số chính xác; Qmax không tăng để xóa thiếu cũ.
- Khiên/hồi theo F không bị nhân q; mọi tỷ lệ/mở hiệu ứng theo tầng không bị nhân q.
- Xuyên Phòng thủ khác Xuyên Giáp Ảo; từng đòn xử lý riêng và có khiên vỡ giữa chuỗi.
- Weekly qua mốc tầng/đổi bản/chuyển chế độ; chốt muộn không sửa snapshot trận hoặc cấp nguồn hai lần.
- Luyện lại tối đa hai bản; lịch sử luật cũ không diễn giải bằng luật mới.
- Mọi màn hình đọc cùng hồ sơ, không có chênh số giữa chi tiết/nâng cấp/trận.
- Cân bằng lại toàn bộ 39 môn/40 encounter ở các mức habit 50/80/100%, thuần phái và phối hợp. Báo cáo practice-v1 cũ không chứng minh luật mới đã cân bằng.

## 11. Bước tiếp theo

**Khi được phép chạy tiếp:** đọc PROGRESS/diff và nối tiếp B01–B10 trong [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md), không dựng lại domain đang có. [kiem-y-demo.html](prototypes/cultivation/kiem-y-demo.html) đã dùng dữ liệu mẫu riêng qua `scripts/lib/cultivation-demo.ts`, views/actions production và builder `.mjs`; hướng dẫn ở [README](prototypes/cultivation/README.md). Tiếp tục:

1. Kiểm tiếp forecast/revision/paused mode, audit tuần và tương thích; R riêng từng kỳ không bị q cũ cắt phần tăng.
2. Bảng chọn/đổi chiêu, preview read-only và history race đã có bằng chứng. Theo PROGRESS§5.9/§6, sửa hai footer chữ200% và rerun assertion Đọc chiêu lặp; review log/kết quả và gates nguồn cuối. Giữ coverage, guards và mức xem intent được cấp.
3. Kiểm năm nhóm thông tin trên mọi công pháp/chiêu boss và Nâng cấp; thống nhất một số Sát thương nổi bật ở các màn cùng ngữ cảnh.
4. Kiểm discovery/unlocks cho 39 môn/40 encounter; danh sách boss phẳng và Thành tựu đã có bước đầu, còn cần review mọi trạng thái.
5. Nối tiếp bộ thử nhanh/ngày/reset hiện có; sinh lại HTML sau thay source, không sửa luật trong HTML đầu ra. Fixture maxed không là evidence campaign.
6. A08 đã áp factory21 cho bản mới; dùng reports baseline/candidate/mastery/mixed/repetition tại PROGRESS§5.6–5.7 để kiểm phần balance còn rủi ro. Giữ lịch đã lưu; tiếp tục visual/mobile/dark/chữ lớn, số đo nguồn cuối và full gates/rehearsal/staging/bàn giao theo PLAN. Ảnh hiện có giữ ở đợt này.

Theo AGENTS.md hiện tại, chưa sửa code khi chỉ đang lập kế hoạch. [GOAL](CULTIVATION_GOAL.md) nêu inventory và quyền triển khai đầy đủ để người dùng cấp bằng việc gửi prompt; khi được cấp quyền đó, các chặng demo/engine/UI/tests/staging là cổng tự kiểm, không dừng xin duyệt lại từng nhóm trong phạm vi. Nếu người dùng chỉ duyệt demo thì chỉ làm demo. Không áp công thức mới lên bản luyện/trận lịch sử.
