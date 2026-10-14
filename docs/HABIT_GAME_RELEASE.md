# Habit và Tu luyện — bằng chứng phát hành

## Tu luyện v2 — ngày 2026-10-14

**Gates nguồn cuối đạt; source commit đầu8dffbe8. Đang hoàn tất artifact/migration/deploy, chưa phát hành v2 tại thời điểm ghi phần này.** Trạng thái từng bước ở [PROGRESS §5.9](CULTIVATION_IMPLEMENTATION_PROGRESS.md).

### Phạm vi giao

- Hiện tại / Công pháp / Thử thách / Thành tựu; Phái → Môn → Tác dụng / Nâng cấp, 39 môn và 40 encounter. Mỗi thẻ một số Sát thương nổi bật; hiệu ứng, điều kiện và cái giá đọc thống nhất, nhật ký có breakdown mở thêm.
- Tầng theo số ngày luyện; damage tăng độc lập từng kỳ theo habit. Thuần khiết giữ khuyết điểm kế thừa, trần và phần mất; 80/90/100% là Tinh Thuần/Chí Thuần/Thông Thần. Tối đa hai bản được duy trì, lịch sử và snapshot vẫn giữ.
- Bản v2 mới dùng lịch3/4/6/8: thường21/cấm32/ngoài42 ngày. Lịch đã lưu và bản v1 giữ riêng. Contentthan-lo-5, practice-v2/battle-v2 cho bản/trận mới; content1–4 và rulev1 vẫn được đọc đúng.
- [Demo HTML](prototypes/cultivation/kiem-y-demo.html)354.409byte đóng gói production engine/actions/views; dữ liệu mẫu riêng, networkAPI bị chặn. Giữ ảnh hiện có, bốn raster kiếm tổng69.742byte; không sinh ảnh mới hoặc dùng dịch vụ trả phí.

### Gates và review trước release

| Cổng | Kết quả nguồn cuối | Artifact private |
| --- | --- | --- |
| Main |378/378,0fail/skip,819,84s |`delivered-main.log` |
| Browser |44/44,0fail/skip |`checked-browser.log` |
| Typecheck / web |exit0;47modules |`delivered-typecheck.log`, `delivered-web.log` |
| Build / staging check |exit0;230assets,719,90KiB/gzip166,71KiB |`delivered-build.log`, `delivered-staging.log` |
| Visual |320/360/390/1440,hai theme/chữ200%,104demo captures; agent mở contact sheets và màn thật |Ảnh nguồn cuối và `review-demo-*` |
| Restore mới |0038 áp được trên bản sao, integrityok,0FK;99bảng cũ unchanged,1bảng mới |`delivered-restore.json` |
| Recovery bundle |content1–5/practice-v1/v2 GET200/parity,401khôngauth,state/version giữ; restoredDB read-only |`delivered-recovery.json` |

Đã sửa footer chữ lớn bằng chuyển ghi chú dài vào body, ảnh desktop contain và đưa phần Nâng cấp vào viewport khi đổi mục. Preview/nhật ký dùng metadata resolver; không đổi công thức phòng ngự hoặc kinh tế nền. Huyền Quy/Kiếm Ý/Thôn Thiên có ca trigger/benefit/limit cụ thể tại [BALANCE](HABIT_GAME_BALANCE.md); matrix earned giữ fingerprint và giới hạn của report gốc.

### Hiệu năng có điều kiện

Năm mẫu local cuối,390×844,latency150ms,100KiB/s,không CPU throttle: shell13,6–17,6ms; nội dung303–313,8ms; ảnh trong viewport740,8–759,1ms; mở cache5,2–6,8ms; chi tiết734,7–775,2ms. `delivered-performance.json` giữ hashes từng nguồn. Fixture không bao gồm Worker/D1; không dùng số này làm latency staging hoặc chứng minh nhanh hơn bản cũ.

D1 local với lịch34 đã lưu và4tầng×30habit: peak22SQL/ngày, overview13SQL/25.281byte, detail7SQL/14.618byte. Không viết các phép tính game vào UI/LLM.

Đóng gói Git: metadata gốc được stage no-filters để giữ CRLF/hash nguồn.26record trong Git index và12checkout-filter cases true/false/input khớp hash; không tạo .gitattributes khi chưa được user duyệt.

### Backup và phục hồi

Backup mới `.wrangler/cultivation-v2-final-qa/staging-before-v2-release-20261014.sql`,1.632.676byte, SHA256 `0FF106002333390C413E07DC5F94FF7D5BF1D4418F85A79775269E1375751B7D`. File và CLI output riêng tư không commit.

Recovery candidate là bundle nguồn cuối719,90KiB, SHA256 `567a9edf921e4b5cfb56d823d2049ca9e09e1a8a6ff763584fe8fc14bdb65b87`. Rehearsal offline hỗ trợ content1–5/v1–v2; workerd local tối đa2026-08-06, cloudconfig2026-09-11 giữ nguyên. Sau writesv2, không dùng binarypre-v2 hoặc restore backup đè writes mới. Commands và cách phục hồi ở [OPERATIONS](OPERATIONS.md).

### Kiểm sau phát hành

Chưa thực hiện tại checkpoint này. Cần ghi sourcecommit, WorkerID, migrationlisting, static/hash/auth/Origin, ownerGET bằng phiên thật và latencylive trước báo hoàn tất. Không tạo dữ liệu cá nhân thử hoặc gửi tin thử. Art/trải nghiệm dài ngày chờ người dùng nghiệm thu; Chrome emulation không thay thiết bị thật.

---

## Tu luyện redesign — staging ngày 2026-10-13 — lịch sử

**Source `07e9aa0` đã commit/push trên `review/p1-p3`, deploy exit 0 và kiểm sau phát hành.** Worker version: **`db6b1f93-3532-4aac-972b-598fa48e5488`**.

URL nghiệm thu: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/

### Bản được giao

- **Hiện tại → Công pháp → Vượt tầng → Thành tựu**. Có 22 tầng chính, 18 cơ duyên và 39 công pháp. Thành tựu giữ chiến thắng đầu tiên; discovery che tên/ảnh bí tịch chưa phát hiện.
- Content `than-lo-4`, engine `battle-v1`. Trận mới không chọn hoặc thưởng vũ khí. Snapshot, quyền, receipt, preset và lịch sử cũ được bảo toàn. Không đổi schema 0037 hoặc hành vi task, habit, ngủ, tập trung, lời nhắc và đột phá.
- Bộ ảnh cuối gồm 61 raster thành 122 WebP, cùng 39 SVG nguyên bản. Nguồn, crop, hash và QA màn hình thật nằm trong inventory, audit và STYLE_V2. Ngân sách bổ sung 0đ; sinh ảnh local với DreamShaper 8. Không còn job GPU; originals/model ở ngoài Git.

### Kiểm trước phát hành

- Full gate **329 main + 25 experiments**, 0 fail/skip, ở lượt trước các sửa loader/fastpath/modal cuối. Sau các sửa đó: loader/discovery 9, settlement read-only 1 và 19 practice/battle cases liên quan đạt. Không gọi kết quả cũ là full rerun source cuối.
- Browser source cuối **35/35**, 0 fail/skip; matrix asset cuối 1/1. Thêm 40 màn phái/cast sáng–tối. Root xem contact sheets và màn thật, gồm luyện, chuẩn bị, active, cứu, thắng, tử trận, hết lượt và rút lui; chữ 200%/màn nhỏ/theme tối.
- Typecheck, check:web 45 modules, staging config 3/3, deploy readiness 4/4 và dry-run đều đạt. Dry-run đọc 224 asset files; Worker 670,88 KiB / gzip 155,90 KiB.
- Frontend lab trước–sau không chứng minh tải đầu nhanh hơn đáng kể. Loại hai SQL kết toán thừa, nạp chiến tích theo nhu cầu và giới hạn response có bằng chứng riêng. Các số remote/bootstrap ngày 2026-10-12 bên dưới là lịch sử.

### Kiểm sau phát hành

- `/app/` và **216 file tĩnh** HTTP 200, SHA256 khớp source: 45 modules, CSS/index, 130 WebP và 39 SVG. Tám GET API không auth trả 401; POST với Origin ngoài trả 403 trước ghi.
- Tail 60 giây: **66 events** trên đúng version, gồm 65 request và một cron; tất cả outcome `ok`, 0 parse error. Cron CPU 17ms / wall 3743ms. Không có owner API 200 trong mẫu; đây không phải benchmark owner API/render hoặc mọi phase.
- Browser isolated sau deploy không có runtime exception, nhưng phiên đã hết hạn: 401. Không giả phiên, ghi log cá nhân hoặc gửi tin để lấy bằng chứng.
- Listing đúng DB staging không có migration chờ; không áp migration. Backup trước phát hành: 1.578.743 byte, SHA256 `c3f37f56e6db7cf00309895e6b4d6b3aa1a9bd8bb8151ad47c542cbbe5c79245`, nằm ở `.wrangler/cultivation-qa/staging/before-redesign-20261013.sql`, ngoài Git.
- Cron, phases và secrets giữ nguyên. Rollback cần binary hiểu content 1–4; ưu tiên sửa tiến tới, không restore backup cũ đè dữ liệu mới. Xem OPERATIONS.

### Bằng chứng và giới hạn nghiệm thu

Artifacts local: `.wrangler/cultivation-qa/staging/` có `final-deploy.log`, `final-public-assets-auth.json`, `final-natural-runtime.json`, `after-owner-reads.json` và `final-migrations-list.log`; các logs/screens/matrix được liệt kê trong checkpoint. Backup/raw CLI logs riêng không đưa vào Git hoặc tài liệu. Docs commit sau phát hành không đổi binary/asset.

**Chưa kiểm owner API bằng phiên đăng nhập thật trong vòng này**; user đăng nhập khi nghiệm thu. Engine/D1 integration local bao phủ writes, ownership, replay và legacy; static/auth/cron remote xác nhận bản phát hành, không thay bằng chứng owner interaction. Chrome emulation không phải nghiệm thu thiết bị thật. Chưa chứng minh tải đầu nhanh hơn đáng kể hoặc độ cuốn dài ngày; số đo có điều kiện ở REVIEW.

Hướng dẫn nghiệm thu: [USER_GUIDE](HABIT_GAME_USER_GUIDE.md). Nghiên cứu và số đo: [CULTIVATION_REVIEW](HABIT_GAME_CULTIVATION_REVIEW.md). Audit mục tiêu: [CULTIVATION_PROGRESS](HABIT_GAME_CULTIVATION_PROGRESS.md).

---

## Phát hành Habit/Thần Lộ 2026-10-12 — lịch sử

Cập nhật 2026-10-12. **Toàn bộ phần mở rộng đã phát hành staging và kiểm sau deploy; sẵn sàng để user nghiệm thu.** File này đối chiếu yêu cầu với bằng chứng hiện có, không thay [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) hoặc [PRODUCT](HABIT_GAME_PRODUCT.md).

## Target và trạng thái

| Mục | Thực tế |
| --- | --- |
| Branch | `review/p1-p3`; kiểm HEAD/git status trước mỗi release |
| Staging | `personal-assistant-staging` |
| D1 | `assistant-staging`, ID `5457c401-45d9-4b19-b76e-0eceec67a223` |
| URL app | https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ |
| Release source | `bcd22bb`, đã push; các commit tài liệu sau đó không đổi binary |
| Schema đã phát hành | 0031–0037 áp thành công; listing sau apply không còn migration chờ |
| Luật/content | `practice-v1`, `battle-v1`, `than-lo-3`; snapshots cũ giữ nghĩa cũ |
| Xác thực | Auth10000 đã giải: agent chạy `wrangler login` theo user, exit0; info/pending migration target verified |
| Backup staging thật / restore | Đã export/restore/rehearse;72legacytables/1011rows proof giữ,27newtables |
| Worker version | `d3923c51-3959-474d-8e9a-6d4bfbaf7415` |
| Deploy / smoke | Deploy exit0; assets/auth/live owner APIs đạt; user xác nhận đã mở và đăng nhập được |

Backup thật, full gates và kiểm sau deploy đã đạt. Cron mỗi phút giữ nguyên; không thay webhook, gửi tin thử hoặc tạo habit/log cá nhân giả. Không in token/.env/SQL/private export URL.

## Đối chiếu phạm vi sản phẩm

| Yêu cầu | Bằng chứng sở hữu | Giới hạn / phần còn cần |
| --- | --- | --- |
| Habit CRUD/lifecycle/ba lịch/tick và định lượng | `src/application/habit-service.ts`, D1 habit store; unit habits và integration habits; live GET habits200 | Writes được kiểm D1/local; staging không tạo dữ liệu giả |
| H01/H02/H07/H08/H09/H10: revisions, sửa cùng ngày, retry, khóa ngày cũ | integration habits: replacement/concurrency/replay, pending revision rollback, weekly archive; unit time/definitions | Không cho fixture sửa dữ liệu thật |
| H03–H06: ngày trung tính/quota/thiếu không thể bù | unit habits: cả 896 mẫu Q1–7 và ví dụ ngày1/6/7; integration weekly | Quota là số ngày đạt, không số lần ghi |
| H11: report/history/notes/filter/export | D1 history/report; browser habit flows; JSON/CSV web model tests | UI 7/30 ngày; API bounded 366 ngày, có pagination |
| Habit lịch/nhắc/đặt chỗ tùy chọn | integration habits reservation/replan/reminder/archive/sleep; browser | Giữ task buffer và không phát vé từ slot |
| G01–G04: luyện một habit/bốn tầng/tinh thuần/nghĩa vụ tuần/mode ngày sau | unit practice; D1 practice selection/training/weekly audit; earned profiles | Phẩm chất nghiêm, không chữa bản cũ |
| G05/G10/G13/G14: settlement/idempotency/chờ/rút/reward/version | D1 battle và practice; battle-run unit; snapshot legacy v2 test | Mạng ngoài không exactly-once; kết quả là từ DB commit |
| G06–G09/G11: effects/order/giáp/echo/seal/revival/multi-hit/cứu | unit battle/battle-run/economy/read-stance; D1 battle rollback/death | 39 casts × tier/purity sample; không chứng minh toán học mọi combo |
| G12: kinh tế/cứu/đột phá/ngủ/hoàn tác | D1 battle rescue guards; healthy-runtime/rest notifications; unit battle economy | Không hoàn nguyên toàn account để hoàn tác ngủ |
| 5 phái/39 môn/15 chương/tuyến phụ | game-content validator; fresh earned main + full collection từng phái; reports imperfect/mixed | Domain traversal kiểm cả quyền/tier/account; D1 atomic entitlement proof riêng |
| Lựa chọn chiến thuật và nhịp chơi | BALANCE: 3200 repeat cases, 30 earned profiles/5 mixed routes/earned rescue | Không spam một chiêu vượt toàn truyện; thời gian mô phỏng không dự báo thời gian chơi thật |
| 3 thần binh/11 chiến tích | reward registry/D1 weapon victory; union earned profiles/mixed/rescue đủ 11 IDs | Không dùng fixture cấp sẵn mọi quyền để chứng minh kiếm được |
| Truyện/nhân vật nguyên bản và thư viện/nhật ký | game-content/characters; lazy chapter/boss endpoints; browser story/access/history/search | Không lộ kết chương/pattern khi chưa có quyền |
| Ảnh thật đồng nhất, không placeholder | assets manifest/source/workflows; 40 encounter/15 scene/5 school/3 weapon +39 SVG; full campaign browser/contact QA; staging SHA256 khớp | `tram-nui` là ảnh dự phòng không được dùng trong runtime |
| Onboarding/guide/settings/export | browser guide/settings/export/presets; D1 game-export/presets; USER_GUIDE | Hide game/reduced motion device-local; không tự import ghi đè dữ liệu |
| UI gọn/mobile/accessibility/mạng | actual browser 360/390/414/1440, light/dark, text200%, keyboard, slow/offline; PROGRESS | Chrome emulation; không tuyên bố thiết bị thật |
| Bot/context/tools | integration habit-game-bot: readonly/pagination, native atomic journal, stale cutoff/lost ACK/guards | Live provider không suy từ fixture; deterministic core không phụ thuộc model |
| Giữ task/ngủ/focus/reminders/đột phá | main regression suites + full browser; final-send race có fail-before/pass-after | Root cause tin ngủ lịch sử chưa xác nhận; tin đã dispatch không thu hồi |
| Data/hiệu năng/vận hành | upgrade rehearsal + production-store restore smoke; D1 scale case; runtime benchmark; actual staging backup/restore readflows; live CPU/wall sample; OPERATIONS | Mẫu live nhỏ; bootstrap khoảng6giây, không chứng minh mọi lượt dưới10msCPU |

## Bằng chứng F6/R1 mới

Artifact local ở `D:/Tro-ly-AI-art`, không chứa trong bundle/Git. Nội dung private backup không đưa vào báo cáo.

- `f6-full-campaign-art-ui.log`: 1 test đạt, 80 preparation previews/30 chapter screens/30 story endings, read-only. `f6-campaign-ui-evidence.json` ghi geometry thật. Đã xem contact sheets portraits light/dark, chapters, preparation lower-fold và bốn story-ending sheets. Stale native dialog close không được reset thẻ mới đang mở; giữ regression assertion.
- `r1-upgrade-rehearsal-final.log`: 2 tests đạt; pre0031 SQL → restored SQLite →0031–0037, counts/hash cột cũ giữ nguyên. Production habit/log/practice chạy trên DB restored; task/uncertain delivery/healthy giữ đúng. Migration lỗi SQL hoặc đổi dữ liệu cũ rollback cả schema/writes; thiếu migration tracking bị từ chối.
- `r1-d1-runtime-scale.log`: 1 actual Miniflare D1 test đạt; 30 habit ×1096 ngày logs, lịch sử hai trang không trùng, backlog365 ngày tiến một ngày mỗi batch, không đổi healthy. Không dùng synthetic data trên staging.
- `r1-local-runtime-benchmark-drain.json`: bốn fixture6/30habit, 1095 ngày lịch sử,1096bản luyện, backlog7/365. Today13SQL/<24KB; history page1SQL/~16KB; report2SQL. Drain đầy đủ365 ngày: 2190/10950 outcomes mới đúng một lần, max18SQL/call, replay0, healthy giữ nguyên. Mỗi call có giới hạn; tổng drain không là một invocation Worker.
- Local SQL-inclusive wall time phụ thuộc máy/tải; lớn nhất history page khoảng119ms trong lượt đo. CPU là Node+SQLite, counters Windows có thể làm tròn lượt ngắn thành0ms; không dùng để khẳng định Worker CPU<10ms hoặc remote D1 latency.
- Actual backup `staging-before-habits-20261012-1.sql` ngoàiGit,1.559.408bytes/SHA256`0ce8d64e1eedf878de6cdfbf8de549bd356b777210519f0927dd2da0739d0b8b`. Real rehearsal `.sqlite`/`.json` baseline0030→0037 giữ72legacytables/1011rows và tạo27newtables; integrityok/FK0. `staging-real-restore-readflows-20261012.json`: productionhealthy/taskprogress/habits/game/battle reads trên actualcopy, tất cảtableproof unchanged; không dispatch hoặc tạo dữ liệu thật.

Fullbrowser cuối **33pass/0skip**, exit0 (`r1-final-test-browser.log`); typecheck/check:web45modules/build:check/staging:check dry-run đạt. Bundle659.42KiB/gzip153.30KiB/224assetfiles. Main gate đầu314/315, một source-fragment assertion cũ không phù hợp queued-close fix; đã thay bằng kiểm callback giữ thẻ mới và mở cuộn sau đóng cuối,17unitUIcases đạt. Full recheck **317main +25experiments/0fail/0skip**, exit0 (`r1-final-test-all-recheck.log`); có cả D1scale/restore/newclosebehavior cases. Không gọi provider fixtures là live.

Candidate rollback code là `fb3e76f`: `git diff --name-only fb3e76f bcd22bb -- src web migrations` chỉ có `web/ui/sheets.js`; backend/migrations/rules giống nhau. Khi cần, dựng candidate từ checkout riêng, chạy gates rồi deploy cùng staging và giữ schema0037. Candidate này bỏ queued-close fix nên ưu tiên sửa tiến tới; chưa có Worker version cloud của candidate để rollback trực tiếp. Không dùng Worker pre-habit cũ khi đã có dữ liệu/trận mới; không xóa schema hoặc ghi đè workspace/data. Quy trình cụ thể ở OPERATIONS.

## Kiểm sau deploy và audit cuối

- `r1-staging-migrations-apply.log`, `r1-staging-migrations-after.log`, `r1-staging-deploy.log`: 0031–0037 áp thành công, không còn pending; Worker version bên trên, deploy exit0. Không thay secrets/webhook/cron.
- `r1-staging-public-assets-auth-smoke-final.json`: 215 file tĩnh200 và SHA256 khớp source, gồm toàn130WebP/39SVG/45module/CSS. `index.html` được phục vụ ở `/app/`200,1775bytes/SHA256 khớp; `/app/index.html`404 là canonical routing của Assets, không là màn app thiếu. Sáu GET API không auth trả401; POST foreign Origin trả403 trước mutation. Report gốc giữ phản hồi canonical404 để đối chiếu; report cuối bổ sung kiểm indexroute.
- `r1-staging-natural-runtime-20261012.json`: tail đã lọc bỏ headers/body/query/log/privatecontent; 52events, không parseerror. Owner traffic trên đúng version có bootstrap/history/habits/habit-history/habit-report/game/game-catalog/game-chapter200. User xác nhận **đã mở và đăng nhập được**; agent không lấy token của user hoặc phát request ghi thử.
- Live sample: habits4requests CPU4–6ms/wall1247–1420ms; game5requests CPU6–10ms/wall1521–1593ms; catalog CPU3ms/wall219ms; report CPU2ms/wall626ms. Bootstrap3requests CPU24–35ms/wall6186–6551ms. Bootstrap chứa legacy task/plan/rest/timeline và nhiều đọc D1 nối tiếp, phần habit/game/history mới tải riêng; không thể suy chậm do feature mới hoặc cam kết10ms từ mẫu này. Tất cả request mẫu outcomeok; số đo là Worker wall, không là thời gian render thiết bị. Giữ latency bootstrap là hạn chế đã biết và mục tiêu tối ưu tiếp, không nâng gói0đ hoặc đổi cơ chế cũ để đạt một con số.
- `r1-staging-counts-after-migration-retry.json`: query read-only/rowswritten0; tasks20/sleepreports1/healthyaccounts1 khớp backup; habits/gameaccounts/battles0. Diagnostic UNION trước đó bị D1compoundSELECTlimit từ chối, đã thay scalar subqueries; không là failure migration hoặc mất dữ liệu.
- `r1-staging-natural-cron-20261012.json`: thêm180giây tail,9events/0parseerror; ba cron trên đúng version outcomeok/CPU5–8ms/wall1932–3713ms. Owner API/history/game/bootstrap tiếp tục200; game wall2242–2269ms, bootstrap6377–6619ms. Observer dừng tiến trình tail của chính nó theo timeout; childexit1 do timedStop, không là Workerexception. Mẫu này chưa phủ mọi phase hoặc backlog lớn ở remote.
- Audit PRODUCT/REVIEW/ACCEPTANCE: H01–H11/G01–G14 và từng dòng scope có evidence trong bảng trên; A01–A10 có source/docs/QA/ops tương ứng. Full gates chạy trên runtime source của `bcd22bb`; bàn giao docs sau release không đổi binary. Không còn feature/art/staging gate phải hứa bổ sung. Root cause nudge lịch sử vẫn chưa được chứng minh; hai lỗi final-send thực tế đã có regression fail-before/pass-after và bản fix đã deploy.

## Tour nghiệm thu và giới hạn

1. **Hôm nay:** kiểm kế hoạch/deadline/focus/ngủ vẫn theo bố trí cũ; habit chỉ là nhóm gọn.
2. **Thói quen:** tạo habit thực tế nếu muốn; thử tick hoặc nhập tổng, lịch tuần linh hoạt, lịch sử/báo cáo, nhắc/đặt chỗ tùy chọn và xuất dữ liệu.
3. **Thần Lộ:** mở Cách chơi, Công pháp và Hành trình; thử Võ Kỹ Cơ Bản/trận nhập môn, chọn luyện từ habit thật. Xuất chiến/đổi môn áp ngày sinh hoạt kế tiếp; không cần log giả để thấy toàn catalog.
4. Đọc [USER_GUIDE](HABIT_GAME_USER_GUIDE.md) khi cần hiểu tinh thuần, chốt ngày, rút/cứu, kỳ thiếu hoặc mất mạng.

Chrome emulation không phải thiết bị thật; provider fixtures không chứng minh Gemini/Telegram live. Truyện/game nhiều ngày đã kiểm bằng production engine/D1/earned simulations, chưa phải người thật chơi nhiều tháng. Độ cuốn và cảm giác hình ảnh do user nghiệm thu cuối. Local artifact/backup có dữ liệu hoặc dung lượng lớn giữ ngoàiGit; finals/workflow/manifest/docs trong repo.
