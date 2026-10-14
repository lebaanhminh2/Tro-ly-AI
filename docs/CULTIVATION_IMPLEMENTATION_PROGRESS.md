# Tu luyện — checkpoint vòng cơ chế/UI mới

Cập nhật **14/10/2026**. **Checkpoint hiện hành duy nhất: §5.9/§6.** Tu luyện v2 đã phát hành staging, schema0038, Worker `ef677def-9126-4af5-857b-39c3bcf6f103`. Runtime source8dffbe8, artifact sourcef2b4ec6 đã push. Gates378main/44browser, type/web/build/staging; demo354.409byte, visual/performance/recovery và owner smoke đạt. [RELEASE](HABIT_GAME_RELEASE.md) ghi versions/evidence/giới hạn đầy đủ; các checkpoint khác giữ lịch sử.

## 1. Trạng thái thực tế

[Bản chốt](CULTIVATION_FINAL_BRIEF.md), [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md), [PROGRESSION](CULTIVATION_PROGRESSION_PROPOSAL.md) và [GLOSSARY](CULTIVATION_EFFECT_GLOSSARY.md) sở hữu sản phẩm/luật. Không khởi động lại vòng đã phát hành từ checkpoint lịch sử.

| Chặng | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P0 hợp đồng | Hoàn thiện | F01–F18,A01–A08 và validators giữ luật |
| P1 demo | Hoàn thiện | Chung engine/actions/views; dữ liệu riêng,khôngcloudAPI |
| P2 engine/D1/API | Hoàn thiện | V1/v2 dispatch,lịch/snapshot giữ; main378/378 và recovery |
| P3 UI/catalog | Hoàn thiện | Browser44/44; footer/crop/Nâng cấp/log đã review |
| P4 balance/performance | Hoàn thiện trong phạm vi đo | Earned120+120,mastery2,mixed5,repetition12.800;5mẫu local cuối và25ownerGET live |
| R1 release | Hoàn thiện kỹ thuật |0038,deploy,222static hash,auth/Origin,owner200,Gitpush; source/Worker tạiRELEASE |

AGENTS mới yêu cầu duyệt trước sửa code. Turn nối tiếp chỉ sửa script rehearsal và tạo .gitattributes sau hai xác nhận riêng. Metadata gốc được giữ nguyên byte trong Git,26record hashes và12checkout-filter cases đạt; unit art1/1 sau cấu hình. Runtime không đổi sau gates/deploy.

## 2. Luật cần giữ khi nối tiếp

- Hết số ngày luyện lên tầng; habit quyết định riêng phần sát thương nhận thêm của kỳ đó.
- Kỳ trước 50%, kỳ sau 100% nhận đủ phần tăng kỳ sau; thiếu cũ giữ trong độ thuần, không giảm phần sát thương đã có.
- Hiệu ứng/tỷ lệ/mốc mở tăng đủ theo tầng, không gate thuần khiết.
- Một số Sát thương nổi bật, nghĩa là tổng đòn chính chắc chắn ban đầu trước phòng ngự; số đòn và tác dụng xem trong chi tiết.
- Phái → môn → Tác dụng/Nâng cấp; tối đa hai bản được duy trì, lịch sử chỉ đọc, không ghép tầng.
- Thanh thuần gồm đã đạt/còn đạt được/đã mất; forecast có nhãn; thưởng 80/90/100 chỉ từ Q đã chốt.
- Giữ snapshots/rule/receipts/quyền cũ; không suy R từ q cũ hoặc thay trận cũ bằng catalog mới.
- Giữ task/habit/ngủ/focus/reminders/healthy/đột phá; /ngu không kết toán game.
- Vòng này dùng ảnh có sẵn; chưa nghiệm thu chất lượng art, không tạo batch art mới.

## 3. Inventory triển khai — lịch sử trước cổng cuối

Các mô tả sau giữ diễn biến triển khai; câu “còn/chưa/cần” và kích thước HTML/ảnh chỉ đúng khi ghi. §5.9/§6 sở hữu trạng thái nguồn cuối, không dùng inventory này để khởi động lại phần đã đạt.

### 3.1. Domain và dữ liệu

- `practice-progression.ts`: lịch cố định từng kỳ, R riêng, q kế thừa, Q/Qmax, audit tuần; đã thêm `ratioSettledDay`/`qualitySettledDay`, cadence và forecast theo lịch chọn thứ/quota tuần. Forecast dựa trên cadence đã ghi và giả định luyện liên tục, còn cần kiểm revision/paused/future periods.
- Factory bản v2 mới dùng3/4/6/8 (thường21/cấm32/ngoài42); edition có requiredDays riêng. Unit/integration đã kiểm lịch34 lưu từ trước tiếp tục đúng hạn, không reset. Xem §5.8; đây là local, chưa staging.
- `practice-progression.ts` đã thêm `permanentLossBp`: phần mất chắc chắn từ kết quả đã chốt, tách khỏi phần ngoài trần dự báo theo lịch hiện tại. Forecast vẫn cần kiểm revision/paused mode; không gọi mọi khoảng 100−Qmax tạm tính là khuyết điểm vĩnh viễn.
- `technique-profile.ts`: hồ sơ chung 39 môn, tách lực sát thương/lực hỗ trợ; validator thưởng danh hiệu khớp Q và trần theo tầng; Kiếm Ý/Huyền Quy/Thôn Thiên có tác dụng mới thử. Scaling Chảy máu đã nằm trong lượt focused unit 59/59.
- `practice-presentation.ts`: DTO compact không đưa member ledger ra UI, mốc mở và ngày chốt riêng; dự kiến tầng kế/giới hạn bản giữ khuyết điểm, lộ trình bản hoàn hảo đặt riêng. Upgrade rows so sánh lượng, đơn vị, thời điểm, điều kiện và giới hạn; bắt được tăng trần dù tỷ lệ nguồn giữ nguyên. Lộ trình có tác dụng hỗ trợ và trạng thái `awaitingSettlement`.
- Dispatch luyện/trận v1/v2, content `than-lo-5`, bỏ vũ khí cho trận/thưởng mới, giữ legacy snapshot. Trận v1 từ chối đổi sang edition v2.
- Migration 0038: `maintained`, `strength_score`, normalized `practice_tier_sources`; JSON/receipts lịch sử được giữ theo rehearsal đã chạy.

### 3.2. Store và API

- `game-store.ts` port/D1 đã có truy vấn chi tiết công pháp, lấy các bản maintained trực tiếp thay vì suy từ 20 history gần nhất; hỗ trợ chọn bản archived để xem.
- Route `/api/game-technique`: xác thực owner/discovery; selected edition, maintained editions, profile và upgrade DTO; context so sánh do server đặt **Công 100, không buff ngày**, private no-store.
- Overview/history dùng projection compact; HTTP không đưa contributor arrays/claim allocations chi tiết ra ngoài. Internal store vẫn có ledger cho engine.
- Ba ca integration từng thất bại đã kiểm lại đạt 3/3. Assertion 30 habit kiểm `memberCount=30`, ledger D1 đủ 30 nguồn và DTO không chứa ledger; không đưa arrays trở lại chỉ để làm test xanh. Lỗi rehearsal trong main trước đã sửa và chạy targeted đạt cả restore/legacy/v2; chưa full main sau sửa hoặc rehearsal remote mới.

### 3.3. Frontend

- `web/ui/technique-profile.js`: chung damage headline, thanh thuần có earned/possible/lost, nhóm tác dụng, so sánh nâng cấp và reference roadmap; caption/ARIA phân biệt phần mất đã chốt với trần tạm tính. Hoàn tất phân biệt chờ tuần, bản đạt giới hạn và Thông Thần.
- `web/views/game.js`: Hiện tại/Công pháp/Thử thách/Thành tựu; thẻ luyện gọn, bỏ avatar, thư viện phái → môn; Hiện tại luyện có thể render trước catalog.
- `web/features/game.js`: chi tiết lazy qua API mới, Tác dụng/Nâng cấp, chọn hai bản maintained, history lazy, xác nhận luyện lại và guards response cũ. Selector có bản archived chỉ đọc; hành động ngoài phần cuộn để thao tác được trên mobile.
- Loader overview/catalog chạy độc lập; unit đã kiểm overview render được khi catalog vẫn pending. Tìm môn không dấu dùng `gameSearchText` chung.
- Đã sửa các chuỗi tiếng Việt hỏng trong hai file game mới. Browser v2 kiểm nhãn/luồng liên quan; vẫn cần review toàn DOM/guide/errors ở vòng cuối.
- Model/state/styles đã có thay đổi local; hai browser cases và hai ảnh mobile đã được kiểm/xem trong lượt trước. Chưa đủ ma trận visual cuối.
- `web/ui/game-art.js` dùng WebP Kiếm Ý theo tầng 1–4 với ảnh lớn từ 80px; icon nhỏ và các môn khác giữ SVG. `game.js` view/feature truyền tầng bản đang xem; thẻ hiện tại đã giảm chiều cao ảnh còn 170px.
- `latestBattleResult` giữ kết quả kết thúc hôm nay/ngày trước; thẻ Hiện tại và mục boss còn cho đọc khi lịch tự trở về luyện. Có unit case cho hành vi này.
- `journey.js` đã thay cây tầng/hero boss lặp bằng danh sách boss tuyến chính phẳng; Cơ duyên riêng, không đổi unlock graph.
- `game-collection.js` dùng Tầng N, Q tổng từ snapshot v2; fallback legacy ghi Chất lượng tầng. Chiêu thực sự đã dùng đặt trước, bộ chiêu cuối và truyện mở xem riêng. Đây là bước triển khai đầu, chưa nghiệm thu toàn luồng.
- `journey.js` dùng một nút **Chọn/đổi chiêu**; `web/features/battle.js` mở sheet để xem tác dụng/preview rồi xác nhận ở footer. Header/footer ngoài phần cuộn. `web/app.js` đã nối `openBattleChoices`; guards response/footer/xác nhận cái giá giữ generation/revision/day/game/battle version. Browser kiểm stale qua ngày/version không POST, offline/retry và context refresh.
- `battleChoiceProfile`/`battleChoiceDetail` trong domain dùng snapshot và `resolveBattleTurn` với đóng góp ngày bằng 0, không mutate state. `GET /api/battle-choice` xác thực owner, trả day/gameVersion/battleVersion và private no-store; compact choices chỉ có damage headline. Swap khi intent kế chưa được xem trả reason, không trả outcome numbers/logs suy từ intent ẩn.
- UI dùng renderer chung, ghi rõ preview chưa tính buff habit/task ngày; có cảnh báo lặp, dự kiến thắng/bị hạ/hồi sinh/hết lượt và diễn biến mở thêm. Trạng thái hết hạn được bỏ khỏi bảo vệ active; reduction âm ghi Tăng sát thương nhận. Browser kiểm HP không đủ/cái giá; vẫn cần review mọi môn và đầy đủ log/rescue.
- Chuẩn bị/đổi môn dùng `profile.totalPurityBp` với bản v2, không lấy thuần tầng cuối thay tổng. Bản v1 ghi Chất lượng tầng. Bản archived xem được nhưng không thêm vào bộ chiêu mới. Guide đã đồng bộ số tầng và đường vào phái.
- Chuẩn bị mới dùng `web/ui/battle-loadout.js`: draft checkbox tối đa năm môn khác nhau, chip bỏ chọn, tìm không dấu, tác dụng lazy, radio hai bản maintained. Preset nguyên tử, lỗi giữ draft; footer tách khỏi body cuộn; boss overview60×80 đã có ảnh mở tại §5.8. Đổi một ô dùng cùng component với giới hạn1. Guards xác nhận cứu/rút/tử trận kiểm healthy/day/game/battle; nhóm sau này chưa được full browser nguồn cuối.
- CSS tab chi tiết dark đã sửa; ảnh upgrade dark mới đã mở và phần lệch nền sáng cũ không còn ở ảnh đó. Ma trận sáng/tối/chữ lớn còn phải review đủ.

### 3.4. Demo và ảnh đã tích hợp local

- `scripts/lib/cultivation-demo.ts`: session dữ liệu mẫu riêng, gọi `settlePracticeDay`, profiles/presentation/upgrade, discovery, `newBattleState`/`settleBattleDay`, rescue/death/reward functions production. Adapter nằm ngoài thư mục asset deploy. Đường cũ `web/demo/cultivation-session.ts` không còn; không tạo lại file đó.
- `docs/prototypes/cultivation/demo.js`: lắp views/features game/battle của app vào shell demo. Không có fetch fallback ra cloud; CSP `connect-src 'none'`.
- `scripts/build-cultivation-demo.mjs`: builder hiện có; chạy `node scripts/build-cultivation-demo.mjs` khi đã được phép triển khai và cần sinh lại HTML từ source. Không sửa công thức trong HTML đầu ra.
- `docs/prototypes/cultivation/kiem-y-demo.html`: **354.258 byte** đối chiếu bằng filesystem trong lượt tổng hợp này; mở trực tiếp từ repo bằng Chrome/Edge. Giữ cấu trúc thư mục vì ảnh tham chiếu `web/assets/than-lo/`. Builder đã đóng gói lịch mới/guards/exchange/log; cần sinh lại sau sửa production tiếp. Bằng chứng hiện hành ở §5.9.
- Có bộ tình huống tầng 1–4, Thông Thần, chờ tuần, hai bản, prepared/active/victory/rescue/Nghịch Mệnh/discovery/all; qua ngày, tỷ lệ 0/50/80/100 và reset. Pending-week dùng tuần Monday thực từ `habitWeekStart`, không dựng key tuần lệch.
- “Toàn danh mục” cấp quyền/bản tối đa để kiểm nội dung; fixture cứu tăng HP/Công boss để thử bị hạ. Hai fixture này không là evidence cân bằng. Refresh/reset chỉ chạm session mẫu.

Bốn ảnh runtime sao chép nguyên từ `docs/prototypes/cultivation/assets/kiem-y/v2/`; lượt kiểm đã ghi xác nhận SHA256 nguồn và đích bằng nhau. Tên nguồn lịch sử không là tên tầng trên UI mới:

| Tầng / nguồn v2 | Runtime trong web/assets/than-lo | Byte | SHA256 |
| --- | --- | ---: | --- |
| 1 / nhap-mon.webp | technique-kiem-y-tier-1.webp | 9.816 | AB25E57488DC1B89A8C6BE4EA1B84800F8486A0ACAF36F5320AFD7D537AA22A9 |
| 2 / tieu-thanh.webp | technique-kiem-y-tier-2.webp | 15.008 | B3C9FE97DD8D5733DB8A086CC3C41F6B150B63188C07140B280913712033071B |
| 3 / dai-thanh.webp | technique-kiem-y-tier-3.webp | 19.428 | F3466A38A9D60D886B3B57C2DB4FCEBB5C3C8776A98A18B15807DAFBECBA78A6 |
| 4 / vien-man.webp | technique-kiem-y-tier-4.webp | 25.490 | BF641B37025E7ABC2B51FDBFBDCDC2F677CFAD00730EB184D5A72CFF31084CEF |

Đã nối nguồn đúng **bộ v2** tại [manifest runtime](art/kiem-y-runtime-v2.json): PNG, metadata/model/revision/seed, conditioning/original sword/mask, prototype WebP và runtime WebP. `tests/unit/cultivation-art.test.ts` kiểm hash/bytes/ancestry/dimensions/distinct tiers, **1/1 đạt**. Bốn WebP tổng **69.742 byte**. `docs/art/kiem-y-concept.json` mô tả lượt ảnh cũ; không dùng thay manifest v2. Không sinh ảnh mới; review toàn ma trận và nghiệm thu mỹ thuật của người dùng còn thiếu.

**Chưa hoàn thiện:** footer chuẩn bị/đổi một ô khi chữ lớn, rerun assertion Đọc chiêu lặp, rủi ro forecast/compatibility còn lại, review ảnh/kết quả/nhật ký, cân bằng còn rủi ro, latency live và gates/release nguồn cuối. History race và builder đã xử lý; không dựng lại. Demo không là bằng chứng tài khoản thật. Trạng thái hiện hành ở §5.9/§6.

## 4. Quyết định A01–A08 đang áp dụng

| Mã | Lựa chọn và việc cần kiểm |
| --- | --- |
| A01 thành viên/cam kết | Chốt habit đủ hiệu lực ở ngày luyện đầu kỳ; mới thêm tracking ngay, góp từ tầng kế. R là trung bình tỷ lệ habit có nghĩa vụ, cùng trọng số. Kiểm sửa/lưu trữ không xóa nghĩa vụ đã ràng buộc |
| A02 tuần qua kỳ/bản/chế độ | Claim v2 trọng số 1000/ngày luyện, kể cả neutral; success thuộc receiver ngày đó, thiếu phân bổ một lần theo claim. v1 giữ trọng số/công thức cũ. Đổi môn/dừng không hủy audit |
| A03 mở/chốt | Mở tầng đúng số ngày; R chốt khi dữ liệu kỳ đủ, không đợi q cũ. q giải chuỗi kế thừa; ghi ngày chốt R/q riêng. Kiểm cron/GET muộn và atomicity |
| A04 trần thuần | Basis points, không round lên. Forecast đã xét cadence/quota, known misses và open audit; vẫn tạm tính. Có `permanentLossBp` riêng cho thiếu đã chốt; cần kiểm revision, dừng luyện, kỳ tương lai chưa bind và denominator tuần |
| A05 hai slot | Ưu tiên tầng → lực sát thương cùng nền → q → created/id; bản thứ ba giữ bản mạnh và bản mới, archive lịch sử. Kiểm active replacement/preset và chốt muộn ảnh hưởng thứ tự; không gọi Q cao nhưng yếu hơn là mạnh hơn |
| A06 legacy | v1 active tiếp tục v1; new practice v2/new battle v2/content5. Legacy edition giữ lượng/tác dụng cũ trong trận mới, không nhận tác dụng mới tự động. Preset archived báo cần chọn lại; trận v1 không nhận edition v2 |
| A07 schema/rollback | 0038 local, ledger normalized thay vì JSON dài. Rehearsal local giữ lịch sử/two slots đã chạy; remote rehearsal và binary rollback tương thích chưa có bằng chứng |
| A08 nhịp chơi | Chọn3/4/6/8 cho factory bản v2 mới, thường21/cấm32/ngoài42; giữ lịch đã lưu/v1/snapshot. Baseline/candidate/mastery/mixed/repetition dẫn tới lựa chọn này; targeted lịch/compatibility đã đạt. Chưa phát hành hoặc chứng minh toàn cân bằng; collection1.925 ngày thuộc lịch34, không gắn cho lịch mới. Bằng chứng mới ở §5.8 |

## 5. Kiểm thử: bằng chứng và giới hạn

### 5.1. Các lượt trước patch API/UI mới nhất

- Baseline đầu vòng **331/331** đạt trước thay service/D1: chỉ là baseline.
- Practice integration trước đó **9/9** đạt, log `.wrangler/cultivation-v2-practice-integration.log`: time tier, stopped weekly audit, 30 habit, hai slot/archive, migration local, scheduler/auth.
- Các lượt unit/loader cũ là lịch sử; lượt focused unit mới ở mục 5.3 đã bao gồm loader pending và Chảy máu. Không cộng các lượt chồng lặp để gọi thành tổng số tests khác nhau.

### 5.2. Log integration mới đã đối chiếu trực tiếp

`.wrangler/cultivation-v2-api-integration.log` giữ kết quả lịch sử **26 tests, 23 pass, 3 fail, 0 skip/cancel**. Cả ba ca đã sửa và chạy lại đạt trong `.wrangler/cultivation-v2-api-recheck.log`; lượt riêng đó chỉ kiểm lại ba ca. Lượt main mới nhất bao gồm integration được ghi riêng ở mục 5.4:

| Failure cũ | Cách sửa và bằng chứng |
| --- | --- |
| Battle weekly obligation | Fixture giữ assertion effort v1; đã đổi expectation v2 và kiểm purity/clock/ngày mở/ngày chốt. Ca kiểm lại đạt |
| Overview 30 weekly habits | DTO compact không còn `members`; assertion đã kiểm memberCount và 30 normalized sources trong D1 qua `practice_id`, kèm payload. Ca kiểm lại đạt |
| HTTP history fixture | Retained fixture trùng edition1 gây UNIQUE; tách retained2/archives3–23. Ca HTTP ownership/catalog/history kiểm lại đạt |

### 5.3. Các lượt trước nhóm chọn chiêu — giữ lịch sử

| Kiểm | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Focused unit trước nhóm demo | **59/59 đạt**, không skip/cancel | `.wrangler/cultivation-v2-focused-unit.log`: practice/progression/presentation/profile/loader và battle/run/economy; không phải toàn main suite |
| Focused unit sau nhóm demo/UI | **22/22 đạt** được ghi nhận ở kết quả tool lượt triển khai trước | cultivation-demo, game-library, game-loader, practice-presentation; có overlap với lượt 59. Lượt tổng hợp này chưa chạy lại và không có log riêng mới để cộng thành tổng |
| Integration kiểm lại ba failures | **3/3 đạt**, không skip/cancel | `.wrangler/cultivation-v2-api-recheck.log`; chưa full integration source cuối |
| Browser demo + v2 mới nhất | **4/4 đạt**, không skip/cancel | `.wrangler/cultivation-v2-demo/browser.log`: hai demo cases mở file/settlement/victory/rescue + hai app v2 cases headline/nâng cấp/phái/history; đã đọc lại log. Không thay toàn browser suite |
| Typecheck / check:web | Đạt trong lượt triển khai trước; **46 modules** | Ghi nhận từ kết quả tool trước checkpoint; lần tổng hợp này không chạy lại. Không thay build/staging/full gates |

Browser dùng localhost, profile thử riêng. Trong sandbox Runtime.enable không trả lời; cùng test chạy với escalation đã được automatic review chấp thuận thì đạt. Khi chạy lại, dùng quyền môi trường phù hợp, chỉ dọn process/profile thuộc harness, giữ nguyên Chrome của người dùng.

**Review cũ:** hai ảnh trong `.wrangler/cultivation-v2-visual/` từng cho thấy thẻ cao và SVG. Source sau đó đã đổi ảnh/crop; không dùng findings cũ để kết luận hiện vẫn chưa tích hợp raster.

**Ảnh trong `.wrangler/cultivation-v2-demo/` đã mở ở lượt trước bảng chọn chiêu mới:**

| Ảnh | Quan sát và phần cần sửa |
| --- | --- |
| demo-current-360.png | Một số 119, tầng 2, Q37,5%, trần 62,5%; kiếm raster đã hiện và hành động còn trong ảnh 360×844. Chữ phụ khá nhỏ/nhạt; tiếp tục kiểm readability, safe area và màn ngắn |
| demo-upgrade-320-dark.png | Đọc được +20 sát thương và xuyên 40→45; phần chọn tab có nền sáng lệch theme, contrast/state còn chưa đồng bộ. Cần kiểm cả đầu/cuối panel và chữ 200%; ảnh này không đủ xác nhận toàn bảng |
| demo-victory-390.png | Thành tựu ghi ngày/lượt và chiêu đã dùng; bộ chiêu cuối mở riêng. Dòng quyền học liệt kê dài; nên thu gọn/tách phần xem thêm để chiến tích rõ hơn |

Ảnh được tạo và review trong lượt trước, không chụp mới ở lượt tổng hợp hiện tại. CSS tab tối đã sửa sau ảnh này, cần chụp/xem lại. Các ảnh còn lại/mobile/desktop/state matrix chưa được mở lại đầy đủ; tồn tại file ảnh không là bằng chứng đã review. Boss art hiện có chưa được người dùng nghiệm thu; việc mở ảnh trên không duyệt mỹ thuật.

Các kết quả trên gắn với source local của lượt trước; sau mỗi thay đổi tiếp theo chạy lại gate bị ảnh hưởng. Chưa coi toàn v2 đã đạt hoặc đã phát hành.

Ở checkpoint trước, agent chưa chạy lại code gates, chưa mở phiên staging owner hoặc tạo dữ liệu thử tài khoản thật. Kết quả main lịch sử ở mục 5.4; kết quả sau sửa ở mục 5.5.

### 5.4. Lịch sử nhóm chọn chiêu — trước sửa hai failures

| Kiểm | Kết quả và giới hạn |
| --- | --- |
| Unit preview + progression trước hai ca forecast mới | 9/9 đạt; preview 39 môn khớp resolver, read-only, không lộ swapped intent và kiểm HP/cooldown |
| Unit preview + progression sau thêm forecast | 10/11 đạt; lỗi weekday fixture bên dưới. Không cộng với lượt 9 vì có overlap |
| Main tests | **367 tests, 365 pass, 2 fail, 0 skip/cancel**, log `.wrangler/cultivation-v2-main-tests.log`; nhận kết quả phiên 65063, không mở lượt main thứ hai |
| Typecheck/check:web | Đạt ở lượt triển khai nhóm chọn chiêu, check:web **46 modules**; chưa thay build/browser/staging gates |
| Build demo | Thành công, HTML 341.737 byte; chưa có browser proof cho bản đã sinh này |
| Browser mới | Chưa chạy sau thay bảng chọn chiêu. Case demo đã sửa thao tác mở bảng/xem/xác nhận; các case cultivation cũ vẫn cần cập nhật |

Hai failures của lượt main lịch sử này; **đã xử lý và kiểm lại ở mục 5.5**:

1. `tests/integration/upgrade-rehearsal.test.ts`: số migration áp thực tế **8**, assertion cũ **7** sau có 0038. Đã thay bằng đối chiếu danh sách migration thực sau 0030, yêu cầu có 0038; giữ các assertion bảo toàn bảng/hash legacy và thêm flow practice-v2 sau restore với một ngày luyện/một normalized source.
2. `tests/unit/practice-progression.test.ts`: forecast **5000** thay vì **6666** do fixture thứ Hai dùng `[1]` trong hệ **Monday=0**. Đã sửa hai cadence thành `[0]`, bổ sung `fallback: null` cho fixture tuần theo type thực; không đổi công thức forecast để hợp thức hóa test.

Nhóm HTTP chi tiết chiêu trong main không nằm trong danh sách failures, nhưng chưa thay browser hoặc owner staging smoke. Không claim tất cả gates xanh từ 365 tests đạt.

### 5.5. Kết quả sau sửa — bằng chứng mới nhất

| Kiểm | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Targeted progression + preview + upgrade rehearsal | **13/13 đạt** | Kết quả tool ở lượt triển khai trước; bao gồm hai flow rehearsal đầy đủ, forecast và read-only preview. Không cộng vào 365 để suy ra full main đã đạt |
| Typecheck | Đạt | `npm.cmd run typecheck` trong lượt triển khai sau sửa; chưa build/staging gate |
| check:web | Đạt, **46 modules** | `npm.cmd run check:web` sau sửa |
| Sinh demo | Thành công, **342.498 byte** | Builder hiện có; byte đã đối chiếu lại trong lượt tổng hợp |
| Browser Tu luyện + demo | **12 tests, 12 pass, 0 fail/skip/cancel, exit 0** | `.wrangler/cultivation-v2-choice-qa/browser-verified.log`; phiên 25728 kết thúc, 40,2 giây. Hai file cultivation-flows/cultivation-demo; chưa full browser của mọi tab |
| Full main/full browser/build/staging nguồn cuối | **Chưa chạy đủ** | Main gần nhất còn là log 365/367 trước sửa. Không suy targeted/browser thay các gate này |

Browser mới kiểm: xem chiêu không ghi lựa chọn hoặc kết toán; intent ẩn không lộ qua preview; offline/retry; chiêu thiếu HP không xác nhận; stale cost confirmation qua ngày/version không POST; response stale vô hiệu footer và refresh hoạt động; header/footer ở 320×460 và chữ 200%. Harness giữ production strength/Q và maintained filter. Library duyệt render/identity đủ 39 môn trong bảy nhóm; hồ sơ đủ 40 encounter và nội dung chương. Đây là coverage UI/contracts, không là evidence đã kiếm được mọi quyền qua campaign v2.

Các log `browser.log` 9/11 và `browser-final.log` 11/12 trong cùng thư mục là lượt cũ; `browser-verified.log` là lượt đạt sau sửa selectors/nhãn. Không xóa failure history hoặc gộp số tests chồng lặp.

**Ảnh QA mới đã mở xem:**

| Ảnh trong .wrangler/cultivation-v2-choice-qa/ | Quan sát | Phần còn phải kiểm |
| --- | --- | --- |
| v2-choice-390-dark.png | Bảng chọn có một damage headline, tác dụng/preview và footer riêng; đã mở ở lượt triển khai trước | Mọi chiêu dài/cái giá/điều kiện và trạng thái disabled |
| demo-upgrade-320-dark.png | Dòng nâng cấp đọc được, nền tab dark đã đồng bộ; đã mở ở lượt triển khai trước | Toàn lộ trình/các môn hỗ trợ và chữ lớn |
| demo-current-360.png | Kiếm raster, một headline, thanh thuần và thời gian gọn; đã mở ở lượt triển khai trước | Ma trận pending/max/khuyết điểm và readability |
| v2-choice-320-large.png | Mở trong lượt tổng hợp này: ở vị trí cuộn đang chụp vẫn thấy tiêu đề/X và nút Chọn Kiếm Ý; body cuộn riêng | Chưa dùng ảnh này xác nhận mọi nội dung body đều đọc được hoặc đúng trên máy thật |
| v2-preparation-320-dark.png | Mở trong lượt tổng hợp này: tiêu đề/X và Chuẩn bị xuất chiến truy cập được, ngày bắt đầu và tạm dừng luyện đọc được | Review thêm bộ chiêu, chọn hai bản, native select trong phần tùy chỉnh và toàn luồng chuẩn bị |

Tại checkpoint §5.5 còn thiếu ma trận visual, provenance, phép đo và simulation. Phần provenance/phép đo local/baseline simulation đã được bổ sung sau đó ở §5.6; visual matrix đầy đủ, cân bằng và gates nguồn cuối vẫn chưa xong. Lượt tổng hợp hiện tại không tạo ảnh hoặc sửa code.

### 5.6. Simulation, nguồn ảnh và hiệu năng local

Các thay đổi code/tooling ở phần này được thực hiện trong lượt triển khai trước theo quyền GOAL. Lượt tổng hợp hiện tại đọc lại report/log và thu phiên browser **29652: exit 0**; không mở thêm test hay sửa code.

| Kiểm chứng | Kết quả | Nguồn và giới hạn |
| --- | --- | --- |
| Earned simulation v2 unit | **3/3 đạt** | `.wrangler/cultivation-v2-simulation-tests.log`; quyền 39/40 kiếm qua thắng, increments/R khác q, snapshot, audit/neutral/mixed và day accounting |
| Legacy profiles | **4/4 đạt** | `.wrangler/cultivation-v2-legacy-profiles-recheck.log`; v1 giữ mặc định, không cộng vào tổng full suite |
| Baseline thuần phái | **120 hành trình hoàn tất chạy** | `.wrangler/cultivation-v2-matrix-pure.json` và `.log`; phiên 4575 đã exit 0. 24 profile ×5 phái; không có nghĩa 120 campaign đều thắng |
| Lịch đối chiếu3/4/6/8 | **120 hành trình hoàn tất chạy** | `.wrangler/cultivation-v2-candidate-21-pure.json` và `.log`; phiên24191 đã exit0. Đây là counterfactual, chưa đổi runtime |
| Full collection mẫu | **40 thắng, 39 bản** | `.wrangler/cultivation-v2-one-daily-80.json`; Thiên Kiếm/1 habit hằng ngày 80%, campaign 404 ngày; tổng 1.925 =1.674 luyện +163 đánh +88 chờ |
| Provenance Kiếm Ý | **1/1 đạt** | Manifest `docs/art/kiem-y-runtime-v2.json` + `tests/unit/cultivation-art.test.ts`; nguồn đúng v2, không là duyệt mỹ thuật |
| D1 bốn tầng ×30 habit | **1/1 đạt** | `.wrangler/cultivation-v2-four-tier-budget.log`; 120 normalized sources, kết toán đúng ngày, DTO không mang ledger |
| Browser performance local | **5 mẫu, exit 0** | `.wrangler/cultivation-v2-performance.json` và `.log`; browser riêng, viewport390×844, latency150ms,100KiB/s, không CPU throttle |

**Baseline thuần phái theo tỷ lệ habit mục tiêu:**

| Tỷ lệ | Số hành trình | Tới kết truyện | Khoảng ngày tới kết thúc hành trình |
| --- | ---: | ---: | ---: |
| 0% | 30 | 0 | 223–335; dừng khi solver không tìm được đường tiếp |
| 50% | 30 | 28 | 333–668; gồm hai hành trình dừng sớm |
| 80% | 30 | 30; mỗi hành trình 40 thắng | 362–608 |
| 100% | 30 | 30; mỗi hành trình 40 thắng | 338–494 |

Hai ca 50% chưa tìm được đường: Bất Diệt/one-weekly-50 tại Trường Sinh (ngày333/rank 4); Thiên Cơ/one-weekdays-50 tại Thần Chiến Vương (ngày618/rank 9). Không ghi chúng là boss bất khả thi. Môn đầu dùng được ngày8–9, ba môn ngày19–23. Policy chỉ luyện tầng4 khi cần; milestone hoàn tất một môn của policy không phải thời điểm sớm nhất người chơi có thể đạt tầng4.

Harness dùng `newTimePracticeVersion`/`practiceStrength` và battle-v2; theo lịch thật từ ngày kế tiếp, không cấp sẵn quyền/max. Tuy nhiên solver nhìn toàn pattern, tìm chiến thuật có giới hạn; các thử nghiệm thất bại chưa commit trận và chưa bị tính phí cứu/thua/chờ. Ngủ/điểm danh đều và đột phá thuận lợi. Vì vậy đây là bằng chứng đường tiến triển dưới giả định đã ghi, chưa là thời lượng hoặc độ cuốn của người thật. Report có config/seed/source hashes; baseline predates bổ sung `campaignTimeline` và tham số thử thời lượng, không tự gắn fingerprint của source cuối vào nó.

**Lịch đối chiếu đã xong:** phiên **24191 exit0**, log `.wrangler/cultivation-v2-candidate-21-pure.log`, report `.wrangler/cultivation-v2-candidate-21-pure.json` đủ120 hành trình. `--days 3,4,6,8` chỉ đổi lịch edition mới của harness; runtime factory/lịch đã lưu giữ nguyên. Tổng thường 21/cấm 32/ngoài 42; max39 môn lý thuyết1.033 ngày luyện. Kết truyện:0%=0/30,50%=29/30,80%=30/30,100%=30/30. Ngày ở80%=335–540,100%=308–463. So cặp đều hoàn thành:50% giảm median37 ngày (28 cặp),80/100% giảm30 ngày (30 cặp mỗi nhóm); một cặp80% chậm hơn32 ngày. Một ca50% Bất Diệt/one-weekly dừng tại Thần Chiến Vương ngày588/rank 9. Hai script khác hashes, các domain source trong hai report cùng hashes. Chi tiết tại [BALANCE](HABIT_GAME_BALANCE.md); chưa chốt lịch phát hành.

**Ngân sách D1 local:** peak settlement **22 SQL/ngày**; JSON edition **1.527 byte**; overview **13 SQL/25.373 byte**; detail **7 SQL/14.642 byte**. Fixture setup không tính vào query runtime. Bài này kiểm đủ bốn tầng/120 nguồn, không chỉ một tầng/30 nguồn. Local Miniflare không chứng minh latency D1 remote.

**Thời gian browser local, median của 5 mẫu:** phản hồi shell **14,1ms**; nội dung Hiện tại **300,8ms**; vùng đầu sẵn sàng kèm ảnh **756,5ms**; mở lại Công pháp có cache **6,6ms**; chi tiết lazy **692,8ms**. Nội dung đầu range287,6–301,3ms; vùng đầu684,9–759,9ms. Mốc bắt đầu là thao tác mở tab sau khi shell app đã sẵn sàng; không là tải app từ navigation/login. Thời gian vùng đầu còn đợi catalog chạy song song; report có resource timing để tách. Không có Worker/D1 latency, mobile CPU throttle hoặc máy điện thoại thật; không claim staging nhanh hơn từ số này.

**Next action tại checkpoint §5.6 (lịch sử):** khi đó còn đo max một môn sớm/mixed/tactical. Các probes này đã được bổ sung tại §5.7 và factory đổi tại §5.8; dùng next action ở **§5.8/§6 hiện hành**. Nhóm simulation/performance §5.6 không còn handle cần thu; giữ bằng chứng theo đúng source, không poll lại.

### 5.7. Nhóm mới nhất — chuẩn bị bộ chiêu và probes cân bằng

Tên mục giữ để bảo toàn liên kết. Đây là **checkpoint lịch sử trước §5.8**; các câu chưa đổi runtime/chưa mở ảnh bên dưới mô tả thời điểm đó, không ghi đè trạng thái hiện hành.

Lượt tổng hợp hiện tại đã đọc log/report và đối chiếu source; kết quả dưới đây thuộc lượt triển khai trước. Không chạy lại tests hoặc sửa code trong lượt tổng hợp này. Các tiến trình được ghi ở đây đã kết thúc; không còn handle cần poll.

**Inventory mới:** `web/ui/battle-loadout.js`, `web/features/battle.js`, `web/features/battle-presets.js`, `web/styles.css`, `tests/browser/cultivation-flows.test.mjs`; cập nhật `scripts/simulate-game-profiles.ts`, `scripts/simulate-cultivation.ts`, `scripts/simulate-game-tactics.ts` và sinh lại HTML. Component bộ chiêu chỉ giữ draft, tải qua callback; không tự mutation khi xem chi tiết. `setVersions` kiểm nguyên tử, preset lỗi không đổi draft, radio chọn đúng ID bản maintained. Hồ sơ boss gọn và footer ngày hiệu lực/hành động cố định.

| Kiểm | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| Browser Tu luyện/demo sau đổi loadout | **13 tests: 12 pass, 1 fail** | `.wrangler/cultivation-v2-loadout-qa/browser.log`; lỗi fixture dùng ID `thien-nhan` không có, API 404. Đã sửa thành `quan-thien` |
| Kiểm lại ca loadout bị lỗi | **1/1 đạt** | `.wrangler/cultivation-v2-loadout-qa/limit-recheck.log`; giới hạn 5, lazy/search, draft không mutation, footer và submitted IDs. Không cộng thành full 13/13 |
| Typecheck / check:web | Typecheck đạt sau script/UI mới; check:web **47 modules** đạt trước thu gọn boss overview | Kết quả tool lượt triển khai trước; nguồn sau sửa cuối cần gate lại |
| Demo sinh lại | **349.109 byte** | Đối chiếu filesystem trong lượt tổng hợp; cần browser nguồn cuối |
| Luyện một môn tới tầng 4 trước campaign | Hai hành trình kết thúc, report đã có | `.wrangler/cultivation-v2-mastery-baseline.json` và `cultivation-v2-mastery-candidate.json` |
| Phối môn và thử cứu | **5/5 hành trình tới kết truyện, 40 thắng mỗi ca** | `.wrangler/cultivation-v2-candidate-mixed-rescue.json`; lịch21, one-daily-80, năm phái. Rescue probe chỉ tìm được ở hai ca, ba ca `not_found` |
| Lặp một chiến thuật | **12.800 ca, 0 dominance candidate theo tiêu chí probe** | `.wrangler/cultivation-v2-repeated-tactics.json`; bốn tầng ×40 lựa chọn ×40 encounter ×hai tỷ lệ. Fixtures cấp strength, không phải earned timeline hoặc toàn balance |

**Ảnh loadout đã mở ở lượt triển khai trước:** `v2-loadout-390-dark.png`, `v2-loadout-320-large.png`, `v2-preparation-320-dark.png` trong `.wrangler/cultivation-v2-loadout-qa/`. Header/footer truy cập được; ảnh màn chuẩn bị ngắn cho thấy boss overview cũ chiếm quá nhiều không gian. Sau đó đã thu ảnh boss về60×80 và gộp overview, **chưa có ảnh mới đã mở để chứng minh sửa cuối**. Không dùng ảnh trước sửa làm visual gate nguồn cuối.

**Mastery-first, Thiên Kiếm / one-daily-100:**

| Mốc | Lịch34 | Lịch21 đối chiếu |
| --- | ---: | ---: |
| Môn đầu dùng được | Ngày4 | Ngày4 |
| Hoàn tất môn đầu | Ngày35 | Ngày22 |
| Boss đầu thắng | Ngày38 | Ngày25 |
| Campaign | 376 =206 luyện +120 đánh +50 chờ | 336 =169 luyện +120 đánh +47 chờ |

Cả hai giữ Q100%/Thông Thần, K1540; mốc mở tính cả ngày hiệu lực. Đây là hai mẫu chiến lược chủ động luyện hoàn tất, không thay matrix120 hoặc chứng minh tất cả phái/lịch có cùng nhịp.

**Mixed/rescue:** Thiên Kiếm504 ngày, Bất Diệt609, U Minh429, Thái Hư472, Thiên Cơ485. Thiên Kiếm/U Minh thắng sau cứu và tốn21 Tu Vi; ba probe còn lại không tìm thấy đường thắng bằng chiến lược mở đầu lặp đã chọn. `not_found` không chứng minh cứu bất khả thi; không được làm mất kết quả campaign hoặc nuốt lỗi khác. Bốn ca kiếm Dị Giáo qua chiêu thực dùng; Thái Hư không kiếm, đúng điều kiện không dựa riêng vào bộ chiêu.

**Repetition:** tại rank đề xuất và fixtures R 60/100%, không lựa chọn lặp nào thắng encounter chương15. Perfect tier 4 thắng nhiều nhất: Kiếm Vực31/40, Vô Hồi30/40, Huyết Hải29/40, Phong Thần23/40; tối đa hai trạng thái cuối trận. Probe lặp/fallback không chứng minh mọi combo, vai trò hỗ trợ hay lợi ích bật/tắt ba tác dụng mới đã cân bằng. Báo cáo có timestamp/source hashes/fixture; không gắn cho source sửa tiếp.

**Next action của checkpoint lịch sử này:** lúc đó cần browser/ảnh/pacing, runtime durations chưa đổi. Browser13/13 và ảnh compact overview sau đó đã đạt, factory21 đã áp tại §5.8. Nối tiếp theo **§5.8/§6**, không làm lại các bước đã giải.

### 5.8. Checkpoint lịch sử — factory21, guards và đổi một ô

**Checkpoint lịch sử, được §5.9 cập nhật.** Các câu “chưa rerun”/“chưa chạy” dưới đây diễn tả thời điểm của lượt đó.

Đối chiếu trực tiếp source/log trong lượt tổng hợp này. Các kiểm dưới đây chạy ở lượt triển khai trước; lượt này chỉ đọc và cập nhật Markdown.

| Phần | Kết quả thực | Bằng chứng / giới hạn |
| --- | --- | --- |
| Browser Tu luyện/demo sau compact boss overview | **13/13 đạt**, không skip/cancel | `.wrangler/cultivation-v2-final-qa/browser.log`; trước sửa guards/exchange tiếp theo, chưa full browser mọi tab |
| Lịch mới và giữ lịch đã lưu | **25/25 targeted domain đạt** | `pacing-tests.log` cùng thư mục; gồm progression/presentation/profile. Predates test support mới thêm |
| D1 lịch34 đã lưu và bốn tầng×30 habit | **2/2 đạt** | `persisted-schedule.log`; edition1.520byte, peak22SQL/ngày, overview13SQL/25.281byte, detail7SQL/14.618byte; Miniflare local |
| Typecheck / check:web | Đã đạt trong nhóm lịch mới | 47 modules; trước sửa cuối, không thay gate nguồn cuối |
| Focused rescue / preparation / exchange | **3 ca: 2 đạt, 1 thất bại** | `exchange-browser.log`: failure so sánh fixture do JSON clone bỏ `strength: undefined`; source đã đổi thành `structuredClone`, **chưa rerun**. Không ghi là exchange đã đạt |
| Lợi ích Huyền Quy trong bộ chiêu | Test mới đã thêm, **chưa chạy** | `tests/unit/technique-profile.test.ts`, ca equipped support/on-off qua resolver; không lấy số25/25 trước đó chứng minh ca này |
| Demo | **349.109byte, cần sinh lại** | HTML đã đóng gói source trước factory21/guards/exchange mới nhất; không sửa công thức trực tiếp trong HTML |
| Full gates / release | **Chưa đạt đủ / chưa phát hành v2** | Chưa full main/browser/build/staging source cuối hoặc remote migration/deploy/commit/push vòng này |

**Ảnh đã mở ở lượt triển khai trước:** `.wrangler/cultivation-v2-final-qa/v2-preparation-320-dark.png`, `v2-loadout-390-dark.png`, `v2-loadout-320-large.png`. Boss overview60×80, header/footer truy cập được, body cuộn riêng. Ảnh exchange và ma trận nguồn cuối còn phải mở xem; không suy từ việc file screenshot tồn tại.

**A08 đã áp local:** `TIME_PRACTICE_DAYS=[3,4,6,8]` chỉ trong `newTimePracticeVersion`; cấm làm tròn từng kỳ thành5/6/9/12, ngoài6/8/12/16. requiredDays/costs của bản đã lưu, v1 và snapshot giữ nguyên. Các report đối chiếu giữ fingerprint gốc; không gắn report cũ cho source cuối hoặc rerun120hành trình chỉ vì factory nay khớp lịch đã thử.

**UI đã sửa tiếp nhưng còn gate:** `submitCurrent` và `confirmCommand` kiểm revision/ngày/game/battle/healthy/busy trước POST; stale quote refresh. Đổi một ô dùng bộ chọn giới hạn1, chi tiết lazy, chọn đúng maintained edition và retry offline. Giới hạn5 của chuẩn bị giữ. Fixture exchange đã phản ánh chỉ đổi slot, giữ state và tiêu quyền; integration production có ca liên quan, browser mới chưa được coi là đạt.

**Rủi ro cụ thể mới thấy trong source:** `battle.ts` hiện log đòn chỉ có HP mất; thiếu raw/protection absorption để giải thích kết quả. `openBattleHistory`/archive dùng phần tử loading đã tháo khỏi DOM, nên lỗi trang tiếp có thể không hiện. Cần metadata/mô tả v2 từ resolver, history retry/stale và thứ tự diễn biến; không thay kết quả combat/log legacy. Các file thuộc PLAN§11; lần chạy tiếp ghi inventory nhóm trước sửa.

**Next action:** rerun focused exchange/rescue/preparation sau sửa fixture và test support mới; mở ảnh exchange. Giải rủi ro log/history/forecast/legacy, sinh lại demo, rồi visual/performance/full gates/rehearsal/staging và bàn giao. Không có handle tiến trình còn chạy cần poll.

### 5.9. Checkpoint hiện hành — đã bàn giao staging v2

Branch `review/p1-p3`; runtime source `8dffbe8`, artifact source `f2b4ec6`, đã push thường. Worker `ef677def-9126-4af5-857b-39c3bcf6f103`, schema 0038. Commit đóng gói/tài liệu sau release không đổi binary/assets. URL và bảng latency ở [RELEASE](HABIT_GAME_RELEASE.md).

| Phần | Bằng chứng nguồn giao | Giới hạn |
| --- | --- | --- |
| Main | **378/378**,0 fail/skip,819,84 s | `delivered-main.log`,không cộng lượt cũ |
| Browser | **44/44**,0 fail/skip | `checked-browser.log`;320×460/chữ200%,prepare/exchange/guards/history race |
| Type/web/build/staging |exit0;47 modules,230 files,719,90 KiB/gzip166,71 KiB | `delivered-*.log`; đây là gates, deploy có report riêng |
| Demo/visual |354.409 byte chung production source;104 demo captures,320/360/390/1440,hai theme/chữ200% | Agent mở sheets/màn thật; sửa lazyload capture,cropdesktop,cuộnNâng cấp/footer. User chưa duyệt mỹ thuật |
| Cơ chế/catalog |39 môn×4 tầng,40 encounter; R/q/forecast/pending/neutral/revision/legacy, log/preview/support covered | Main và profile/progression/browser; solver không là kỳ vọng người thật |
| Localperformance |5 mẫu cuối,390×844, 150 ms,100 KiB/s | Shell13,6–17,6 ms,content303–313,8 ms,ảnh740,8–759,1 ms,warm5,2–6,8 ms,detail734,7–775,2 ms; không Worker/D1 |
| D1 | Lịch34 và4 tầng×30habit đạt | Peak22SQL/ngày,overview13SQL/25.281byte,detail7SQL/14.618byte,Miniflare local |
| Backup/restore | Backup mới1.632.676 byte;0038/integrityok/0 FK,99 bảng cũ unchanged,1 bảng mới | `release-restore.json`; SHA256 `0FF106002333390C413E07DC5F94FF7D5BF1D4418F85A79775269E1375751B7D` |
| Recovery | Bundle GET content 1–5/practice-v1/v2 đều200/parity;401không auth,state/version giữ; restoredDB read-only | `release-recovery.json`; bundle SHA256 `567a9edf921e4b5cfb56d823d2049ca9e09e1a8a6ff763584fe8fc14bdb65b87`; local workerd 2026-08-06,cloud config 2026-09-11 |
| Packaging | Metadata giữ raw bytes,26 records/12 checkout filters khớp hash; .gitattributes -text đã duyệt | `release-art-packaging.log`1/1; provenance gốc không sửa |
| Remote |0038 applied,listing 0 pending,quick_check ok,0 FK;deploy exit0,Worker trên | Không reset/production/force-push |
| Static/auth |222 files200/hash match;8 APIs401,foreignOrigin403 | `release-public-assets-auth.json`;230 là số Wrangler đọc |
| Ownerlive |25 GET/5 endpoint×5 mẫu đều200,0 runtime error; catalog than-lo-5,chi tiết Kiếm Ý200 | `release-owner-reads.json`; read-only actions,không seed/tin thử. Median game482,6ms/catalog213,2ms/detail359ms; không benchmark mọi dữ liệu |

Artifacts private ở `.wrangler/cultivation-v2-final-qa/`, ngoài Git. Gates fingerprint/source giữ nguyên; không gắn số đo lịch sử cho source mới. Quy trình phục hồi ở OPERATIONS: binary phải hiểu v1/v2/content 1–5, không restore backup cũ đè writes mới.

## 6. Sau bàn giao

**Vòng triển khai kỹ thuật đã hoàn tất theo PLAN§12.** Đủ staging/HTML/hướng dẫn/luật/trị số/source/Worker/migration và evidence. Người dùng thử [staging](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/) và [demo](prototypes/cultivation/kiem-y-demo.html), nghiệm thu mỹ thuật/trải nghiệm dài ngày.

Phản hồi tiếp theo được xử lý trong phạm vi mới, theo AGENTS và quyền user mới nhất. Không tự làm batch art mới, thêm feature hoặc chạy lại probes/gates đã đủ khi chưa có finding/sourcechange. Các mục dưới giữ lịch sử tại thời điểm ghi, không ghi đè checkpoint này.

### 6.1. Kết quả lượt tổng hợp tài liệu

Lượt tổng hợp hiện tại đồng bộ BRIEF/PLAN/PROGRESS/GOAL/PROGRESSION/HANDOFF/README demo và index tài liệu, giữ glossary làm nguồn tên gọi và BALANCE làm nguồn simulation. Thay các chỉ dẫn stale race/HTML cũ bằng checkpoint thực, tách bằng chứng đạt với lỗi còn lại và rehearsal trên bản sao với remote release. Không tạo thêm đặc tả cạnh tranh. Đã kiểm9tài liệu,115liên kết local, đủ18luật F01–F18, các điểm hợp đồng, fence và ký tự thay thế: không lỗi. Prompt đã có nguồn OpenAI tại GOAL§5; không tuyên bố tra lại nguồn đó trong lượt này.

Chỉ sửa Markdown, thu kết quả performance đã chạy và đối chiếu logs/source; không sửa code/asset, chạy lại suites, sinh HTML, commit/push hoặc deploy. Goal cùng phạm vi vẫn active và chưa hoàn tất; yêu cầu hiện tại là chuẩn bị bản tổng hợp để người dùng chạy tiếp sau. **Next khi được phát lệnh: §6 mục1**, rồi hoàn thiện mọi cổng bàn giao PLAN§12. Kết quả kiểm tính nhất quán tài liệu được ghi sau khi kiểm, không dùng nó thay gates sản phẩm.

## 7. Nhật ký triển khai và mẫu checkpoint

### Nhóm GOAL hiện tại — sửa footer chữ lớn rồi phát hành nguồn cuối

Continuation đã xác nhận toàn inventory PLAN§11 và quyền tự triển khai trong phạm vi. **Inventory trước nhóm sửa:** `tests/browser/cultivation-flows.test.mjs` chụp footer chữ lớn trước assertion để xem lỗi thật; `web/features/battle.js` và `web/styles.css` điều chỉnh nơi đặt thông tin dài/footer theo ảnh; giữ ngày/version/giới hạn5/1 và các assertion truy cập. Sinh lại `docs/prototypes/cultivation/kiem-y-demo.html` bằng builder sau sửa production. Không tạo lại engine hoặc thay cơ chế/kinh tế. Đầu ra tiếp là focused chuẩn bị/đổi ô/Đọc chiêu lặp đạt, ảnh thực đã xem; sau đó review ma trận, gates nguồn cuối và staging theo§6/PLAN§12.

Footer đã sửa và mở ảnh thật: ghi chú dài vào body cuộn, footer chỉ hành động; focused3/3 và full browser44/44 đạt. Review ảnh matrix thấy vài ảnh sáng chụp trước khi lazy image tải xong, ảnh chữ200% chỉ có header. **Inventory bổ sung trước sửa:** `tests/browser/cultivation-demo.test.mjs` đợi ảnh thực ở viewport tải thành công trước chụp, thêm ảnh phần nội dung sau cuộn ở chữ200%. Không thay UI/công thức chỉ để ảnh đẹp. Owner đã đăng nhập lại cửa sổ profile app cho smoke read-only, không in token/cookie.

Review matrix phát hiện kiếm bị crop nặng ở1440 do frame luôn cao170px; tab Nâng cấp ở sheet nhỏ chỉ lộ tiêu đề lợi ích sau phần profile dài. **Inventory bổ sung trước sửa:** `web/styles.css` dùng ảnh Kiếm Ý contain/tỷ lệ gốc có chiều cao giới hạn; `web/features/game.js` đưa nội dung Tác dụng/Nâng cấp vào viewport khi người dùng đổi tab, không tự cuộn lúc mở. Cập nhật builder/output và rerun browser/build/staging/web nguồn cuối; domain không đổi, main378/378 đã kết thúc đạt trước nhóm CSS/web này. Report performance đã kết thúc, không poll handles mất. Rehearsal tiếp dùng bundle recovery-candidate và actual restored copy, không dispatch/remote mutation.

**Inventory bổ sung cho rehearsal reproducible:** tạo `scripts/rehearse-cultivation-release.ts` trong tooling PLAN§11: chạy bundle Worker đã build bằng Miniflare offline với snapshots content1–5/practice-v1/v2 tổng hợp, GET profile/preview so production domain và kiểm không ghi state; mở restored SQLite read-only để kiểm source adapters/schema/integrity mà không dispatch. Report chỉ hash/count/status/version, không xuất row/secrets. Candidate rollback là chính bundle tương thích này ở commit nguồn cuối; binary pre-v2 không được dùng sau writes v2.

Review matrix phát hiện kiếm bị crop nặng ở1440 do frame luôn cao170px; tab Nâng cấp ở sheet nhỏ chỉ lộ tiêu đề lợi ích sau phần profile dài. **Inventory bổ sung trước sửa:** `web/styles.css` dùng ảnh Kiếm Ý contain/tỷ lệ gốc có chiều cao giới hạn; `web/features/game.js` đưa nội dung Tác dụng/Nâng cấp vào viewport khi người dùng đổi tab, không tự cuộn lúc mở. Cập nhật builder/output và rerun browser/build/staging/web nguồn cuối; domain không đổi, main378/378 đã kết thúc đạt trước nhóm CSS/web này. Report performance đã kết thúc, không poll handles mất. Rehearsal tiếp dùng bundle recovery-candidate và actual restored copy, không dispatch/remote mutation.

### Lượt tổng hợp hiện tại — chuẩn bị chạy tiếp toàn phạm vi

Đã đối chiếu goal active, git/source, HTML và các log gần nhất; thu kết quả performance đã chạy. Chỉ sửa8file Markdown: FINAL_BRIEF, PLAN, PROGRESS, GOAL, PROGRESSION, HANDOFF, README demo và index docs. Không sửa code/asset, chạy lại suites, commit/push/migration/deploy. Quyết định sản phẩm giữ nguyên; sửa các chỉ dẫn đã lỗi thời để agent không làm lại history race/builder/backup đã có.

Checkpoint hiện hành duy nhất ở **§5.9/§6**: footer chuẩn bị/đổi một ô ở chữ200% và rerun Đọc chiêu lặp là bước tiếp; sau đó review ảnh/rủi ro cơ chế/cân bằng, gates nguồn cuối và release. Các mục bên dưới là lịch sử tại thời điểm ghi; câu “đang chạy” trong chúng không là trạng thái tiến trình hiện tại.

### Lịch sử nhóm tiếp tục GOAL — race nhật ký và cổng nguồn cuối

Goal continuation đã cấp quyền PLAN§11 và phụ thuộc trực tiếp. Lượt tổng hợp trước là **progress**: đã đồng bộ tài liệu và bằng chứng nối tiếp. Lượt này bắt đầu từ§5.9; không tạo lại engine hoặc các probes đã giải.

**Inventory trước sửa:** `tests/browser/app-harness.mjs` thêm cổng chờ GET do test điều khiển để tạo race xác định; `tests/browser/cultivation-flows.test.mjs` khởi động reload game trước mở history, xác minh dữ liệu mới đã render rồi giải phóng trang history cũ. Giữ các assertion offline/retry/dedup/read-only và stale; không sửa lifecycle/guards production. Sau targeted đạt, sinh `docs/prototypes/cultivation/kiem-y-demo.html` bằng builder đã có rồi chạy gates/visual/performance/rehearsal/release theoPLAN.

Ca history đã **1/1 đạt** tại `history-gated-recheck.log`. Đã mở `v2-log-history-390.png`: header/X truy cập được, nhưng breakdown nhiều số đang nối thành đoạn văn dày. **Inventory bổ sung trước sửa:** `web/features/battle.js`, `web/styles.css` dùng metadata hit v2 để tách kết quả HP và mục Chi tiết sát thương; các lớp phòng ngự thành bảng ngắn, không tính lại. Cùng renderer cho preview/history; legacy giữ chữ gốc. `tests/browser/cultivation-flows.test.mjs` dùng metadata fixture, kiểm mặc định gọn/mở chi tiết đúng và giữ race đã đạt. Sinh lại HTML sau nhóm; không đổi domain/combat/kinh tế.

**Inventory bổ sung cho visual gate:** `tests/browser/cultivation-flows.test.mjs` thêm360px, ảnh chữ200% và Nâng cấp cả sáng/tối; `tests/browser/cultivation-demo.test.mjs` chụp ma trận trạng thái luyện/pending/max/hai bản/chuẩn bị/trận/cứu/kết quả qua320/360/390/1440 và hai theme. Dùng tình huống demo đã có, không thêm gameplay hoặc công thức fixture. Mở xem ảnh/montage sau test và xử lý findings cụ thể.

Full browser lượt đầu44ca:38đạt/6thất bại, do selectors/luồng guide/next-step/export từ UI cũ. **Inventory bổ sung:** `tests/browser/app-flows.test.mjs` kiểm hành vi tương ứng qua card mới, sheet chọn/xác nhận chiêu, danh sách boss, guide theo yêu cầu và Xuất hồ sơ; giữ assertions coalescing/auth/version/no-auto-write. `web/views/game.js` dùng `returnGameSummary` hiện có làm một dòng ngữ cảnh cho lượt rút/hết hạn cũ, không thêm dashboard; `web/models/practice.js` sửa tiếng Việt v2 hỏng và nhãn Tầng N; `web/features/game-export.js` thống nhất nhãn hồ sơ. `tests/browser/app-harness.mjs` thêm scaleText thực theo computed px, dùng tại các visual cases đã liệt kê; không xem font-size gốc200% là proof mọi chữ đã lớn. Main session9861 đang chạy; build/staging sessions56593/76249 đã exit0, không restart main chỉ vì chờ.

Nhật ký bên dưới giữ các lượt trước. **Điểm nối tiếp duy nhất hiện tại là §5.9/§6.** Những câu “mới nhất”/“next action” trong từng lượt chỉ đúng ở thời điểm ghi.

### Nhóm triển khai tiếp — nhật ký sát thương và lịch sử tải thêm

Focused exchange/rescue/preparation **3/3 đạt** (`exchange-recheck.log`); progression/presentation/profile **26/26 đạt**, gồm test support Huyền Quy mới (`domain-recheck.log`). Đã mở ảnh `v2-exchange-320-dark.png`: header/X và footer thao tác truy cập được ở320px; body cuộn riêng. Còn ma trận/gates cuối.

**Inventory trước sửa:** `src/domain/battle-armor.ts`, `src/domain/battle.ts`, `tests/unit/battle-preview.test.ts` để đưa breakdown từng đòn từ resolver vào log v2, giữ kết quả combat và log v1; `web/features/battle.js`, `tests/browser/app-harness.mjs`, `tests/browser/cultivation-flows.test.mjs` để sửa trạng thái lỗi/trang tiếp/retry/stale của history/archive. Sinh lại HTML bằng builder đã có sau nhóm; không đổi công thức combat/kinh tế/schema. Metadata phải phân biệt giảm thương/Phòng thủ/Giáp Ảo/Khiên/HP và overkill; UI không suy lại bằng công thức riêng.

### Checkpoint tổng hợp để người dùng chạy một lượt

Lượt này cập nhật8file Markdown: FINAL_BRIEF, PLAN, PROGRESS, GOAL, PROGRESSION, BALANCE, README demo và HANDOFF. Không sửa code/asset hoặc phát hành. Đã kiểm **77liên kết local trong9tài liệu**, **18luật F01–F18**, fence và ký tự thay thế: không lỗi. Đã gọi domain read-only để đối chiếu **5phái/39môn/40encounter**, lịch bản mới21/32/42 và mốc Tinh Thuần/Chí Thuần/Thông Thần; không thay suite/gate nguồn cuối.

Quyết định sản phẩm ở BRIEF/PLAN; trạng thái hiện hành ở§5.8/§6. Các checkpoint cũ bên dưới giữ lịch sử, không ghi đè next action. Khi người dùng gửi promptGOAL, nối tiếp focused exchange/support và rủi ro log/history/forecast/compatibility, rồi sinh demo, visual/performance/gates/release theoPLAN. File HTML đang có cần sinh lại trước nghiệm thu vòng này.

### Nhóm đang triển khai — lịch21, tương thích lịch đã lưu và thao tác trận

GOAL đã yêu cầu tiếp tục toàn phạm vi và cấp quyền inventory§11. Lượt trước là progress: đồng bộ8tài liệu, kiểm74liên kết/18luật. Lượt hiện tại typecheck/check:web47 đạt; browser Tu luyện/demo13/13 đạt tại `.wrangler/cultivation-v2-final-qa/browser.log` (phiên66229 terminal exit0). Đã mở ảnh `v2-preparation-320-dark.png`, `v2-loadout-390-dark.png`, `v2-loadout-320-large.png`: overview60×80 và header/footer truy cập được, body cuộn riêng. Chưa full visual/source cuối.

**Quyết định A08:** chọn3/4/6/8 cho factory bản v2 mới (thường21/cấm32/ngoài42). Baseline/candidate/mastery/mixed reports cho thấy tăng nhịp hoàn tất và không mất đường thắng ở80/100% trong matrix; không claim thời lượng người thật. Giữ requiredDays đã lưu, v1 và mọi snapshot; không sửa bản đang luyện theo lịch34. Nội dung/rule không cần tăng chỉ vì default lịch bản mới đổi: lịch cụ thể đã nằm trong edition.

**Inventory trước nhóm sửa:** `src/domain/practice-progression.ts`; `tests/unit/practice-progression.test.ts`, `tests/unit/practice-presentation.test.ts`, `tests/unit/technique-profile.test.ts`, `tests/integration/practice.test.ts` để kiểm lịch mới và lịch34 đã lưu; `web/features/battle.js`, `tests/browser/cultivation-flows.test.mjs` để hoàn thiện exchange/footer/chi tiết, guards rescue/death/withdraw qua ngày/version và nhật ký retry; docs cơ chế/balance/guide/checkpoint và HTML sinh lại từ builder. Chỉ sửa file phụ thuộc khi findings đòi hỏi, ghi bổ sung trước nhóm.

**Trạng thái nhóm:** lịch mới đã áp, domain25/25/D1 2/2 đạt; guards/exchange đã sửa, ca fixture cuối cần rerun và support mới chưa chạy. **Next action hiện hành ở §5.8/§6**, không áp factory lần nữa hoặc poll sessions đã kết thúc. Không rerun120hành trình nếu source tương đương lịch counterfactual và chưa đổi battle rules; kiểm source/config và test invariants.

Phụ thuộc trực tiếp bổ sung trước UX exchange: `web/ui/battle-loadout.js` cho giới hạn1 khi chọn bản thay vào, `tests/browser/app-harness.mjs` giữ fixture exchange đúng snapshot (integration production đã có), `tests/unit/technique-profile.test.ts` kiểm lợi ích hỗ trợ/on-off bằng resolver. Giữ giới hạn5 ở prepare; không thêm quy tắc combat.

### Nhóm mới nhất — loadout và bằng chứng bổ sung

Checkpoint lịch sử, đã được nhóm lịch21 và §5.8 nối tiếp; không dùng next action dưới đây thay §6 hiện hành.

Inventory, log và giới hạn ở §5.7. Lượt tổng hợp đã thêm [bản chốt dành cho người dùng](CULTIVATION_FINAL_BRIEF.md), đồng bộ PLAN/GOAL/BALANCE/README/HANDOFF và checkpoint; không sửa source hoặc áp migration. Khi được yêu cầu triển khai tiếp, bắt đầu bằng browser/ảnh sau sửa cuối, forecast/compatibility và quyết định pacing, không đo lại mastery/mixed/repetition vì tài liệu cũ từng ghi chúng còn thiếu.

### Lịch sử nhóm — earned timeline v2, provenance và phép đo local

Inventory đã có: `scripts/simulate-game-profiles.ts` (v1 default/v2 opt-in/cadence/timeline), `scripts/simulate-cultivation.ts` (matrix/mixed/collection/rescue/counterfactual/config/seed/hashes), `tests/unit/cultivation-simulation.test.ts`; manifest `docs/art/kiem-y-runtime-v2.json` và `tests/unit/cultivation-art.test.ts`; case four tiers×30 habits trong `tests/integration/practice.test.ts`; `scripts/measure-cultivation.mjs`. Không sửa runtime durations. Bằng chứng/giới hạn/handles hiện tại tại §5.6; typecheck gần nhất đạt trước case integration120 nguồn mới, cần gate nguồn cuối.

Phiên4575 baseline,24191 lịch đối chiếu và29652 performance đều đã exit0, report đã đọc; không poll lại như đang chạy. Tiếp tục từ kết quả đó và phần UX/forecast/compatibility/cân bằng còn thiếu, không tạo lại scripts/manifest hoặc lặp tests đã đủ. Full main/browser/build/staging/release chưa đạt hết; không đánh goal complete.

### Nhóm vừa triển khai — demo dùng chung UI/engine và UI đầu tiên

Lượt triển khai trước đã tạo `scripts/lib/cultivation-demo.ts`, `docs/prototypes/cultivation/demo.js`, `scripts/build-cultivation-demo.mjs`, README, HTML đầu ra và tests unit/browser demo; sửa art/game features/views/styles, model kết quả và unit game-library. Nhóm này đã chạy targeted checks như mục 5, chưa full gates. Lượt tổng hợp hiện tại giữ code và cập nhật PLAN/PROGRESS/GOAL/PROGRESSION/GLOSSARY/SOURCE REVIEW/HANDOFF cho đúng source.

**Next action được thay bằng §5.8/§6:** đọc diff và checkpoint hiện hành; giữ kết quả cũ theo đúng source. Factory21/browser13/13/ảnh overview đã có, còn focused exchange/support, log/history/forecast/compatibility và các gates cuối. Tiếp tục visual/latency live/rehearsal/release, sinh lại demo. Goal cùng phạm vi đang active; không tạo goal mới hoặc tự đánh complete.

### Inventory đã triển khai local — chọn chiêu và dự kiến trận

Nhóm này đã sửa `src/domain/battle.ts` (hồ sơ/preview từ snapshot bằng resolver, giữ bí mật intent), `src/entrypoints/mini-app/game.ts` và `mini-app.ts` (GET chi tiết chiêu owner-only/lazy/no-store), `web/features/battle.js`, `web/views/journey.js`, `web/ui/technique-profile.js`, `web/styles.css` (một nút chọn/đổi + sheet, effects/costs/context; sửa theme tabs). Demo/session/harness tại `scripts/lib/cultivation-demo.ts`, `docs/prototypes/cultivation/demo.js`, `tests/browser/app-harness.mjs` dùng cùng endpoint/hàm. Đã thêm unit preview, hai ca forecast, integration HTTP; browser đã cập nhật và kiểm theo mục 5.5. Không thay giá kinh tế hoặc công thức damage/defense. Đây là code của lượt triển khai trước; lượt tổng hợp hiện tại chỉ sửa Markdown.

### Nhóm đã triển khai — sửa gate và nối bảng chọn

Inventory đã thực hiện: `tests/unit/practice-progression.test.ts` sửa weekday/fallback fixture; `tests/integration/upgrade-rehearsal.test.ts` đối chiếu migration và kiểm flow v2 sau restore; `web/app.js` nối `openBattleChoices`; `web/features/battle.js` guard khi bấm/xác nhận, nhãn Q tổng và archive chỉ đọc; `web/views/journey.js` sửa nhãn bất lợi/hết hạn; `web/features/game-guide.js` đồng bộ Tầng/phái; `tests/browser/cultivation-flows.test.mjs`, `tests/browser/app-harness.mjs` cập nhật thao tác/production strength và stale/offline/preview/cái giá; sinh lại demo. Targeted 13/13, browser 12/12, typecheck/check:web đạt. Không thay luật hoặc kinh tế; chưa toàn goal đạt.

### Mẫu ghi checkpoint tiếp theo

- Chặng/phần đang làm:
- Quyết định vừa chốt và lý do:
- File/rule/schema/source version:
- Kiểm chứng trên đúng source, kết quả và giới hạn:
- Ảnh đã mở xem, findings và cách sửa:
- Dữ liệu/compatibility/query budgets:
- Việc bắt buộc còn lại:
- Blocker thật và phần độc lập tiếp tục được:
- Next action cụ thể:
