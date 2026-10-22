# Linh thú v2 — nghiệm thu và vận hành local

Cập nhật 22/10/2026. Đây là bản nâng cấp local; chưa deploy hoặc chạy migration remote. [Luật18 loài](LINH_THU_V2_SPEC.md), [bằng chứng và ma trận](LINH_THU_V2_VERIFICATION.md).

## Kiểm tra nhanh

Node24+, `npm ci` nếu chưa có dependency. Trên PowerShell dùng `npm.cmd`/`npx.cmd` để không phụ thuộc execution policy của script `.ps1`.

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:web
npm.cmd run check:web
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run test:browser
npm.cmd run build:check
node scripts/benchmark-linh-thu.ts
node scripts/benchmark-linh-thu-v2.ts
```

Browser cần Chrome/Chromium. Tests sử dụng ví/DB tạm và fixture riêng, không cần cấp vé vào tài khoản thật. Các file mới ngoài baseline của `scripts/format.mjs` cũng đã được kiểm Prettier riêng. Log trong `.wrangler/linh-thu-v2-audit/` là local, không commit bí mật hoặc dump tài khoản thật.

## Chạy ứng dụng trên DB local riêng

Từ workspace `D:\Tro-ly-AI`:

```powershell
npx.cmd wrangler d1 migrations apply assistant-local --local --persist-to .wrangler/linh-thu-v2-preview
npx.cmd wrangler dev --local --persist-to .wrangler/linh-thu-v2-preview
```

Cấu hình thông tin local theo [OPERATIONS.md](OPERATIONS.md), dùng tài khoản thử. Không thay database_id bằng DB thật để thử nghiệm. Bộ ảnh và logic chạy trong source hiện tại; không cần dựng lại ảnh.

Luồng nghiệm thu: cấu hình ngày sinh hoạt → mở Linh thú → chọn đồng hành → xem “Toàn bộ năng lực” có T1–T4/95%/100%, mô tả và tiến trình → hoàn thành task/habit → xem số dư server. Skill tự động; ghép phù/quay/đột phá/tháp vẫn cần thao tác của người dùng. Không có nút activation tuần ở tài khoản v2. Các lựa chọn v1 đã trả phí vẫn có thể hoàn tất.

Thưởng skill phụ thuộc ngủ/ngày chỉ chốt sau khi ngày sinh hoạt đã đóng, hết thời hạn undo và đủ assessment habit/ngủ/task. Dòng chờ chốt không có nghĩa mất thưởng. Cron tự tiến công việc; GET chỉ hỗ trợ bảo trì theo cùng receipt. Mỗi lượt bảo trì có giới hạn để không vượt50 queries; backlog lớn cần nhiều lượt, không có vòng lặp quét toàn lịch sử trong một request.

## Schema và cutover

- Áp dụng các migration chưa có theo thứ tự đến `0045_linh_thu_v2.sql`, gồm0043/0044 nếu DB còn ở0042. Không chạy lại file đã có trong `d1_migrations`.
- 0045 thêm4 bảng v2 và cột snapshot task/trigger; giữ nguyên ví, cá thể, attempt, điểm luyện/xám, độ thuần, receipts và pending choices v1. Không có backfill thưởng.
- Account Linh thú mới: v2 từ ngày khởi tạo, kể cả lần đầu là mutation chưa từng GET collection. Account cũ: lần quan sát v2 đầu tiên ghi cutover vào ngày sinh hoạt kế tiếp; ngày hiện tại và backlog trước cutover vẫn v1.
- `rule_version` luyện không đổi. Phiên bản skill runtime v2 được quản lý ở `beast_v2_runtime`, event `skill_version=2`, không giải nghĩa lại `counters_json` v1.
- `beast_v2_days` lưu multiplier/identity gốc, task facts, quota tức thời và dấu settled. `beast_v2_states` theo attempt; `beast_v2_buffs` giữ provenance và ngày hiệu lực. `task_completions.beast_source_json` chụp form/attempt theo timestamp completion canonical.
- Thưởng qua ví và VTH/counter/buff/day receipt commit cùng transaction. Khi conflict, đọc lại state/receipt; không tự đổi request ID để quay lại kết quả đã thanh toán.

## Nếu phát hành sau nghiệm thu

Đây là hướng dẫn, chưa thực hiện các bước remote:

1. Sao lưu DB hoặc bookmark khôi phục và lưu đúng revision code/schema trước nâng cấp. Kiểm tra danh sách migration thực tế, retention backup và môi trường đích.
2. Dừng writer/cron hoặc đặt cửa sổ bảo trì có kiểm soát. Migration0045 tạo trigger và cột mới nên cần tránh writer mới chạy với schema cũ.
3. Áp dụng migration còn thiếu theo thứ tự, kiểm FK/schema/receipts/ví mẫu. Sau đó đưa runtime mới lên, khởi động lại writer/cron và kiểm cutover từng owner.
4. Smoke test nguồn mới, v1 pending choice, retry cùng ID, chốt ngày và task recovery. Đối chiếu số dư và journal, không xóa receipt/counter để chữa lệch.
5. Nếu cần phục hồi: khóa writer trước. Khi chưa có ghi v2, có thể quay code cũ trong cửa sổ bảo trì với schema bổ sung còn nguyên. Khi đã có ghi v2, quay code cũ đơn thuần có thể cấp lại thưởng v1: ưu tiên sửa tiến hoặc khôi phục đồng bộ snapshot DB và revision tương ứng, xử lý các thao tác phát sinh sau snapshot bằng đối soát. Không DROP bảng/cột hoặc reset ví để giả rollback thành công.

## Giới hạn phép đo

Benchmark dùng SQLite local và browser localhost. Gate 50 queries và payload<40.000 byte cho Linh thú GET được giữ nguyên; không đại diện latency mạng hay CPU production. Benchmark web cũ dùng fixture v1 để giữ baseline ảnh/UI; browser v2 riêng kiểm roadmap/progress/cultivation và runtime D1 riêng kiểm luật thật. Chưa có chứng nhận production hoặc dữ liệu người dùng thật.
