# Linh thú v2 — checkpoint thực thi

## Checkpoint nghiệm thu local — 22/10/2026

Đã hoàn tất triển khai và kiểm chứng phạm vi local. Toàn suite **460/460tests** và **120/120browser PASS**,75test v2 và12hồi quy liên quan chạy lại sau sửa cuối đều PASS. MigrationCLI trên DB local riêng đến0045 PASS. Backend/web typecheck,lint,syntax,format và Worker builddry-run PASS. Benchmarkv2 **96metrics** với24/2400cá thể giữ<=50queries và Linh thú payload<40.000byte. Không deploy/remote migration/commit/push.

Khuyển tự trừ **12tuvi gốc ×3=36/ngày có hiệu lực**, once/day. Đủ18loài/6mốc, luồng ví/nguồn/daily/cron/API/UI, snapshot nguồn, undo và compatibilityv1 đã đối chiếu ma trận. Quyền tự chủ đã dùng đúng phạm vi goal, giữ output không liên quan.

Hồ sơ cuối: [VERIFICATION](LINH_THU_V2_VERIFICATION.md), [nghiệm thu local/migration/phục hồi](LINH_THU_V2_OPERATIONS.md). Nội dung checkpoint bên dưới là lịch sử, không phải việc còn thiếu hiện tại. Goal chỉ chuyển complete sau kiểm tra file/gate cuối của agent chính.

## Lịch sử checkpoint tích hợp — 22/10/2026

**Goal active, chưa nghiệm thu toàn bộ.** Quyền tự chủ trong goal tiếp tục áp dụng. Không deploy production/remote migration. Tự thiêu Khuyển: **12 TV gốc ×3 =36/ngày hiệu lực**, một lần, không nhân tiếp108.

Đã nối: domain/config đủ18loài; migration0045; context/effect atomic cùng ví/receipt/counter; task trực tiếp và recovery; checkin/habit-ticket/sleep+undo; fusion/breakthrough preflight/x10; daily chờ nguồn và ngày đóng; maintenance; API/bootstrap; UI roadmaps/progress/quota/buff/pending/cultivation freshness; tower v2 cứu tầng4 và reward theo run gốc. V1 chỉ còn trước cutover và pending/replay đã trả phí; chặn activation tuần mới trong v2.

Quyết định bổ sung: quota tức thời lưu `beast_v2_days.daily_json`, nguồn task giữ `task_completions.beast_source_json` trong transaction timestamp gốc; delayedsource không lấy form/reset/quota ngày mới. Reset/evolve/towerstart latch ngày trước mutation. Recovery v2 một nguồn/invocation giữ budget50queries; đang tối ưu toàn cron vì phép đo phát hiện53queries. Fixture test cơ chế tuần v1 được pin cutover tương lai rõ ràng, bộ v2 độc lập dùng account mới thật, không giảm assertions/gate.

Bằng chứng tại checkpoint (log `.wrangler/linh-thu-v2-audit/`): baseline v1 beast84/84; domainv2 23tests; daily11; migration3; actualruntime15; webmới7 và regressionroles/evolution18+odds1 đã PASS. Backend/web typecheck, lint, syntax44modules, builddry-run đã PASS từng mốc, cần chạy lại cuối. Benchmarkv2 ban đầu66metrics ở24/2400cá thể đều<=50, đang mở rộng API/cron. Full `npm test` và browser đang chạy, có lỗi fixture/audit v1→v2 đã có sửa cần rerun; **chưa tuyên bố fullsuite PASS**.

Phân công hiện tại: root context/effects/store/reader/maintenance/settlement/tower/API/hồ sơ; v2_domain healthy/glue/draw/cultivationAPI/tests; v2_runtime_audit migration/daily/runtime tests/benchmark/fixturev1; v2_web UI và fullbrowser tuần tự.

Tiếp theo bắt buộc: kiểm tra fusion thực/quota và sacrifice sau suspended; API/cron benchmark<=50; kết thúc và rerun suite lỗi sau sửa; mapping ma trận18loài/xuyênsuốt với evidence; finalformat/typecheck/lint/build và hồ sơ nghiệm thu. Không complete khi còn phần trên. Giữ hai thư mục output không liên quan.

## Lưu checkpoint khởi đầu — nội dung bên dưới là lịch sử

## Trạng thái

- Goal bắt đầu 22/10/2026. **Đang triển khai, chưa nghiệm thu.**
- Đã đọc ba tài liệu v2 và kiểm tra workspace: thay đổi ban đầu chỉ gồm tài liệu v2, các banner/mục lục tài liệu và hai thư mục output không liên quan. Không sửa/xóa output.
- Mức tự thiêu mới nhất: 12 TV gốc, thực trừ 36 TV/ngày hiệu ứng có hiệu lực.
- Không có AGENTS.md được tìm thấy bằng `rg --files -g AGENTS.md`; chỉ dẫn người dùng trong phiên và ngoại lệ ủy quyền goal tiếp tục áp dụng.

## Phân công và phạm vi

- Root: tích hợp runtime D1, transaction/nguồn thưởng, ngày/cron, API, compatibility, quyết định và kiểm chứng chung.
- `v2_domain`: module domain/config v2 mới và unit test mới; không sửa v1/DB/UI.
- `v2_runtime_audit`: baseline, audit, migration mới và migration test mới.
- `v2_web`: các module UI linh thú và module trình bày v2, kiểm thử liên quan.
- Mỗi nhóm tệp một người ghi. Root kiểm tra lại kết quả tích hợp.

## Phát hiện ban đầu

1. `prepareBeastTaskEffect` v1 đếm ordinal qua receipt `$.ticket=1`; không thể dùng cho v2 nhân ba. Cần facts nguồn tách khỏi số vé nhận.
2. Sleep effect hiện được cấp lúc báo ngủ, undo chỉ đảo phần nền; v2 phải hoãn thưởng/counter phụ thuộc ngủ đến sau undo/ngày đóng.
3. Bảo trì combined v1 thiếu điều kiện ngày đóng; nhánh v2 sẽ chốt toàn bộ skill ngày khi đủ nguồn và ngày đã đóng.
4. Giữ luật/cấu hình v1 để giải quyết ngày trước cutover và pending quyền lợi; domain v2 nằm module riêng, không viết đè meaning counter cũ.

## Quyết định kỹ thuật đang triển khai

- Thêm trạng thái v2 riêng (runtime account, day facts/snapshot, attempt skill state, buff). Dùng version guard account v2 để đồng bộ với transaction ví hiện có.
- Bootstrap account cũ ở ngày sinh hoạt kế tiếp lần đầu quan sát v2; account mới bắt đầu ngay ngày khởi tạo. Không mint/backfill thưởng trong migration.
- Skill ngày v2 xử lý một lần sau ngày đóng từ snapshot habit/training và assessment ngủ gốc; không cấp riêng lúc báo ngủ.
- Tổng task v2 lưu bền vững trong day facts, không phụ thuộc lượng vé trong receipt.

## Việc tiếp theo

1. Chốt type/API reducer v2 và tạo migration cùng baseline.
2. Viết adapter context/prepare effect v2, nối task/ghép/đột phá/x10.
3. Nối quyết toán ngày/multiplier và thưởng nền, role/reset/sacrifice/tower/cron.
4. API/UI và compatibility v1.
5. Ma trận kiểm chứng, migration, browser/build/benchmark và review diff.

## Bằng chứng

- Chưa có test runtime v2 được tuyên bố đạt ở checkpoint này.
- Baseline/test log sẽ cập nhật từ lệnh thực chạy và các agent.
