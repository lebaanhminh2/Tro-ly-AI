# Linh thú v2 — triển khai và hợp đồng nghiệm thu

Ngày lập: **22/10/2026, Asia/Saigon**. Trạng thái ban đầu lúc lập kế hoạch: chưa triển khai runtime v2. Kết quả local sau thực thi ở [hồ sơ kiểm chứng](LINH_THU_V2_VERIFICATION.md), cách nghiệm thu/migration ở [vận hành v2](LINH_THU_V2_OPERATIONS.md).

Nguồn chuẩn: [Đặc tả v2](LINH_THU_V2_SPEC.md). Lệnh thực thi: [Goal](LINH_THU_V2_GOAL.md).

## 1. Quyền và giới hạn

Người dùng đã ủy quyền agent tự chủ thực hiện nâng cấp, tự quyết trường hợp phát sinh và không hỏi lại khi người dùng vắng mặt. Được sửa/tạo/tái cấu trúc/di chuyển/loại bỏ code, migration, tài liệu và test trực tiếp liên quan hoặc điểm gọi cần thay để hoàn thành luồng. Đây là ngoại lệ cho việc xin xác nhận từng lần sửa code; không cần sửa AGENTS.md.

Công bố phạm vi rồi thực hiện; phát sinh tệp liên quan thì cập nhật và tiếp tục, không dừng duyệt. Được đổi đề xuất kỹ thuật nếu có căn cứ. Không tự cân bằng lại phần CHỐT; quyết định bổ sung/thay mặc định phải ghi rõ và kiểm chứng.

Mục tiêu là workspace và local/test sẵn sàng nghiệm thu. Không deploy production, chạy migration database thật, xuất bản hoặc gửi thông báo; đó là ngoài phạm vi, không phải bước xin quyền làm gián đoạn goal. Không reset/clean workspace, không ghi đè thay đổi sẵn có, không tự commit/push nếu không có chỉ dẫn tương ứng. Không làm lại sản phẩm hoặc nâng dependency diện rộng ngoài nhu cầu.

Có thể dùng agent phụ khi công cụ hỗ trợ. Mỗi nhóm tệp chỉ một agent ghi tại một thời điểm; agent chính tích hợp và kiểm chứng, không coi báo cáo agent phụ là bằng chứng thay cho kết quả.

## 2. Khảo sát và baseline

1. Đọc hướng dẫn áp dụng, hai tài liệu v2 và trạng thái Git; phân biệt thay đổi sẵn với thay đổi của goal.
2. Truy vết nguồn task/habit/ngủ/quay/ghép/đột phá/tháp → hiệu ứng → transaction → ví/counter → API/UI.
3. Đo baseline đủ phân biệt lỗi có sẵn và hồi quy mới. Không coi kết quả v1 ngày 21/10 trong tài liệu cũ là test v2 mới chạy.
4. Đọc [vận hành v1](LINH_THU_OPERATIONS.md), [nghiệm thu v1](LINH_THU_ACCEPTANCE.md), [habit](HABITS.md) để giữ phần ngoài phạm vi.
5. Công bố kế hoạch và bắt đầu triển khai, không dừng chờ duyệt.

## 3. Bản đồ tác động dự kiến

| Nhóm           | Nơi khảo sát/sửa                                                                                                                   | Kết quả                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cấu hình/luật  | `src/domain/linh-thu-skills.ts`, `linh-thu-ultimates.ts`, `linh-thu.ts`                                                            | Tỷ lệ từng form, skill tự động, counter có kiểu, giới hạn từng skill                         |
| Tài khoản/điểm | `src/domain/linh-thu-account.ts`, `linh-thu-training.ts`, `healthy.ts`                                                             | Tách skill version và training rule version, modifier trước roll, giữ điểm/độ thuần/luật nền |
| Ngày/habit     | Luật/port/adapter habit liên quan                                                                                                  | Phân biệt achieved/missed/neutral, nghỉ/quota, active/đến hạn; không đổi công thức luyện     |
| Điều phối      | `src/application/linh-thu-settlement.ts`, `linh-thu-ultimates.ts`, `linh-thu-roles.ts`, `linh-thu-service.ts`, `linh-thu-tower.ts` | Chu kỳ/buff, bỏ activation tuần cho v2, role/reset/sacrifice                                 |
| Port           | `src/ports/linh-thu-store.ts` và module mới cần thiết                                                                              | Source event, snapshot, trạng thái ngày/skill, version và receipt                            |
| D1 linh thú    | `src/adapters/d1/linh-thu-effects.ts`, `linh-thu-draw.ts`, `linh-thu-maintenance.ts`, `linh-thu-store.ts`, `linh-thu-reader.ts`    | Ghi nguyên tử, x10 cấp giao dịch, chốt ngày có giới hạn, tương thích v1                      |
| Nguồn nền      | `src/adapters/d1/task-hierarchy-store.ts`, `healthy-store.ts`, `schedule-store.ts`, adapter thưởng habit                           | Task duy nhất, sleep/undo, phân loại khoản tài nguyên, chống mất cập nhật                    |
| Entrypoint     | `src/entrypoints/mini-app/linh-thu.ts`, `cultivation.ts`, `src/entrypoints/worker-scheduler.ts` và điểm gọi                        | HTTP/cron cùng luật; client cũ không kích hoạt v1 mới                                        |
| Tháp           | `src/domain/linh-thu-tower.ts`, tower service/eligibility                                                                          | Cứu một bẫy mỗi lượt, gồm tầng 4, vẫn có bẫy sau cứu                                         |
| Web            | `web/models/linh-thu.js`, `web/views/linh-thu.js`, `web/features/linh-thu.js`, các module cultivation                              | Luật/mô tả/progress/quota/buff, chance preview và bỏ UI tuần                                 |
| UI phụ         | `web/linh-thu.css`, fixture/demo/state liên quan                                                                                   | Chỉnh vừa đủ, giữ hình ảnh/UI hiện có, không thêm nút cấp tài nguyên test vào app thật       |
| Dữ liệu        | Migration mới trong `migrations/`                                                                                                  | Cutover, version, constraint/index, nâng cấp dữ liệu v1                                      |
| Bằng chứng     | `tests/unit`, `tests/integration`, `tests/browser`, benchmark liên quan                                                            | Kỳ vọng độc lập, runtime thật, migration, hiệu năng                                          |

Tên tệp/lớp là điểm khảo sát, không khóa kiến trúc. Được thêm/tách module nếu giảm vòng phụ thuộc hoặc trùng lặp. Không xây framework luật tổng quát/DSL hoặc kéo dependency nặng khi kiểu dữ liệu và hàm thường đã đủ.

## 4. Hợp đồng kiến trúc

### 4.1 Luật và sự kiện

- Hàm luật có kiểu, không gọi HTTP/DB trực tiếp, nhận thời gian/RNG từ ngoài.
- Xác suất từng form chính xác; không scale lại lượng thưởng hoặc buff xác suất hai lần.
- Nguồn có thể gồm task, sleep, habit, combined/perfect day, giao dịch x10, fusion, breakthrough, tower.
- `qualified=false` không đồng nghĩa bỏ qua mọi xử lý: miss reset chuỗi/bảo hiểm; thành công reset chuỗi đột phá thất bại.
- Tổng task nguồn tách số task đã trả thưởng thiên phú.
- Result phân biệt thưởng, refund, modifier trước roll, buff thời hạn và state mới; không ép mọi hiệu ứng thành object thưởng dương.
- Reward không tạo lại source để tự lặp skill.

### 4.2 Giao dịch và replay

- Source có danh tính ổn định: request, task, ngày và giao dịch x10 phải phân biệt đúng.
- Ví TV/VQ/vật phẩm, VTH, counter, buff, tự thiêu và receipt commit nhất quán.
- Version guard/transaction/unique constraint hoặc phương án tương đương phải chứng minh được không trả trùng/mất cập nhật.
- Replay receipt trước kiểm tra trạng thái mới có thể chặn request đã thành công.
- Không lộ outcome chưa commit; conflict không trả thưởng; retry không roll lại kết quả đã commit.
- Không dùng trạng thái nút/browser làm khóa quota.
- Không phụ thuộc lịch sử UI có thể retention xóa; không quét toàn lịch sử mỗi task/draw.

### 4.3 Ngày và snapshot

- Lưu đủ ngữ nghĩa habit satisfied/reward eligible, task count, on-time, perfect, chuỗi ngày gốc, đồng hành và trạng thái skill. Tên trường do agent chọn.
- Khi status không đủ phân biệt nghỉ hợp lệ với chưa bắt đầu/archived, giữ thêm reason/active obligation; không đoán từ raw log.
- Pending không phải miss. Backlog có thứ tự, nhận diện khoảng trống, không nối chuỗi giả.
- Multiplier snapshot theo ngày gốc; không áp trạng thái hôm nay cho thưởng hôm qua/pending v1.
- Provenance của buff, ngày hiệu lực và lượt luyện rõ; đổi thú không cấp lại mốc/hồi quota.
- Scheduler tiến công việc dù không mở app, mỗi bước hữu hạn/checkpoint được; không yêu cầu người dùng GET liên tục.
- GET bảo trì dùng luật quyết toán và receipt; preview thuần không ghi thưởng.

### 4.4 Tài nguyên, ngủ và đột phá

- Kiểm kê mọi chỗ cộng/trừ ví; không chỉ nhân khoản thú mà bỏ task/check-in/quay/tháp nền.
- Phân loại nguyên nhân trước multiplier, lưu số gốc/số thực trả đủ audit.
- Một giao dịch có thể gồm chi phí/thưởng/hoàn; không nhân net delta.
- Không nhân điểm luyện/chance/số roll/cá thể; tự thiêu **12 TV gốc × 3 = 36 TV** một lần/ngày có hiệu lực, không nhân lại thành 108.
- Chuỗi skill không lấy sai chuỗi nền đã được phù bảo vệ; không phá luật bảo hộ nền.
- Ưu tiên chờ hết undo trước trả skill phụ thuộc ngủ. Bút toán bù thay thế phải đảo đủ reward/counter và chống roll lại; không khóa undo.
- Linh Quy đọc buff trước roll, tiêu hao đúng một lần; chance preview khớp server.
- Ghép phù giữ chi phí/yêu cầu đủ đầu vào; quota hồi theo ngày, không theo reload hoặc đổi thú.

## 5. Cutover và tương thích v1

Ghi chính sách đã chọn vào decision/migration log trước khi coi phần này xong:

1. Skill version v2 tách rule luyện nếu luật luyện không đổi; không đổi training ruleVersion theo quán tính.
2. Cutover server-side rõ, ưu tiên ngày sinh hoạt nguyên vẹn. Ngày trước/sau dùng luật nào phải xác định được cả khi backlog chạy muộn.
3. Không giải nghĩa lại counter v1 khác nghĩa, không reset ví/cá thể/điểm/độ thuần hoặc trả lại thưởng đã thanh toán.
4. Receipt v1 replay được. Pending choice đã trả vé hoàn tất theo quyền lợi đã ghi; claim không tạo source v2 mới để thưởng lần nữa.
5. Hiệu ứng v1 đã cấp có quy tắc kết thúc/tương thích; không mở activation tuần v1 mới sau cutover và không cộng vô ý v1/v2.
6. Client cũ được phản hồi có nghĩa hoặc compatibility; không âm thầm tiêu tài nguyên theo luật không còn trong UI.
7. Không để ultimate/choice cũ giữ thú kẹt sacrifice. Không xóa quyền lợi còn tồn chỉ để mở khóa.
8. Migration mới, không sửa lịch sử migration. Chạy DB sạch và v1 đại diện, kiểm constraint/index/foreign key/bảo toàn dữ liệu.
9. Bàn giao thứ tự migration/deploy và biện pháp phục hồi có tính dữ liệu v2 đã ghi; không hứa rollback code là đủ sau khi state/schema đã đổi.
10. Không chạy DB thật để hoàn thành goal local.

## 6. Giai đoạn và checkpoint

| Pha | Đầu ra                                                                     |
| --- | -------------------------------------------------------------------------- |
| P0  | Đối chiếu đủ 18 loài, inventory điểm gọi, baseline và mặc định cần áp dụng |
| P1  | Config/sự kiện/counter có kiểu, test con số và trạng thái chính            |
| P2  | Nối hook thật, atomic reward/receipt, ngày/undo/multiplier hoạt động       |
| P3  | Migration, cutover, pending v1 và role/reset/sacrifice                     |
| P4  | API/UI/fixture, progress/quota/buff/chance và client cũ                    |
| P5  | Test xuyên suốt, migration, benchmark và tự review diff                    |

Được đổi thứ tự theo phụ thuộc; xong domain không phải xong tính năng.

Khi bắt đầu goal thực thi, tạo/cập nhật `docs/LINH_THU_V2_PROGRESS.md` và `docs/LINH_THU_V2_VERIFICATION.md` hoặc hồ sơ tương đương. Chưa tạo các file kết quả giả tại giai đoạn soạn đặc tả. Checkpoint ghi:

- Pha hiện tại, file đã sửa, việc còn lại và bước kế tiếp cụ thể.
- Quyết định CHỐT hay bổ sung/thay mặc định, căn cứ, ảnh hưởng và test.
- Lệnh thực chạy, kết quả, đường dẫn log local và thời điểm.
- Lỗi baseline có bằng chứng tách khỏi hồi quy mới.

Context rút gọn/turn mới: đọc checkpoint/diff và đi tiếp, không khảo sát lại vô ích. Tool lỗi thì thử cách khác, tiến phần độc lập, không hỏi một quyết định đã được ủy quyền. Không tự pause hoặc đánh dấu complete vì hết context/hạn mức. Nếu không còn đường tiến vì điều kiện ngoài công cụ/quyền, lưu bằng chứng và phần chưa đạt; không giả thành công/lặp vô ích.

## 7. Ma trận nghiệm thu

**Chưa có dòng nào được đánh dấu PASS cho runtime v2 tại lúc lập tài liệu.** Agent phải gắn từng dòng với nơi triển khai và test/kiểm tra thực chạy trong hồ sơ kết quả.

### 7.1 Từng loài

| ID      | Phạm vi bắt buộc                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| V-R01   | Tỷ lệ bốn form, đúng tier thưởng, tích lũy 3 ngày, ghép lần 1–3/4/ngày mới, success/failure/thiếu đầu vào               |
| V-R02   | Thiên phú, chuỗi 3 và 14 độc lập, miss/reset, reset cả khi roll 40% không trúng                                         |
| V-R03   | Hoàn 5 cap thực mất, success cắt chuỗi, ba thất bại rồi modifier trước roll, dùng/reset buff, không mất TV              |
| V-R04   | 10/20/30/35, task thứ 3, một lần/ngày, biên 04:59/05:00/07:59/08:00/ngày sinh hoạt                                      |
| V-R05   | Bốn tỷ lệ, task thứ 3/8/9, redo/retry không trả lại, ngày mới                                                           |
| V-R06   | Thiên phú/95% đều +2, ba ngày combined trả cả hai quà, không đòi task, miss reset                                       |
| V-SR01  | 2 VQ, tích lũy 5 trả 5VQ+10TV, liên tiếp 5 perfect trả 20+20, thiếu từng điều kiện reset                                |
| V-SR02  | 15/30/45/60, mốc 3, nhịp 1/2/3/3..., task 6–8 và reset ngày                                                             |
| V-SR03  | 10/25/35/50, task 3 trước/đúng 12:00, một thưởng 10VQ/ngày, hai perfect/reset                                           |
| V-SR04  | 95% tích lũy khác 100% liên tiếp, dùng S gốc, bắt đầu S20 rồi trả23, không cap                                          |
| V-SR05  | Hoàn 10, mất3 hoàn3, habit+2, năm đêm/reset/VTH                                                                         |
| V-SR06  | 3/5/7/9, sáu hụt rồi bảo đảm, trúng ngày7 không cấp đôi, trúng/miss reset, 30/70 đúng một phù                           |
| V-SSR01 | Ngủ+10, TP2 T3/T4 5/10%, combined+2VQ, ba đêm trả S vé không xóa chuỗi                                                  |
| V-SSR02 | TP độc lập/cùng thưởng, từ task3 +3VQ kể cả sau5, ceil(S/2) cap5 ở S1/2/3/7/8/9/10                                      |
| V-SSR03 | 10/15/25/35, buff10/20 điểm tại S14, một roll/ngày, x10 3/6/...100/reset, quay đơn, 100% chỉ đếm S>=7                   |
| V-SSR04 | +5TV và riêng+1VQ habit T4, hai task roll3VQ nhưng buff chắc chắn, mọi task ngày sau/không chồng, cứu tầng4/gặp lại bẫy |
| V-UR01  | +3TV/+2VQ đúng tỷ lệ, mọi10 task trả10VQ và roll30% VTH, multiplier đúng nguồn/ngày, tự thiêu/đứt chuỗi                 |
| V-UR02  | +5/+10 đúng form, bảy perfect100VQ, daily perfect+S vé, đồng thời trả95%/100%                                           |

### 7.2 Xuyên suốt

| ID   | Bằng chứng                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | Đủ18 ID/rank/6mốc, form và sát biên95%/100% bằng số gốc                                                                            |
| V-02 | RNG/time kiểm soát trong test, probability boundary, kỳ vọng độc lập không đọc config rồi so chính config                          |
| V-03 | Task gốc/step/redo/retry/đã nhận thưởng, total count tách cap thiên phú                                                            |
| V-04 | Habit daily/weekdays/weekly, nghỉ/quota, all-neutral/no-active/miss/pending; không đổi điểm luyện/xám                              |
| V-05 | Ngủ→undo→báo lại không kiếm thêm quà/chuỗi/counter; giữ undo/bảo hộ nền                                                            |
| V-06 | Đồng thời, receipt replay, stale version, rollback trước commit; không trùng/mất cập nhật                                          |
| V-07 | Backlog/ngày trống/nguồn đến lệch/ngày qua nửa đêm, dùng S/role/form/multiplier gốc                                                |
| V-08 | Đổi role/mở skill/tiến hóa/luyện lại/hiến tế/tạm ngưng-tiếp tục, không hồi quota hoặc mất quyền lợi                                |
| V-09 | Nhân thưởng nền/thú, loại refund/conversion/chi phí/chế tạo/cá thể/điểm luyện, không đệ quy, tự thiêu một lần, phạt ngày đứt chuỗi |
| V-10 | Task→DB→ví→API→UI, sleep/habit→chốt→thưởng, x10→receipt, fusion/breakthrough/tower thật, không chỉ fixture                         |
| V-11 | DB mới/v1 migration được, giữ ví/ID/điểm/pending/receipt, client cũ không activation v1 mới, không kẹt sacrifice                   |
| V-12 | Browser thật/mobile, skill/progress/quota/buff/pending, đóng-mở/reload/phản hồi muộn, bỏ nút tuần                                  |
| V-13 | Không mở app vẫn tiến qua cron, không buộc GET lặp mới hoạt động, không hard cap chung                                             |
| V-14 | Nhiều cá thể/habit/ngày tồn, query/payload/budget thực, không nới gate để xanh                                                     |
| V-15 | Review diff, tìm số/mô tả tuần cũ sót, call site/import/vòng phụ thuộc, chỉ giữ v1 compatibility có chủ đích                       |

### 7.3 Lệnh kiểm tra

Đọc lại `package.json` lúc triển khai nếu đã thay đổi. Hiện có:

```powershell
npm run typecheck
npm run typecheck:web
npm run check:web
npm run lint
npm run format:check
npm test
npm run test:browser
npm run build:check
node scripts/benchmark-linh-thu.ts
```

Chạy test mục tiêu trong khi làm, các gate phù hợp trước bàn giao; browser toàn suite khi môi trường cho phép. Experiments nếu bị ảnh hưởng; benchmark web hiện có nếu thay đáng kể UI/asset loading. Chỉ format tệp sửa; module mới ngoài baseline format vẫn phải kiểm riêng.

Không gọi kiểm tra chưa chạy là PASS. Tool lỗi môi trường phải thử phương án thay và ghi phạm vi thiếu. Không giảm assertion/gate hoặc xóa kiểm thử nghiệp vụ. Được thay test hành vi v1 đã bị thay bằng test v2 tương ứng, giữ test compatibility cần thiết. Lỗi ngoài phạm vi phải có bằng chứng baseline, không dùng che hồi quy mới.

## 8. Định nghĩa hoàn thành

- Đủ 18 loài khớp đặc tả; mặc định đã áp dụng/thay đổi được ghi rõ.
- Hook runtime thật/API/UI cùng chạy cơ chế mới; không dừng ở config/domain/demo.
- Skill tự động; luật tuần v1 không vô ý tác động sự kiện v2.
- Giao dịch/counter/quota, migration/pending/undo có kiểm chứng.
- Ma trận có nơi triển khai và test/kết quả thật, không “đã làm” không căn cứ.
- Hồi quy mới phát hiện trong luồng liên quan đã sửa; diff đã tự review, kiểm tra bị ảnh hưởng đã chạy lại.
- Test/build/benchmark quan trọng có kết quả; hướng dẫn local/migration đủ nghiệm thu.

Thiếu tiêu chí thì ghi chưa đạt, không tự hạ chuẩn để kết thúc. Không cần sửa mọi lỗi không liên quan hoặc lặp toàn suite vô tận khi không có lý do mới.

Báo cáo cuối ngắn, dẫn đặc tả/decision log/hồ sơ test/file chính/hướng dẫn local/migration và giới hạn thực tế. Không sửa lịch sử release/acceptance v1 thành kết quả v2 chưa chạy.
