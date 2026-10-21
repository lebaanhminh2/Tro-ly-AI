# Kiểm chứng Linh thú

Cập nhật 21/10/2026. Hệ thống có 18 loài và 108 ảnh: 72 dạng T1–T4, 18 Thức tỉnh, 18 Hoàn mỹ. Đây là phạm vi kiểm tra tự động và giới hạn bằng chứng; duyệt dùng tạm ảnh không thay duyệt thị giác từng ảnh. [Đặc tả](LINH_THU_SPEC.md) · [Vận hành](LINH_THU_OPERATIONS.md) · [Mỹ thuật](LINH_THU_ART_APPROVALS.md).

## Kết quả đã chạy

Checkpoint sau tối ưu phân trang, dọn tệp cũ và tách module D1 ngày 21/10/2026:

| Kiểm tra                 | Kết quả và phạm vi                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Backend/unit/integration | 354 đạt, 0 fail/skip/cancel                                                                                            |
| Experiments              | 25 đạt, 0 fail/skip/cancel                                                                                             |
| Chrome browser toàn bộ   | 84 đạt, 0 fail/skip/cancel; chạy tuần tự                                                                               |
| Artwork trong UI         | Giải mã đúng 54 thumbnail/biến thể và đủ 108 ảnh full; atlas chỉ đọc một trang toàn kho, mỗi loài đọc trang riêng      |
| Code                     | Typecheck backend/frontend, lint, syntax 43 web modules, format baseline 111 tệp và diff whitespace đạt                |
| Build                    | Local và staging dry-run đạt; không deploy                                                                             |
| Hiệu năng                | Benchmark D1 và ba mẫu cho mỗi registry ảnh trên localhost/mạng 100 ms, 256 KiB/s đạt; cách đo và trước/sau ở vận hành |

Log local được Git bỏ qua: `.wrangler/goal-audit-20261021/batch3-main-tests.log`, `batch3-browser-tests.log`; bản tổng hợp `batch3-results.json` trong cùng thư mục. Số đo trước/sau phân trang giữ ở `batch1-results.json`; không chạy lại benchmark web để quy thay đổi thời gian cho việc tách module backend. Log PowerShell có thể là UTF-16LE; dùng `Get-Content` để đọc.

Lần browser trước khi cập nhật bài artwork đạt 83/84 vì fixture cũ yêu cầu vét ba trang và không hỗ trợ overview/lọc loài. Sau phê duyệt bổ sung, bài kiểm dùng fixture chung, giữ toàn bộ 108 assert ảnh và suite đầy đủ đạt 84/84. Hai ca từng dao động trong baseline cũng đạt ở lần chạy tuần tự này; kết quả đó không chứng minh đã sửa nguyên nhân dao động.

Sau đợt dọn được duyệt: cả bảy bài trong `tests/integration/telegram.test.ts` đạt, giữ nguyên mọi assertion giao dịch; typecheck hai phía, lint, syntax, format baseline và diff whitespace đạt. Asset verifier vẫn đủ 72 tham chiếu +108 ảnh v3; 552 tệp tài nguyên được bảo vệ và 1.789 tệp chưa theo dõi giữ nguyên hash. Đợt 3 sửa liên kết `MODEL_VERDICT.md` đã hỏng từ trước; kiểm lại toàn bộ liên kết Markdown local không còn đích thiếu hoặc chỉ có trong file chưa theo dõi.

Build local/staging dry-run sau dọn đều đạt: Worker 620,01 KiB / gzip 139,34 KiB, 512 tệp assets. Không deploy. Kết quả riêng trong `.wrangler/goal-audit-20261021/batch2-results.json`; không cộng bảy bài chạy riêng vào tổng suite ở checkpoint trên.

Sau tách D1: toàn bộ 354 backend, 25 experiments và 84 browser tuần tự đều đạt, không fail/skip/cancel. Đồ thị import thực thi từ Worker có 84 module, không có vòng hoặc import không resolve; trước đó một cụm vòng gồm tám module trong 82 module reachable. Phân tích tính cả hai module mới, export-from và dynamic import chuỗi literal; không gặp dynamic import chưa xác định trong `src`.

Đối chiếu AST trước/sau xác nhận 16 phương thức đọc, bốn phương thức ghi/điều phối và ánh xạ hàng giữ nguyên nội dung; hai hàm bảo trì chỉ chuyển nơi khai báo. Các hàm chuẩn bị hiệu ứng chỉ đổi Store sang Reader, tiếp tục trả statement cho giao dịch có guard. Giữ đủ 247 assertion tích hợp cũ và thêm bốn assertion cho reader chỉ đọc; không bỏ hoặc nới kỳ vọng. Cả 33 ca benchmark D1 giữ nguyên số truy vấn và byte trả về so với đợt 1: API chính 22, các ca backlog tối đa 40, gate 50. Bộ đọc thuần không thực thi batch trong ca kiểm riêng.

Build sau tách đạt 620,20 KiB / gzip 139,56 KiB, vẫn 512 assets; đây không phải đợt giảm bundle. Không deploy hoặc đổi schema. Bằng chứng cấu trúc, đối chiếu và bảo toàn ở `batch3-import-actual.json`, `batch3-extraction-check.json`, `batch3-benchmark-comparison.json`, `batch3-integrity.json` trong thư mục audit. Các kết quả local này không xác minh latency D1 remote hoặc nghiệm thu trên thiết bị thật.

Đối chiếu cuối đợt 3: mọi tệp tracked ngoài 14 tệp được duyệt giữ hash. Trong 1.789 tệp untracked có sẵn, 1.771 giữ hash; suite browser đã tạo lại 18 ảnh/báo cáo QA tại `output/linh-thu-reveal-integration/` và `output/tower-implementation-20261020/screenshots/`. Không được báo toàn bộ output giữ nguyên. Snapshot chỉ có hash, tìm bản trùng trong output và `.wrangler` không thấy nên chưa khôi phục được nội dung 18 bản QA trước lần chạy. Đây là lý do cần chuyển nơi ghi bằng chứng kiểm thử sang thư mục kết quả riêng cho từng lần chạy.

## Chạy local và kiểm lại

1. Dùng Node 24 trở lên và dependency từ lockfile. Trên PowerShell gọi `npm.cmd`/`npx.cmd`.
2. Dùng DB local/tạm, áp **toàn bộ** migrations theo thứ tự (mã nguồn hiện đến 0042). Các integration tests dựng Miniflare riêng; không trỏ vào DB hoặc bản sao có dữ liệu riêng tư.
3. `npm.cmd run dev` mở ứng dụng thật; đăng nhập theo luồng Telegram/trình duyệt hiện có. Tài khoản mới bắt đầu trống, không có nút cấp thú/vé thử.
4. Dữ liệu điều khiển thuộc `tests/browser/linh-thu-fixture.mjs`; prototype HTML và playground cũ đã được gỡ.
5. Chạy `npm.cmd run test:all`, `node --test --test-concurrency=1 tests/browser/*.test.mjs`, các scripts typecheck/check/lint/format và dry-run được liệt kê trong vận hành.
6. `node scripts/build-linh-thu-assets.ts --require-complete` xác minh nguồn/hash/registry mà không ghi. Thêm `--write` mới dựng lại tài nguyên, cần đúng phạm vi thay đổi đã duyệt.

## Phủ hành vi

| Luồng                   | Bằng chứng và điều kiện cần giữ                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Luyện và quota habit    | Domain/tích hợp: điểm thực/xám theo ngày; neutral không phạt; quota 4→1 giữ ID, hiệu lực thứ Hai sau; clipping ngày cuối giữ tối thiểu 0,1 xám khi còn thiếu |
| Vai trò và quyết toán   | Chọn/hủy/đổi muộn; ngày cũ tính con cũ rồi khóa đúng tiến độ; đồng hành độc lập luyện; thưởng gắn đúng cá thể/ngày gốc                                       |
| Hiển thị lựa chọn chờ   | Browser: cá thể mới hiện sau server xác nhận, nhãn ngày mai; vẫn truy cập con hôm nay; refresh/qua ngày, lỗi và sheet mới không bị phản hồi cũ chiếm         |
| Tiến hóa và khám phá    | Domain/integration/browser: đủ điểm thực mới tăng từng T; dạng hiện tại tách lịch sử; reset giữ khám phá; không tải/lộ dạng tương lai                        |
| Năng lực theo T         | Browser đủ 18 lộ trình, nêu đơn vị đếm và mức tăng từng T; luyện đầy T4 tách 95%/100%; tiến độ lưu và rollover Hootlet                                       |
| Hiệu ứng tiến hóa       | Browser đủ 18 loài, nhịp T2/T3/T4, commit trước cảnh, skip/replay/Escape, kết thúc tự động, giảm chuyển động, ẩn trang và lỗi ảnh/canvas                     |
| Kỹ năng task            | Pyropup, Zappur, Flameow, Manteeny, Voltfawn: hook hoàn thành hợp lệ, hạn mức, mục tiêu, combo, lựa chọn thưởng và rollback                                  |
| Habit/ngủ/kết hợp       | Rubblet, Frostnip, Punchimp, Shardsnail, Fluffle, Goonbug, Hootlet, Funglet: hook thật, cùng ngày gốc, bảo hộ trước phạt, tiến độ tuần/tích lũy và reset     |
| Quay/ghép/đột phá       | Skinklet, Maskfry, Humbug, Gibber, Cheerling: hook API/D1 thật, giới hạn 10 lượt, lựa chọn và hoàn đúng tổn thất                                             |
| Tuyệt kỹ                | 18 loại ở domain/integration; một lần/tài khoản/tuần, mục tiêu/giao ước khóa trước, hạn và budget tuần gốc; reset không trả khóa tuần                        |
| Triệu hồi               | Tỷ lệ/bảo hiểm và UR ưu tiên, đổi 20:1, ×10 nguyên tử, cá thể trùng, Pyro ba ứng viên lưu server và cập nhật bảo hiểm đúng con nhận                          |
| Reset và đan            | Chuỗi 30 ngày, neutral dừng/miss đứt, 40% và bảo hiểm mẻ ba; tiêu một đan, T1 mới, giữ lịch sử, hủy hiệu ứng và companion chờ đúng lượt                      |
| Tháp                    | 4→4→3→2, snapshot habit +task, race/replay/qua ngày, dừng/claim tổng quà, bảo hộ một lần tầng 1–3, không cứu tầng bốn; API không lộ bẫy                      |
| Phục hồi mutation       | Browser/API/D1: mất phản hồi sau commit rồi reload đọc receipt, không POST lại hoặc tiêu vé lần hai; nút phục hồi khóa khi request còn chạy                  |
| Phản hồi đọc đến muộn   | Collection, picker task 405 mục, lựa chọn quay và tháp không mở lại sheet đã đóng hoặc thay sheet mới; chọn task giữ ID qua phân trang                       |
| Luyện đan đến muộn      | Cập nhật kho và thông báo kết quả mà không chiếm sheet mới                                                                                                   |
| Hai cửa sổ              | API fixture có version guard kiểm UI không tiêu/hiện kết quả lần hai; atomicity/rollback D1 được kiểm riêng                                                  |
| Bộ sưu tập lớn          | 2.400 cá thể/18 loài: overview theo lượt hiện tại, owner isolation, form/purity/tie, cursor trùng thời điểm, trang loài và picker toàn kho độc lập           |
| Ảnh                     | Manifest đủ 108 nguồn và 216 đầu ra full/thumbnail, 72 nguồn tham chiếu giữ hash; browser chọn đúng thường/95%/100%, không mutation khi xem                  |
| Cron/backlog            | Benchmark bốn job, 30 habit; giới hạn truy vấn, mỗi invocation tối đa một ngày ngủ, gửi trả lời nhưng hoãn thông báo chủ động khi chưa chốt vắng mặt         |
| Nâng cấp và hồi quy nền | Migration giữ bảng/dữ liệu nền, restore rehearsal, task/habit/lịch/nhắc/ngủ/check-in/quay/vật phẩm/đột phá/auth và guards giao dịch                          |

Các bảng này mô tả điều đã được assert, không suy từ việc chỉ có tên kỹ năng trong catalog. Bộ luật domain nằm trong `tests/unit/linh-thu*.test.ts`; giao dịch/hook trong `tests/integration/linh-thu*.test.ts`; UI trong `tests/browser/linh-thu*.test.mjs`.

## Luồng UI → API sản phẩm → D1 tạm

Chạy `node --test tests/browser/linh-thu-live.test.mjs`. Bài dùng Chrome, router sản phẩm, credential giả lập, services/stores thật và Miniflare áp toàn bộ migrations. Phần handshake đăng nhập do harness cung cấp; không kiểm đăng nhập Telegram ngoài mạng.

Luồng: tài khoản trống → đổi vé → triệu hồi → mất phản hồi sau commit/reload/receipt → chọn luyện qua ngày → log habit → tháp/nhận quà → chuyển luyện/khóa lượt cũ → đan/reset giữ lịch sử → đồng hành hoàn mỹ/tuyệt kỹ/báo ngủ. Test đối chiếu ví, lượt luyện, quà và receipts sau các bước.

Fixture cấp 40 vé ban đầu, tạo/hoàn tất task bằng store thật, đưa đan tới 30 ngày/hai fail và một Frostnip tới 100%. Test đọc bẫy trực tiếp từ DB để đi hết tháp; API không trả bẫy cho client. Đây không phải quyền cấp quà trong sản phẩm hoặc thay kiểm tra 30 ngày/18 kỹ năng ở domain/integration.

Đặt `LINH_THU_CAPTURE=1` khi cần ghi ảnh và `live-flow-proof.json` trong `trial-results/linh-thu/`. Tệp có dữ liệu thử, request/receipt và ID trước/sau reset, không có dữ liệu tài khoản thật.

## Giao diện, ảnh và giới hạn đo

Đã kiểm Chromium ở các viewport 320–1440px, sáng/tối, chữ lớn, bàn phím/Escape, focus, giảm chuyển động, offline/khôi phục và phản hồi muộn. Safe area/visibility dùng mô phỏng; chưa thay nghiệm thu iPhone/Telegram thật. Ảnh chụp tại [trang review lịch sử](../output/linh-thu-review/index.html) phản ánh ngày chụp, không phải mọi chỉnh sửa UI sau đó.

[Gallery 108 ảnh](../output/imagegen/catalog-v3/index.html), [quyết định mỹ thuật](LINH_THU_ART_APPROVALS.md) và [hướng dẫn nguồn](assets/linh-thu/art/README.md) xác định bộ hiện hành. Full WebP 512px tổng 3.871.966 byte, thumbnail 128px tổng 651.000 byte. Kiểm hash/alpha không thay xem trực tiếp hình thể, độ rõ, điểm neo hoặc duyệt thị giác.

Benchmark web so cùng runtime/API fixture với registry tham chiếu và registry v3, profile Chrome mới; đo ảnh/module thật, atlas/trang loài/tải tiếp. Backend benchmark dùng service/store thật trên SQLite local. Báo cáo ở `trial-results/linh-thu/performance.json`, `web-performance.json`, `web-performance-throttled.json`; dữ liệu trước/sau và giới hạn truy vấn được giữ trong vận hành. Không suy chênh lệch thời gian local thành cải thiện latency D1 remote, CDN/cache, CPU Worker hoặc thiết bị người dùng.

## Phát hành lịch sử

[Hồ sơ phát hành 19/10](LINH_THU_RELEASE.md) và [VERIFICATION.json của catalog](../output/imagegen/catalog-v3/VERIFICATION.json) giữ các số liệu đúng tại thời điểm đó (330 main, 25 experiments, 41 browser; migration 0041). Chúng không được ghi đè bằng kết quả suite mới. Trạng thái mã nguồn và ghi nhận phát hành mới hơn nằm trong [HANDOFF](HANDOFF.md).

Các lần kiểm staging trước chỉ đối chiếu GET/auth/hash và màn đăng nhập; không ghi tài khoản thật hoặc gửi tin Telegram để QA. Các thay đổi local trong goal rà soát chưa được deploy. Phát hành/migration remote cần xác nhận riêng và quy trình backup/restore; không dùng lịch sử phê duyệt để cấp quyền cho lần sau.
