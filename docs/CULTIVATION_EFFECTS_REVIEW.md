# Tu luyện — kiểm kê baseline v1 và danh mục hiện có

Ngày đối chiếu: 2026-10-13.

**Phạm vi số liệu trong tài liệu:** baseline battle-v1/practice-v1/content than-lo-4 trước vòng đổi cơ chế. Giữ bảng này để kiểm tương thích và biết tác dụng gốc của 39 môn/40 encounter; không dùng công thức v1 cho bản luyện v2. Source local nay đã có phần practice-v2/battle-v2/content than-lo-5, nhưng chưa phát hành. Trạng thái và bằng chứng tại [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md); cơ chế mới tại [PROGRESSION](CULTIVATION_PROGRESSION_PROPOSAL.md), thuật ngữ tại [GLOSSARY](CULTIVATION_EFFECT_GLOSSARY.md), tổng hợp tại [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md).

Các HTML lịch sử từng chỉ có 25 môn phái và gate độ thuần/hệ số cũ. `kiem-y-demo.html` hiện đã được builder sinh từ production v2 local, đủ catalog 39 môn/40 encounter; không dùng các công thức v1 dưới đây để thay luật demo mới. Các đề xuất UI/nâng cấp vòng trước trong tài liệu này đã được thay bằng PROGRESSION. Trạng thái triển khai/gates ở PROGRESS; các bảng dưới vẫn là kiểm kê **baseline v1** để kiểm tương thích.

## 1. Nguồn kiểm chứng

- [Battle engine](../src/domain/battle.ts), [thứ tự hấp thụ](../src/domain/battle-armor.ts).
- [39 bộ tác dụng công pháp](../src/domain/battle-techniques.ts), [tên và điều kiện loại môn](../src/domain/techniques.ts).
- [40 encounter boss](../src/domain/game-content.ts), [tuyến chính](../src/domain/game-campaign.ts), [nhánh](../src/domain/game-branches.ts), [Đọc chiêu lặp](../src/domain/game-balance.ts).
- [Luyện và audit tuần](../src/domain/practice.ts), [đóng góp/kết toán trận](../src/domain/battle-run.ts), [kinh tế cứu/thua](../src/domain/battle-economy.ts).
- [Chuẩn bị/chọn chiêu](../src/application/battle-service.ts), [commit kết toán](../src/adapters/d1/battle-settlement.ts).

Đối chiếu trực tiếp catalog xuất ra **39 môn, 40 encounter**: 22 chính, 5 truyền thừa, 7 nhánh cấm thuật, 6 ngoài phái. Có 8 cấm thuật; Nghịch Mệnh mở từ trận Tạ Trường Sinh nên không cần một encounter nhánh thứ tám.

## 2. Các nguồn tăng sức mạnh hiện tại

| Nguồn | Cơ chế hiện tại |
| --- | --- |
| Cảnh giới | Rank bắt đầu từ 0. HP tối đa = `180 + 60 × rank`; công = `30 + 12 × rank`; phòng thủ = `2 × rank`. Chốt khi chuẩn bị trận. |
| Tầng công pháp | Hệ số tầng 1/2/3/4 = `1 / 1,18 / 1,36 / 1,54`. Đây là cộng 0,18 vào hệ số nền mỗi tầng, không phải nhân 1,18 liên tiếp. |
| Độ thuần khiết | Hệ số = `0,4 + 0,6 × tỷ lệ thuần khiết`. 50% → 0,70; 80% → 0,88; 90% → 0,94; 100% → 1. |
| Habit đạt hôm đó | Có ít nhất một nguồn hợp lệ: +30%; nguồn trưởng thành bổ sung +6%, trần tổng +60%. Trưởng thành sau 7 ngày từ hiệu lực cam kết. |
| Task hoàn thành hôm đó | +5% mỗi task hợp lệ; tối đa hai task/ngày, tức +10%. |
| Tăng công do công pháp | Các trạng thái đang có cộng vào nhau; trần +60%. Ví dụ Kiếm Vực +18%, Chiến Thể +35%. |

Chi tiết habit: nếu toàn bộ nguồn đạt đều đã trưởng thành, một nguồn được dùng làm nền +30%, những nguồn còn lại nhận +6%. Nếu có nguồn mới chưa trưởng thành làm nền, các nguồn đạt đã trưởng thành vẫn có thể nhận phần bổ sung. Ví dụ một nguồn mới + một nguồn trưởng thành = +36%; hai nguồn đều mới = +30%; sáu nguồn trưởng thành = +60%.

Đạt một phần, ngày trung tính/ngoài lịch, hoặc làm dư sau khi đủ quota tuần không tạo thêm nguồn đóng góp. Từng habit đóng góp tối đa một nguồn đạt/ngày.

Task phải nằm trong snapshot tối đa 200 task gốc đang mở khi chuẩn bị trận; task thêm sau đó không tính. Chỉ tính task còn ở trạng thái hoàn thành, không bị xóa, có thời điểm hoàn thành trong ngày đang kết toán. Không tính bước nhỏ, phút làm việc hay ước lượng. Mỗi task chỉ được dùng tăng lực **một lần trên mọi trận**, kể cả tick lại hoặc đánh lại.

Phù đột phá, miễn hạ bậc và chuỗi ngủ không trực tiếp nhân sát thương hoặc cứu mạng trận này. Cảnh giới có thể thay đổi nhờ hệ thống sinh hoạt, nhưng trận đang đánh giữ rank snapshot. Thần binh đã bị loại khỏi chuẩn bị và thưởng của trận mới; hiệu ứng cũ chỉ được giữ để đọc các trận lịch sử.

## 3. Cách tính sát thương

### 3.1. Lực của chiêu đang thi triển

Gọi `P` là lực công sau tầng, thuần khiết và đóng góp ngày:

`P ≈ công snapshot × hệ số tầng × hệ số thuần khiết × (1 + bonus habit + bonus task)`.

Engine làm tròn xuống **sau từng phép nhân**, và giữ P tối thiểu 1.

Đòn đánh trực tiếp:

`sát thương thô mỗi đòn ≈ P × hệ số đòn × (1 + tăng công đang có)`.

Tăng công đang có bị chặn ở +60%. Chiêu nhiều đòn xử lý riêng từng đòn; vì vậy phòng thủ được trừ ở từng đòn, không trừ một lần trên tổng.

Các bảng công pháp phía dưới dùng `110% P`, `70% P`… để chỉ hệ số, **chưa cộng tăng công và chưa qua phòng ngự**.

### 3.2. Ví dụ Kiếm Ý theo đúng engine

Điều kiện so sánh: công nền 100; không có đóng góp ngày, tăng công, phòng ngự hoặc thế đọc chiêu của boss.

| Tầng | Thuần khiết 50% | Thuần khiết 80% | Thuần khiết 90% | Thuần khiết 100% |
| --- | ---: | ---: | ---: | ---: |
| 1 | 77 | 96 | 103 | 110 |
| 2 | 90 | 113 | 121 | 129 |
| 3 | 104 | 130 | 139 | 149 |
| 4 | 117 | 148 | 158 | 169 |

Kiếm Ý ở tầng 2, thuần khiết 90%: `100 → 118 → 110 → 121 sát thương thô`. Nếu boss có phòng thủ 18, xuyên 50% khiến phòng thủ hiệu dụng còn 9; mất 112 HP khi không còn lớp phòng ngự khác.

Con số ở bảng được chạy trực tiếp qua `resolveBattleTurn`, không lấy số làm tròn hiển thị của công thức gần đúng.

### 3.3. Phòng thủ, Giáp Ảo và khiên

Thứ tự xử lý mỗi đòn:

1. Nhân sát thương với hệ số giảm thương. Tổng giảm thương bị giới hạn từ -50% đến +70%; số âm nghĩa là chịu thêm sát thương.
2. Trừ `floor(phòng thủ × (1 − tỷ lệ xuyên phòng thủ))`.
3. Nếu Giáp Ảo còn điểm ở **đầu đòn**, giảm tiếp 40% phần sát thương còn lại.
4. Giáp Ảo tiêu điểm để hấp thụ.
5. Khiên tiêu điểm để hấp thụ phần còn lại.
6. HP thật nhận phần còn lại, tối đa bằng HP đang có.

**Xuyên phòng thủ không xuyên Giáp Ảo, không xuyên khiên và không bỏ qua giảm thương.** Trong source chỉ số phòng thủ vẫn mang tên `armor`; trên sản phẩm cần dùng từ “phòng thủ”.

Ví dụ đòn 121, xuyên 50%, boss phòng thủ 18, Giáp Ảo 60, khiên 20:

`121 − 9 = 112 → floor(112 × 0,6) = 67 → Giáp Ảo nhận 60 → khiên nhận 7 → HP mất 0`.

Giáp Ảo vỡ sau đòn đó; đòn kế tiếp không còn được giảm 40%. Khiên vẫn còn 13 điểm.

Chảy máu và phản thương hiện xuyên 100% **chỉ số phòng thủ**, nhưng vẫn chịu giảm thương, Giáp Ảo và khiên. Chưa có một loại “sát thương chuẩn” tự bỏ qua mọi lớp.

### 3.4. Phần nào tăng khi lên tầng/thuần khiết?

| Thông số | Có tăng nhờ P? | Ghi chú |
| --- | --- | --- |
| Đòn trực tiếp, đòn cộng thêm, đòn trễ, chảy máu | Có | Số đòn và thời hạn hiện giữ nguyên. |
| Điểm khiên, điểm Giáp Ảo, hồi HP cố định theo lực | Có | Mỗi hiệu ứng khiên/Giáp Ảo sinh ra có trần 65% HP tối đa. |
| Lượng giảm phòng thủ của Quy Hư | Có | Bằng 25% P. |
| Trần sát thương theo HP boss, sao chép, chuyển lực, echo | Có | Lượng thực tế còn phụ thuộc HP/chiêu boss và trần. |
| Tỷ lệ xuyên, hút máu, phản thương, giảm thương, tăng công | Không | Hiện là tỷ lệ cố định trong catalog. |
| Số lượt, hồi chiêu, số Cương Kình, số Hư Ảnh | Không | Hiện là số cố định. |
| Đổi thứ tự chiêu, đổi ô, cứu mạng, điều kiện bốn ấn | Không | Không có phiên bản nâng cấp theo tầng hiện tại. |

Các hiệu ứng trễ chốt trị số khi được tạo; không tự tính lại theo công pháp hoặc đóng góp của ngày sau. Tăng công áp lên các đòn đi qua bộ xử lý strike, không tự nhân hồi máu, điểm khiên, chảy máu đã đặt, phản thương hay đòn theo HP tối đa. Vì vậy không nên gọi mọi trị số trong phần chi tiết là “damage được buff”.

## 4. Danh mục 39 công pháp — cùng một cách phân nhóm

P là lực theo công thức source tại mục 3. Các con số % P dưới đây là hệ số trước tăng sát thương trong trận/phòng ngự. Cột số đòn chỉ đếm **đòn chính**; đòn thêm có điều kiện và đòn trễ nằm riêng ở cột Hiệu ứng. Dấu — nghĩa là không có, không phải thiếu dữ liệu.

Engine hiện **không có chí mạng hoặc xuyên Giáp Ảo** ở bất kỳ môn nào. Hút máu là đặc tính của đòn trực tiếp được chỉ định; không tự áp lên đòn trễ, chảy máu hoặc đòn hit riêng theo HP boss.

### 4.1. Thiên Kiếm

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Kiếm Ý | 110% P | 1 | Xuyên Phòng thủ 50% | — | — |
| Liên Vân Kiếm | 46% P | 3 | Xuyên Phòng thủ 10% mỗi đòn | — | — |
| Tuyệt Mệnh Kiếm | 110% P | 1 | Xuyên Phòng thủ 20% | Kết liễu: boss ≤30% HP thì hệ số đòn thành 210% P | — |
| Vô Hồi Kiếm | 200% P | 1 | — | — | Nhận thêm 25% sát thương lượt này, trước bước trừ Phòng thủ |
| Kiếm Vực Khai Thiên | 70% P | 1 | — | Đòn trễ 240% P sau 1 lượt, xuyên 20%; Tăng sát thương +18%, 2 lượt, đặt sau đòn chính | — |

### 4.2. Bất Diệt

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Bất Diệt Kim Thân | 55% P | 1 | — | +1 Cương Kình khi thi triển; Giảm thương 30% lượt này | — |
| Huyền Quy Chân Kinh | 50% P | 1 | — | Khiên 70% P trong 2 lượt, có trần | — |
| Phản Chấn Quyết | 65% P | 1 | — | Phản thương 55% HP thật đã mất, lượt này | — |
| Trấn Sơn Quyền | 70% P | 1 | — | Tiêu tối đa 3 Cương Kình; một đòn thêm 50% P × số điểm đã tiêu | Tiêu toàn bộ Cương Kình đang có |
| Bất Diệt Chiến Thể | 80% P | 1 | — | +1 Cương Kình; Tăng sát thương 35%, Khiên 60% P, cùng 2 lượt; đặt sau đòn chính | — |

### 4.3. U Minh

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Thôn Thiên Ma Công | 100% P | 1 | Hút máu 50% HP thật lấy được | — | — |
| Huyết Sát Quyết | 170% P | 1 | — | Chảy máu 20% P/lượt, 2 lượt tiếp theo | Hiến 15% HP tối đa từ HP hiện tại, phải còn HP sau trả |
| Minh Hà Huyết Chú | 65% P | 1 | — | Chảy máu 35% P/lượt, 3 lượt tiếp theo | — |
| Tàn Mệnh Chỉ | 100% P | 1 | Xuyên Phòng thủ 30% | Thêm tối đa 130% P theo tỷ lệ HP người chơi đã mất; không thực đạt trần 230% P khi còn sống | — |
| Huyết Hải Phần Thiên | 160% P | 1 | Hút máu 35% đòn trực tiếp | Chảy máu 45% P/lượt, 3 lượt tiếp theo | Giảm 12% HP tối đa cho phần còn lại của trận |

### 4.4. Thái Hư

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Thái Hư Bộ | 65% P | 1 | — | Tạo/giữ 1 Hư Ảnh; Giảm thương 35% lượt này | — |
| Hư Không Tạng | 45% P | 1 | — | Hồi 50% P nếu có Hư Ảnh trước thi triển; sau đó tạo/giữ Hư Ảnh | — |
| Không Minh Trảm | 80% P | 1 | Xuyên Phòng thủ 20% đòn chính | Có Hư Ảnh: thêm 1 đòn 130% P, xuyên 70% | Tiêu Hư Ảnh nếu có |
| Hoán Hình Thuật | 60% P | 1 | — | Có Hư Ảnh: né đúng 1 đòn boss ở phản công lượt này | Tiêu Hư Ảnh nếu có |
| Vạn Pháp Quy Hư | 100% P | 1 | — | Giải trừ Khiên/Tăng sát thương/Giảm thương boss; Giảm Phòng thủ 25% P; tạo/giữ Hư Ảnh; Giảm thương 25% lượt này | — |

Giải trừ không xóa Giáp Ảo hoặc hồi sinh. Né một đòn không né cả combo.

### 4.5. Thiên Cơ

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Quan Thiên Chỉ | 65% P | 1 | — | Xem trước thêm 2 hành động boss | — |
| Lạc Tử Ấn | 60% P | 1 | — | Dấu ấn 140% P nổ sau 2 lượt, xuyên 20% | — |
| Dẫn Kiếp Chỉ | 60% P | 1 | — | Đòn thêm theo 35% sát thương thô boss đã báo, trần hệ số 120% P; Giảm thương tối đa 30% lượt này | — |
| Thất Tinh Sát | 80% P | 1 | — | Tiêu tối đa 2 dấu ấn; một đòn thêm 70% P × số ấn; ấn đã tiêu không nổ lại | Tiêu các ấn dùng cho đòn thêm |
| Nghịch Thiên Kỳ | 110% P | 1 | — | Đổi hành động boss lượt này và lượt kế; không có lượt kế thì không đổi | — |

Đòn chuyển lực qua strike có thể nhận buff Tăng sát thương; phần trần trên là trước buff đó.

### 4.6. Cấm thuật

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Nghịch Mệnh Hoán Sinh | 55% P | 1 | — | Bị hạ ngay lượt đã thi triển thì mở lựa chọn cứu; không tự cứu/trả giá | Cứu bằng 1 cảnh giới nếu chọn; chung quyền với Hộ Mệnh |
| Thâu Thiên Hoán Mệnh | 60% P | 1 | Hút máu 70% đòn chính | Đòn thêm 12% HP tối đa boss, trần 180% P, xuyên 60%; đòn thêm này không hút máu | Giảm 15% HP tối đa trong trận |
| Táng Nhật Nhất Kích | 340% P | 1 | Xuyên Phòng thủ 70% | Boss còn sống vẫn phản công | Sau thi triển chỉ còn 1 HP, kể cả khi thắng |
| Đồng Mệnh Huyết Khế | 70% P | 1 | — | Phản thương 90% HP thật đã mất, 2 lượt | Hiến 10% HP tối đa từ HP hiện tại |
| Cửu U Đoạt Hồn | 70% P | 1 | — | Sao chép tổng sát thương thô hành động boss trước thành 1 đòn, trần 150% P, xuyên 30% | — |
| Thiên Táng Phong Thần | 65% P | 1 | — | Niêm phong 2 lượt; boss dùng đòn thường thay tuyệt kỹ; hồi chiêu 3 lượt | Giảm 18% HP tối đa trong trận |
| Tam Nhật Đoạn Mệnh | 55% P | 1 | — | Dấu ấn 330% P sau 3 lượt, xuyên 20%; chỉ một dấu của môn này tồn tại | Hiến 10% HP tối đa từ HP hiện tại |
| Nghịch Luân Chuyển Sinh | 80% P | 1 | — | Giảm Phòng thủ bằng lượng boss vừa tăng ở hành động trước, trần 70% P; giải trừ Tăng sát thương boss | — |

### 4.7. Ngoài phái

| Công pháp | Sát thương mỗi đòn chính | Số đòn chính | Đặc tính đòn | Hiệu ứng / điều kiện | Cái giá |
| --- | --- | ---: | --- | --- | --- |
| Vô Môn Dịch Kinh | 75% P | 1 | — | Được đổi 1 ô công pháp ở ngày giao chiến sau trước chọn chiêu; giữ trạng thái/quyền cứu | — |
| Sơn Hà Hộ Kiếm | 50% P | 1 | — | Giáp Ảo 120% P trong 2 lượt; giảm 40% khi còn ở đầu đòn; tạo Sơn Ấn | — |
| Huyết Triều Khai Kiếm | 80% P | 1 | — | Đòn thêm 8% HP tối đa boss, trần 140% P, xuyên 60%; Chảy máu 20% P ×2 lượt tiếp theo; tạo Huyết Ấn | — |
| Chấn Kiếp Kiếm Thức | 70% P | 1 | — | Chuyển lực 45% sát thương boss đã báo, trần hệ số 140% P; Giảm thương tối đa 30% lượt này; tạo Kiếp Ấn | — |
| Vạn Cổ Kiếm Âm | 65% P | 1 | — | Tái hiện 60% sát thương thô đã gây trong lượt này vào lượt sau, trần 120% P; Hồi phục 45% P; tạo Cổ Ấn | — |
| Tứ Ấn Vấn Thiên | 105% P | 1 | Xuyên Phòng thủ 35% đòn chính | Đủ 4 ấn: thêm 1 đòn 380% P, xuyên 70%, một lần/trận | Tiêu đủ 4 ấn khác nhau |

Võ Kỹ là chiêu nền ngoài 39 môn: 100% Công × đóng góp ngày, 1 đòn, không xuyên Phòng thủ, không hiệu ứng/cái giá, không dùng tầng/thuần khiết của một môn khác.

## 5. Giới hạn cộng dồn và thời hạn

- Mỗi loại trạng thái trên mỗi đối tượng có tối đa **2 nguồn**. Dùng lại cùng chiêu sẽ thay/làm mới nguồn của chiêu đó; nguồn thứ ba cùng loại thay nguồn cũ nhất.
- Cương Kình tối đa 3; chỉ một Hư Ảnh; bốn ấn phải khác loại. Cương Kình/Hư Ảnh/bốn ấn giữ trong trận đến khi tiêu, không tự hết sau một ngày chờ.
- Tăng công trần +60%; giảm thương trần +70%, tăng sát thương nhận tối đa +50%; tổng phản thương trần 100% HP thật bị mất.
- Mỗi khiên/Giáp Ảo sinh bởi chiêu có trần 65% HP tối đa. Đây là trần **từng nguồn**, không phải trần tổng tất cả các lớp bảo vệ.
- Buff “2 lượt” thông thường gồm lượt thi triển và lượt giao chiến kế tiếp. Chảy máu “2 lượt tiếp theo” bắt đầu từ lượt sau; dấu ấn có lượt nổ cụ thể.
- Hồi HP không vượt HP tối đa hiện tại. Né một đòn không mặc nhiên né cả combo.
- Phong Thần dùng lại sớm nhất sau 3 lượt: nếu dùng ở lượt 1 thì sớm nhất lượt 4. Boss vẫn có một nhịp không bị niêm phong giữa hai lần.
- Echo và phản thương không tạo vòng phản/echo vô hạn. Đòn trễ đã giết boss thật thì chiêu mới không được thi triển và không trả giá.

## 6. Boss và luồng đánh hiện tại

### 6.1. Chuẩn bị

1. Chọn boss đã mở; một số thử thách yêu cầu chiến thắng trước đó và công pháp đã học.
2. Mang tối đa 5 công pháp khác nhau, chọn một bản đã đạt ít nhất tầng 1 cho từng môn. Võ Kỹ luôn là lựa chọn đánh nền riêng.
3. Chốt rank, HP/công/phòng thủ, tầng/thuần khiết của từng bản và nguồn task. Trận có hiệu lực từ **ngày sinh hoạt kế tiếp**.
4. Trước khi bắt đầu có thể chỉnh bộ công pháp hoặc hủy chuẩn bị. Những thay đổi bản luyện/cảnh giới bên ngoài sau đó không tự tăng sức mạnh snapshot.

### 6.2. Mỗi ngày giao chiến

1. Xem hành động boss đã báo, HP hai bên và hiệu ứng đang tồn tại.
2. Chọn 1 chiêu; có thể đổi trong ngày, server dùng lựa chọn cuối. Chiêu có giá phải chấp nhận giá rõ ràng.
3. Habit/task được kết toán theo nguồn hợp lệ khi ngày sinh hoạt kết thúc. `/ngu` không chốt lượt chiến đấu.
4. Engine xử lý đòn trễ/chảy máu đến hạn trước, sau đó trả giá chiêu mới và thực hiện các hiệu ứng theo thứ tự catalog.
5. Boss còn sống thì phản công từng đòn. Sau phản công còn sống, boss có thể hồi HP/tăng phòng thủ nếu intent có các hiệu ứng đó.
6. Ghi kết quả và quyền học/thành tựu theo một giao dịch, không cho nhận lại nhờ gửi lặp.

Sát thương thô boss = công boss × từng hệ số đòn trong pattern. Không nhân với tầng/thuần khiết/habit của người chơi. Engine hiện xác định kết quả theo số liệu; chưa có chí mạng ngẫu nhiên, né ngẫu nhiên, hệ nguyên tố hoặc tốc độ đánh thời gian thực.

### 6.3. Đọc chiêu lặp

Trừ bốn trận chính mở đầu chương 1, boss ở nội dung mới có thế đọc chiêu:

| Chương | Thi triển cùng chiêu như lượt trước |
| --- | --- |
| 1–3 | Giảm 65% mọi sát thương người chơi gây ra trong lượt đó |
| 4–9 | Giảm 75% |
| 10 trở đi | Giảm 85% |

Đổi chiêu phá thế đọc. Bao gồm sát thương trễ, chảy máu và phản thương; không giảm hiệu quả hồi/thủ hoặc giá phải trả. Thế đọc đã chốt trước khi Nghịch Thiên đổi intent. Snapshot cũ không có thuộc tính này giữ luật cũ.

### 6.4. Thắng, chờ, cứu và thua

- Boss chết thật trước khi phản công thì người chơi không nhận phản công. Boss có hồi sinh thì kiểm số lần/HP hồi đã công bố; có thể tiếp tục nhận các đòn còn lại.
- Đồng quy do phản thương không tự tính thắng khi HP người chơi bằng 0. Cứu thành công và boss thực sự đã chết mới ghi thắng.
- Không chọn chiêu: trận chờ, boss không tự đánh. Ba ngày sinh hoạt liên tiếp không chọn: rút an toàn. Habit/cam kết tuần vẫn được đánh giá như thường.
- Mỗi boss có giới hạn lượt giao chiến; hết lượt mà chưa thắng thì trận hết hạn. Số lượt không giảm ở ngày chờ.
- HP về 0 lần đầu: có hai ngày sinh hoạt kế tiếp để quyết định cứu. Một quyền cứu chung trong toàn trận; bị hạ lần nữa sau cứu là tử trận.

| Lựa chọn | Kết quả và giá |
| --- | --- |
| Hộ Mệnh | Hồi 35% HP tối đa hiện tại; tiêu Tu Vi bằng `max(5, min(100, ceil(8% ngưỡng Tu Vi rank snapshot)))`. |
| Nghịch Mệnh | Phải mang và đã thi triển ở lượt bị hạ; hy sinh 1 cảnh giới đang có, không trả thêm Tu Vi; giảm nền chiến đấu nếu rank mới thấp hơn snapshot, giữ tỷ lệ HP đã hiến; hồi 35%; khóa tái đột phá 3 ngày. |
| Tử trận | Mất `min(Tu Vi đang có, 60, max(5, ceil(8% Tu Vi đang có)))`; không tự hạ cảnh giới hoặc tiêu vật phẩm. |

Cứu không chạy tiếp những đòn boss còn lại ở lượt đã bị hạ. Thắng mở quyền học theo boss và thành tựu; không tự tặng một bản công pháp ở tầng cao. Trận mới không tặng Thần binh. Từ ngày sau khi trận kết thúc, trở lại bản luyện trước đó nếu còn có thể luyện, hoặc nghỉ; đóng góp của ngày giao chiến không được dùng thêm một lần để luyện.


## 7. Kiểm kê boss theo cùng trường thông tin

HP / Công / Phòng thủ là chỉ số bắt đầu; số đòn liệt kê các kiểu chuỗi có trong pattern. Hiệu ứng ở cột cuối chỉ xảy ra tại hành động tương ứng, không phải mọi lượt.

Tăng Phòng thủ sau phản công có trần floor(70% Công boss). Hồi phục cũng sau phản công, chỉ nếu trận còn active; không tự hồi khi boss chết thật. Hồi sinh kiểm tại HP về 0 với số lần/HP đã công bố.

| Boss (ID) | Chương | HP / Công / Phòng thủ | Số đòn trong các chiêu | Lượt tối đa | Hiệu ứng / nội tại hiện có |
| --- | ---: | --- | --- | ---: | --- |
| Người Truy Lệnh (truy-lenh) | 1 | 95 / 12 / 0 | 1 | 4 | Đòn trực tiếp |
| Song Nha Canh Lộ (song-nha) | 1 | 130 / 9 / 1 | 1, 2 | 5 | Đòn trực tiếp |
| Thư Lệnh Không Mặt (thu-lenh) | 1 | 175 / 12 / 0 | 1 | 6 | Hồi 10 HP ở nhịp hồi |
| Thiết Lệnh Sứ (thiet-lenh-su) | 1 | 240 / 16 / 4 | 1, 2 | 7 | Tăng Phòng thủ +2 ở nhịp tăng |
| Người Giữ Kiếm Trầm (kiem-truyen) | 1 | 390 / 24 / 8 | 1, 3 | 7 | Đọc chiêu lặp −65% |
| Kỷ Hành · tỷ thí (ky-hanh-1) | 2 | 290 / 21 / 4 | 1, 2 | 7 | Tăng Phòng thủ +2 ở nhịp tăng; Đọc chiêu lặp −65% |
| Huyết Hà Đạo Nhân (huyet-ha) | 3 | 390 / 26 / 3 | 1, 3 | 8 | Hồi 18 HP ở nhịp hồi; Đọc chiêu lặp −65% |
| Tạ Trường Sinh (truong-sinh) | 4 | 430 / 27 / 5 | 1, 2 | 9 | Hồi 10 HP ở nhịp hồi; Hồi sinh 1 lần, 35% HP; Đọc chiêu lặp −75% |
| Thiên Kiêu Khôi Lỗi (khoi-loi-dai-hoi) | 5 | 590 / 34 / 7 | 1, 3 | 9 | Hồi 20 HP ở nhịp hồi; Tăng Phòng thủ +3 ở nhịp tăng; Đọc chiêu lặp −75% |
| Vô Ảnh Sát Chủ (vo-anh) | 6 | 610 / 39 / 3 | 1, 2 | 10 | Đọc chiêu lặp −75% |
| Thủ Mộ Nhân (thu-mo) | 7 | 690 / 42 / 14 | 1, 2, 3 | 10 | Tăng Phòng thủ +3 ở nhịp tăng; Đọc chiêu lặp −75% |
| La Sát Nữ Đế (la-sat) | 8 | 740 / 45 / 6 | 1, 2 | 10 | Hồi 20 HP ở nhịp hồi; Đọc chiêu lặp −75% |
| Thiên Luật Chấp Kiếm Sứ (thien-luat) | 9 | 900 / 49 / 12 | 1, 3 | 11 | Tăng Phòng thủ +4 ở nhịp tăng; Đọc chiêu lặp −75% |
| Kỷ Hành · phản đạo (ky-hanh-2) | 10 | 910 / 53 / 7 | 1, 4 | 11 | Đọc chiêu lặp −85% |
| Thần Tướng Thạch Trụ (tru-thach) | 11 | 930 / 46 / 21 | 1 | 11 | Tăng Phòng thủ +3 ở nhịp tăng; Đọc chiêu lặp −85% |
| Thần Tướng Thủy Trụ (tru-thuy) | 11 | 880 / 48 / 6 | 1, 2 | 11 | Hồi 35 HP ở nhịp hồi; Đọc chiêu lặp −85% |
| Thần Tướng Âm Trụ (tru-am) | 11 | 1050 / 52 / 8 | 1, 2, 5 | 12 | Đọc chiêu lặp −85% |
| Vạn Pháp Thần Khôi (van-phap-khoi) | 12 | 1180 / 57 / 11 | 1, 2 | 12 | Hồi 30 HP ở nhịp hồi; Tăng Phòng thủ +4 ở nhịp tăng; Đọc chiêu lặp −85% |
| Kỷ Hành · phá Thiên Môn (ky-hanh-3) | 13 | 1120 / 61 / 9 | 1, 2, 3 | 12 | Tăng Phòng thủ +2 ở nhịp tăng; Đọc chiêu lặp −85% |
| Thần Chiến Vương (than-chien-vuong) | 14 | 1240 / 63 / 16 | 1, 4 | 14 | Tăng Phòng thủ +3 ở nhịp tăng; Hồi sinh 1 lần, 25% HP; Đọc chiêu lặp −85% |
| Thiên Mệnh Thần Sổ (than-so) | 15 | 1280 / 60 / 17 | 1, 2 | 13 | Hồi 35 HP ở nhịp hồi; Tăng Phòng thủ +3 ở nhịp tăng; Đọc chiêu lặp −85% |
| Thiên Mệnh Thần Thể (than-the) | 15 | 1450 / 65 / 14 | 1, 5 | 14 | Tăng Phòng thủ +4 ở nhịp tăng; Đọc chiêu lặp −85% |
| Thiên Mệnh Thần Chủ (than-chu) | 15 | 1500 / 67 / 13 | 1, 4 | 15 | Hồi 25 HP ở nhịp hồi; Hồi sinh 1 lần, 20% HP; Đọc chiêu lặp −85% |
| Người Giữ Cương Kình (thach-truyen) | 2 | 410 / 26 / 7 | 1, 3 | 8 | Đọc chiêu lặp −65% |
| Người Giữ Huyết Khế (huyet-truyen) | 3 | 450 / 25 / 4 | 1, 2 | 8 | Hồi 16 HP ở nhịp hồi; Đọc chiêu lặp −65% |
| Người Giữ Hư Ảnh (hu-truyen) | 2 | 400 / 30 / 3 | 1, 2 | 8 | Đọc chiêu lặp −65% |
| Người Giữ Thiên Bàn (co-truyen) | 3 | 460 / 28 / 5 | 1, 2 | 8 | Đọc chiêu lặp −65% |
| Người Đoạt Huyết (cam-thau-thien) | 5 | 620 / 31 / 4 | 1, 3 | 9 | Hồi 28 HP ở nhịp hồi; Đọc chiêu lặp −75% |
| Người Giữ Nhật Tàn (cam-tang-nhat) | 6 | 640 / 40 / 2 | 1 | 9 | Đọc chiêu lặp −75% |
| Người Giữ Song Khế (cam-dong-menh) | 5 | 610 / 35 / 5 | 1, 2 | 9 | Đọc chiêu lặp −75% |
| Người Giữ Dấu Hồn (cam-cuu-u) | 7 | 760 / 42 / 6 | 1, 3 | 10 | Đọc chiêu lặp −75% |
| Người Giữ Niêm Ấn (cam-phong-than) | 8 | 800 / 44 / 8 | 1 | 10 | Đọc chiêu lặp −75% |
| Người Giữ Tử Ấn (cam-tam-nhat) | 8 | 820 / 43 / 10 | 1, 2 | 11 | Tăng Phòng thủ +2 ở nhịp tăng; Đọc chiêu lặp −75% |
| Người Giữ Luân Khuyết (cam-nghich-luan) | 9 | 930 / 48 / 12 | 1 | 11 | Hồi 30 HP ở nhịp hồi; Tăng Phòng thủ +5 ở nhịp tăng; Đọc chiêu lặp −75% |
| Khách Không Môn (di-san-vo-mon) | 5 | 570 / 33 / 5 | 1, 3 | 9 | Đọc chiêu lặp −75% |
| Người Giữ Sơn Hà (di-san-son-ha) | 7 | 710 / 40 / 8 | 1, 4 | 10 | Đọc chiêu lặp −75% |
| Người Giữ Huyết Triều (di-san-huyet-trieu) | 8 | 760 / 43 / 6 | 1, 2 | 10 | Hồi 20 HP ở nhịp hồi; Đọc chiêu lặp −75% |
| Người Giữ Kiếp Thanh (di-san-kiep-dong) | 9 | 890 / 50 / 7 | 1, 2 | 11 | Đọc chiêu lặp −75% |
| Người Giữ Kiếm Âm (di-san-van-co) | 10 | 900 / 47 / 10 | 1, 2 | 11 | Tăng Phòng thủ +2 ở nhịp tăng; Đọc chiêu lặp −85% |
| Người Giữ Tứ Ấn (di-san-van-thien) | 11 | 1060 / 51 / 11 | 1, 2, 3 | 12 | Đọc chiêu lặp −85% |

Mỗi hành động có tên, hệ số từng đòn, cờ tuyệt kỹ, lượng Hồi phục và Tăng Phòng thủ. Chiêu nhiều đòn có thể gây lượng khác nhau giữa từng đòn; phải dùng danh sách đòn thay vì một trung bình nếu khác nhau.

Boss hiện **không chủ động tạo** Khiên, Giáp Ảo, Chảy máu, Hút máu, Chí mạng hoặc Xuyên Giáp Ảo trong các pattern này. Engine có một số handler chung để giải trừ/chặn các trạng thái không có nghĩa catalog boss đang dùng chúng. Không thêm các nhãn đó vào hồ sơ boss nếu dữ liệu không có.

## 8. Luyện hiện tại và điểm khác phương án mới

- Tầng dùng chi phí 3/6/10/15 **đơn vị nỗ lực**, không phải số ngày cố định. Một ngày có success nhận 1–1,6 đơn vị theo nguồn trưởng thành.
- Đủ nỗ lực và hết audit mới khóa tầng. Ngày không đạt không tăng tiến độ, nhưng thiếu vẫn tích lũy.
- Chất lượng q = min(trần tầng trước, max(1%, (S/(S+2M))^(1+0,35×(tầng−1)))); S/M tích lũy trong bản, không phải tỷ lệ habit riêng của kỳ.
- Tầng đã khóa bất biến; muốn cải thiện cần luyện lại.
- Trong chiến đấu engine nhân hệ số tầng với chất lượng **tầng cuối** lên lực P. Khiên/hồi và lượng tác dụng tính từ P cũng bị ảnh hưởng.
- Tỷ lệ xuyên, hút máu, giảm thương, số đòn/thời hạn và tác dụng riêng của từng môn hiện cố định ở cả bốn tầng.
- Chưa có nội tại tự chạy chỉ vì mang công pháp. Kiếm Ý hiện không tăng chiêu Thiên Kiếm tiếp theo; Huyền Quy chưa tự tạo Khiên khi HP thấp; Thôn Thiên chưa có phần hút thêm theo ngưỡng HP.

Người dùng vừa chọn lên tầng theo thời gian và cộng phần tăng sát thương theo habit; vì vậy **không thể chỉ sửa câu chữ hoặc nhân thêm Q vào P hiện tại**. Cần rule mới cho bản luyện và chiến đấu, dữ liệu dẫn xuất nhất quán, snapshot và cân bằng mới. Trận/bản lịch sử giữ luật cũ.

## 9. Giới hạn của bằng chứng

Đây là kiểm kê cấu trúc/content và đối chiếu source, không phải nghiệm thu hình ảnh, UI hoặc xác nhận cân bằng luật mới. Báo cáo mô phỏng practice-v1/battle-v1 cũ không chứng minh phương án lên tầng theo số ngày đã cân bằng.

Phần triển khai v2 cần đối chiếu thêm `practice-progression.ts` và `technique-profile.ts`: tách R/q, lực sát thương D/lực hỗ trợ F, các tỷ lệ theo tầng, thưởng danh hiệu và ba tác dụng mới. Hồ sơ/nâng cấp trên UI phải do hàm production dẫn xuất; không sao chép các bảng số v1 ở đây rồi đổi tên thành v2. Buff ngày, kinh tế và defense order được giữ theo hợp đồng; vẫn phải kiểm hồi quy trên đường chạy mới.
