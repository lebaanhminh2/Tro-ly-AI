# Thần Lộ — bằng chứng cân bằng và findings

Checkpoint 2026-10-12. Đây là kết quả đã chạy, không phải nghiệm thu toàn F6. Engine/content production; mọi fixture dùng thời gian giả và dữ liệu riêng. Không ghi D1 remote hoặc gửi Telegram.

## Hành trình đã kiếm được sức mạnh

`node scripts/simulate-game-profiles.ts --output <report.json>` chạy sáu mẫu cho từng phái, seed82131:

| Mẫu | Cam kết và thực hiện | Phân biệt cần giữ |
| --- | --- | --- |
| daily-80 | Một habit;4/5ngày đạt | Ngày bỏ có thiếu thật, tinh thuần giữ khuyết điểm |
| daily-60 | Một habit;3/5ngày đạt | Không cấp sẵn bản tinh thuần tốt để che phần thiếu |
| six-80 | Sáu habit;4/5ngày đạt mỗi habit, lệch pha | Speed/contribution theo trần production, không nhân6 |
| weekdays-80 | Thứ2/4/6;4/5nghĩa vụ đạt | Ngày không đến lịch trung tính |
| weekly-3 | Q3;4tuần đạt thứ2/5/CN,tuần5chỉ thứ2 | Tuần thiếu vẫn trung tính tới thứ7,rồi thiếu mới cuối kỳ; audit theo bản đã dùng |
| mixed-six | Hai daily,hai weekdays,hai weekly | Tiến độ/tinh thuần từ đủ nguồn thật, không fake success ngày trung tính |

Tài khoản từ `initialHealthy`, chỉ có quyền nhập môn. Bản luyện qua `settlePracticeDay`, quyền/weapon qua thắng; đột phá dùng RNG seed và phù từ điểm danh thật. Mode/lựa chọn luyện từ ngày sau; ngày chuẩn bị vẫn luyện môn cũ, trận không đồng thời nhận tiến độ luyện. `battleHabitContribution` dùng chung production adapter và harness. Không có task bonus,cứu mạng hoặc quyền admin.

Kết quả `D:/Tro-ly-AI-art/earned-profiles-early.json`: **30/30 tới DIỆT THẦN và40wins**, tính cả18nhánh. Vào nhánh ngay khi preceding victories đã đủ, luyện prerequisites thật; không chờ ending rồi mới cấp rank7. 387–1128ngày fixture để đi cả sưu tập; đây **không phải** thời gian tuyến chính hoặc thời gian kỳ vọng của người chơi. Số ngày gồm luyện môn ngoài phái để mở truyền thừa và toànnhánh. Tinh thuần nhỏ nhất từ các bản đã kiếm được:711–4873bp tùy mẫu, không tự nâng thành10000. Bất Diệt daily60/weekdays/weekly có lần chưa vượt Kiếm Trầm khi mới mở, sau thêm sức mạnh vẫn vượt được. Thiên Cơ daily60/mixed-six cần rank8 ở một phần route; đã kiếm bằng sleep/checkin/breakthrough, không grant.

`--profile daily-80 --mixed`: cả5phái dùng ba môn phái đã luyện và tối đa hai môn ngoài phái đã kiếm được. **5/5 tới40wins**, 567–692ngày, tất cả nhận Dị Giáo qua actual casts. Reports `earned-mixed-schools.json`; không lấy đổi loadout làm proof của chiến tích. Existing perfect earned collection chứng minh39editions; lượt này chứng minh imperfect/weekly/earlybranches và phối hợp, không thay thế persistence tests.

Giới hạn: ngủ/điểm danh mỗi ngày; một seed; solver nhìn pattern đầy đủ; preview thất bại chưa commit trận/mất Tu Vi; thử tối đa4tầng và thêm tối đa2rank cho trận chính. Các hành trình thành công chứng minh có đường tiến triển ở fixture, không chứng minh cân bằng hay độ cuốn đã đạt. Không dùng kết quả này để xóa luật tinh thuần nghiêm.

## Chiến thuật lặp — finding còn mở

`node scripts/simulate-game-tactics.ts --output <report.json>`: **3200cases**,40encounters×40choices(Võ Kỹ+39môn)×2purity. Cấp sẵn một môn, tầng1chương1–3/tầng2chương4–9/tầng3chương10–15, rankgợiý, habitbonus300mọilượt; khôngweapon/tasks/rescue. Lặp môn đó, chỉ dùng Võ Kỹ khi cooldown/HP không đủ. Đây là phép thử chiến thuật đơn giản, không earned traversal.

Report `D:/Tro-ly-AI-art/repeated-tactics.json` cho thấy nhiều môn10000bp thắng40/40 bằng lặp; **Kiếm Vực/Tàn Mệnh/Huyết Hải còn thắng40/40 ở6000bp**. Không có statusstack vô hạn (maxturns vẫn bounded); vấn đề là chọn chiêu/nhịp phản công chưa đủ giá trị khi có sức mạnh phù hợp. Không coi nhiều môn thắng được là đã hết dominance: một lựa chọn lặp vẫn xóa mất phần chiến thuật mà PRODUCT yêu cầu.

**Việc kế tiếp bắt buộc:** thiết kế counter hoặc nhịp boss có báo trước để lặp một môn không vượt toàntruyện, vẫn có ít nhất hai hướng đáp trả và các phái/mixed/weekly yếu có đường tiến triển. Xem stats/pattern/source thực tế trước chọn giải pháp. Không chỉ tăngHP/attack toàncatalog hoặc hạ tinh thuần user. Phải giữ trận/bản luyện cũ qua content/snapshot/rulecompatibility; effects hiện tra bằngID nên chỉnh globalspec cần registry cũ. Có thể thêm thuộc tính content optional cho encounter mới, giữ snapshots cũ mặc định không có effect; quyết định cuối phải thử trước khi ghi đã triển khai. Lưu before/after và rerun earned routes bị ảnh hưởng. Đây là finding **chưa sửa**, chặn F6/release acceptance.

## Phần còn phải chứng minh

- Thắng sau cứu mạng bằng tài khoản/bản đã kiếm được; đủ11chiến tích hợp lệ qua các trường hợp tương ứng (pure/mixed/collection đã có, rescue hiện có D1/domain tests nhưng earned scenario còn thiếu).
- Nhịp tuyến chính tách khỏi fullcollection; nhiều seed/gián đoạn hợp lý nếu finding chỉ ra rủi ro, không chạy vô hạn.
- Chiêu hỗ trợ/phòng thủ/trấnphái có giá trị trước các pattern mới; combos trong phạm vi rủi ro, không cần enumerate39môn mọi tổ hợp.
- UX giải thích strength/purity/contribution/intent/cost và mục tiêu gần nhất bằng UI thật; network/accessibility/art toànflow còn gate riêng.
