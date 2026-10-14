# Tu luyện — bằng chứng cân bằng và findings

Checkpoint 2026-10-14. Mọi fixture dùng thời gian giả và dữ liệu riêng; không ghi D1 remote hoặc gửi Telegram. Kết quả domain không thay thế nghiệm thu UI, art, độ cuốn hoặc hiệu năng remote.

**V2:** [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md) sở hữu yêu cầu, [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md) §5.9 sở hữu trạng thái phát hành. A08 chọn lịch21 cho bản mới; lịch đã lưu/v1/snapshot giữ nguyên. Báo cáo baseline/mastery/mixed/repetition dưới đây giữ config/fingerprint gốc; không gắn hash nguồn mới cho kết quả cũ. Các ca resolver cuối bổ sung lợi ích/giới hạn ba tác dụng mới, không chứng minh mọi combo cân bằng hoặc trải nghiệm dài ngày.

### Đối chiếu ba tác dụng mới qua resolver cuối

`tests/unit/technique-profile.test.ts`, đi qua main gate nguồn cuối:

| Tác dụng | So sánh / giới hạn đã kiểm |
| --- | --- |
| Kiếm Ý nối chiêu | Sau Kiếm Ý tầng2, Liên Vân144 thay vì138; thi triển lại Kiếm Ý không nhận buff, dùng Kim Thân rồi Liên Vân trở lại138. Chỉ một chiêu Thiên Kiếm khác ở lượt kế, không buff vô hạn |
| Huyền Quy nội tại | Cùng chuỗi đòn20/250/250 và HP360: mang nội tại còn40HP, bản đánh dấu quyền đã dùng bị hạ. Không tăng sát thương, không cần thi triển Huyền Quy; chỉ một lần, sống sót ở HP thấp, không kích từ tự hiến HP hoặc đòn chí tử |
| Thôn Thiên hút thêm | HP400 →445 khi thi triển ở ngưỡng thấp; dùng Kiếm Ý không hồi. Khi Khiên boss chặn hết HP thật mất thì hồi0; tầng1 chưa có bonus. Tác dụng nằm trên chính chiêu, không là nội tại mọi đòn |

Các phép đối chiếu dùng battle-v2 và hàm production, cùng lực tấn công/trạng thái khi so. Đây là kiểm trigger, lợi ích và giới hạn cụ thể; matrix earned/repetition dưới đây kiểm phạm vi rộng hơn. Không tuyên bố cân bằng mọi cách phối hoặc kỳ vọng chơi người thật.

## Baseline v2 — luyện theo ngày và damage từng kỳ

### Cấu hình và phạm vi đã chạy

- `scripts/simulate-cultivation.ts`, seed **82131**, search width **48**, `practice-v2`/`battle-v2`/`than-lo-5`.
- **120 hành trình**: năm phái ×24 profile; 1 hoặc6 habit, hằng ngày/chọn thứ/quota tuần, tỷ lệ mục tiêu0/50/80/100%.
- Bắt đầu bằng trạng thái nhập môn; quyền qua victory và các bản qua `newTimePracticeVersion`/`settlePracticeDay`/`practiceStrength`. Không cấp sẵn catalog max, không vũ khí/task bonus hoặc luyện song song.
- Báo cáo `.wrangler/cultivation-v2-matrix-pure.json`, log cùng tên `.log`; phiên4575 exit0. Config/seed/source SHA256 nằm trong report. Fingerprint predates bổ sung `campaignTimeline`/tham số đối chiếu thời lượng; kết quả này không được gắn source hash mới.
- **Lịch của baseline này:** thường3/6/10/15, cấm5/9/15/23, ngoài6/12/20/30. Factory source local sau đó đổi lịch cho bản mới như mục quyết định dưới; không gắn thay đổi đó vào report baseline.

### Kết quả baseline

| Habit mục tiêu | Số hành trình | Tới kết truyện | Ngày kết thúc hành trình |
| --- | ---: | ---: | ---: |
| 0% | 30 | 0 | 223–335; solver dừng sau5–10 thắng |
| 50% | 30 | 28 | 333–668; có hai ca dừng sớm |
| 80% | 30 | 30;40 thắng mỗi ca | 362–608 |
| 100% | 30 | 30;40 thắng mỗi ca | 338–494 |

Hai ca50% chưa tìm được đường: `bat-diet/one-weekly-50` tại `truong-sinh` ngày333/rank 4; `thien-co/one-weekdays-50` tại `than-chien-vuong` ngày618/rank 9. Đây là finding để thử tiếp hoặc cân bằng; không là chứng minh boss bất khả thi.

Môn dùng được đầu tiên ngày8–9; ba môn ngày19–23 theo policy campaign. Policy ưu tiên môn tầng1–3 và chỉ max khi cần, vì vậy không có milestone max trong một số ca100% **không** có nghĩa phải đi hết truyện mới max được môn. Mẫu mastery-first bên dưới đã đo riêng hoàn tất một môn sớm.

Lượt full collection mẫu Thiên Kiếm/one-daily-80 tại `.wrangler/cultivation-v2-one-daily-80.json`:40 thắng/39 editions; campaign404 ngày; tổng1.925 ngày = **1.674 luyện +163 đánh +88 chờ**. Đây là luyện tối đa mọi môn sau khi kiếm quyền, khác với chỉ đi hết truyện. Không bắt người dùng phải full collection để thắng boss cuối.

### Giới hạn phải giữ khi đọc số

Solver có toàn bộ pattern tương lai, tìm đường qua beam search có giới hạn; đây là khả năng chiến thuật thuận lợi hơn UI người thật. Thử chiến thuật thất bại chưa commit trận nên chưa tính chi phí cứu/thua/chuẩn bị của lần đó. Ngủ/điểm danh đều, đột phá dùng nguồn kiếm được nhưng thuận lợi. Tỷ lệ habit là mục tiêu dài hạn, các kỳ ngắn/quota tuần có R khác do ngày/lịch/audit. Neutral không tự thành success.

Số ngày là kết quả harness dưới các giả định trên, không phải kỳ vọng chơi thật hoặc engagement. Profile0% vẫn mở tầng đúng ngày; không thêm habit gate để làm đẹp kết quả. Earned unit **3/3** kiểm riêng increments/R khác q, snapshot bất biến, audit/mixed và tổng ngày; legacy profile **4/4** giữ v1 mặc định. Unit mixed chưa thay một matrix phối môn đầy đủ.

### So sánh lịch và quyết định A08

Lịch đối chiếu **3/4/6/8** được thử bằng `--days 3,4,6,8`: thường21/cấm32/ngoài42ngày, toàn39môn lý thuyết1.033ngày luyện. Report đối chiếu dùng override edition mới của harness và production clock/settlement/resolver tại fingerprint đã ghi. Sau đối chiếu/probes, **factory local đã áp cùng lịch cho bản mới**, không đổi lịch đã lưu. Đây là quyết định triển khai, chưa staging và chưa nghiệm thu toàn cân bằng.

Phiên **24191 đã exit0**, report `.wrangler/cultivation-v2-candidate-21-pure.json` đủ120 hành trình; log cùng tên `.log`. Không khởi động lại chỉ vì checkpoint trước ghi đang chạy. So fingerprint: hai script simulation thay đổi (timeline/đối chiếu lịch), các source domain trong hai báo cáo cùng SHA256.

| Habit mục tiêu | Tới kết truyện, lịch21 | Ngày kết thúc hành trình, lịch21 | Trung vị ngày giảm, các cặp đều tới kết truyện |
| --- | ---: | ---: | ---: |
| 0% | 0/30 | 171–270; vẫn chỉ5–10 thắng | Không so thời gian thắng |
| 50% | 29/30 | 376–612; gồm một ca dừng sớm | 37 ngày,28 cặp |
| 80% | 30/30 | 335–540 | 30 ngày,30 cặp |
| 100% | 30/30 | 308–463 | 30 ngày,30 cặp |

Ở80%,29/30 cặp nhanh hơn nhưng một cặp chậm hơn32 ngày; tổng nhịp còn phụ thuộc lịch tuần/quyền/chiến thuật/rank chứ không chỉ tổng ngày luyện. 50% Bất Diệt/one-weekly-50 nay đi tới Thần Chiến Vương ngày588/rank 9, vẫn chưa tìm được chiến thắng. Boss đầu ngày4–5, môn đầu ngày8–9, ba môn ngày19–23 ở cả hai lịch: rút các tầng sau chưa cải thiện đoạn khởi đầu. Không kết luận lịch21 là lựa chọn phát hành chỉ từ việc ít ngày hơn.

Agent dùng so sánh và các probes bên dưới để hoàn thiện trị số/động lực nâng cấp trong khung PLAN. A08 đã chọn lịch21 vì hoàn tất môn sớm hơn và giữ các đường thắng80/100% trong matrix; lịch đã lưu được giữ. Còn lợi ích hiệu ứng mới/on-off, combo/support/rescue và gate nguồn cuối; không coi lựa chọn factory là kết luận cả catalog đã cân bằng. Tách tuyến truyện/collection và ngày luyện/đánh/chờ; nếu đổi tiếp phải có finding và evidence tương ứng.

## Bổ sung v2 — luyện hoàn tất, phối môn và chiến thuật lặp

Các report đã có config/seed/source hashes và được đọc trong lượt tổng hợp14/10. Đây là evidence trên nguồn/config ghi trong report; không thay gates của source sửa tiếp. Factory sau đó đã chọn lịch21 cho bản mới, lịch đã lưu giữ nguyên; PROGRESS§5.8 có targeted compatibility.

### Luyện một môn hoàn tất trước khi đánh

Hai report `.wrangler/cultivation-v2-mastery-baseline.json` và `.wrangler/cultivation-v2-mastery-candidate.json` dùng Thiên Kiếm/one-daily-100, strategy `mastery-first`: luyện starter sở hữu hợp lệ qua production settlement tới tầng4 rồi đi campaign.

| Mốc | Lịch34 | Lịch21 đối chiếu |
| --- | ---: | ---: |
| Môn dùng được | Ngày4 | Ngày4 |
| Hoàn tất môn đầu | Ngày35 | Ngày22 |
| Boss đầu thắng | Ngày38 | Ngày25 |
| Campaign | 376 ngày | 336 ngày |
| Ngày luyện / đánh / chờ | 206 /120 /50 | 169 /120 /47 |

Cả hai bản đầu Q100%/Thông Thần/K1540. Thời gian hoàn tất gồm ngày hiệu lực, không chỉ cộng các kỳ luyện. Hai mẫu chứng minh đường luyện sớm dưới giả định harness; không chứng minh mọi phái/lịch có cùng mốc hoặc lịch21 là lựa chọn cuối.

### Phối môn và thử cứu bằng sức mạnh đã kiếm được

Report `.wrangler/cultivation-v2-candidate-mixed-rescue.json`: one-daily-80, lịch3/4/6/8, năm phái. **Cả năm đạt40 thắng và kết truyện**; không cấp sẵn39 môn tối đa.

| Phái | Ngày campaign | Probe sau cứu |
| --- | ---: | --- |
| Thiên Kiếm | 504 | Thắng; tốn21 Tu Vi |
| Bất Diệt | 609 | Không tìm được bằng chiến lược probe |
| U Minh | 429 | Thắng; tốn21 Tu Vi |
| Thái Hư | 472 | Không tìm được bằng chiến lược probe |
| Thiên Cơ | 485 | Không tìm được bằng chiến lược probe |

Rescue probe cố tình dùng mở đầu lặp rồi thử phục hồi bằng beam search có giới hạn. Ba `not_found` không chứng minh cứu không thể thắng, cũng không làm mất evidence campaign. Harness chỉ chuyển lỗi `EARNED_RESCUE_NO_VICTORY:` thành kết quả có giới hạn; lỗi khác vẫn phải báo. Bốn ca kiếm Dị Giáo qua chiêu thực thi, Thái Hư không kiếm: mang môn trong bộ chiêu chưa đủ.

### Chiến thuật lặp qua cả bốn tầng

Report `.wrangler/cultivation-v2-repeated-tactics.json`: **12.800 ca** =4 tầng ×40 lựa chọn (Võ Kỹ+39 môn) ×40 encounter ×R 60/100%. Đây là fixtures inspection, rank đề xuất, habit bonus 300/lượt, không task/vũ khí/cứu; K/Q/F/grade theo production. Lặp môn và fallback khi hồi chiêu/thiếu HP.

- **0 dominance candidate** theo tiêu chí probe; không chiêu lặp nào thắng encounter chương15 ở fixtures này.
- Perfect tier 4 thắng nhiều nhất: Kiếm Vực31/40, Vô Hồi30/40, Huyết Hải29/40, Phong Thần23/40. Mọi lựa chọn thắng ít nhất một số ca trong phạm vi probe.
- Tối đa hai trạng thái cuối trận; không chứng minh không có combo vô hạn ở mọi cách phối môn.
- Không dùng fixtures này thay earned timeline hoặc kết luận môn hỗ trợ vô dụng vì khó thắng khi lặp riêng. Đối chiếu lợi ích ba tác dụng mới ở đầu tài liệu; support trong bộ chiêu được kiểm riêng qua resolver.

### Kết luận để quyết định nhịp

Lịch21 giúp hoàn tất một môn sớm hơn và giảm ngày ở nhiều đường campaign; tuyến truyện vẫn dài hàng trăm ngày dưới điều kiện solver thuận lợi. **Đã áp lịch21 cho factory bản v2 mới; giữ lịch đã lưu.** Giảm lịch tầng sau không tự cải thiện mọi đoạn khởi đầu. Các ca support/on-off đã đạt và được đưa vào main gate nguồn cuối; không lấy probe lặp chiêu để kết luận hỗ trợ vô dụng hoặc mọi combo an toàn. Không chạy lại report nếu source/rủi ro liên quan chưa đổi.

## Baseline trước vòng v2: nội dung `than-lo-4`

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

Giới hạn: ngủ/điểm danh mỗi ngày; một seed; solver nhìn pattern đầy đủ; preview thất bại chưa commit trận/mất Tu Vi; thử tối đa4 tầng và thêm tối đa2rank cho trận chính. Các hành trình thành công chứng minh có đường tiến triển ở fixture, không chứng minh cân bằng hay độ cuốn đã đạt. Không dùng kết quả này để xóa luật tinh thuần nghiêm.

## Chiến thuật lặp — trước và sau cân bằng

`node scripts/simulate-game-tactics.ts --output <report.json>`: **3200cases**,40 encounters×40choices(Võ Kỹ+39 môn)×2purity. Cấp sẵn một môn, tầng1chương1–3/tầng2chương4–9/tầng3chương10–15, rankgợiý, habitbonus300mọilượt; khôngweapon/tasks/rescue. Lặp môn đó, chỉ dùng Võ Kỹ khi cooldown/HP không đủ. Đây là phép thử chiến thuật đơn giản, không earned traversal.

Report `D:/Tro-ly-AI-art/repeated-tactics.json` cho thấy nhiều môn10000bp thắng40/40 bằng lặp; **Kiếm Vực/Tàn Mệnh/Huyết Hải còn thắng40/40 ở6000bp**. Không có statusstack vô hạn (maxturns vẫn bounded); vấn đề là chọn chiêu/nhịp phản công chưa đủ giá trị khi có sức mạnh phù hợp. Không coi nhiều môn thắng được là đã hết dominance: một lựa chọn lặp vẫn xóa mất phần chiến thuật mà PRODUCT yêu cầu.

Đã chọn counter có báo trước trong content `than-lo-3`: bốn trận chính chương1 giữ nguyên. Các trận khác đọc chiêu nếu lặp đúng chiêu đã thi triển ở lượt trước, giảm sát thương gây ra lượt đó65% (chương≤3),75% (≤9),85% (sau9). Đổi chiêu phá thế đọc; giá thi triển, damage nhận và hiệu quả phòng thủ không đổi. Giảm bao gồm đòn trễ/phản thương, stance cố định trước intent swap. UI báo trong intent và ngay trên lựa chọn bị đọc. `repeatWard` là thuộc tính optional lưu trong intents của trận mới; snapshot v1/v2 không có vẫn chạy đúng luật cũ, không sửa globalspec công pháp.

Thử550/650/750 chưa đủ: Kiếm Vực hoàn hảo vẫn thắng38/40. Mức650/750/850 đã chạy3200cases tại `repeated-tactics-v3.json`: không chiêu nào lặp vượt toàntruyện; Kiếm Vực10000bp còn21/40,6000bp còn5/40 và cả hai không thắng ba encounter cuối. Test boss cuối có đường thắng bằng đổi giữa các chiêu công khác nhau. Rerun toàn30earned profiles/5mixed routes bên trên vẫn tới40wins. Đây là bằng chứng xử lý finding lặp chiêu cũ trong phạm vi harness, **không** là chứng minh mọi combo cân bằng hoặc F6 đã đạt toàn bộ.

## Cứu mạng bằng sức mạnh kiếm được

`--school thien-kiem --profile daily-80 --rescue`: tiếp tục account/calendar/editions của earned route, đánh lại encounter đã thắng; không cấp thêm quyền hoặc thưởng. Lặp Vô Hồi10lượt ở Thần Chiến Vương khiến HP về0; trả21 Tu Vi từ2985 xuống2964, rank7 giữ nguyên, hồi210HP. Đổi Kiếm Vực/Liên Vân/Kiếm Vực/Vô Hồi, thắng lượt14 với36HP, nhận điều kiện `vuot-tu-canh`. Report `earned-rescue-v3.json`; unit replay lại từng cast/cost và đối chiếu edition/tinh thuần đã kiếm. Không cộng sleep/checkin trong fixture chiến đấu riêng này; solver nhìn pattern. Không khẳng định mọi thế thua đều cứu được hoặc dùng ca này thay persistence/rank-rescue tests. Build thuần năm phái, mixed Dị Giáo, Kiếm Đồ/ending và rescue có các nguồn domain tương ứng cho11chiến tích; quyền lưu một lần vẫn cần evidence D1 riêng.

## Phần còn phải chứng minh

- Release audit đối chiếu11chiến tích với earned reports và D1 reward/dedupe; không dùng một report thuần Thiên Kiếm để chứng minh cả năm phái.
- Nhịp tuyến chính tách khỏi fullcollection; nhiều seed/gián đoạn hợp lý nếu finding chỉ ra rủi ro, không chạy vô hạn.
- Chiêu hỗ trợ/phòng thủ/trấnphái có giá trị trước các pattern mới; combos trong phạm vi rủi ro, không cần enumerate39 môn mọi tổ hợp.
- UX giải thích strength/purity/contribution/intent/cost và mục tiêu gần nhất bằng UI thật; network/accessibility/art toànflow còn gate riêng.
