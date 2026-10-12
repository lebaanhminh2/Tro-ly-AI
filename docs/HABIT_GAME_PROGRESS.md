# Habit/Thần Lộ — checkpoint và quyết định triển khai

Cập nhật 2026-10-12. Đây là nơi giữ trạng thái ngắn để goal tiếp tục qua các phiên; không phải nhật ký hội thoại. Nhiệm vụ tại [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md), đặc tả đích tại [PRODUCT](HABIT_GAME_PRODUCT.md).

## 1. Trạng thái thực tế

- **Goal đang active**, đã cấp quyền tự triển khai code/tests/assets/migration và publish staging sau gates; ngân sách bổ sung 0đ. Không cần duyệt từng file trong phạm vi goal.
- F1 commit/push `5c8d90a`, F2 `656f06d`, F3 `d766e69` trên `review/p1-p3`. F4 engine/store/API/UI local; schema tới0035, chưa migration/deploy remote.
- Baseline DOM giả thiếu `firstElementChild` đã sửa theo DOM thật. Gate `npm.cmd run test:all` ở F2 trước tối ưu đọc nhóm/slot version: 225 bài chính +25 experiments đạt. Chạy lại các ca có rủi ro sau sửa; không dùng gate cũ để chứng minh code mới.
- Domain habit: 896 mẫu tuần Q1–7 đã kiểm; D1 kiểm replacement/concurrency/replay qua ngày, weekly/archive/restore/catchup, revision/rollback, HTTP/auth/input, reminders khi ngủ/dedupe, slots/khả năng replan. Fixture30habit kiểm query budget ≤25 và weekly projection đạt; không phải benchmark CPU/remote.
- Web: typecheck và 30module syntax/import đạt. Chrome thật tạo ba cadence, tick/log15/20/XSS, xếp12:00–12:20, nhìn trong Today và link về habit, sheet header trên viewport nhỏ, report/history đạt. Ảnh `D:\Tro-ly-AI-art\habit-qa-{habits-320,habits-390,habits-1440,habit-today-320,habit-today-390,habit-report}.png` đã xem; header lịch tháng được bổ sung sau lần chụp report đầu.
- Art local `D:\Tro-ly-AI-art\venv`: Python3.12.10/CUDA12.4/GTX1650 4095MiB; DreamShaper8 revision `a7e52b98680b1ba8ff7bce97c7f9f2e2e5337917`. Float32/offload448×640/640×448 ~100s/ảnh, peak4053MiB. FP16/NaN đã loại. Tịch Vân,5bosses và cảnh cửa núi có WebP/thumb/manifest, đã xem integrated390/320 theo evidence. Cảnh trạm núi chưa tích hợp; hai thử Thư Lệnh thành người bị loại. Không art process chạy; toàn inventory còn F5/F6.
- Staging target: Worker `personal-assistant-staging`, DB `assistant-staging`/`5457c401-45d9-4b19-b76e-0eceec67a223`; URL `https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev`. Chưa áp0031–0035 hoặc phát hành phần mới.
- Issue nền ngủ: audit D1 read-only xác nhận báo ngủ 2026-10-07 23:05:39 UTC+7. Hai bedtime nudge trong khoảng kiểm tra đã gửi trước đó (22:45:14, 23:02:01); chưa có bằng chứng nudge sau báo ngủ trong nhóm này. Asset sleep staging khác local; chưa kết luận root cause/chưa sửa. Không gửi tin thử hoặc sửa dữ liệu cá nhân.

| Mốc | Trạng thái | Bằng chứng thực hiện | Tiếp theo |
| --- | --- | --- | --- |
| D0 Bộ tài liệu | Đã commit/push `66da16e`; goal đã bắt đầu | Relative links/encoding và `git diff --check` đạt; prompt goal dưới4.000 ký tự | Đồng bộ docs theo code thật |
| P0 Khảo sát/thiết kế/ảnh thử | Đang làm | Baseline/audit D1/art venv; các quyết định bên dưới | Chốt hợp đồng lưu/đóng ngày, thử model local |
| F1 Nền habit | Đạt lát cắt local; chưa release | `0031_habits.sql`, domain/service/port/store/auth API, web CRUD/log/history/export, unit/integration/Chrome QA | Tiếp tục F2, mở rộng cases HTTP/biên thời gian; release chung cuối goal |
| F2 Lịch/nhắc/theo dõi | Commit/push `656f06d`, chưa release | API/report/history filters, CSV, recurrence opt-in, reservation; D1/Chrome tests | Onboarding/JSON export hoàn thiện trong flow tổng |
| F3 Luyện | Commit/push `d766e69`, chưa release | Domain9tests, D1practice6cases, versions/select/stop, API/UI/Chrome light-dark | Weekly integration/cân bằng qua battle |
| F4 Lát cắt chơi hoàn chỉnh | Engine/store/API/UI/art local; gate tổng đạt, chưa release | 39 specs; 5 encounters; truyền thừa luyện thật, HTTP/cooldown/exchange/rollback/timeout; Chrome art QA | Commit/push checkpoint rồi F5 |
| F5 Toàn bộ game/nội dung | Chưa bắt đầu | Chưa có | Đủ 39 môn/15 chương/tuyến phụ/thần binh |
| F6 Hoàn thiện trải nghiệm | Chưa bắt đầu | Chưa có | Review UX/art/nhịp chơi toàn sản phẩm |
| R1 Release/nghiệm thu | Chưa bắt đầu | Chưa có | Đủ gates, data/backup, staging và hướng dẫn |

Agent thay dòng bằng trạng thái thật/HEAD/bằng chứng sau mỗi phần việc bền vững. Không đổi “đã test” nếu chỉ có file test hoặc một tool command chưa đọc output. F4 là bước nội bộ, không phải điểm dừng của goal.

## 2. Quyết định cần AI hoàn thiện trong P0

| ID | Chủ đề | Cần ghi trước khi triển khai phần phụ thuộc |
| --- | --- | --- |
| A01 | Ngày/tuần và revisions | Week start, tuần đầu, đổi target/lịch/giờ sinh hoạt, archive/delete/restore; timeline biên |
| A02 | Đóng góp/anti-farm | Trần Q, trọng số/tăng tốc/habit mới, nguồn task ổn định, phần vượt target |
| A03 | Tinh thuần/receiver | Công thức nghiêm, khóa tầng, thiếu weekly qua môn/tầng/mode/idle, không né nghĩa vụ |
| A04 | Chế độ và settlement | Start/cancel/end, cutoff, delayed cron, unselected/safe absence, batch/resume |
| A05 | Engine effects | Thứ tự hit/status/rounding, caps, recursion, intent/phase, đồng quy |
| A06 | Giá và account | Death/Hộ Mệnh/Nghịch Mệnh, multi-hit/rescue pending, rank/protection/re-breakthrough/undo |
| A07 | Hợp đồng persistence/API | Actual DTO/schema/index/guards/receipt/job/atomic boundaries và lỗi |
| A08 | Content và versioning | Stable IDs, unlock graph/rule versions, map đủ 39/15/tuyến phụ, replay rewards |
| A09 | UX/cast/art | Điều hướng, flow chính, character/style sheets, asset inventory, pipeline miễn phí |
| A10 | Data/runtime/release | Export/restore, performance budgets đo được, feature off, migration/rollback staging |

Các quyết định này do AI tự làm trong phạm vi goal đã được user cấp, không gửi lại cả bảng để user tự thiết kế. Nếu cần thay luật user hoặc quyền/ngân sách, chỉ hỏi đúng phần vượt quyền, kèm phương án đã chuẩn bị.

## 3. Mẫu quyết định và checkpoint

### Quyết định đang triển khai

- **A01**: Tuần bắt đầu thứ Hai theo ordinal ngày sinh hoạt. Habit daily/chọn thứ mới theo dõi ngay, cam kết từ ngày sau; quota tuần từ thứ Hai sau. Đổi mục tiêu/kiểu/lịch hoặc archive/restore có hiệu lực ngày sau, trừ khi lịch trước/sau là tuần thì từ thứ Hai sau. Không xóa revision/history. Day snapshot dùng cửa sổ schedule hiện có; ngày cũ khóa theo server clock dù cron chậm. Cần kiểm chuyển giờ sinh hoạt và delayed catchup tại integration.
- **A02**: Giá trị lưu integer hundredths, nhập tối đa 2 chữ số thập phân/1.000.000 đơn vị; check chỉ 0/1. Đạt đủ mới đóng góp; trần quota Q; neutral không vào mẫu số. Habit nhiều chỉ tăng tốc có trần 6 (1 + 0,12 mỗi habit thêm), điều kiện trưởng thành còn phải chốt trước F3.
- **A07 (phần habit)**: Definitions/revisions/logs/outcomes tách khỏi tài khoản healthy; không mỗi tick tăng version healthy. Guard/version và receipt riêng theo owner; receipt kiểm trước clock/day để retry đã commit qua ngày trả kết quả cũ. Log dùng version habit + version log + ngày công bố; giá trị là tổng thay thế, không phép cộng dễ lặp.
- Habit store giới hạn 30 habit hoạt động, danh sách tối đa 100 gồm lưu trữ; history dùng keyset, tối đa 100 dòng/trang và 366 ngày. Cron pha 3 luân phiên bảo trì cũ/habit/game, mỗi nhóm chạy 12 phút/lần. Habit chốt tối đa 30 mục cùng ngày cũ nhất; game chốt tối đa một ngày/lượt. Không bỏ ngày vắng như healthy suspension. Restore giữ nguyên lifecycle quá khứ; preview tối đa 7 ngày, chưa phát thưởng.
- **A03/A04 luyện**: `practice-v1` được đặc tả tại GAMEPLAY mục 2 và domain. Chi phí 3/6/10/15; hệ số 1000/1500/2000 milliunits; bonus trưởng thành sau 7 ngày, trần 1,6. Tinh thuần dùng S/(S+2M), số mũ theo tầng và trần từ tầng trước. Audit ràng buộc tiến độ với cam kết tuần đang hiệu lực; chốt khi đủ Q hoặc hết tuần, phân bổ thiếu cả tuần theo tiến độ đã dùng. Tầng đủ tiến độ nhưng còn audit thì chờ khóa. Đổi/dừng luyện hiệu lực ngày sau; bản cũ giữ nguyên; game_days, receiver và receipts cùng giao dịch.

### Checkpoint F1/F2

- Chưa có game receiver/settlement luyện/battle; `habit_outcomes.game_applied=0` để F3 consume atomically. Không gọi dữ liệu habit đã có là game hoàn tất.
- F1 đã push; migration0031–0033 chưa áp remote, chưa deploy tính năng mới. F2/source/art chỉ chạy local. Tiếp theo: chốt các gate mới (đọc nhóm, slot optimistic version, report calendar), commit/push checkpoint; giải A03/A04 và triển khai F3 luyện.
- Verification mới:6 D1 habit integration đạt sau tối ưu đọc nhóm; ca reservation chạy lại sau slot version đạt. Chrome flow/report/calendar chạy lại đạt; typecheck/check:web và29tests architecture/web/modules/migration đạt. Full225+25 là gate trước thay đổi cuối; cần full gate lại khi release. Process verification đã kết thúc, không terminal/app/art đang chạy ở checkpoint này.
- Today dùng `renderDailyPlan`, không `renderTimeline`; reservation đã đưa vào màn thật. Giữ task focus/sleep/layout và những việc hoàn thành trong nhóm thu gọn.
- Reminder habits là configured personal recurrence. Không chặn bởi asleep, nhưng manual pause/inactive giữ nguyên. Archive end date + lifecycle guard; dedupe cùng slot across revisions. Reservation không bật nhắc và giữ20%task buffer.
- A03 luyện đã triển khai; F4 nối battle settlement/audit cùng batch. D1 weekly qua battle/absence chốt về bản gốc mà không nhận tiến độ trận. Cân bằng toàn15 chương còn phải làm.

### Checkpoint F3 trước engine

- Files mới: domain practice/techniques, port game-store, PracticeService, D1GameStore, migration 0034, entrypoint game, web models/features/views. Scheduler chốt habit theo nhóm; live-data/mutations nhận includeGame và xóa trạng thái khi logout. Catalog 39 identities là nền cho effects, chưa phải toàn game.
- `npm.cmd run test:all` trước thay grouped cron/source detail đạt 239 bài chính +25 experiments, exit0. Sau đổi: 12 ca D1 habit/practice đạt, ca cron ≤50 SQL đạt, 36 ca unit/web/worker boundaries đạt. Typecheck/check:web 33 modules và staging dry-run đạt (47 assets; bundle 469 KiB, gzip 109 KiB). Cần full gate ở release cho source cuối.
- Full browser mới nhất: 19 tests đạt, gồm luồng habit/luyện và tất cả flows task/ngủ/đột phá/reminders/auth cũ. Ảnh `D:\Tro-ly-AI-art\game-qa-practice-{intro,320,390,1440,dark}.png` đã xem light390/320 và dark390; guide thumbnail tải qua URL local thật. Sửa label nav 320 px để không xuống dòng. UX với chữ lớn, nhiều dữ liệu và toàn bộ art còn ở F6.
- Fixture 30 weekly habits: GET game ≤50 SQL và response <50 KB; grouped habit ≤20 SQL. Hai maintenance cron slots với 30 habit ≤50 SQL. Đây là đo local có giới hạn; CPU/runtime remote và network còn là gate release.
- Targeted gate sau source detail kết thúc: 6 ca D1 practice đạt, full browser 19 đạt, typecheck/check:web/diff sạch; các session kiểm thử đã kết thúc. Tiếp theo commit/push checkpoint, F4 engine effects/order/intents/cost/rescue, encounters/chương 01, audit khi mode battle và guards kinh tế/ngủ. Sau đó hoàn thiện toàn scope F5–F6/R1.


Quyết định đáng giữ viết ngắn theo mẫu: `ID — vấn đề — lựa chọn — lý do/alternatives — ảnh hưởng dữ liệu/UX — case kiểm chứng — docs/code liên quan — trạng thái`. Cập nhật đặc tả sở hữu chủ đề khi quyết định đổi; quyết định không được chỉ nằm trong chat/summary.

### Checkpoint F4 engine và mở đầu

- A05/A06 tại [BATTLE_RULES](HABIT_GAME_BATTLE_RULES.md);0035/API/guards tại ARCHITECTURE. Engine/store/API/UI local, chưa phải full game hoặc release. Năm encounters chương01 gồm truyền thừa có story/intents/reward snapshots/art.
- Full `test:all` đạt266main+25experiments trước thêm2 cases mới. Sau đó D1 weekly qua battle/absence và GETgame30weekly≤50SQL/<50KB đều đạt; typecheck/check:web35modules/diff đạt. Full browser20 đạt; staging dry-run49assets/bundle543KiB/gzip127KiB. Source cuối vẫn cần final gate sauF5/F6.
- D1: prepare ngày sau/retry/owner/concurrency/rollback;4ngày thắng/unlock một lần; task snapshot/global once-only; rescue rank/account/lock/battle cùng batch; second death trừ một lần. Domain936mẫu và cases giáp/chiêu trễ/giá thắng/đồng quy/revival/intent/seal đạt.
- `scripts/simulate-game.ts` dùng engine production; report `D:\Tro-ly-AI-art\opening-simulation.json`:100case/93thắng, cả5phái thắng với một habit. Fixture được cấp4môn thường/tầng1/rank gợi ý, không traversal unlock thật.7case khônghabit cần luyện thêm.
- Chrome screenshots `D:\Tro-ly-AI-art\game-qa-battle-{320,390,1440,rescue,dark}.png`: đã xem active390/rescue390/dark390; portrait Thiết Lệnh Sứ tích hợp thật. Tịch Vân đã QA introF3. Manifest cần cập nhật integrated QA.
- Art chapter01 đã publish:5boss identities và cảnh cửa núi tích hợp. Ảnh `opening-final-{journey,boss-song-nha,boss-thu-lenh,boss-kiem-truyen,battle-preparation}.png` tại thư mục art ngoàiGit đã xem390; manifest cập nhật QA. Song Nha portrait là một canh thú, alt không giả hai đầu; Thư Lệnh v3 là cổ thư/ấn sẫm, hai bản người đã loại. Cảnh trạm núi còn pending integration.
- Gate mới: truyền thừa D1 luyện thật4môn/1habit đạt; HTTP projection/cooldown đạt; rescue rollback/rank guard đạt; exchange/rescue timeout đạt; browser battle/art đạt. Typecheck/check:web35modules và staging dry-run61assets/546KiB/gzip128KiB đạt. Full `test:all` và `test:browser` đạt exit0; logs ngoàiGit `f4-test-all.log`/`f4-test-browser.log`, browser20pass/0skip. Chưa remote migration/deploy.
- F5 chuẩn bị story bible tại `HABIT_GAME_STORY_BIBLE.md`; art batch `docs/art/campaign.json` gồm Kỷ Hành/Mộc An/cảnh02 đang tạo tại venv ngoàiGit. Không publish cho đến khi xem/duyệt concept và QA màn thật. Kiểm process session95440 trước nối tiếp.
- Việc tới: commit/push checkpointF4 sau gate, F5 toàn content/graph/version registry và weapon/achievement/side paths, paging loadout, art; đủ toànF5–F6/R1. Issue sleep vẫn chưa có root cause. Không complete ở đây.

Checkpoint cuối phần việc/phiên cần:

1. HEAD/branch và git status; các thay đổi user hoặc unfinished files cần giữ.
2. Đã làm, chưa làm, cổng vừa đạt/chưa đạt; command/kết quả/fixture/seed/screenshot paths.
3. DB/migration/feature flags/jobs/content/art version và target deploy nếu có; không secrets.
4. Findings còn cụ thể, blocker thực tế và next action độc lập; việc kế tiếp bắt đầu bằng file/case nào.
5. Dịch vụ local đang chạy/model cache ở đâu và cách dừng/resume, không để công cụ art tiếp tục ngoài ý muốn.

Giữ một bảng trạng thái hiện tại và các quyết định đang hiệu lực; lịch sử nằm trong Git. Chi tiết kiểm thử lặp dài/ảnh/model logs lưu artifact có giới hạn, docs chỉ dẫn vị trí. Lệnh tiếp tục cùng mục tiêu: đọc checkpoint, kiểm source/workspace rồi làm next action, không khởi động lại từ đầu hoặc rút xuống demo.
