# Linh thú v2 — hồ sơ kiểm chứng

Ngày kiểm chứng: **22/10/2026, Asia/Saigon**. Hoàn thành phạm vi local/test theo [đặc tả](LINH_THU_V2_SPEC.md) và [kế hoạch](LINH_THU_V2_IMPLEMENTATION.md). **Chưa deploy hoặc migrate remote.** Hướng dẫn nghiệm thu/migration/phục hồi: [OPERATIONS v2](LINH_THU_V2_OPERATIONS.md).

## Lệnh và kết quả

Log local trong `.wrangler/linh-thu-v2-audit/`. Các test sau có0 fail/0 skip; không cộng số suite chồng nhau thành tổng test độc lập.

| Lệnh                                                                                                                | Kết quả                                                     | Log/bằng chứng                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm.cmd test`                                                                                                      | **460/460 PASS**                                            | `full-tests-final.log`                                                   |
| `npm.cmd run test:browser`                                                                                          | **120/120 PASS**, Chrome thật, mobile/desktop               | `full-browser-final.log`                                                 |
| 6 file domain/wallet/runtime/daily/migration v2 chạy lại sau sửa cuối                                               | **75/75 PASS**, gồm4 subcase habit thật                     | `v2-all-final.log`                                                       |
| Hồi quy empty/exchange/rollback/sacrifice sau bổ sung khởi tạo qua mutation đầu tiên                                | **12/12 PASS**                                              | `first-mutation-regressions.log`                                         |
| `npm.cmd run typecheck`, `typecheck:web`, `check:web`, `lint`                                                       | PASS;44 module web hợp lệ                                   | Output công cụ và `final-checks.log`                                     |
| `npm.cmd run format:check`                                                                                          | PASS baseline 111 files; file v2 mới kiểm Prettier riêng    | `final-checks.log`                                                       |
| `npm.cmd run build:check`                                                                                           | PASS Worker dry-run, 711,36 KiB/gzip 158,79 KiB             | Output công cụ và `final-checks.log`                                     |
| `node scripts/benchmark-linh-thu.ts`                                                                                | PASS gate gốc50 queries/40.000 byte, giữ v1 fixture rõ ràng | `legacy-benchmark.log` và fulltest cron                                  |
| `node scripts/benchmark-linh-thu-v2.ts`                                                                             | **96 metrics PASS**,24/2400 cá thể,3 loài                   | `v2-benchmark-payload.log`                                               |
| `node scripts/benchmark-linh-thu-web.mjs --samples=1`                                                               | PASS diagnostic,2 biến thể ảnh,2400 cá thể fixture          | `web-benchmark-final.log`; `trial-results/linh-thu/web-performance.json` |
| `wrangler d1 migrations apply assistant-local --local --persist-to .wrangler/linh-thu-v2-audit/migration-rehearsal` | PASS toàn bộ migration đến0045 trên DB local riêng          | `wrangler-migration-local.log`                                           |

Bộ test đầy đủ chạy trước các bổ sung cuối: khởi tạo v2 ngay khi mutation đầu tiên chưa GET, test cron không GET và lấy đúng snapshot tiến trình khi mở cá thể đồng hành từ bộ sưu tập. Sau đó, **75 test v2, 12 hồi quy liên quan và 8 test web v2 đều PASS**; benchmark 96 metrics được chạy lại. Log web: `v2-web-final.log`. Không lặp toàn repo khi các thay đổi đã có kiểm tra đúng phạm vi. Bộ browser đầy đủ đã dùng luồng v2 và sửa audit x10 cuối. Baseline beast v1 trước tích hợp84/84 PASS, không dùng thay bằng chứng v2.

## Ma trận18 loài

`U` = [unit domain v2](../tests/unit/linh-thu-v2.test.ts), dùng kỳ vọng số độc lập, RNG/time kiểm soát; `R` = [runtime D1/API v2](../tests/integration/linh-thu-v2-runtime.test.ts); `D` = [daily D1](../tests/integration/linh-thu-v2-daily.test.ts). Tất cả dòng PASS trong các lệnh trên. Cấu hình/reducer ở [domain v2](../src/domain/linh-thu-v2.ts), không phải luật demo.

| ID      | Bằng chứng hành vi và điểm nối                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-R01   | U humbug:4 tỷ lệ/tier/tích lũy; R real fusion API:success/failure lần1–3/4/ngày mới/thiếu đầu vào; adapter fusion giữ sản phẩm/refund riêng                       |
| V-R02   | U owl:chu kỳ3/14độc lập, miss và hụt40% reset; D chờ ngày/undo, originalS                                                                                         |
| V-R03   | U turtle:hoàn5 capthực mất,success/reset/consume; R actual breakthrough chance100 với modifier5 trước roll và case rời/quay lại không giữ buff cũ                 |
| V-R04   | U deer:10/20/30/35, task3, biên04:59/05:00/07:59/08:00 và once/day; adapter nhận localMinute timestamp gốc                                                        |
| V-R05   | U rabbit3/8/9; R main task8 thật/replay/redo không lặp, không bị cap5                                                                                             |
| V-R06   | U funglet:habit/95 đều2 và combined3 ngày nhận cả quà; R cron thật không task vẫn trả combined5 TV+3 VQ ở mốc, replay không trả lại                               |
| V-SR01  | U snail:2 VQ,5 ngày tích lũy5 VQ+10 TV,5 perfect20+20 và reset thiếu điều kiện; D giữ thứ tự nguồn                                                                |
| V-SR02  | U cat:15/30/45/60,1/2/3/3...; R task6–8 thật vẫn+9 TV, source-day không rewind                                                                                    |
| V-SR03  | U mantis:10/25/35/50,3 task trước12:00 vs đúng12:00,2 perfect/reset                                                                                               |
| V-SR04  | U sheep:tích lũy riêng,3đêm trảSgốc không cap; D payout23 tại chuỗi23 và không trùng                                                                              |
| V-SR05  | U fish:hoàn10 caploss3,habit2,5đêmVTH; actual breakthrough hook dùng loss sau clamp và earned riêng                                                               |
| V-SR06  | U knight:3/5/7/9,bảo hiểm7 hụt liên tiếp, trúng/miss reset, không cấp đôi,10đêm roll30/70 một vật phẩm                                                            |
| V-SSR01 | U frost:ngủ10,phù độc lập5/10%,combined2 VQ,3đêm trảS vé không cap; D dùng assessment thật, không chuỗi bảo hộ                                                    |
| V-SSR02 | U lion:thiên phú độc lập/cùng thưởng,task>=3 thêm3 VQ kể cả>5,ceil(S/2)cap5 tại đầy đủ biên                                                                       |
| V-SSR03 | U ninja:10/15/25/35 và buffS14,x10 pity3/6/...100/reset,quay đơn,perfect cầnS>=7; R paidx10 thật/replay, không đủ10 vé không gọi RNG                              |
| V-SSR04 | U monkey:habitT4 +5 TV/+1 VQ,roll2 task và buff chắc chắn; R buffngày sau, bồi hoàn buff đến muộn, tower cứu tầng4 một lần/gặp lại bẫy vẫn thua                   |
| V-UR01  | U pyro:3 TV/2 VQ,mốc10 task/30%VTH,12 gốc→36; R task/checkin/drawx3 giữ chi phí; wallet sleep late x3 trướcclamp; D selfburn36 một lần; R towerexpiry x3 ngày gốc |
| V-UR02  | U meteor:5/10 TV,7 perfect100 VQ cùngdailyS; R habit→sleep→settlement thật4 trường hợp, ngày perfect trả101 VQ khiS1                                              |

## Ma trận xuyên suốt

| ID   | Bằng chứng và kiểm tra                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V-01 | U đầy đủ18 ID/rank/6 mốc, raw95/100 và yêu cầu đầyT4; browser all18 roadmaps; catalog/training/art regression toàn suite                                                                                                       |
| V-02 | U bảng kỳ vọng độc lập và strict probability boundaries; R/mock RNG cho x10/fusion/breakthrough; clock test không lấy thời gian máy                                                                                            |
| V-03 | R task8/redo/replay; healthy-v2 recovery9 task, tổng riêngquota; old hierarchy step/retry regressions giữ nguyên                                                                                                               |
| V-04 | R luồng thật: nohabit satisfiedtrue/eligiblefalse, weekly neutral không miss, daily miss chặnperfect,achieved; full habit tests daily/weekdays/quota/commitment/archived và traininggray không đổi                             |
| V-05 | healthy-v2 actual report→undo→report không reroll/cộng thêm skill; D không chốt trong undo window; full sleep protections/undo concurrency PASS                                                                                |
| V-06 | D stale runtime guard rollback ví/counter/journal/day; full atomic task/wallet/choice concurrency, R receipt replay/redo; guard version ví+beast+runtime cùng batch                                                            |
| V-07 | D oldestpending/missingday/originalattempt/closingskill; R delayed task giữ sourceform/oldattempt/dayquota, bồi hoàn buff ngày sau; sleep strictS không dùng protectedstreak                                                   |
| V-08 | R elixir latch trước role rewrite, turtle interruption, sacrifice sau suspended, tower reset; full roles/evolution/late training/cancel regressions                                                                            |
| V-09 | R+wallet task/checkin/habit/draw/sleep x3, costs giữ nguyên; R fusion không nhân sản phẩm/refund, exchange/sacrifice không nhân, D selfburn36 once, unit actual loss caps và penaltybeforeclamp                                |
| V-10 | R gọi D1 WorkStore, cultivation API, HabitService→ScheduleStore→BeastSettlementService→daily→ví; browser thật dùng production API/D1 cho paid draw và v1 compat; browser v2 dùng server projection fixture cho UI              |
| V-11 | Migration fresh/v1 bảo toàn ví/attempt/receipt/3 loại pendingchoices/FK; R v1 activation replay và paidrewardclaim sau cutover; code paid draw/summon choice không gọi v2 effect; sacrifice dùng settled v2 thay combinedv1    |
| V-12 | Fullbrowser120/120:mobile/desktop,quota/buff/pending,close/reopen/late response,automatic18 roadmaps,previewfresh/retry; xem screenshot dưới                                                                                   |
| V-13 | R actual worker cron không GET:habit slot→trainingrendezvous→v2 daily→replay; healthy-v2 wholeworker49/43/43 queries, mỗi lần phục hồi1 nguồn; benchmark actualcronclosedday25 queries                                         |
| V-14 | 96 metrics24/2400 beasts:task<=30,draw<=15,bootstrapví<=41,GETactive<=26,GETtrainingpending49,cronclosed25,dayreplay1; Linh thú payload tối đa38.708 byte<40.000. Full habit/history/backlog và legacybenchmark gate không nới |
| V-15 | Review diff, `git diff --check`, typecheck/lint/build/format; v1 chỉ ở nhánh pre-cutover/pending và fixture chỉ định. Không đổi ảnh,training/cost/pity và không thêm dependency                                                |

## Quyết định và sửa hồi quy

- Daily v2 chờ ngày đóng + undo + nguồn upstream; không cấp skill ngày trong reportSleep. S ngủ thực tách chuỗi được phù bảo hộ. Counter trả chu kỳ không xóa S tài khoản.
- Quota tức thời theo `daily_json` từng ngày. Task completion có snapshot form/attempt canonical; phục hồi muộn không dùng form mới, không rewind quota mới, không mất buff ngày sau đã kiếm được.
- Multiplier latch theo ngày; reset/evolve/tower-start chụp trước mutation. Ngày đạtS30 mởx3 từ ngày tiếp theo. Earned/refund/product/cost được phân loại, tự thiêu12×3=36 đúng một lần.
- D1 effect trả statement để caller ghép cùng ví. Ngoại lệ metadata bootstrap account cũ chỉ ghi cutover, không thưởng; fixture atomic test chụp baseline sau bootstrap metadata, vẫn so deep-equal ví/beast/counters sau rollback.
- Recovery v2 giảm từ25 source/slot xuống1 để giữ50 queries toàn worker. Phép đo ban đầu53 được sửa bằng dùng nguồn đã đọc/cache timestamp/provenance và bỏ đọc window lặp; test actualworker49 PASS, không nâng gate.
- Các test tuyệt kỹ tuần v1 pin cutover tương lai có chú thích. Newv2 fixtures dùng cutover thật. Browser paid draw đổi audit từ12 v1 perloot sang3 v2 paidbundles/tổng12 roll; giữ assertion3 roundtrip và chi phí/retry ban đầu.
- Fulltest đầu441/447, browser đầu118/120 là log lịch sử trước sửa, không dùng làm kết quả cuối. Lỗi commentsemicolon migration0045 đã sửa; CLI local và unitD1 commentcompat đều PASS.

## Hình và giới hạn

Đã xem trực tiếp screenshot mobile390 px: `trial-results/linh-thu/v2/run-23996/roadmap-390.png`; roadmap đọc được, nội dung cuộn trong sheet, không tràn ngang. Bộ browser cuối tạo thêm ảnh trong `trial-results/linh-thu/v2/run-*`.

Phép đo local SQLite không chứng nhận CPU/mạng/giới hạn production. Webbenchmark ảnh là fixture diagnostic một sample/biến thể; không coi là fieldWebVital hoặc actualD1 v2. ActualD1/API đã kiểm riêng bằng runtime suites và querybenchmark. Chưa thao tác DB thật, deploy, commit hoặc push. Hai thư mục output ban đầu giữ nguyên. Không có hạng mục local bắt buộc còn thiếu trong ma trận này.
