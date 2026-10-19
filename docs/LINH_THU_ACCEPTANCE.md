# Hồ sơ kiểm tra Linh thú

Cập nhật 19/10/2026. Đã tích hợp đầy đủ hệ thống và **108 ảnh của 18 loài: 72 dạng T1–T4, 18 Thức tỉnh 95%, 18 Hoàn mỹ 100%**. Người dùng đã duyệt bản hiện tại và cho phép phát hành staging; migration 0041 và deploy đã hoàn tất, kiểm tra sau phát hành đạt. [Hồ sơ phát hành](LINH_THU_RELEASE.md). Ảnh 95%/100% tiếp tục dùng tạm và chỉnh riêng sau; Stormlion là chuẩn nét đã duyệt.

Checkpoint mới nhất: `npm.cmd run test:all` đạt **330 main/unit/integration +25 experiments**, 0 fail/skip/cancel, exit 0. Typecheck backend/frontend, syntax **37 web modules**, lint, format **109 files**, build local/staging dry-run và asset verify đều đạt. Worker **607,70 KiB / gzip 136,37 KiB**, **505 web files**. Cổng `--require-complete` đạt **72/72 thường  +18/18 thức tỉnh  +18/18 hoàn mỹ**. Kết quả browser cuối được ghi ở mục kiểm chứng bên dưới.

Log lần xác nhận đầy đủ: `trial-results/linh-thu/test-all-art-v3.log` (UTF-16LE, Git bỏ qua); main khoảng 312 giây, experiments khoảng 1 giây. Không cộng thêm test vào kết quả suite cũ. Xem [chi tiết và giới hạn](LINH_THU_IMPLEMENTATION.md), [trang xem 108 ảnh](../output/imagegen/catalog-v3/index.html) và [hồ sơ kiểm chứng](../output/imagegen/catalog-v3/VERIFICATION.json).

[Xem giao diện các luồng chính](../output/linh-thu-review/index.html) · [Đối chiếu từng mục goal](LINH_THU_GOAL_AUDIT.md). Trang review có ảnh chụp UI thật, dữ liệu fixture, liên kết gallery và hướng dẫn thử; không phải ứng dụng tương tác hoặc quyền cấp quà.

## Kết quả kiểm chứng cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Backend/unit/integration | 330 đạt, 0 fail/skip/cancel |
| Experiments | 25 đạt, 0 fail/skip/cancel |
| Chrome browser | 41 đạt, 0 fail/skip/cancel; log `trial-results/linh-thu/browser-art-v3.log` |
| Catalog trong UI | Phân trang 24 → 48 → 54 cá thể fixture; giải mã thumbnail thật và mở đủ 108 ảnh full đúng loài/dạng/độ thuần |
| Kiểm ảnh | 108 nguồn không lỗi import; 72 ảnh tham chiếu giữ nguyên; cổng 72 +18 +18 đạt |
| Code | Typecheck backend/frontend, lint, syntax 37 modules, format 109 files đạt |
| Build local/staging | Cả hai dry-run đạt, không phát hành; 607,70 KiB / gzip 136,37 KiB; 505 web files |

Lần browser đầu đạt 40/41 vì bài task tuyệt kỹ đợi dialog đóng thay vì đợi mutation hoàn tất. Dialog xác nhận đóng trước khi gửi xong; đã sửa bài kiểm để đợi thông báo thành công. Suite đầy đủ chạy lại đạt 41/41; không thay hành vi sản phẩm để né lỗi kiểm thử. Ảnh chụp bộ mới ở `trial-results/linh-thu/art-v3/`, gallery mobile ở `art-gallery-390-dark.png`/`art-gallery-390-light.png`, các luồng API/D1 ở `live-summon-390.png`, `live-tower-390.png`, `live-ultimate-390.png`.

## Chạy và kiểm tra

1. Dùng DB local/tạm, áp migrations theo thứ tự đến 0041. Không dùng bản sao chứa dữ liệu riêng tư để tạo ảnh review.
2. Chạy `npm.cmd run dev`, mở địa chỉ Wrangler hiển thị. Tài khoản thật phải đăng nhập theo luồng Telegram/trình duyệt hiện có.
3. Tài khoản chưa có linh thú bắt đầu trống; không có nút cấp thú/vé thử trong sản phẩm. Bộ fixture trình duyệt ở `tests/browser/linh-thu-fixture.mjs` chỉ chạy trong harness kiểm thử.
4. Xem demo độc lập đã duyệt ở `docs/prototypes/linh-thu/index.html`; số dư và dữ liệu mẫu ở đó không phải dữ liệu runtime.

## Checklist nghiệm thu bằng hành vi

| Luồng | Điều cần thấy | Bằng chứng tự động hiện có |
| --- | --- | --- |
| Điều hướng | Linh thú có đúng bốn tab, Lò đan là nút; tháp nằm trong Habit | Browser nhiều viewport, không lặp danh sách habit |
| Luyện | 4 habit đạt 3: +1,2 thực, +0,4 xám; xám từ phải; nghỉ +0/+0 | Unit công thức/ngày cuối, integration quyết toán |
| Thuần | Chưa đầy chỉ tạm tính; đầy ≥95% mở Thức tỉnh, chính xác 100% mở tuyệt kỹ | Unit ngưỡng và rounding, UI dùng số gốc |
| Ảnh theo độ thuần | T4 hoàn tất đủ điều kiện dùng đúng ảnh 95%/100%; T1–T3 và triệu hồi T1 dùng thường | 7 unit art; browser chọn ảnh qua các màn; bài catalog tải/giải mã 108 ảnh runtime thật qua bộ sưu tập phân trang và chi tiết |
| Chuyển thú | Có hiệu lực ngày kế tiếp, ngày cũ vẫn tính con cũ rồi khóa đúng tiến độ | Integration chọn/hủy/đổi muộn, không làm mất xám |
| Đồng hành | Độc lập luyện; thưởng thuộc cá thể của ngày gốc | Integration task/ngủ/habit/kết hợp, vai trò theo ngày |
| Tuyệt kỹ | Một lần/tài khoản/tuần; mục tiêu và giao ước khóa trước; có tiến độ và hạn | Domain 18 bộ, integration các hook thực, browser tiến độ |
| Reset | Tiêu đúng một đan; lượt T1 mới; giữ lịch sử; hủy hiệu ứng và không trả hạn mức tuần | Integration reset, companion chờ và quyền cứu bẫy |
| Triệu hồi | 20 vé đổi 1; ×10 nguyên tử, cá thể trùng riêng, SSR/UR đúng bảo hiểm | Unit ranh giới, integration cạnh tranh/rollback/replay |
| Pyrodaemon | Trả vé trước, giữ ba ứng viên; chọn một mới cập nhật bảo hiểm | Integration ×10 và lựa chọn lưu trên DB |
| Quay thường | Hychroma 3 chọn 2, Cheerstella 2 chọn 1; chỉ nhận ô đã chọn | Integration giới hạn 10 lượt/ngày, không trừ lại vé |
| Tháp | 4→4→3→2; dừng nhận tổng 2/3 vé thường hoặc 1/2 vé triệu hồi | Integration từng tầng/dừng/bẫy/race/qua ngày; browser luồng nhận |
| Điều kiện tháp | Habit và task phân biệt; snapshot một lần, sửa log không thu hồi lượt/quà | Integration snapshot, task hoàn chỉnh, log undo |
| Lò đan | 30 ngày đủ, neutral dừng, miss reset; 40%, mẻ thứ ba bảo hiểm sau hai fail | Domain và integration receipt crafting/reset |
| Mất phản hồi | Reload vẫn giữ request; kiểm tra receipt trước thao tác tiếp | Browser triệu hồi lỗi phản hồi sau commit và reload; DB lost ack |
| Phản hồi muộn | Đóng bảng hoặc mở bảng khác không bị tải cũ chiếm lại; đan vẫn vào kho | Browser chặn tải collection/task/quay thường/tháp và phản hồi luyện đan |
| Tài khoản trống/thiếu vé | Không cấp dữ liệu mẫu; triệu hồi khóa, đổi vé chỉ nhận số nguyên trong số dư | Browser bộ sưu tập trống, 19 vé không đổi được, số lẻ/vượt số dư bị chặn |
| Nhiều cửa sổ | Version cũ bị từ chối, số dư tải lại, không hiện kết quả hoặc tiêu vé lần hai | Hai Chrome clients với API fixture có version guard; atomicity D1 kiểm riêng |
| Quota thay đổi | 4→1 giữ ID, có hiệu lực từ thứ Hai sau; không viết lại tạp chất tuần cũ | Integration D1 hai tuần với log, sửa quota và quyết toán luyện/đan thật |
| Nâng cấp | Không thay dữ liệu nền, không cấp thưởng/thú mẫu | Fixture nâng cấp 0041 so hash mọi bảng cũ; restore rehearsal |
| Cá thể trùng loài | Thấy mã ngắn, độ thuần, điểm thực/xám, vai trò và trạng thái khóa trước khi chọn/reset | Browser ba cá thể cùng loài, 100%/95%/đã khóa; chữ gấp đôi ở 360px |
| Xuyên suốt API/D1 | Giao diện dùng production API và D1 tạm; ví/lượt luyện/quà/receipt khớp sau từng bước | `tests/browser/linh-thu-live.test.mjs`, gồm cả tuyệt kỹ và báo ngủ qua UI |
| Cron có backlog ngủ | Chốt từng ngày, giữ thông báo chủ động chờ xác định vắng mặt; vẫn gửi trả lời và xử lý tiếp luyện | Benchmark 30 habit/bốn job, hồi quy nhiều lượt cron và hai tin đã xếp hàng |

Đánh dấu ở bảng là **phạm vi kiểm tra tự động**, không thay thế duyệt của người dùng hoặc kiểm tra sản phẩm trên dữ liệu thật.

## Luồng chạy production API và D1 tạm

Chạy `node --test tests/browser/linh-thu-live.test.mjs`. Bài này dùng Chrome thật, router `miniAppApi`, xác minh chữ ký credential giả lập, services/stores sản phẩm và D1 Miniflare áp đủ migrations. Phần ghép đôi đăng nhập vẫn là handshake của harness; đây không phải phép kiểm đăng nhập Telegram ngoài mạng. Không gửi tin hoặc dùng dữ liệu thật.

Luồng kiểm: tài khoản trống → đổi 40 vé thường thành 2 vé triệu hồi → triệu hồi hai cá thể → mất phản hồi sau commit, reload và đọc receipt, không POST lại → chọn luyện hiệu lực ngày sau → log habit qua UI → qua ba tầng tháp và nhận đúng 1 vé triệu hồi → đổi luyện rồi khóa con cũ đúng 1 điểm → luyện đan bảo hiểm → reset giữ lượt cũ trong lịch sử → chọn đồng hành hoàn mỹ qua ngày → kích hoạt tuyệt kỹ Frostluna → báo ngủ trên UI tiêu đúng một lượt và nhận đúng thưởng.

Giới hạn fixture được khai báo trong bài: ví 40 vé ban đầu, task hoàn chỉnh được tạo/hoàn tất bằng task store thật, lò đan được đưa tới 30 ngày/hai lần thất bại, một Frostnip được đưa tới hoàn tất 100%. Test đọc lá an toàn từ DB để đi hết tháp; vị trí bẫy không đi qua API cho client. Các fixture này không phải quyền cấp quà trong sản phẩm, không thay bằng chứng domain/integration cho 30 ngày tích đan hoặc 18 bộ kỹ năng.

Muốn ghi ảnh và bằng chứng DB, đặt biến môi trường `LINH_THU_CAPTURE=1` trước cùng lệnh. Đã chạy chế độ này và xem trực tiếp `trial-results/linh-thu/live-summon-390.png`, `live-tower-390.png`, `live-ultimate-390.png`. `live-flow-proof.json` lưu loại fixture, danh sách request/receipt đã đối chiếu, hai POST triệu hồi kể cả lúc phục hồi, ID lượt trước/sau reset và tuyệt kỹ còn hai lượt sau báo ngủ. Các file review này nằm trong thư mục được Git bỏ qua.

## Bằng chứng giao diện và hiệu năng

- 360/390/768/1024/1440px: bốn tab, touch target, ảnh tải được, thanh xám neo phải, không tràn ngang.
- Chữ gấp đôi: nhãn từng tab ở trong đúng nút; tên/nhãn nhân vật không chồng ảnh. Sáng/tối được kiểm qua `data-theme` của ứng dụng.
- Bàn phím, Escape, reduced motion và luồng tháp được kiểm trong Chrome thật.
- Phân trang task tuyệt kỹ kiểm 405 task, giữ mục tiêu đã chọn khi tải thêm và gửi đúng ID từ hai trang. Đóng trong lúc tải không mở lại bảng; mở Lò đan trong lúc tải collection không bị bảng cũ thay thế.
- Đã xem `duplicate-picker-large-dark-360.png` và `duplicate-collection-dark-360.png` trong cùng thư mục review: các cá thể cùng loài vẫn phân biệt được, nội dung không che ảnh hoặc tràn khi chữ gấp đôi. Lượt khóa không còn được ghi là độ thuần tạm tính.
- Ảnh đã xem trực tiếp ở `trial-results/linh-thu/training-current-390.png`, `training-large-dark-390.png`, `companion-current-390.png`, `companion-current-1440.png`; thư mục này được Git bỏ qua.
- `node scripts/benchmark-linh-thu.ts`: 24 và 2.400 cá thể; GET chính 21 truy vấn/~9,7 KB; collection 24 con 1 truy vấn/~4,5 KB; tháp 10 truy vấn/~720 B. Có backlog và đồng hành: bước chốt ngày 39, bước kết hợp 37, sau đó 19 truy vấn; giữ dưới mức 50. Bốn slot cron yên tải 11–13 truy vấn. Với 30 habit và công việc thật: chốt tháp 25, luyện 40, kết hợp 28, hết hạn 23. Khi có chốt ngủ, hoãn bảo trì rồi xử lý tiếp: 24/32/40, không mất tiến độ. Benchmark và hồi quy gửi tin/chốt ngủ nằm trong `tests/integration/linh-thu-cron.test.ts`, tự chạy với suite chính. Thông báo chủ động được giữ chờ đánh giá xong vắng mặt; hồi quy cũ đã chuyển sang kiểm nhiều lượt cron với điều kiện không gửi sai ở mọi lượt. Đây là đo Node/SQLite local, **không phải latency D1 remote, CPU Worker hoặc kiểm tải cực đại của mọi cron job**.
- `node scripts/build-linh-thu-assets.ts --require-complete` đạt: 72 thường, 18 thức tỉnh, 18 hoàn mỹ. Kiểm nguồn/đầu ra, kích thước, alpha, hash, registry và provenance. Thêm `--write` khi chủ động dựng lại bản web từ nguồn. CI có cùng cổng kiểm đủ ảnh.
- Log hiện hành: `trial-results/linh-thu/test-all-art-v3.log`, `browser-art-v3.log`, `build-art-v3.log`, `staging-art-v3.log`. Browser catalog dùng ảnh thật, nhưng dữ liệu sở hữu là fixture; không thay duyệt thị giác của người dùng.

### Tải web sau thay ảnh

Đã chạy `node scripts/benchmark-linh-thu-web.mjs --capture` và `node scripts/benchmark-linh-thu-web.mjs --throttled --samples=3`. Mỗi biến thể dùng ba profile Chrome mới ở390px, cùng runtime/API fixture và kho2.400 cá thể. Baseline dùng registry ảnh tham chiếu; candidate dùng artv3. So sánh này đo chi phí thay ảnh, **không phải bản remote trước tính năng**.

| Mạng mô phỏng 100ms/256KiB mỗi giây, trung vị3mẫu | Tham chiếu | Artv3 |
| --- | --- | --- |
| Mở Hôm nay từ navigation | 2.562,6ms | 2.615,1ms |
| Chuyển sang Đang luyện, ảnh trong viewport giải mã xong | 580,5ms | 564,0ms |
| Mở Bộ sưu tập, ảnh trong viewport giải mã xong | 298,7ms | 315,9ms |
| Body ảnh khi mở màn luyện | 57.630byte | 56.578byte |
| Body ảnh khi mở trang collection đầu | 38.886byte | 39.240byte |

Hôm nay tải **0 ảnh linh thú**. Collection chỉ dựng24/2.400 cá thể và18 loài trong atlas, mọi ảnh collection là thumbnail128px, tải lười; tại checkpoint mạng mô phỏng chỉ6request ảnh đã hoàn tất. Khi vào màn luyện, ảnh lớn512px và preview tải theo màn. Registry mới làm phần body tải ban đầu tăng10.411byte trong server không nén. Không kết luận chênh lệch vài chục ms là cải thiện/tụt hiệu năng có ý nghĩa thống kê; benchmark gồm polling/khung render và không mô phỏng CDN, cache hoặc latency D1 remote.

Báo cáo chi tiết: `trial-results/linh-thu/web-performance.json`, `web-performance-throttled.json`; có từng sample, URL ảnh, decoded/transfer bytes và API calls. Benchmark kiểm không tràn, chỉ một GET collection, không mutation. Tùy chọn `--capture` ghi ảnh UI để review. Đo backend/service/store thật trên SQLite được giữ riêng ở `performance.json`.

## Mỹ thuật hiện hành

Đã hoàn tất và tích hợp 108 ảnh nguồn PNG 1024px alpha. Có 95 ảnh tạo mới trong đợt catalog v3, 13 ảnh tái sử dụng có hồ sơ gốc: tám dạng UR, ba bản Stormlion đã duyệt và hai bản Pyrodaemon v5 dùng tạm. Không dùng lại SSR v1 hoặc các bản độ thuần UR v2/v3/v4 đã bị loại. Toàn bộ 72 ảnh tham chiếu giữ nguyên hash; đây là dữ liệu đối chiếu, không được đếm thành ảnh thiết kế mới.

Nguồn, prompt, model và trạng thái từng ảnh nằm trong `docs/assets/linh-thu/art/MANIFEST.json`; bộ dựng xuất registry `web/assets/linh-thu/art.js` và `ART.json`. Bộ mới có full 512px và thumbnail 128px WebP, tổng lần lượt 3.871.966 và 651.000 byte. Tên có hash tránh cache cũ. Bản thường/95%/100% có URL riêng; preview T1–T3 không dùng ảnh độ thuần. Xem [quy trình thay từng ảnh](assets/linh-thu/art/README.md).

Ảnh thực tế được tạo bằng CLI chính thức của skill imagegen qua gateway Cockpit local, model `gpt-image-2.5`; provenance ghi `imagegen_cli_cockpit`, không ghi nhầm thành công cụ tích hợp `image_gen`. Giữ cấu hình gateway hiện có, không dùng khóa OpenAI mới hoặc huấn luyện trọng số mô hình.

Đã xem các bảng T1–T4 và độ thuần từng rank ở 64/128px, nền sáng/tối; kiểm ảnh trong giao diện mobile. 95% cố ý khác nhẹ; một số bản 100% như Rockong vẫn thay đổi ít. Các bản này được dùng tạm theo yêu cầu, không tự ghi là người dùng đã duyệt thị giác từng con. [Trang review hiện hành](../output/imagegen/catalog-v3/index.html) lọc rank, đổi nền và mở nguồn 1024px. Bộ SSR v1 chỉ còn là lịch sử đã loại.

Bộ ảnh không thay đổi luật luyện, độ thuần hoặc kỹ năng. Có thể sửa một ảnh sau này bằng entry manifest và phiên bản mới rồi dựng lại; không cần reset cá thể hay sửa dữ liệu người chơi.

## Quy trình duyệt phát hành đã hoàn tất

- Người dùng review bản local, bộ ảnh và luồng sản phẩm; chỉnh góp ý nếu có. 95%/100% được phép tiếp tục dùng tạm.
- Đối chiếu kết quả kiểm chứng và môi trường phát hành; kiểm local không chứng minh latency hoặc CPU Worker trên D1 remote.
- Review toàn bộ diff, nguồn assets, migration 0041, backup/restore và rủi ro còn lại.
- Chỉ sau khi bản review đủ mới xin xác nhận riêng cho deploy/migration remote. Quyền deploy của đợt cleanup trước không có hiệu lực cho tính năng này.

Checkpoint trước release chỉ còn0041 chưa áp; báo cáo lịch sử ở `trial-results/linh-thu/staging-readiness.json`. Sau xác nhận **“Duyệt bản hiện tại và cho phép phát hành staging”**, đã backup mới, diễn tập restore/nâng cấp giữ nguyên102 bảng cũ, áp0041 và deploy version `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559`. Kiểm sau deploy: 402/402 file khớp hash, tám API chưa đăng nhập trả401, Chrome 390/1440px không lỗi JS/tràn ngang. Các luồng ghi có đăng nhập chỉ được kiểm local qua API/D1 tạm; không ghi dữ liệu tài khoản thật để QA. [Chi tiết và bằng chứng phát hành](LINH_THU_RELEASE.md).
