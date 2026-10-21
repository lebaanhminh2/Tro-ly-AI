# Vận hành và cân bằng Linh thú

Cập nhật 21/10/2026. Luật sản phẩm ở [đặc tả](LINH_THU_SPEC.md), con số từng kỹ năng ở [LINH_THU_SKILLS](LINH_THU_SKILLS.md), phạm vi kiểm chứng ở [nghiệm thu](LINH_THU_ACCEPTANCE.md).

## Vị trí triển khai

| Phần                                           | Nơi sửa                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Catalog và luật thuần, không phụ thuộc DB/HTTP | `src/domain/linh-thu*.ts`                                             |
| Điều phối nghiệp vụ và hợp đồng lưu trữ        | `src/application/linh-thu*.ts`, `src/ports/linh-thu-store.ts`         |
| Truy vấn đọc và ánh xạ dữ liệu                 | `src/adapters/d1/linh-thu-reader.ts`                                  |
| Giao dịch ghi và điều phối habit/tháp          | `src/adapters/d1/linh-thu-store.ts`                                   |
| Chuẩn bị hiệu ứng cho giao dịch của luồng nền  | `src/adapters/d1/linh-thu-effects.ts`                                 |
| Ghép kết quả ngày và chốt tuyệt kỹ hết hạn     | `src/adapters/d1/linh-thu-maintenance.ts`                             |
| HTTP và bảo trì                                | `src/entrypoints/mini-app/linh-thu.ts`, scheduler của Worker          |
| Trạng thái và điều khiển giao diện             | `web/features/linh-thu.js`, `web/core/state.js`                       |
| Trình bày, tra ảnh và năng lực                 | `web/views/linh-thu.js`, `web/models/linh-thu.js`, `web/linh-thu.css` |
| Hiệu ứng và vòng đời dialog                    | `web/ui/beast-evolution*.js`, `beast-reveal*.js`, `beast-tower*.js`   |

Prototype HTML độc lập đã được gỡ. Muốn thử dữ liệu điều khiển dùng harness trong `tests/browser/linh-thu-fixture.mjs`; không thêm nút cấp thú/vé hoặc công cụ mô phỏng vào ứng dụng thật. Mỗi thay đổi code cần nằm trong phạm vi người dùng đã duyệt.

Lần phát hành Linh thú đầu ngày 19/10 được lưu trong [hồ sơ lịch sử](LINH_THU_RELEASE.md). Mã nguồn hiện có migrations đến 0042; các thay đổi rà soát local không tự được phát hành cùng hồ sơ cũ.

## Dữ liệu và giao dịch

`D1BeastStore` kế thừa `D1BeastReader`. Phần chuẩn bị hiệu ứng chỉ dùng reader và trả các statement để luồng gọi ghép vào giao dịch có guard; không tự commit. Hai job bảo trì dùng store ghi trong module maintenance. Khi sửa hook habit/task/ngủ, giữ cùng batch, receipt và thứ tự bảo hộ trước phạt.

Migration bổ sung `0041_linh_thu.sql` không sửa/xóa các bảng game cũ hoặc ví nền. Chín bảng `beast_*` tách tài khoản, cá thể, lượt luyện, vai trò, quyết toán ngày, sự kiện kỹ năng, tuyệt kỹ tuần, tháp và lựa chọn. Ví vé thường/tu vi/vật phẩm và receipts tiếp tục ở hệ thống hiện có.

Mỗi thao tác thưởng/chi phí ghép vào cùng batch có version guard và receipt của owner. Request đã commit được phục hồi trước kiểm tra điều kiện mới; không bốc lại RNG khi retry. Lựa chọn Pyro/quay thường giữ kết quả trên server, không cần giữ trang mở. Không sửa receipt để cho chơi lại, không xóa bộ đếm bảo hiểm khi sửa UI.

Đóng bảng không hủy thao tác đã gửi. Các lần tải thêm chỉ cập nhật bảng vẫn còn mở đúng danh tính; phản hồi cũ không mở lại bảng đã đóng hoặc thay bảng mới. Luyện đan hoàn tất sau khi đóng vẫn cập nhật kho và thông báo kết quả. Một cửa sổ gặp `BEAST_CHANGED` phải đọc số dư/version mới trước lần thử tiếp; không tự phát lại bằng ID mới.

Đổi vai trò hiệu lực theo ngày, giữ `attempt_id` trong lịch sử. Quyết toán habit bị giới hạn số ngày mỗi lần; chưa có habit assessment thì hoãn. Kết hợp habit/ngủ chờ cả hai kết quả cùng ngày. Đổi lượt bảo hộ Meteorax chờ hết công việc của tuần gốc, gồm ngày Chủ nhật kết thúc sau nửa đêm. Reset hủy hiệu ứng đang chạy nhưng không giải phóng khóa tuyệt kỹ tuần.

Task kích hoạt kỹ năng theo lần thưởng hợp lệ đầu trong `task_ticket_awards`, giữ ngày hoàn thành gốc; undo/redo không nhận lại thưởng và task từng nhận vé không làm mục tiêu tuyệt kỹ mới. Bảo hộ ngủ chạy trước phạt/tụt cảnh giới; undo chỉ đảo phần ngủ nền, không bốc lại thưởng hoặc tiêu bảo hộ lần hai. Hootlet giữ budget theo tuần gốc, không đánh giá muộn vào budget tuần khác. Reset Rockong hủy quyền cứu bẫy của phiên đang chạy, không đổi bẫy hoặc trả lượt chơi. Các lựa chọn Hychroma/Cheerstella thanh toán một lần theo lượt gốc, không cộng thêm kết quả đã thay hoặc trừ lại vé.

Scheduler và GET Linh thú tiến từng phần backlog. Không cho client tự khai ngày, phần thưởng hay vị trí bẫy. Lượt tháp cũ tự nhận tổng quà của tầng đã qua; không trừ ví khi bẫy.

Mỗi GET chính chỉ chạy một bước ghi bảo trì: quyết toán ngày trước, rồi ghép kết quả, rồi chốt tuyệt kỹ hết hạn ở những lần tiếp theo. Bốn job thú xoay vòng trong slot cron, mỗi loại có lịch 48 phút khi không mở ứng dụng. Đây không phải hạn xử lý tuyệt đối: khi còn giấc ngủ cần chốt, cron xử lý tối đa một ngày ngủ và hoãn công việc bảo trì khác sang slot sau. Trả lời trực tiếp được ưu tiên trước chốt ngủ; sau đó vẫn gửi được một tin trả lời/menu/đăng nhập đã xếp hàng. Thông báo chủ động chờ chốt ngủ xong để không gửi giữa các ngày vắng mặt chưa được đánh giá; nếu chuyển sang vắng mặt thì outbox loại thông báo đó theo luật cũ. Mở màn tháp cũng chốt lượt cũ ngay. Việc chia lượt không thay ngày gốc hoặc thưởng.

Benchmark local với 30 habit và công việc thật đo bốn job thú lần lượt 25/40/28/23 truy vấn. Ca chốt ngủ trùng quyết toán luyện từng dùng 77 truy vấn; sau tách lượt là 24, 32 rồi 40 truy vấn và luyện vẫn hoàn tất. Bài `tests/integration/linh-thu-cron.test.ts` chạy benchmark trong suite chính, kiểm giới hạn 50 ở các ca này, gửi hai tin đã xếp hàng, mỗi lượt chỉ chốt một ngày ngủ và không chấm lại ngày cũ. Hồi quy vắng mặt còn kiểm cả nhiều lượt cron, không gửi thông báo chủ động ở giữa. Số đo Node/SQLite không chứng minh latency D1 remote, CPU Worker hoặc tải cực đại khi mọi loại thông báo cùng đến hạn.

## Bộ sưu tập và phân trang

GET `/api/linh-thu` trả `collectionOverview`: mỗi loài sở hữu có số lượng và một cá thể đại diện, chọn từ **lượt luyện hiện tại**, theo dạng đã đạt, hoàn mỹ rồi độ thuần. `speciesCounts` được suy ra từ cùng kết quả. `discoveries` vẫn mô tả lịch sử khám phá; reset không xóa lịch sử nhưng đại diện bộ sưu tập phải phản ánh lượt mới.

GET `/api/linh-thu/collection` nhận `species` tùy chọn, `limit` mặc định 24 (1–50), và cursor theo cặp thời điểm nhận/ID. Loài không hợp lệ trả 400. Hai index hiện có `beasts_collection_page` và `beasts_species` phục vụ lần lượt toàn kho và từng loài; không cần migration. Mỗi trang dùng một truy vấn. Bản tổng hợp dùng một truy vấn cửa sổ, vẫn phải xét các cá thể trong kho ở DB; lượng trả về tăng theo số loài.

Atlas dùng bản tổng hợp và không tự tải hết kho. Mở một loài lấy 24 cá thể đầu; nút tải tiếp lấy thêm đúng một trang. Các hộp chọn luyện/đồng hành/dùng đan dùng phân trang toàn kho riêng. Đổi loài, đổi panel hoặc làm mới dữ liệu hủy hiệu lực trang loài cũ; phản hồi cũ không được ghi đè trang mới. Làm mới đưa màn loài về trang đầu. Đóng hộp chọn trong khi tải không làm hộp tự mở lại.

Đối chiếu local ngày 21/10/2026, fixture 2.400 cá thể/18 loài, Chrome mới, HTTP không nén:

| Chỉ số                                 |        Trước |        Sau |
| -------------------------------------- | -----------: | ---------: |
| Yêu cầu collection đến khi mở atlas    |          100 |          1 |
| JSON các trang cá thể đến atlas        | 519.603 byte | 5.056 byte |
| JSON bản tổng hợp thêm trong API chính |            — | 4.328 byte |
| Thẻ cá thể khi mở Frostnip             |          134 |         24 |

Sau khi mở loài và tải tiếp một lần: tổng ba yêu cầu collection, 15.374 byte JSON trang cá thể, 48 thẻ. Bản tổng hợp đã nằm trong API chính, không phát sinh endpoint riêng. Đây là bằng chứng giảm lượng dữ liệu và DOM; không suy ra tỷ lệ tăng tốc thực tế từ các con số này. API chính vẫn 22 truy vấn ở ca thông thường; các ca backlog trong benchmark tối đa 40, dưới giới hạn 50. Chưa đo latency D1 remote, CPU Worker hoặc thiết bị người dùng.

Kiểm chứng bằng `node scripts/benchmark-linh-thu.ts` và `node scripts/benchmark-linh-thu-web.mjs --samples=3`; báo cáo trong `trial-results/linh-thu/performance.json` và `web-performance.json`. Benchmark web kiểm atlas, trang loài đầu và tải tiếp; ghi số yêu cầu, byte API và số thẻ, bên cạnh ảnh/module thật. Các kiểm thử tích hợp kiểm lượt hiện tại/lịch sử, owner, độ thuần và cursor trùng thời điểm; kiểm thử trình duyệt kiểm tải có giới hạn, loài chưa sở hữu, phản hồi muộn và hộp chọn độc lập.

## Cấu hình v1

| Phần                               | Nguồn                              |
| ---------------------------------- | ---------------------------------- |
| Species ID/rank/dạng               | `src/domain/linh-thu-catalog.ts`   |
| Điểm, tỷ lệ, bảo hiểm, thưởng tháp | `src/domain/linh-thu.ts`           |
| Mốc, dung lượng, đan               | `src/domain/linh-thu-training.ts`  |
| Thiên phú/Thức tỉnh/tuyệt kỹ       | `src/domain/linh-thu-skills.ts`    |
| Vòng đời hiệu ứng                  | `src/domain/linh-thu-ultimates.ts` |

Hiện runtime hỗ trợ **v1**; bảng attempts lưu `rule_version`, `skill_version`, dung lượng và mốc. Species ID và ID cá thể/lượt luyện phải ổn định. Đây chưa phải công cụ chỉnh cân bằng nóng trong giao diện.

Chính sách cho đợt chỉnh sau:

1. Đổi câu chữ, tên hiển thị hoặc đường dẫn ảnh: giữ ID, không ghi lại tiến độ/receipt.
2. Đổi sức mạnh kỹ năng hoặc luật luyện: tạo phiên bản mới và bộ đọc tương ứng; giữ cấu hình v1 cho lịch sử và lượt cũ. Không chỉ sửa hằng v1 rồi coi là áp dụng an toàn.
3. Mặc định lượt luyện mới dùng luật mới; lượt đang luyện giữ dung lượng/mốc gốc. Kỹ năng mới có thể áp cho hành vi tương lai sau ngày hiệu lực đã công bố; hiệu ứng đã kích hoạt giữ tham số và hạn gốc.
4. Nếu muốn thay luật của lượt cũ, phải có migration riêng, báo tác động trước/sau và được người dùng duyệt. Không backfill thưởng lịch sử, đổi phẩm chất hoặc hoàn vé tự động.
5. Kiểm thử nhiều phiên bản, reset, quyết toán muộn, lựa chọn đang chờ và retry trước phát hành bản cân bằng.

Registry đa phiên bản sẽ được thêm cùng bản v2; không tuyên bố runtime hiện đã đọc được v2 chưa tồn tại.

## Assets

Tham chiếu gốc trong `docs/assets/linh-thu/reference` giữ nguyên. `scripts/build-linh-thu-assets.ts` dựng full 512px, thumbnail 128px, WebP alpha và manifest nguồn/hash/encoder. Chạy không đối số chỉ xác minh, `--write` mới ghi. Encoder sharp được resolve từ dependency phát triển hiện có của Miniflare, không gọi API mạng.

Nguồn vẽ mới và prompt đi vào `docs/assets/linh-thu/art/MANIFEST.json`; [hướng dẫn](assets/linh-thu/art/README.md) có schema, lệnh và giới hạn kiểm chứng. Bộ dựng tạo registry `web/assets/linh-thu/art.js`, provenance `ART.json`, full/thumbnail có phiên bản và hash tên file. Mỗi loài có bốn ảnh thường, một ảnh Thức tỉnh 95% và một ảnh Hoàn mỹ 100% ở T4. Nguồn hiện tại ghi đúng `imagegen_cli_cockpit` và model `gpt-image-2.5`, không giả thành công cụ ảnh tích hợp.

`--require-complete` là cổng kiểm riêng đủ **72 thường/18 thức tỉnh/18 hoàn mỹ**, hiện **đạt** và được chạy trong CI. Bộ dựng kiểm kỹ thuật và ảnh trùng, không thay duyệt thị giác. UI chọn hoàn mỹ trước, rồi thức tỉnh đủ điều kiện, rồi thường ở hero, collection, picker và chi tiết; preview dạng thấp và gacha T1 luôn dùng thường. Không thay phần thưởng hoặc điều kiện độ thuần khi đổi ảnh.

Build hiện có 108 ảnh mới ×2 kích thước, ngoài 72 ảnh tham chiếu giữ để đối chiếu/fallback. Ảnh mới full 512px tổng 3.871.966 byte; thumbnail 128px tổng 651.000 byte. Bộ T1–T4 đã được kiểm qua bảng từng rank, nền sáng/tối và browser; 95%/100% được dùng tạm theo yêu cầu, không tự đánh dấu từng ảnh đã được người dùng duyệt.

Để thay một ảnh: giữ ID loài và gameplay, lưu PNG nguồn mới có phiên bản riêng, cập nhật entry tương ứng trong manifest với prompt/model/trạng thái thật; chạy bộ dựng `--write --require-complete`, kiểm ảnh ở 64/128px và trong UI rồi chạy kiểm thử liên quan. Không ghi đè raw, không reset cá thể hoặc xóa receipt. Xem [gallery hiện hành](../output/imagegen/catalog-v3/index.html) và [hồ sơ kiểm chứng](../output/imagegen/catalog-v3/VERIFICATION.json).

## Nâng cấp, phục hồi và phát hành

Đã thực hiện sau xác nhận riêng ngày19/10/2026: ghi version/schema cũ, backup toàn DB, diễn tập restore/nâng cấp trên bản sao, chạy staging dry-run, áp0041 vào `assistant-staging` rồi deploy `personal-assistant-staging`. Backup riêng và log ở `.wrangler/linh-thu-release-20261019-170354/`; không chia sẻ SQL hoặc URL tải có chữ ký.

Tại lần phát hành 19/10, version `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559` nhận 100% lưu lượng và không còn migration chờ. Restore rehearsal xác nhận 102 bảng cũ giữ nguyên và chín bảng mới, integrity/FK đạt. Kiểm GET sau deploy đối chiếu 402 file web và tám API auth; Chrome 390/1440px hiển thị đăng nhập không lỗi JS/tràn ngang. Đây là bằng chứng lịch sử, không xác nhận version hoặc migration remote hiện tại. Không thử ghi dữ liệu tài khoản thật hoặc gửi Telegram. [Chi tiết phát hành](LINH_THU_RELEASE.md); [bàn giao mới hơn](HANDOFF.md).

Phục hồi không được ghi đè migration history hoặc xóa toàn bộ `beast_*` để thử lại. Trước khi rollback Worker phải xem phiên bản cũ có hiểu schema/dữ liệu mới không. Backup phải gồm cả ví và receipts liên quan, không chỉ bảng thú, để tránh hoàn chi phí mà giữ thưởng hoặc ngược lại. Không chạy script kiểm thử với owner/data thật và không gửi tin thử nếu chưa được yêu cầu.

Lệnh kiểm chứng local: các scripts `typecheck`, `typecheck:web`, `check:web`, `lint`, `format:check`, `test:all`, `test:browser`, `build:check`, `staging:check`; cùng benchmark và asset verify nói trên. `build:check`/`staging:check` là dry-run, không chứng minh đã deploy.

Đo tải web: `node scripts/benchmark-linh-thu-web.mjs` hoặc thêm `--throttled --samples=3`. Có thể thêm `--capture` để ghi ảnh các màn. Dữ liệu API là fixture, bytes ảnh/modules là thật; baseline là cùng runtime với registry tham chiếu. Kết quả ở `trial-results/linh-thu/web-performance*.json`, không được dùng để cam kết hiệu năng D1 remote/CDN.
