# Linh thú v2 — đặc tả cân bằng và cơ chế tự động

Ngày lập: **22/10/2026, Asia/Saigon**.

**Trạng thái: hợp đồng v2 đã được triển khai local.** Bằng chứng nằm trong [hồ sơ kiểm chứng](LINH_THU_V2_VERIFICATION.md), cách chạy/migration ở [vận hành v2](LINH_THU_V2_OPERATIONS.md). Tài liệu đặc tả không phải bằng chứng phát hành remote.

Đầu vào liên quan: [Kế hoạch và nghiệm thu](LINH_THU_V2_IMPLEMENTATION.md) · [Lệnh goal](LINH_THU_V2_GOAL.md).

## 1. Thẩm quyền và cách đọc

Bản này kết tinh cân bằng 18 loài và các xác nhận cuối cùng của người dùng ngày 22/10/2026. Agent không cần đọc lại chat/attachments để hiểu thông số.

- **CHỐT:** thông số và cơ chế người dùng đã xác nhận; không tự cân bằng lại.
- **MẶC ĐỊNH ĐƯỢC ỦY QUYỀN:** cách giải quyết trường hợp biên để agent không hỏi lại. Được thay bằng giải pháp có căn cứ, ghi khác biệt/lý do/test trong decision log; không âm thầm thay thông số CHỐT.
- **ĐỀ XUẤT KỸ THUẬT:** hướng cấu trúc trong tài liệu triển khai; được điều chỉnh theo repo thực tế.

Ưu tiên: chỉ dẫn người dùng mới hơn → phần CHỐT v2 → các mặc định có ghi nhận quyết định → hướng dẫn kỹ thuật hiện hành. Code và bảng kỹ năng v1 dùng khảo sát/tương thích, không phủ định mục tiêu v2. Luật ngoài phạm vi giữ theo source/tài liệu hiện hành.

## 2. Thuật ngữ và phạm vi CHỐT

| Thuật ngữ               | Nghĩa                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| TV                      | Tu vi, số nguyên; không phải điểm luyện linh thú                       |
| VQ                      | Vé quay thường                                                         |
| VTH                     | Vé triệu hồi linh thú                                                  |
| Phá Cảnh Phù            | Ghi đầy đủ sơ cấp/trung cấp/cao cấp/cực phẩm theo tier hiện có         |
| Hộ Tâm Phù / An Tâm Phù | Hai vật phẩm bảo hộ riêng; không gọi chung là “phù” trong mô tả thưởng |
| 95%                     | Luyện đầy T4 và độ thuần cuối >=95% → Thức tỉnh                        |
| 100%                    | Luyện đầy T4 và độ thuần cuối 100% → Hoàn mỹ, vẫn giữ Thức tỉnh        |

Skill tự phát động khi đủ điều kiện và đang đồng hành có hiệu lực. Bỏ hạn mức tuyệt kỹ chung một lần/tuần, bấm kích hoạt, chọn task và giao ước v1 cho sự kiện v2. “Tự động” không có nghĩa tự tiêu vé, ghép phù, đột phá hoặc chọn thẻ thay người dùng.

Giữ ID loài, rank, tên hình thái, ảnh, công thức luyện/xám/độ thuần, ngưỡng tiến hóa, chi phí và bảo hiểm triệu hồi, đổi vé, hiến tế, số lượt tháp ngoài thay đổi skill ghi rõ. Không khôi phục hệ chiến đấu/Thần Lộ đã gỡ.

| Rank | Lên T2 | Lên T3 | Lên T4 | Luyện đầy |
| ---- | -----: | -----: | -----: | --------: |
| R    |     10 |     25 |     40 |        60 |
| SR   |     15 |     35 |     55 |        80 |
| SSR  |     20 |     50 |     80 |       120 |
| UR   |     30 |     70 |    110 |       160 |

Bảng dùng điểm hiển thị; lưu trữ hiện dùng một phần mười. Vào T4 chưa phải luyện đầy. Xét độ thuần bằng số gốc, không phần trăm hiển thị đã làm tròn.

## 3. Điều kiện chung

### 3.1 CHỐT

- Task hợp lệ là công việc chính hoàn thành hợp lệ lần đầu theo luật thưởng. Bước nhỏ, bật lại/hoàn thành lại task đã tính không tạo lượt mới.
- Đủ thói quen là hoàn thành nghĩa vụ đến hạn. Không đến hạn/nghỉ hợp lệ/quota tuần còn linh hoạt không phải miss.
- Ngày kết hợp = đủ thói quen và ngủ đúng giờ; không cần task nếu skill không ghi thêm.
- Ngày hoàn hảo = đủ thói quen + ngủ đúng giờ + ít nhất một task hợp lệ trong cùng ngày sinh hoạt.
- “Ngủ đủ” của Mộng Nấm nghĩa là ngủ đúng giờ, không xét thời lượng.
- Habit quota tuần xét theo kết quả ngày; không hồi tố biến ngày nghỉ hợp lệ thành miss chỉ vì cuối tuần thiếu quota.
- Liên tiếp: ngày thiếu điều kiện làm reset; tích lũy: không cần liên tiếp, giữ tiến độ dư.
- Skill thưởng/xét thưởng xong reset mốc. Ngoại lệ Huyễn Sắc x10 chỉ reset khi trúng.
- Counter chu kỳ và chuỗi ngủ dùng tính lượng thưởng tách riêng; trả thưởng không xóa chuỗi ngủ.
- Skill độc lập có thể cùng thưởng. Hai thiên phú xác suất xét độc lập, trừ buff xác suất được ghi rõ.
- Hoàn TV không vượt thực mất; không cộng nhiều khoản hoàn vượt thiệt hại.

### 3.2 MẶC ĐỊNH ĐƯỢC ỦY QUYỀN D-01 — giới hạn

Người dùng chưa yêu cầu bỏ trần cho toàn bộ thiên phú. Cách giữ phần cũ chưa sửa:

| Nhóm                                | Giới hạn                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Thiên phú task T1–T4 giữ lại        | Xét 5 task hợp lệ đầu/ngày: Tụ Từ, Tinh Tài, Dư Hỏa, Lan Liêm Truy Tài, Lôi Tài/Lôi Tức, Liệp Hỏa/Truy Tài |
| Mốc task thứ 3 của Lộc/Thỏ/Hỏa Miêu | Một lần/ngày                                                                                               |
| Lan Liêm 95%                        | Một lần/ngày, đủ 3 task trước 12:00                                                                        |
| Linh Thỏ 100%                       | Một lần/ngày tại task thứ 8                                                                                |
| Hỏa Miêu 100%, Lôi Vương 95%        | Mọi task theo mốc, không trần 5 task                                                                       |
| Kiên Tâm đạt 2 task                 | Xét thưởng và tạo buff một lần/ngày                                                                        |
| Buff task ngày sau Linh Hầu         | Mọi task hợp lệ trong ngày hiệu lực                                                                        |
| Khuyển 95%                          | Mọi task hợp lệ, mỗi đủ 10 xét một lần, không thêm trần ngày                                               |
| Huyễn Sắc 95%                       | Mỗi giao dịch x10 trả đủ vé xét một lần, không trần 10 draw/ngày                                           |

Tổng task và nguồn giao dịch phải ghi độc lập với cap trả thưởng từng skill. Không return sớm chung ở task 6/draw 11. Không gộp mười giao dịch quay đơn thành một giao dịch x10.

### 3.3 MẶC ĐỊNH ĐƯỢC ỦY QUYỀN — thời gian/vòng đời

| ID   | Quyết định mặc định                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-02 | Dùng ngày sinh hoạt server, không tự đổi sang ngày 00:00. Giờ skill theo Asia/Saigon thực tế; sáng là [05:00,08:00), trước trưa là <12:00.                                                                                                                                                                                     |
| D-03 | Chuỗi skill dựa trên đêm thực sự báo đúng giờ. Phù giữ chuỗi nền không biến ngủ muộn thành ngủ đúng giờ. Giữ cơ chế bảo hộ nền và tách chuỗi skill nếu cần.                                                                                                                                                                    |
| D-04 | Counter gắn owner/cá thể/lượt luyện/skill/version phù hợp; chỉ đếm khi đã mở và đang đồng hành. Rời đồng hành gián đoạn counter liên tiếp, giữ counter tích lũy; luyện lại tạo trạng thái mới, không xóa dấu vết thưởng để nhận lại.                                                                                           |
| D-05 | Chuỗi ngủ tài khoản có thể dài hơn thời gian đồng hành. Chu kỳ skill vẫn phải đếm đủ sau khi mở/có hiệu lực. Ví dụ bắt đầu Dương Hoàn mỹ khi S=20, sau 3 đêm hợp lệ nhận 23 TV, không trả các mốc cũ.                                                                                                                          |
| D-06 | Ngày chưa đủ dữ liệu là pending; backlog phải giữ thứ tự chuỗi gốc và nhận diện ngày trống. Không habit active: mặc định nghĩa vụ habit của ngày hoàn hảo được đáp ứng nhưng không tự cấp thiên phú “ngày đủ thói quen”. Có habit active nhưng đều nghỉ hợp lệ: phần habit được đáp ứng. All-neutral vẫn không tạo điểm luyện. |
| D-07 | Buff Kiên Tâm tồn tại đúng ngày sinh hoạt kế tiếp, có nguồn và thời hạn; không chồng cùng nguồn. Đổi đồng hành không xóa buff đã cấp. Luyện lại/hiến tế phải giữ provenance quyền lợi đã cấp, không tái cấp.                                                                                                                   |
| D-08 | Ưu tiên quyết toán skill phụ thuộc ngủ sau cửa sổ undo hoặc lúc ngày đóng. Nếu dùng bút toán bù phải đảo đủ reward/counter và chống roll lại; không khóa undo để né tích hợp.                                                                                                                                                  |
| D-09 | Multiplier chốt đầu ngày theo đồng hành và chuỗi đã xác nhận. Đạt S=30 trong ngày thì nhân ba toàn ngày từ ngày sinh hoạt kế tiếp nếu còn đủ điều kiện; không hồi tố nửa ngày. Ngày có multiplier vẫn nhân phạt dù cuối ngày đứt chuỗi.                                                                                        |
| D-10 | Tự thiêu là phạt TV, số dư >=0. Không tự thêm luật tụt cảnh giới do tự thiêu; giữ luật tụt do ngủ nền trên kết quả phạt đúng. Không trừ lại do GET/retry/đổi role.                                                                                                                                                             |
| D-11 | Dùng snapshot role/form/mở skill của sự kiện gốc, không ngày chạy backlog. Chỉ nguồn phát sinh sau khi mở mới hợp lệ; nguồn ngày tổng hợp phát sinh lúc chốt ngày. Không phát lại ngày đã xử lý.                                                                                                                               |

Những dòng này là quyết định bổ sung được phép tự xử lý, không được trình bày thành tất cả đều do người dùng chốt trực tiếp.

## 4. Danh mục 18 loài — CHỐT

Các giai đoạn sau giữ skill đã mở. Tỷ lệ của giai đoạn là mức thay thế, không cộng xác suất với giai đoạn trước. “Và” nghĩa là nhận đồng thời, không chọn một trong hai.

### R01 — Nghi Lễ Kim Trùng (`humbug`)

Chuyên kiếm Phá Cảnh Phù từ habit và tăng sản lượng ghép phù.

| Mốc  | Hình thái           | Skill và tác dụng                                                                                                                                                         |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Kim Trùng      | **Phù Ấn:** ngày đủ thói quen, 25% nhận 1 Phá Cảnh Phù sơ cấp.                                                                                                            |
| T2   | Khiêm Tâm Giáp      | **Phù Ấn:** 50% nhận 1 Phá Cảnh Phù sơ cấp.                                                                                                                               |
| T3   | Thiền Tâm Kim Trùng | **Phù Ấn:** 75% nhận 1 Phá Cảnh Phù sơ cấp.                                                                                                                               |
| T4   | Nghi Lễ Kim Trùng   | **Phù Ấn:** 100% nhận 1 Phá Cảnh Phù sơ cấp.                                                                                                                              |
| 95%  | T4 · Thức tỉnh      | **Tam Nhật Kết Ấn:** cứ tích lũy 3 ngày đủ thói quen nhận 1 Phá Cảnh Phù trung cấp; giữ tiến độ dư.                                                                       |
| 100% | T4 · Hoàn mỹ        | **Luyện Phù Song Sinh:** tối đa 3 lần ghép sơ cấp → trung cấp/ngày được tăng lợi ích. Thành công nhận tổng 2 Phá Cảnh Phù trung cấp; thất bại hoàn 1 Phá Cảnh Phù sơ cấp. |

Giữ yêu cầu đủ 3 phù đầu vào, tỷ lệ ghép 80% và mức tiêu hao gốc. Một lần thử hợp lệ dùng một lượt; ngày mới hồi 3. Không tự ghép. Luật gốc thất bại tiêu 1 phù thì skill hoàn 1, chi phí ròng bằng 0; không biến khoản hoàn thành thưởng.

### R02 — Thời Mộng Linh Cú (`hootlet`)

Chuỗi ngủ ngắn kiếm vé, chuỗi dài có cơ hội nhận Hộ Tâm Phù.

| Mốc  | Hình thái         | Skill và tác dụng                                                                                           |
| ---- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Dạ Cú        | **Dạ Tức:** ngủ đúng giờ, 25% thêm 1 TV.                                                                    |
| T2   | Thời Khắc Cú      | **Dạ Tức:** 50% thêm 1 TV.                                                                                  |
| T3   | Thời Luân Linh Cú | **Dạ Tức:** 75% thêm 1 TV.                                                                                  |
| T4   | Thời Mộng Linh Cú | **Dạ Tức:** 100% thêm 1 TV.                                                                                 |
| 95%  | T4 · Thức tỉnh    | **Tam Dạ Hộ Tâm:** 3 đêm đúng giờ liên tiếp → 3 VQ; thưởng rồi reset mốc.                                   |
| 100% | T4 · Hoàn mỹ      | **Đêm Đứng Yên:** 14 đêm đúng giờ liên tiếp → xét 40% nhận 1 Hộ Tâm Phù; xét xong reset dù trúng hay không. |

Hai counter độc lập, không hạn mức tuần. Đêm trả Hoàn mỹ vẫn xét các skill khác nếu cùng đủ điều kiện.

### R03 — Cổ Thạch Linh Quy (`gibber`)

Hoàn TV khi đột phá thất bại, bảo hộ lần thử sau ba thất bại liên tiếp.

| Mốc  | Hình thái          | Skill và tác dụng                                                                                                                             |
| ---- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Thạch Quy     | **Thạch Giáp:** đột phá thất bại, 25% hoàn tối đa 5 TV.                                                                                       |
| T2   | Kiên Giáp Quy      | **Thạch Giáp:** 50% hoàn tối đa 5 TV.                                                                                                         |
| T3   | Nham Giáp Linh Quy | **Thạch Giáp:** 75% hoàn tối đa 5 TV.                                                                                                         |
| T4   | Cổ Thạch Linh Quy  | **Thạch Giáp:** 100% hoàn tối đa 5 TV.                                                                                                        |
| 95%  | T4 · Thức tỉnh     | **Quy Tức:** mỗi ngày đủ thói quen thêm 1 TV.                                                                                                 |
| 100% | T4 · Hoàn mỹ       | **Mai Đá Hộ Thể:** sau 3 lần đột phá thất bại liên tiếp, lần thử tiếp theo +5 điểm phần trăm chance, cap 100%; nếu vẫn thất bại không mất TV. |

Cộng modifier với bảo hiểm/Phá Cảnh Phù nền, không thay thế. Thành công trước ba thất bại cắt chuỗi. Mặc định được ủy quyền: lần được buff tiêu hao hiệu ứng dù kết quả nào, reset counter; thất bại của chính lần được buff không tính là đầu chu kỳ mới. Đây là ba lần thử liên tiếp, không bắt buộc ba ngày liền. Hoàn TV không biến thất bại thành thành công.

### R04 — Từ Giác Linh Lộc (`voltfawn`)

Kiếm TV từ task, thưởng riêng cho làm việc sáng sớm.

| Mốc  | Hình thái         | Skill và tác dụng                                                                              |
| ---- | ----------------- | ---------------------------------------------------------------------------------------------- |
| T1   | Tiểu Điện Lộc     | **Tụ Từ:** hoàn thành task, 10% thêm 1 TV.                                                     |
| T2   | Tia Điện Lộc      | **Tụ Từ:** 20% thêm 1 TV.                                                                      |
| T3   | Lôi Giác Linh Lộc | **Tụ Từ:** 30% thêm 1 TV.                                                                      |
| T4   | Từ Giác Linh Lộc  | **Tụ Từ:** 35% thêm 1 TV.                                                                      |
| 95%  | T4 · Thức tỉnh    | **Tam Cực:** task hợp lệ thứ 3 trong ngày thêm 3 TV, một lần/ngày.                             |
| 100% | T4 · Hoàn mỹ      | **Cực Từ Đảo Chiều:** hoàn thành task từ 05:00 đến trước 08:00 thêm 5 TV, tối đa một lần/ngày. |

Xét thời điểm hoàn thành server; mốc sáng không yêu cầu đó là task thứ nhất trong ngày.

### R05 — Tinh Tú Linh Thỏ (`cheerling`)

Kiếm VQ từ task, đủ tám task/ngày nhận VTH.

| Mốc  | Hình thái        | Skill và tác dụng                                                                  |
| ---- | ---------------- | ---------------------------------------------------------------------------------- |
| T1   | Tiểu Hỷ Thỏ      | **Tinh Tài:** hoàn thành task, 10% thêm 1 VQ.                                      |
| T2   | Hoan Hỷ Thỏ      | **Tinh Tài:** 20% thêm 1 VQ.                                                       |
| T3   | Xuân Hỷ Linh Thỏ | **Tinh Tài:** 30% thêm 1 VQ.                                                       |
| T4   | Tinh Tú Linh Thỏ | **Tinh Tài:** 35% thêm 1 VQ.                                                       |
| 95%  | T4 · Thức tỉnh   | **Tam Tinh:** task hợp lệ thứ 3 trong ngày thêm 3 VQ, một lần/ngày.                |
| 100% | T4 · Hoàn mỹ     | **Tinh Tú Dẫn Lối:** hoàn thành 8 task hợp lệ trong ngày nhận 1 VTH, một lần/ngày. |

Task thứ 9/retry/redo không trả lại mốc tám. Ngày sau đếm lại.

### R06 — Mộng Nấm Linh (`funglet`)

Thưởng TV cho habit, duy trì ngủ đúng giờ để nhận cả vé lẫn TV.

| Mốc  | Hình thái          | Skill và tác dụng                                                            |
| ---- | ------------------ | ---------------------------------------------------------------------------- |
| T1   | Tiểu Nấm Linh      | **Mộng Tức:** ngày đủ thói quen, 25% thêm 2 TV.                              |
| T2   | Mê Mộng Nấm        | **Mộng Tức:** 50% thêm 2 TV.                                                 |
| T3   | Huyễn Mộng Nấm     | **Mộng Tức:** 75% thêm 2 TV.                                                 |
| T4   | Mộng Nấm Tiên Linh | **Mộng Tức:** 100% thêm 2 TV.                                                |
| 95%  | T4 · Thức tỉnh     | **An Mộng:** mỗi ngày kết hợp thêm 2 TV.                                     |
| 100% | T4 · Hoàn mỹ       | **Mộng Cảnh:** 3 ngày kết hợp liên tiếp nhận 3 VQ và 3 TV; thưởng rồi reset. |

100% không yêu cầu task; không dùng nhầm cờ ngày hoàn hảo. Ngủ đủ nghĩa là báo đúng giờ.

### SR01 — Tinh Thạch Linh Ốc (`shardsnail`)

Tích lũy vé từ habit, thưởng lớn cho chuỗi ngày hoàn hảo.

| Mốc  | Hình thái          | Skill và tác dụng                                                                      |
| ---- | ------------------ | -------------------------------------------------------------------------------------- |
| T1   | Tiểu Thạch Ốc      | **Tinh Thạch Tích Lũy:** ngày đủ thói quen, 25% thêm 2 VQ.                             |
| T2   | Bảo Thạch Ốc       | **Tinh Thạch Tích Lũy:** 50% thêm 2 VQ.                                                |
| T3   | Ngọc Giáp Linh Ốc  | **Tinh Thạch Tích Lũy:** 75% thêm 2 VQ.                                                |
| T4   | Tinh Thạch Linh Ốc | **Tinh Thạch Tích Lũy:** 100% thêm 2 VQ.                                               |
| 95%  | T4 · Thức tỉnh     | **Ngũ Sắc Kết Tinh:** cứ tích lũy 5 ngày đủ thói quen nhận 5 VQ và 10 TV.              |
| 100% | T4 · Hoàn mỹ       | **Tinh Hốc Bí Tàng:** 5 ngày hoàn hảo liên tiếp nhận 20 VQ và 20 TV; thưởng rồi reset. |

Thiếu bất kỳ yếu tố ngày hoàn hảo reset 100%, không reset tiến trình tích lũy 95%.

### SR02 — Hỏa Miêu (`flameow`)

Kiếm TV từ task; Hoàn mỹ thưởng theo nhịp làm việc trong ngày.

| Mốc  | Hình thái         | Skill và tác dụng                                                                                                                       |
| ---- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Hỏa Miêu     | **Dư Hỏa:** hoàn thành task, 15% thêm 1 TV.                                                                                             |
| T2   | Diễm Vĩ Miêu      | **Dư Hỏa:** 30% thêm 1 TV.                                                                                                              |
| T3   | Ngân Diễm Miêu    | **Dư Hỏa:** 45% thêm 1 TV.                                                                                                              |
| T4   | Tẫn Hỏa Linh Miêu | **Dư Hỏa:** 60% thêm 1 TV.                                                                                                              |
| 95%  | T4 · Thức tỉnh    | **Tam Trảo:** task hợp lệ thứ 3 trong ngày thêm 3 TV, một lần/ngày.                                                                     |
| 100% | T4 · Hoàn mỹ      | **Hỏa Liên Trảm:** task thứ 1 thêm 1 TV, thứ 2 thêm 2 TV, từ thứ 3 trở đi mỗi task thêm 3 TV; không trần số task; ngày mới bắt đầu lại. |

Ví dụ tám task: riêng 100% thêm 1+2+6*3=21 TV, vẫn cộng 95%, thiên phú và thưởng nền khi đủ điều kiện. Không giữ tổng 18 hoặc giới hạn ba lần v1.

### SR03 — Lan Liêm (`manteeny`)

Task kiếm vé, thưởng mạnh cho làm việc trước trưa và ngày hoàn hảo.

| Mốc  | Hình thái         | Skill và tác dụng                                                                 |
| ---- | ----------------- | --------------------------------------------------------------------------------- |
| T1   | Tiểu Lan Đường    | **Lan Liêm Truy Tài:** hoàn thành task, 10% thêm 1 VQ.                            |
| T2   | Tiềm Ảnh Đường    | **Lan Liêm Truy Tài:** 25% thêm 1 VQ.                                             |
| T3   | Hoa Nhận Đường    | **Lan Liêm Truy Tài:** 35% thêm 1 VQ.                                             |
| T4   | Lan Liêm Nữ Vương | **Lan Liêm Truy Tài:** 50% thêm 1 VQ.                                             |
| 95%  | T4 · Thức tỉnh    | **Tam Hoa:** đủ 3 task trong ngày trước 12:00 nhận 10 VQ, một lần/ngày.           |
| 100% | T4 · Hoàn mỹ      | **Song Liêm Khế:** 2 ngày hoàn hảo liên tiếp nhận 3 VQ và 5 TV; thưởng rồi reset. |

Task thứ ba đúng 12:00 không đạt mốc trước trưa. Không chọn/đánh dấu hai task v1.

### SR04 — Thiên Vân Dương (`fluffle`)

Ngủ đúng giờ kiếm TV, chuỗi càng dài thưởng Hoàn mỹ càng lớn.

| Mốc  | Hình thái            | Skill và tác dụng                                                                                                                   |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Miên Dương      | **Vân Tức:** ngủ đúng giờ, 25% thêm 2 TV.                                                                                           |
| T2   | Vân Nhung Dương      | **Vân Tức:** 50% thêm 2 TV.                                                                                                         |
| T3   | Phong Vân Linh Dương | **Vân Tức:** 75% thêm 2 TV.                                                                                                         |
| T4   | Thiên Vân Dương      | **Vân Tức:** 100% thêm 2 TV.                                                                                                        |
| 95%  | T4 · Thức tỉnh       | **Tam Vân Tụ Khí:** cứ tích lũy 3 lần ngủ đúng giờ thêm 5 TV.                                                                       |
| 100% | T4 · Hoàn mỹ         | **Thiên Cung Mộng Du:** cứ thêm 3 đêm đúng giờ liên tiếp, thưởng số TV bằng chuỗi ngủ đúng giờ tại đêm đó; không trần lượng thưởng. |

Từ S=0, luôn có hiệu lực: đêm 3 thêm 3, đêm 6 thêm 6, đêm 9 thêm 9 TV. Reset mốc 100% không xóa chuỗi. Miss reset liên tiếp nhưng giữ tích lũy 95%.

### SR05 — Vực Hải Giáp Linh (`maskfry`)

Hoàn TV khi đột phá thất bại, kiếm VTH từ chuỗi ngủ.

| Mốc  | Hình thái         | Skill và tác dụng                                                               |
| ---- | ----------------- | ------------------------------------------------------------------------------- |
| T1   | Tiểu Diện Ngư     | **Hải Giáp:** đột phá thất bại, 25% hoàn tối đa 10 TV.                          |
| T2   | Cốt Giáp Ngư      | **Hải Giáp:** 50% hoàn tối đa 10 TV.                                            |
| T3   | Thiết Hàm Ngư     | **Hải Giáp:** 75% hoàn tối đa 10 TV.                                            |
| T4   | Vực Hải Giáp Linh | **Hải Giáp:** 100% hoàn tối đa 10 TV.                                           |
| 95%  | T4 · Thức tỉnh    | **Triều Sinh:** mỗi ngày đủ thói quen thêm 2 TV.                                |
| 100% | T4 · Hoàn mỹ      | **Giao Ước Vực Sâu:** cứ 5 đêm đúng giờ liên tiếp nhận 1 VTH; thưởng rồi reset. |

Không chọn giao ước. Chỉ mất 3 thì hoàn 3, không tạo thêm 7 TV.

### SR06 — Giáp Dực Kỵ Sĩ (`goonbug`)

Habit kiếm An Tâm Phù với bảo hiểm chuỗi không trúng; chuỗi ngủ thưởng phù bảo hộ.

| Mốc  | Hình thái        | Skill và tác dụng                                                                                                                                |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1   | Tiểu Giáp Trùng  | **Giáp Dực:** ngày đủ thói quen, 3% nhận 1 An Tâm Phù.                                                                                           |
| T2   | Thiết Giáp Trùng | **Giáp Dực:** 5% nhận 1 An Tâm Phù.                                                                                                              |
| T3   | Huyền Giáp Trùng | **Giáp Dực:** 7% nhận 1 An Tâm Phù.                                                                                                              |
| T4   | Giáp Dực Kỵ Sĩ   | **Giáp Dực:** 9% nhận 1 An Tâm Phù.                                                                                                              |
| 95%  | T4 · Thức tỉnh   | **Thất Nhật Hộ Ấn:** 7 ngày đủ thói quen liên tiếp mà thiên phú chưa ra phù → bảo đảm 1 An Tâm Phù; trúng tự nhiên hoặc miss một ngày đều reset. |
| 100% | T4 · Hoàn mỹ     | **Hiệp Sĩ Hộ Vệ:** cứ 10 đêm đúng giờ liên tiếp nhận đúng một phù ngẫu nhiên: 30% Hộ Tâm Phù, 70% An Tâm Phù; thưởng rồi reset.                  |

Ngày miss reset, không roll. Ngày đạt roll thiên phú trước: trúng → counter 0; hụt → +1; chạm 7 → cấp bảo đảm rồi reset. Không cấp bảo đảm nếu ngày đó đã trúng tự nhiên. Không dùng cách hiểu cũ cứ bảy ngày đủ habit bất kể đã trúng. Quà 100% và nguồn phù khác độc lập, không trần toàn hệ thống một phù/ngày.

### SSR01 — Băng Nguyệt Linh Miêu (`frostnip`)

Ngủ đúng giờ thưởng nhiều TV, chuỗi ngủ tạo lượng VQ tăng dần.

| Mốc  | Hình thái             | Skill và tác dụng                                                                                                                     |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Tuyết Miêu       | **Nguyệt Tức:** ngủ đúng giờ, 25% thêm 10 TV.                                                                                         |
| T2   | Băng Trảo Miêu        | **Nguyệt Tức:** 50% thêm 10 TV.                                                                                                       |
| T3   | Hàn Sương Linh Miêu   | **Nguyệt Tức:** 75% thêm 10 TV. Mở **Tuyết Ấn:** ngày đủ thói quen, 5% nhận 1 An Tâm Phù.                                             |
| T4   | Băng Nguyệt Linh Miêu | **Nguyệt Tức:** 100% thêm 10 TV. **Tuyết Ấn:** 10% nhận 1 An Tâm Phù.                                                                 |
| 95%  | T4 · Thức tỉnh        | **Băng Nguyệt Giao Hòa:** mỗi ngày kết hợp thêm 2 VQ.                                                                                 |
| 100% | T4 · Hoàn mỹ          | **Băng Nguyệt Phong Ấn:** cứ thêm 3 đêm đúng giờ liên tiếp, thưởng số VQ bằng chuỗi ngủ đúng giờ tại đêm đó; không trần lượng thưởng. |

Chu kỳ và chuỗi tách riêng như Thiên Vân Dương. Không còn ba lượt bảo hộ ngủ v1.

### SSR02 — Lôi Vương (`zappur`)

Task thưởng đồng thời vé và TV; nhiều task và ngày hoàn hảo có thêm thưởng.

| Mốc  | Hình thái        | Skill và tác dụng                                                                                                          |
| ---- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Lôi Sư      | **Lôi Tài:** hoàn thành task, 25% thêm 1 VQ.                                                                               |
| T2   | Điện Nha Sư      | **Lôi Tài:** 50% thêm 1 VQ.                                                                                                |
| T3   | Lôi Đình Hùng Sư | **Lôi Tài:** 75% thêm 1 VQ. Mở **Lôi Tức:** hoàn thành task, 50% thêm 1 TV.                                                |
| T4   | Lôi Vương        | **Lôi Tài:** 100% thêm 1 VQ. **Lôi Tức:** 100% thêm 1 TV. Hai thiên phú có thể cùng thưởng.                                |
| 95%  | T4 · Thức tỉnh   | **Tam Lôi:** từ task hợp lệ thứ 3 trở đi trong ngày, mỗi task thêm 3 VQ; cộng thiên phú, không trần số task cho khoản 95%. |
| 100% | T4 · Hoàn mỹ     | **Lôi Vương Bảo Khố:** mỗi ngày hoàn hảo thêm X TV và X VQ, X=min(5,ceil(S/2)), S là chuỗi ngủ đúng giờ của ngày gốc.      |

S=7 → X=4; S>=9 → X=5. Với D-01, task 3–5 T4 nhận thêm 4 VQ+1 TV từ thiên phú và 95%; task 6 trở đi vẫn +3 VQ của 95%, không lặp thiên phú hết hạn mức.

### SSR03 — Huyễn Sắc Nhẫn Giả (`skinklet`)

Ngày hoàn hảo kiếm VTH; quay x10 có xác suất thưởng thêm tăng dần đến khi trúng.

| Mốc  | Hình thái          | Skill và tác dụng                                                                                                                                                             |
| ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Tích Linh     | **Huyễn Tức:** mỗi ngày hoàn hảo, 10% nhận 1 VTH.                                                                                                                             |
| T2   | Huyễn Sắc Tích     | **Huyễn Tức:** 15% nhận 1 VTH.                                                                                                                                                |
| T3   | Ảnh Nhẫn Tích      | **Huyễn Tức:** 25%. Mở **Thế Thân:** S>=14 thì cộng 10 điểm phần trăm, tổng 35%.                                                                                              |
| T4   | Huyễn Sắc Nhẫn Giả | **Huyễn Tức:** 35%. **Thế Thân:** S>=14 thì cộng 20 điểm phần trăm, tổng 55%.                                                                                                 |
| 95%  | T4 · Thức tỉnh     | **Tam Ảnh Tụ Khí:** mỗi giao dịch quay thường x10 hợp lệ xét một lần nhận đồng thời 1 VTH và 30 VQ. Xác suất 3%,6%,9%... tăng sau mỗi lần hụt, cap 100%; chỉ reset khi trúng. |
| 100% | T4 · Hoàn mỹ       | **Ảo Ảnh Tam Phân:** 3 ngày hoàn hảo liên tiếp, chỉ tính ngày có S>=7, nhận 30 VQ và 1 VTH; thưởng rồi reset.                                                                 |

S là chuỗi ngủ đúng giờ. Thế Thân buff cùng một roll Huyễn Tức, không roll VTH lần hai; ngày S=14 dùng buff ngay cho ngày đó. x10 cần đủ chi phí trước roll; quà tiềm năng không thay vé đầu vào. Nếu hụt liên tục, lần xét 34 là 100%; sau trúng lần kế tiếp về 3%. Không reset theo ngày, quay đơn/replay không tăng counter. 100% bắt đầu đếm từ ngày S>=7; S=7/8/9 đều hoàn hảo thì trả ở S=9.

### SSR04 — Đấu Chiến Linh Hầu (`punchimp`)

Habit tạo TV; task tạo vé và buff ngày sau; cứu bẫy ở mọi tầng tháp.

| Mốc  | Hình thái          | Skill và tác dụng                                                                                                                                |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1   | Tiểu Quyền Hầu     | **Hầu Vương Tụ Khí:** ngày đủ thói quen, 25% thêm 5 TV.                                                                                          |
| T2   | Thạch Quyền Hầu    | **Hầu Vương Tụ Khí:** 50% thêm 5 TV.                                                                                                             |
| T3   | Võ Đạo Linh Hầu    | **Hầu Vương Tụ Khí:** 75% thêm 5 TV. Mở **Kiên Tâm:** ngày có >=2 task, 50% thêm 3 VQ và chắc chắn tạo buff ngày hôm sau.                        |
| T4   | Đấu Chiến Linh Hầu | Ngày đủ thói quen chắc chắn thêm **5 TV và 1 VQ**. **Kiên Tâm:** ngày có >=2 task, 100% thêm 3 VQ và chắc chắn tạo buff ngày hôm sau.            |
| 95%  | T4 · Thức tỉnh     | **Ngũ Nhật Chiêu Linh:** cứ tích lũy 5 ngày đủ thói quen nhận 1 VTH.                                                                             |
| 100% | T4 · Hoàn mỹ       | **Phân Thân Thế Mệnh:** mỗi lượt tháp mới được cứu một bẫy ở bất kỳ tầng nào, gồm tầng 4. Xáo lại tầng đó rồi chọn lại; lần chọn lại vẫn có bẫy. |

+1 VQ khi đủ habit ở T4 là khoản riêng đã xác nhận, không thay Kiên Tâm. Mốc hai task xét một lần/ngày; T3 hụt roll 3 VQ vẫn tạo buff. Buff ngày hôm sau: mỗi task hợp lệ +1 VQ và +1 TV, không trần task, không chồng cùng nguồn. Không tăng số lượt tháp/ngày, không biến một lần cứu mỗi lượt thành một lần cứu mỗi tầng.

### UR01 — Khuyển Tam Diệm (`pyropup`)

Task kiếm nhiều tài nguyên; chuỗi ngủ dài mở nhân ba thưởng và hình phạt TV.

| Mốc  | Hình thái          | Skill và tác dụng                                                                                                                                                         |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | Hỏa Khuyển Con     | **Liệp Hỏa:** hoàn thành task, 25% thêm 3 TV.                                                                                                                             |
| T2   | Liệp Hỏa Khuyển    | **Liệp Hỏa:** 50% thêm 3 TV.                                                                                                                                              |
| T3   | Ngục Hỏa Khuyển    | **Liệp Hỏa:** 75% thêm 3 TV. Mở **Truy Tài:** hoàn thành task, 40% thêm 2 VQ.                                                                                             |
| T4   | Tam Diệm Ma Khuyển | **Liệp Hỏa:** 100% thêm 3 TV. **Truy Tài:** 80% thêm 2 VQ.                                                                                                                |
| 95%  | T4 · Thức tỉnh     | **Tam Diệm Tụ Hồn:** cứ tích lũy 10 task hợp lệ nhận 10 VQ, đồng thời xét 30% nhận thêm 1 VTH; xét xong reset.                                                            |
| 100% | T4 · Hoàn mỹ       | **Tam Thủ Chiêu Hồn:** khi S>=30, nhân ba thưởng kiếm được và TV bị phạt trong ngày. Mỗi ngày có hiệu lực tự thiêu **12 TV gốc**, có nhân ba nên **thực trừ 36 TV/ngày**. |

Phạm vi/snapshot ở mục 5 và D-09. Ngày đang có hiệu ứng mà ngủ muộn vẫn nhân phạt dù đứt chuỗi. Không nhân hoàn trả/chuyển đổi/sản phẩm ghép/số cá thể; không nhân đệ quy. Không còn chọn một trong ba ứng viên triệu hồi cho sự kiện v2.

### UR02 — Tinh Vẫn Cự Thú (`rubblet`)

Sinh hoạt đều đặn kiếm TV, ngày hoàn hảo và chuỗi ngủ dài tạo nhiều VQ.

| Mốc  | Hình thái       | Skill và tác dụng                                                                                                 |
| ---- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| T1   | Tiểu Thạch Thú  | **Địa Mạch:** ngày đủ thói quen, 25% thêm 5 TV.                                                                   |
| T2   | Nham Giáp Thú   | **Địa Mạch:** 50% thêm 5 TV.                                                                                      |
| T3   | Cự Nham Thú     | **Địa Mạch:** 75% thêm 5 TV. Mở **Tinh Tức:** ngủ đúng giờ, 50% thêm 10 TV.                                       |
| T4   | Tinh Vẫn Cự Thú | **Địa Mạch:** 100% thêm 5 TV. **Tinh Tức:** 100% thêm 10 TV.                                                      |
| 95%  | T4 · Thức tỉnh  | **Nhật Nguyệt Đồng Tu:** cứ 7 ngày hoàn hảo liên tiếp nhận 100 VQ; thưởng rồi reset.                              |
| 100% | T4 · Hoàn mỹ    | **Tinh Vẫn Kết Giới:** mỗi ngày hoàn hảo thêm số VQ bằng chuỗi ngủ đúng giờ tại ngày đó, không trần lượng thưởng. |

Ngày trả 100 VQ ở 95% vẫn nhận khoản 100% nếu đủ điều kiện. Trả mốc 95% không reset chuỗi ngủ tài khoản.

## 5. Hợp đồng tài nguyên và nhân ba

**CHỐT:** nhân ba khoản thưởng kiếm được, không tăng xác suất/số roll/counter/độ thuần/số cá thể. Không nhân một khoản nhiều lần.

| Nguồn                                                             | Nhân ba?                | Cách áp dụng                                                                |
| ----------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| Thưởng TV/VQ/vật phẩm từ task/habit/ngủ/check-in/quay thường/tháp | Có                      | Nguồn v2 và ngày gốc có hiệu lực; lưu số gốc và số thực trả                 |
| Thưởng mốc linh thú, gồm VTH/vật phẩm                             | Có, khi hợp lệ          | Một lần roll, nhân số lượng kết quả; không roll ba lần                      |
| Hoàn TV, hoàn phù, bồi hoàn giao dịch                             | Không                   | Không vượt thiệt hại/chi phí gốc                                            |
| Đổi vé, hiến tế, chuyển kho                                       | Không                   | Không biến chuyển đổi thành nguồn kiếm lời do nhân ba                       |
| Sản phẩm ghép phù/luyện đan/chế tạo                               | Không                   | Giữ tăng sản lượng của skill ghép riêng                                     |
| Vé/đầu vào tiêu cho quay/triệu hồi/ghép/đổi                       | Không                   | Chi phí không phải hình phạt TV                                             |
| Phạt TV do ngủ/đột phá khi multiplier có hiệu lực                 | Có                      | Nhân hình phạt gốc trước clamp số dư; xử lý bảo hộ/hoàn/cảnh giới đúng luật |
| Tự thiêu                                                          | Có: 12 thành 36 TV/ngày | Một lần/ngày có hiệu lực, không nhân lại thành 108                          |
| Điểm luyện/xám/độ thuần/rank/chuỗi/chance                         | Không                   | Không phải tài nguyên thưởng được nhân                                      |
| Số cá thể hoặc cập nhật pity triệu hồi                            | Không                   | Không tạo ba cá thể/ba lượt pity từ một lượt                                |
| Nhận quyền lợi v1 đã tạo trước cutover                            | Không áp v2 hồi tố      | Thanh toán theo dữ liệu nguồn đã ghi                                        |

Không dùng số dư ròng để suy mọi khoản dương là thưởng và mọi khoản âm là phạt. Một transaction có thể gồm chi phí, thưởng và hoàn; giữ bản chất từng khoản.

Ví dụ: thưởng nền +1 TV và skill +3 TV → +12 TV khi nhân ba, không +30 hoặc +36. Ngủ bị phạt 20 TV → 60 trước clamp, không nhân số dư còn lại. Khuyển 95% nhận 10 VQ và roll trúng 1 VTH → 30 VQ và 3 VTH, vẫn một lần roll 30%.

## 6. Ràng buộc dữ liệu

- Ghi ví TV/VQ/vật phẩm, kho VTH, counter, buff, quota và biên nhận nhất quán.
- Replay request đã commit trả kết quả đã lưu, không roll lại. Hai request đồng thời không trả trùng mốc hoặc mất cập nhật.
- Không làm lộ kết quả giao dịch chưa commit rồi cho client thử lại để chọn may mắn.
- Thời gian/ngày/RNG/bẫy do server kiểm soát.
- Preview không mint thưởng. Nếu GET chạy bảo trì như hiện tại, đó là job có biên nhận, nguồn/ngày gốc và công việc giới hạn; không thưởng vì “mở trang”.
- Cron phải tiến công việc khi không mở app; batch hữu hạn và checkpoint, không quét toàn lịch sử mỗi lần task/quay.
- Cutover/compatibility/pending choices/undo phải được triển khai và kiểm chứng theo tài liệu kế hoạch.

## 7. Checklist đối chiếu cuối

1. Đủ **18 loài: 6 R, 6 SR, 4 SSR, 2 UR**, đủ T1–T4/95%/100%.
2. Không dùng scale chung làm lệch 10/20/30/35 hoặc 3/5/7/9.
3. Không nhầm combined với perfect, pending với miss hoặc nghỉ hợp lệ với bỏ lỡ.
4. Không xóa chuỗi ngủ khi trả thưởng chu kỳ; không lấy chuỗi bảo hộ để giả ngủ đúng giờ.
5. Bảo hiểm Giáp Dực reset khi trúng tự nhiên hoặc miss; không cấp đôi ở ngày trúng.
6. Không cap 5 task/10 draw toàn engine; chính sách từng skill đúng D-01.
7. Linh Hầu T4 có +1 VQ habit riêng; buff ngày sau không phụ thuộc roll 50%.
8. Không nhân refund/conversion, không multiplier đệ quy, không tự thiêu lặp.
9. Không xóa quyền lợi v1 đã trả phí; không tạo skill v1 mới sau cutover.
10. Chỉ báo runtime xong khi có bằng chứng; tài liệu này không phải kết quả test.
