# Habit/Thần Lộ — bằng chứng và phát hành

Cập nhật 2026-10-12. **Goal chưa hoàn thành; phần mới chưa lên staging.** File này đối chiếu yêu cầu với bằng chứng hiện có, không thay [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) hoặc [PRODUCT](HABIT_GAME_PRODUCT.md).

## Target và trạng thái

| Mục | Thực tế |
| --- | --- |
| Branch | `review/p1-p3`; kiểm HEAD/git status trước mỗi release |
| Staging | `personal-assistant-staging` |
| D1 | `assistant-staging`, ID `5457c401-45d9-4b19-b76e-0eceec67a223` |
| URL app | https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ |
| Schema cần phát hành | 0031–0037; chưa áp remote |
| Luật/content | `practice-v1`, `battle-v1`, `than-lo-3`; snapshots cũ giữ nghĩa cũ |
| Xác thực | Auth10000 đã giải: agent chạy `wrangler login` theo user, exit0; info/pending migration target verified |
| Backup staging thật / restore | Đã export/restore/rehearse;72legacytables/1011rows proof giữ,27newtables |
| Deploy / smoke | Full gates đã đạt; chuẩn bị áp remote/deploy, chưa có Worker version mới |

Backup thật và full gates đã đạt; tiếp theo remoteapply/deploy và read-only smoke. Không in token/.env/SQL/private export URL.

## Đối chiếu phạm vi sản phẩm

| Yêu cầu | Bằng chứng sở hữu | Giới hạn / phần còn cần |
| --- | --- | --- |
| Habit CRUD/lifecycle/ba lịch/tick và định lượng | `src/application/habit-service.ts`, D1 habit store; unit habits và integration habits | Local; còn kiểm bản publish |
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
| Ảnh thật đồng nhất, không placeholder | assets manifest/source/workflows; 40 encounter/15 scene/5 school/3 weapon +39 SVG; full campaign browser/contact QA | Staging asset smoke còn thiếu; `tram-nui` là ảnh dự phòng không được dùng trong runtime |
| Onboarding/guide/settings/export | browser guide/settings/export/presets; D1 game-export/presets; USER_GUIDE | Hide game/reduced motion device-local; không tự import ghi đè dữ liệu |
| UI gọn/mobile/accessibility/mạng | actual browser 360/390/414/1440, light/dark, text200%, keyboard, slow/offline; PROGRESS | Chrome emulation; không tuyên bố thiết bị thật |
| Bot/context/tools | integration habit-game-bot: readonly/pagination, native atomic journal, stale cutoff/lost ACK/guards | Live provider không suy từ fixture; deterministic core không phụ thuộc model |
| Giữ task/ngủ/focus/reminders/đột phá | main regression suites + full browser; final-send race có fail-before/pass-after | Root cause tin ngủ lịch sử chưa xác nhận; tin đã dispatch không thu hồi |
| Data/hiệu năng/vận hành | upgrade rehearsal + production-store restore smoke; D1 scale case; runtime benchmark; actualstaging backup/restore readflows; OPERATIONS | Remote migration/deploy/smoke còn chờ gate; runtime remote latency/CPU chưa đo |

## Bằng chứng F6/R1 mới

Artifact local ở `D:/Tro-ly-AI-art`, không chứa trong bundle/Git. Nội dung private backup không đưa vào báo cáo.

- `f6-full-campaign-art-ui.log`: 1 test đạt, 80 preparation previews/30 chapter screens/30 story endings, read-only. `f6-campaign-ui-evidence.json` ghi geometry thật. Đã xem contact sheets portraits light/dark, chapters, preparation lower-fold và bốn story-ending sheets. Stale native dialog close không được reset thẻ mới đang mở; giữ regression assertion.
- `r1-upgrade-rehearsal-final.log`: 2 tests đạt; pre0031 SQL → restored SQLite →0031–0037, counts/hash cột cũ giữ nguyên. Production habit/log/practice chạy trên DB restored; task/uncertain delivery/healthy giữ đúng. Migration lỗi SQL hoặc đổi dữ liệu cũ rollback cả schema/writes; thiếu migration tracking bị từ chối.
- `r1-d1-runtime-scale.log`: 1 actual Miniflare D1 test đạt; 30 habit ×1096 ngày logs, lịch sử hai trang không trùng, backlog365 ngày tiến một ngày mỗi batch, không đổi healthy. Không dùng synthetic data trên staging.
- `r1-local-runtime-benchmark-drain.json`: bốn fixture6/30habit, 1095 ngày lịch sử,1096bản luyện, backlog7/365. Today13SQL/<24KB; history page1SQL/~16KB; report2SQL. Drain đầy đủ365 ngày: 2190/10950 outcomes mới đúng một lần, max18SQL/call, replay0, healthy giữ nguyên. Mỗi call có giới hạn; tổng drain không là một invocation Worker.
- Local SQL-inclusive wall time phụ thuộc máy/tải; lớn nhất history page khoảng119ms trong lượt đo. CPU là Node+SQLite, counters Windows có thể làm tròn lượt ngắn thành0ms; không dùng để khẳng định Worker CPU<10ms hoặc remote D1 latency.
- Actual backup `staging-before-habits-20261012-1.sql` ngoàiGit,1.559.408bytes/SHA256`0ce8d64e1eedf878de6cdfbf8de549bd356b777210519f0927dd2da0739d0b8b`. Real rehearsal `.sqlite`/`.json` baseline0030→0037 giữ72legacytables/1011rows và tạo27newtables; integrityok/FK0. `staging-real-restore-readflows-20261012.json`: productionhealthy/taskprogress/habits/game/battle reads trên actualcopy, tất cảtableproof unchanged; không dispatch hoặc tạo dữ liệu thật.

Fullbrowser cuối **33pass/0skip**, exit0 (`r1-final-test-browser.log`); typecheck/check:web45modules/build:check/staging:check dry-run đạt. Bundle659.42KiB/gzip153.30KiB/224assetfiles. Main gate đầu314/315, một source-fragment assertion cũ không phù hợp queued-close fix; đã thay bằng kiểm callback giữ thẻ mới và mở cuộn sau đóng cuối,17unitUIcases đạt. Full recheck **317main +25experiments/0fail/0skip**, exit0 (`r1-final-test-all-recheck.log`); có cả D1scale/restore/newclosebehavior cases. Không gọi provider fixtures là live.

Candidate rollback code là `fb3e76f`: backend/migrations/rules của worktree hiện tại giống commit này, khác runtime UI chủ yếu là queued-close guard; verify diff lại trước release. Không tự rollback về Worker staging cũ không biết luật game mới nếu đã có dữ liệu/trận. Khi có Worker version mới, ghi version rollback tương thích hoặc dựng candidate từ checkout riêng và chạy gates; không ghi đè workspace/dữ liệu hoặc xóa schema mới.

## Audit còn bắt buộc trước complete

1. Đọc lại PRODUCT/REVIEW/ACCEPTANCE và source cuối, xử lý mâu thuẫn hoặc hạng mục chưa được bằng chứng phủ. Kiểm paths/docs/manifest/hash và staged files.
2. Đạt typecheck/check:web/test:all/test:browser/build:check/staging:check trên source cuối; ghi kết quả và version rõ. Tests provider fixture không gọi Gemini/Telegram thật.
3. Sau login: xác minh account/Worker/DB/migration baseline, export backup ngoài Git; restore và rehearsal backup thật vào SQLite mới; kiểm counts/hash/integrity/FK, dữ liệu cũ và schema mới.
4. Chỉ khi các gate đạt mới áp remote0031–0037/deploy staging. Kiểm migration listing/Worker version, app/modules/assets, auth401 và API read-only bằng phiên owner hợp lệ nếu có. Không tạo log thật hoặc gửi tin giả để smoke.
5. Bổ sung version/commit/migrations/backup path/restore report/remote smoke và hình màn cuối; giao USER_GUIDE, URL/cách đăng nhập và tour nghiệm thu.

Giữ goal active khi còn công việc độc lập; nếu chặn xác thực trở thành impasse thật, dùng blocked theo điều kiện công cụ. Không đánh dấu complete khi chỉ xong local.
