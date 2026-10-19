# Đối chiếu goal Linh thú

Ngày 19/10/2026. Đối chiếu trực tiếp với `goal-objective.md` người dùng cung cấp, quyết định duyệt trong hội thoại và worktree hiện tại. Người dùng đã xác nhận **“Duyệt bản hiện tại và cho phép phát hành staging”**. Đã áp 0041, phát hành và kiểm tra staging; xem [hồ sơ phát hành](LINH_THU_RELEASE.md).

Hồ sơ gồm tích hợp đủ ảnh, kiểm thử toàn bộ, số đo tải web, ảnh giao diện, backup/restore rehearsal, migration và kiểm tra sau deploy. Các kết quả local và remote được tách theo phạm vi thực sự đã kiểm.

## 1. Quyền thực hiện và bảo toàn

- Người dùng đã duyệt kế hoạch và xác nhận “tôi duyệt hết, cứ làm đi”. Quyền tạo/sửa code, tests, assets trong goal đã có; không cần hỏi lại từng file.
- `git status --short` vẫn giữ các thay đổi tracked/untracked. Không commit, reset, clean hoặc xóa dữ liệu có sẵn. `git diff --name-only -- migrations` không có migration lịch sử bị sửa; migration mới là `0041_linh_thu.sql`.
- Các bài kiểm dùng SQLite/Miniflare tạm hoặc fixture. Benchmark web không gửi mutation. Sau xác nhận riêng, đã backup remote, diễn tập trên copy, áp 0041 và deploy staging; kiểm tra sau deploy chỉ đọc metadata và GET chưa đăng nhập, không ghi tài khoản thật hoặc gửi tin thử.
- Xác nhận bản hiện tại và phát hành đã nhận. Ảnh 95%/100% vẫn dùng tạm theo quyết định người dùng; không suy thành duyệt thị giác cuối từng ảnh.

## 2. Nguồn thiết kế và kế hoạch

[Đặc tả](LINH_THU_SPEC.md), [kỹ năng](LINH_THU_SKILLS.md), [mỹ thuật](LINH_THU_ART_DIRECTION.md), [tham chiếu](LINH_THU_REFERENCES.md), [UX và lịch sử demo](LINH_THU_DEMO_UX.md), [HTML đã duyệt](prototypes/linh-thu/index.html), [Habit](HABITS.md), [handoff](HANDOFF.md) và [AI tools](AI_TOOLS.md) đã được đối chiếu với runtime. Khảo sát, luồng, baseline, nhóm file và các luật bổ sung được lưu trong [hồ sơ triển khai](LINH_THU_IMPLEMENTATION.md). Quyết định mới nhất ưu tiên T1–T4; 95%/100% được phép dùng tạm.

## 3. Kiến trúc, dữ liệu và giao dịch

- Domain: catalog, training, skills, ultimates, account và tower trong `src/domain/linh-thu*.ts`. Application: services vai trò, settlement, triệu hồi, tháp và tuyệt kỹ. Port `src/ports/linh-thu-store.ts`; adapter D1 `src/adapters/d1/linh-thu-store.ts`; router `src/entrypoints/mini-app/linh-thu.ts`.
- Migration 0041 tách chín bảng `beast_*`, owner, cá thể, attempt, lịch vai trò, sự kiện, lượt tuần và lựa chọn. Attempt lưu version, capacity và thresholds. [Chính sách cân bằng](LINH_THU_OPERATIONS.md) giữ v1/lịch sử, không tuyên bố hỗ trợ cấu hình v2 chưa tồn tại.
- Đã đọc các guard API/transaction và đối chiếu các bài auth/origin/owner/day, concurrency, rollback, lost acknowledgement, receipt replay trong `tests/integration/linh-thu.test.ts`. Các bài đi qua store/API thật, kiểm số dư/cá thể/receipt và rollback; không chỉ kiểm screenshot.
- `tests/integration/upgrade-rehearsal.test.ts` đối chiếu hash/count mọi bảng cũ sau 0041, không khởi tạo ví/thú/quà mẫu, kiểm FK/integrity; có restore rehearsal và rollback migration hỏng.

## 4. Mỹ thuật và danh mục

- `src/domain/linh-thu-catalog.ts` đủ 2 UR, 4 SSR, 6 SR, 6 R; Rockwu T3/Rockong T4, Cinderclaw T4; không T5.
- Manifest nguồn và registry runtime có **72 thường  +18 thức tỉnh  +18 hoàn mỹ**. Gate `node scripts/build-linh-thu-assets.ts --require-complete` đạt. `tests/unit/linh-thu-art.test.ts` kiểm provenance, alpha, kích thước, ảnh trùng và đường dẫn; browser catalog giải mã 108 ảnh thật và thumbnail.
- `output/imagegen/catalog-v3/IMPORT_CHECKS.json` không có lỗi import; 72 tham chiếu giữ hash gốc. PNG 1024px alpha, WebP 512/128px, neo và khoảng trống được kiểm trong bảng ảnh từng rank, hai nền và UI.
- 95% khác nhẹ; vài bản 100% còn gần T4. Đây là giới hạn mỹ thuật đã ghi rõ và được phép dùng tạm, không tự ghi là duyệt từng ảnh. [Xem bộ ảnh](../output/imagegen/catalog-v3/index.html).

## 5. Luyện, lịch và độ thuần

`src/domain/linh-thu.ts`, `linh-thu-training.ts`, application settlement/roles và habit store dùng achieved/missed/neutral hiện có, lưu phần mười. Đã đối chiếu asserts trong unit công thức/ngày cuối và integration quota đổi 4→1, neutral, lịch thứ Hai UTC+7, quyết toán muộn theo ngày gốc, đổi/hủy vai trò và reset. Các mốc rank và clipping ngày cuối đúng bảng đã duyệt; chuyển thú khóa đúng điểm/xám sau quyết toán. Task/ngủ không cộng điểm luyện. Browser nhiều viewport kiểm xám neo phải, thanh thực từ trái, ngưỡng 95/100 và trạng thái khóa.

## 6. Mười tám bộ kỹ năng

`src/domain/linh-thu-skills.ts` và `linh-thu-ultimates.ts` đủ thiên phú, thức tỉnh và 18 loại tuyệt kỹ riêng; hook task, ngủ, habit, kết hợp, draw, fusion/breakthrough nằm trong adapters nền và Linh thú. Đã đọc các asserts domain và các ca integration theo nhóm:

| Nhóm | Loài | Bằng chứng tác dụng thực |
| --- | --- | --- |
| Task | Pyropup, Zappur, Flameow, Manteeny, Voltfawn | Hoàn thành task thật, giới hạn 5, mục tiêu khóa, combo, reward choice, rollback |
| Habit/ngủ/kết hợp | Rubblet, Frostnip, Punchimp, Shardsnail, Fluffle, Goonbug, Hootlet, Funglet | Quyết toán/hook ngủ thật, bảo hộ trước demotion, cùng ngày gốc, bộ đếm theo tuần/tích lũy, cứu tháp và reset |
| Quay/ghép/đột phá | Skinklet, Maskfry, Humbug, Gibber, Cheerling | Draw ×10 trả vé thật, lựa chọn lưu DB; fusion/breakthrough API, giới hạn 10, hoàn đúng tổn thất |

`tests/unit/linh-thu-skills.test.ts`, `linh-thu-ultimates.test.ts`, `tests/integration/linh-thu.test.ts` kiểm phần thưởng nguyên, ngày/tuần, không trả lại thưởng cũ, không xóa xám hoặc tăng điểm luyện. Tuyệt kỹ Pyropup chọn ba ứng viên kiểm riêng cùng bảo hiểm và phần còn lại của ×10. Không dùng việc có tên skill trong catalog để kết luận hook đã chạy.

## 7. Triệu hồi

Domain kiểm ranh giới R70/SR25/SSR4,5/UR0,5, SSR+ sau19 và UR sau79, ưu tiên UR, hai bộ đếm và tính tuần tự ×10. Integration kiểm đổi vé20:1, đủ chi phí, cá thể trùng, phân trang owner, Pyro lựa chọn và receipt nguyên tử. Browser kiểm thiếu vé/tài khoản trống, mất phản hồi/reload/hai clients, đúng ảnh T1, bỏ qua/reduced motion và màu rank theo CSS. `showBeastReveal` chỉ chạy sau kết quả server.

## 8. Tháp bốn tầng trong Habit

Domain/app/store tháp dùng 4→4→3→2, một bẫy, tổng quà dừng 2/3 vé thường hoặc1/2 vé triệu hồi. Đã đối chiếu tests từng tầng, trap/stop, cứu Rockong một lần tầng1–3, expiry/replay/race, chỉ một lượt/ngày và snapshot habit/task. Public state không trả vị trí bẫy. Browser có thao tác tháp thật và bài production API/D1 nhận quà; ảnh review thẻ đang chọn dùng fixture, ảnh nhận quà production flow được giữ riêng.

## 9. Tịnh Linh Đan

Unit/integration kiểm 30 ngày, neutral dừng, miss reset, 40%, bảo hiểm mẻ3, tiêu chuỗi mỗi mẻ, giữ sẵn ở30 và receipt craft. Reset tiêu1đan, tạo attempt T1/0/0, giữ lịch sử, cập nhật companion chờ, hủy hiệu ứng cũ và giữ khóa tuần. UI có nút góc, trạng thái sẵn sàng, furnace, skip/reduced motion và chọn đúng cá thể trước xác nhận; phản hồi muộn không chiếm lại bảng mới.

## 10. UX và hồi quy nền

Bốn tab, tím chủ đạo, đồng hành riêng, không lặp danh sách habit, tháp chỉ ở Habit. Browser kiểm360/390/768/1024/1440px, chữ gấp đôi, dark/light, bàn phím/Escape, reduced motion, mất mạng và phản hồi muộn. Đã xem ảnh render thực. `test:all` và browser suite còn phủ task/habit/lịch/nhắc/ngủ/check-in/quay/vật phẩm/đột phá/auth; không gửi Telegram thật hoặc dùng Google/AI ngoài mạng để chứng minh offline tests.

## 11. Kiểm chứng, tải và bàn giao

- 330 main +25 experiments +41 browser đạt, 0 fail/skip/cancel. Typecheck hai phía, syntax37, lint, format109 đạt. Local/staging build dry-run đạt; Web Worker607,70KiB/gzip136,37KiB, 505web files. Log và scope trong [hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md).
- Backend benchmark dùng API/services/stores thật trên SQLite local; giữ giới hạn truy vấn, payload và backlog cron. Web benchmark mới so **cùng runtime + API fixture**, registry tham chiếu với artv3, profile Chrome mới, 3mẫu mỗi biến thể, mạng local và100ms/256KiB/s. Có số đo thời gian, bytes, request ảnh và kho2.400cá thể. Đây không phải baseline của bản remote cũ hoặc độ trễ D1 remote.
- [Trang review giao diện](../output/linh-thu-review/index.html), [gallery108ảnh](../output/imagegen/catalog-v3/index.html), checklist, hướng dẫn chạy local và quy trình backup/restore/phát hành đã có. Ảnh chụp trong review có dữ liệu thử và provenance rõ; không phải mock UI vẽ lại.
- Phát hành staging 19/10 sau xác nhận riêng: backup mới, restore rehearsal giữ nguyên102 bảng cũ, thêm9 bảng; integrity/FK đạt. Áp0041 thành công, không còn migration chờ. Version `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559` nhận100% lưu lượng. Cả402 file web khớp SHA256; tám API chưa đăng nhập trả401; Chrome 390/1440px không lỗi JS/tràn ngang. [Bằng chứng](LINH_THU_RELEASE.md).

## Kết luận nghiệm thu

Các nhóm chức năng, assets và kiểm tra bắt buộc đã có bằng chứng; bản hiện tại đã được người dùng duyệt và phát hành staging theo xác nhận riêng. Không còn công việc bắt buộc được biết đến trong phạm vi đã chốt. Luồng ghi dữ liệu đã kiểm bằng API/D1 tạm, không chạy thử trên tài khoản thật. 95%/100% dùng tạm và sẽ chỉnh riêng nếu người dùng yêu cầu; tiếp tục xử lý lỗi trong phạm vi nếu phát hiện sau bàn giao.
