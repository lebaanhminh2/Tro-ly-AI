# Tu luyện — bằng chứng cân bằng và findings

Checkpoint 2026-10-13. Mọi fixture dùng thời gian giả và dữ liệu riêng; không ghi D1 remote hoặc gửi Telegram. Kết quả domain không thay thế nghiệm thu UI, art, độ cuốn hoặc hiệu năng remote.

## Bằng chứng hiện hành: nội dung `than-lo-4`

- Engine giữ `BATTLE_RULE = battle-v1`; `than-lo-1/2/3/4` là phiên bản nội dung, không phải bốn phiên bản engine. Trận đang lưu dùng snapshot cũ, không nhận lại giáp/HP/ý định/phần thưởng từ catalog mới.
- Chuẩn bị trận mới dùng `bossForNewBattle`: không vũ khí hoặc thưởng vũ khí. Engine cứu mạng và `armedBattleState` còn để đọc/chạy snapshot cũ; item entitlement và export lịch sử không bị xóa. Các script earned hiện lấy cùng snapshot mới; profile luôn `weapon=null`, không dùng Thạch Tâm kiếm được ở bản cũ.
- `tests/unit/game-content.test.ts`: cả năm phái từ state mới đi hết 22 trận chính, sau đó 18 cơ duyên, mở đủ 39 quyền và luyện đủ 39 môn qua các ngày kết toán. Không cấp rank/bản luyện/quyền admin; mọi `journey.weapons` rỗng. Nhánh trong bài này đi sau kết truyện, không phải bằng chứng nhịp early-branch.
- `tests/unit/game-profiles.test.ts`: Thiên Kiếm weekly-3, daily-80 với mixed build, và daily-80 với cứu mạng thật sau thế đánh thua đạt kết quả yêu cầu bằng edition đã kiếm được. Weekly giữ trung tính/khuyết điểm, nhánh mở sớm, Dị Giáo dựa actual casts, cứu trừ Tu Vi và giữ rank. Đây là ba bài cụ thể, **không phải** chạy lại 30 profile hoặc chứng minh cứu được mọi thế thua.
- `tests/integration/battle.test.ts`: thắng/kết toán D1 thực tế ghi quyền/danh hiệu cùng batch, trận mới không thưởng vũ khí; batch lỗi/retry không nhân quyền. Legacy snapshot có vũ khí giữ hiệu ứng qua đổi rank/kết toán; receipt prepare cũ chứa vũ khí vẫn replay đúng. Bài sửa chuẩn bị giữ mọi fighter/intent/status ngoài loadout và lịch trở lại luyện; first-win record không bị trận thắng lặp/thua mới che mất.
- Gate riêng đã đạt trước full release gate: 15 bài content/profile/discovery, 18 bài battle/preset/reward, các bài integration bổ sung và 5 bài discovery hiện hành. Xem release checkpoint cho kết quả toàn bộ suite sau các thay đổi cuối, không suy toàn suite từ số bài chọn lọc.

Giới hạn earned harness giữ nguyên: ngủ/điểm danh đều, solver biết cả pattern, preview thất bại chưa commit trận hoặc cái giá, bản perfect collection dùng RNG đột phá thuận lợi. Có đường tiến triển trong những fixture này; chưa phải thời gian hoàn thành thực tế hay đo engagement. Không nới tinh thuần, trần đóng góp, lịch lặp hoặc luật đột phá để làm đẹp kết quả.

## Bằng chứng lịch sử `than-lo-3` (không thay cho gate hiện hành)

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

Ở báo cáo v3 dưới đây, tài khoản từ `initialHealthy`, chỉ có quyền nhập môn. Bản luyện qua `settlePracticeDay`, quyền/weapon qua thắng; đột phá dùng RNG seed và phù từ điểm danh thật. Mode/lựa chọn luyện từ ngày sau; ngày chuẩn bị vẫn luyện môn cũ, trận không đồng thời nhận tiến độ luyện. `battleHabitContribution` dùng chung production adapter và harness. Không có task bonus,cứu mạng hoặc quyền admin. Script hiện hành đã bỏ weapon; chạy lại sẽ cho kết quả v4, không tái tạo nguyên xi báo cáo v3.

Kết quả sau cân bằng `than-lo-3`, `D:/Tro-ly-AI-art/earned-profiles-v3.json`: **30/30 tới DIỆT THẦN và40wins**, tính cả18nhánh. Vào nhánh ngay khi preceding victories đã đủ, luyện prerequisites thật; không chờ ending rồi mới cấp rank7. 398–1138ngày fixture để đi cả sưu tập; đây **không phải** thời gian tuyến chính hoặc thời gian kỳ vọng của người chơi. Số ngày gồm luyện môn ngoài phái để mở truyền thừa và toànnhánh. Bất Diệt có lần chưa vượt Kiếm Trầm khi mới mở, sau thêm sức mạnh vẫn vượt được. Reports trước cân bằng `earned-profiles-early.json` giữ để so sánh, không chứng minh source hiện tại.

`--profile daily-80 --mixed`: cả5phái dùng ba môn phái đã luyện và tối đa hai môn ngoài phái đã kiếm được. **5/5 tới40wins**, 609–711ngày sau cân bằng, tất cả nhận Dị Giáo qua actual casts. Report `earned-mixed-v3.json`; không lấy đổi loadout làm proof của chiến tích. Existing perfect earned collection chứng minh39editions; lượt này chứng minh imperfect/weekly/earlybranches và phối hợp, không thay thế persistence tests.

Giới hạn: ngủ/điểm danh mỗi ngày; một seed; solver nhìn pattern đầy đủ; preview thất bại chưa commit trận/mất Tu Vi; thử tối đa4tầng và thêm tối đa2rank cho trận chính. Các hành trình thành công chứng minh có đường tiến triển ở fixture, không chứng minh cân bằng hay độ cuốn đã đạt. Không dùng kết quả này để xóa luật tinh thuần nghiêm.

## Chiến thuật lặp — trước và sau cân bằng

`node scripts/simulate-game-tactics.ts --output <report.json>`: **3200cases**,40encounters×40choices(Võ Kỹ+39môn)×2purity. Cấp sẵn một môn, tầng1chương1–3/tầng2chương4–9/tầng3chương10–15, rankgợiý, habitbonus300mọilượt; khôngweapon/tasks/rescue. Lặp môn đó, chỉ dùng Võ Kỹ khi cooldown/HP không đủ. Đây là phép thử chiến thuật đơn giản, không earned traversal.

Report `D:/Tro-ly-AI-art/repeated-tactics.json` cho thấy nhiều môn10000bp thắng40/40 bằng lặp; **Kiếm Vực/Tàn Mệnh/Huyết Hải còn thắng40/40 ở6000bp**. Không có statusstack vô hạn (maxturns vẫn bounded); vấn đề là chọn chiêu/nhịp phản công chưa đủ giá trị khi có sức mạnh phù hợp. Không coi nhiều môn thắng được là đã hết dominance: một lựa chọn lặp vẫn xóa mất phần chiến thuật mà PRODUCT yêu cầu.

Đã chọn counter có báo trước trong content `than-lo-3`: bốn trận chính chương1 giữ nguyên. Các trận khác đọc chiêu nếu lặp đúng chiêu đã thi triển ở lượt trước, giảm sát thương gây ra lượt đó65% (chương≤3),75% (≤9),85% (sau9). Đổi chiêu phá thế đọc; giá thi triển, damage nhận và hiệu quả phòng thủ không đổi. Giảm bao gồm đòn trễ/phản thương, stance cố định trước intent swap. UI báo trong intent và ngay trên lựa chọn bị đọc. `repeatWard` là thuộc tính optional lưu trong intents của trận mới; snapshot v1/v2 không có vẫn chạy đúng luật cũ, không sửa globalspec công pháp.

Thử550/650/750 chưa đủ: Kiếm Vực hoàn hảo vẫn thắng38/40. Mức650/750/850 đã chạy3200cases tại `repeated-tactics-v3.json`: không chiêu nào lặp vượt toàntruyện; Kiếm Vực10000bp còn21/40,6000bp còn5/40 và cả hai không thắng ba encounter cuối. Test boss cuối có đường thắng bằng đổi giữa các chiêu công khác nhau. Rerun toàn30earned profiles/5mixed routes bên trên vẫn tới40wins. Đây là bằng chứng xử lý finding lặp chiêu cũ trong phạm vi harness, **không** là chứng minh mọi combo cân bằng hoặc F6 đã đạt toàn bộ.

## Cứu mạng bằng sức mạnh kiếm được

`--school thien-kiem --profile daily-80 --rescue`: tiếp tục account/calendar/editions của earned route, đánh lại encounter đã thắng; không cấp thêm quyền hoặc thưởng. Lặp Vô Hồi10lượt ở Thần Chiến Vương khiến HP về0; trả21Tu Vi từ2985 xuống2964, rank7 giữ nguyên, hồi210HP. Đổi Kiếm Vực/Liên Vân/Kiếm Vực/Vô Hồi, thắng lượt14 với36HP, nhận điều kiện `vuot-tu-canh`. Report `earned-rescue-v3.json`; unit replay lại từng cast/cost và đối chiếu edition/tinh thuần đã kiếm. Không cộng sleep/checkin trong fixture chiến đấu riêng này; solver nhìn pattern. Không khẳng định mọi thế thua đều cứu được hoặc dùng ca này thay persistence/rank-rescue tests. Build thuần năm phái, mixed Dị Giáo, Kiếm Đồ/ending và rescue có các nguồn domain tương ứng cho11chiến tích; quyền lưu một lần vẫn cần evidence D1 riêng.

## Phần còn phải chứng minh

- Release audit đối chiếu11chiến tích với earned reports và D1 reward/dedupe; không dùng một report thuần Thiên Kiếm để chứng minh cả năm phái.
- Nhịp tuyến chính tách khỏi fullcollection; nhiều seed/gián đoạn hợp lý nếu finding chỉ ra rủi ro, không chạy vô hạn.
- Chiêu hỗ trợ/phòng thủ/trấnphái có giá trị trước các pattern mới; combos trong phạm vi rủi ro, không cần enumerate39môn mọi tổ hợp.
- UX giải thích strength/purity/contribution/intent/cost và mục tiêu gần nhất bằng UI thật; network/accessibility/art toànflow còn gate riêng.
