# Thói quen v2 và Nhật ký — checkpoint triển khai

Mục tiêu: triển khai demo `docs/prototypes/habits-v2/index.html` vào ứng dụng thật,
kiểm chứng và phát hành staging để người dùng test trên điện thoại. Quyền sửa code,
thêm migration/test và deploy staging đã được duyệt trong goal ngày 23/10/2026.

## Bất biến Tháp giao ước

Giữ nguyên nội dung, assets, tương tác và luật tháp. Baseline SHA256 trước khi sửa:

| File | SHA256 |
| --- | --- |
| web/ui/beast-tower.js | 233D6CFD8046371A10374CD94BA916260717B12EA429B261C8CF06AD2B457EC9 |
| web/ui/beast-tower-art.js | 4A411DEDF290E1205C5BC36D1561C85CEEAFB30B856F27E54F038C7D829A9ED2 |
| src/domain/linh-thu-tower.ts | 27E845F38278154AE0AFEFE21D5F49C6E6E3A505E6E1EC096BE8A509CA390C71 |
| src/application/linh-thu-tower.ts | CA7C276760A8C3E65780C20D3F185677B4C7F4B4884F98366C1A9DED1F78BD1F |

## Quyết định triển khai

- Nhật ký dùng ngày sinh hoạt phía server, cùng ví `cultivation_accounts`.
- Thưởng cố định +1 tu vi, +1 vé; claim theo owner/ngày tồn tại độc lập với nội dung
  nhật ký. Lưu nội dung, claim, ví và receipt trong cùng transaction.
- Nhật ký giữ version/tombstone khi xóa để request cũ không ghi đè bản mới. Nội dung
  đã xóa không trả trong API. Bản nháp trình duyệt phải được phân biệt theo tài khoản.
- Trạng thái hiển thị thói quen (lưu trữ/xóa/để hôm khác) không được xóa nghĩa vụ
  đã phát sinh hoặc đổi kết quả kiểm tra điều kiện tháp.

## Hoàn tất triển khai — chờ người dùng nghiệm thu

- Đã đọc objective, demo và kiến trúc UI/API/D1, ghi baseline tháp.
- Đã triển khai backend nhật ký và UI đọc/viết/sửa/xóa, nháp theo tài khoản và receipt
  khôi phục qua reload. Thưởng atomic cố định dùng ví thật; không nhân theo Linh thú.
- Đã triển khai giao diện habit v2, chọn/xóa nhiều, archive/resume, lựa chọn theo ngày,
  bảng ghi nhận cũ và shortcut đủ mục tiêu. Giữ các màn tiến bộ/lịch sử qua menu.
- Migration mới: `0046_habits_v2_journals.sql`; 0043–0045 đã có từ các đợt khác.
- Backend full suite PASS 492/492; experiments offline PASS 25/25. Full browser suite
  PASS 148/148, gồm hồi quy tháp; 15 performance/recovery tests PASS. Các selector cũ
  được chuyển sang ID/nhóm hiện hành, giữ kiểm tra hoàn tác, mất mạng và chống trùng.
- Ba browser tests nối API/D1 thật PASS sau sửa cuối: CRUD habit/journal, draft/retry,
  số lượng khi defer không cho ghi, sang ngày hiển thị lại và restore chờ hiệu lực.
  Kiểm màn 320/390/430/1440px, chữ 200%, sáng/tối, viewport 390×410 mô phỏng bàn phím.
  Ảnh ở `trial-results/habits-v2/live/`; dữ liệu ảnh cũ ở output chỉ là lần QA trước.
- Gates PASS: TypeScript backend/web, lint, format 121 files, syntax 48 modules,
  kiểm đủ ảnh Linh thú, build dry-run mặc định và staging. Test history sau xóa đã
  bổ sung log trước xóa để chứng minh có dữ liệu bị ẩn, không assert trên danh sách rỗng.
- Đã xác minh DB staging UUID `5457c401-45d9-4b19-b76e-0eceec67a223`, lịch sử remote
  đến 0045 trước nâng cấp. Backup mới ngay trước cutover tại
  `.wrangler/habits-v2-qa/before-cutover-final.sql` (riêng tư, không commit).
  `rehearsal-final.json`: integrity OK, 0 FK violations, 116 bảng cũ giữ nguyên,
  thêm đúng 3 bảng. Đã áp 0046 remote thành công và xác minh schema.
- Đã deploy **chỉ staging** ngày 23/10/2026, version
  `f20b2986-06e1-4144-94ac-aaaa6f66307c`.
  URL: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/
- Đối chiếu 12 assets remote/local khớp SHA256; các file tháp trong baseline khớp
  nguyên bản, `web/linh-thu.css`, `web/views/linh-thu.js` và domain habit không đổi.
  GET habits/journals không đăng nhập trả 401.
- Smoke có đăng nhập bằng bản sao profile trình duyệt hiện có PASS: journal ngày cũ
  tạo/đọc/sửa/xóa và không thưởng; habit mới chưa phát sinh cam kết ghi số/hoàn tác,
  defer/resume, archive/restore, delete. Dữ liệu thử được ẩn/xóa, không sửa habit hay
  nhật ký thật, không tiêu thụ claim thưởng nhật ký hôm nay. Không gửi Telegram,
  không đổi webhook, không mở/chơi hoặc reset tháp.
- Bằng chứng local riêng tư ở `.wrangler/habits-v2-qa/`: `test-all-final.log`,
  `test-browser-final.log`, `mobile-final2.log`, `presentation-final2.log`,
  `journals-final.log`, `deploy-final.log`, `remote-schema-final.json`,
  `deployed-assets.json`, `postdeploy-smoke.json`, `ui-smoke.json`. UI staging có
  đăng nhập cũng đã kiểm 320/390/430/1440px, mở form và lịch sử nhật ký, không tràn
  ngang, 0 lỗi runtime; ảnh riêng tư ở `trial-results/habits-v2/staging/`.
  Harness staging tăng timeout CDP
  cho chuỗi request remote; lượt đầu bị timeout harness, đã dọn riêng mẫu thử trước
  khi chạy lại thành công. Không coi timeout đó là bằng chứng mutation thất bại.

## Sửa theo phản hồi đối chiếu demo — 23/10/2026

- Bản triển khai đầu chưa đạt độ khớp demo. Đã đối chiếu trực tiếp hai bản cùng
  dữ liệu: tổng kết ngang khoảng 86px; dòng thói quen gọn; checkbox 21px với vùng
  bấm cao 44px; ô số/Khác đồng bộ; thêm chevron và vùng mở tên + mô tả.
- Chi tiết có thẻ hôm nay, bảng thông tin, lịch sử 7 ngày thu gọn đọc từ API,
  quản lý gọn và footer cố định. Ghi nhận có số xem trước, thanh kéo đồng bộ nhập
  chính xác hoặc bộ đếm, nút Đủ mục tiêu và Lưu hôm nay. Form thêm/sửa dùng select
  và hàng mục tiêu/đơn vị theo demo; giữ thông tin hiệu lực cam kết thực tế.
- Sửa CSS cũ đè lên chiều cao dialog, nút Thoát chọn, checkbox mục đã hoàn thành,
  ô số thập phân xuống dòng và ô Khác ở footer. Các nhóm vẫn mở được khi chọn
  nhiều. Màn xác nhận xóa và trạng thái trống được làm lại theo demo.
- Nhật ký dùng khoảng cách, placeholder, chiều cao nội dung và kiểu đọc gọn của
  demo. Footer vẫn truy cập được ở viewport bàn phím thấp. Bản demo không sửa.
- Kiểm chứng: 150/150 browser tests toàn ứng dụng PASS, không skip; sau các sửa
  căn chỉnh cuối, chạy lại suite API Thói quen/Nhật ký và đối chiếu hình học PASS.
  Typecheck web, lint, format 123 file, cú pháp 49 module, hai build dry-run PASS.
  Bằng chứng ở `trial-results/habits-v2/parity/` (demo và app cùng dữ liệu,
  `geometry.json`, 320/390/430/1440px) và `trial-results/habits-v2/live/`.
- Bên trong tháp: 4 hash baseline UI/art/domain/application giữ nguyên;
  `web/linh-thu.css`, `web/views/linh-thu.js`, domain habit không đổi. Browser
  kiểm tháp qua toàn bộ suite và kiểm class CSS được xóa khi đổi sheet.
- Đã phát hành bản sửa **chỉ staging**, version
  `d0c6969a-2d9b-44c5-bc8b-278ecd404ef4`. Không có migration mới. Backup mới
  `.wrangler/habits-v2-qa/review-final-before-deploy.sql`; diễn tập từ baseline
  0046 integrity OK, 0 FK lỗi, dữ liệu cũ giữ nguyên. Đối chiếu 14 assets remote
  khớp local, endpoint chưa đăng nhập trả 401. UI thật có đăng nhập kiểm các kích
  thước màn, mở form/lịch sử nhật ký và không có lỗi runtime. Không sửa dữ liệu
  thật hoặc nhận thưởng hôm nay trong đợt kiểm sau deploy.
- Log riêng tư: `.wrangler/habits-v2-qa/review-full-browser.log`,
  `review-final-parity.log`, `review-archive-parity.log`,
  `review-final-rehearsal.json`, `review-final-deploy.log`,
  `review-deployed-assets.json`, `ui-review-smoke.json`. Ảnh UI staging tại
  `trial-results/habits-v2/staging-review/`. Chưa thay cho nghiệm thu thiết bị thật.

## Sửa CSS Tổng hôm nay và con trỏ nhật ký — 23/10/2026

- Chỉ sửa giao diện trong `web/habits-v2.css`: nhãn Tổng hôm nay cách bộ đếm
  8px, input số có padding và chiều cao rõ ràng, ẩn spinner thừa. Đặt rõ màu
  chữ và caret theo biến theme cho input/textarea trong sheet thói quen/nhật ký.
- Ghi đè màu nút chính trong đúng các vùng này: quy tắc OS dark cũ từng làm
  chữ nút đen dù app ở chế độ sáng. Giữ chữ trắng khi app sáng và chữ tối khi
  app tối. Không sửa CSS dùng chung hay bên trong Tháp giao ước; 4 hash baseline
  của tháp vẫn khớp. Bản demo và `.env` giữ nguyên.
- 4/4 browser tests liên quan PASS, không skip; kiểm tra màu caret/chữ/nút,
  khoảng cách và chiều cao bộ đếm, app sáng trên OS tối, app tối và các luồng
  dữ liệu thói quen/nhật ký. Test lưu lựa chọn theme trước khi đổi OS scheme
  để tránh listener tự động đổi theme sau assertion. Đã xem ảnh nền sáng thực tế.
  Lint, format check và staging dry-run PASS.
- Backup staging mới và diễn tập baseline 0046: integrity OK, 0 lỗi FK, dữ liệu
  cũ giữ nguyên, không có migration mới. Phát hành chỉ staging version
  `6d9b9dba-7baa-49b6-a398-48364900d869`; chỉ một static asset thay đổi.
- Sau deploy, 14/14 assets remote khớp local; API chưa đăng nhập trả 401.
  UI đã đăng nhập kiểm tra chỉ đọc bằng bản sao profile: OS tối/app sáng,
  bộ đếm cao 52px và gap 8px, caret tím, chữ tối trên nền trắng, chữ nút trắng;
  320/390/430/1440px không tràn ngang và 0 lỗi runtime. Không ghi/xóa bản ghi,
  không nhận thưởng, không gửi Telegram hay thao tác trong tháp.
- Bằng chứng riêng tư: `.wrangler/habits-v2-qa/ios-colors-browser.log`,
  `ios-colors-rehearsal.json`, `ios-colors-deploy.log`, `ios-staging-smoke.json`;
  ảnh `trial-results/habits-v2/staging-ios-colors/`. Kiểm chứng bằng Chrome/Edge,
  chưa thay cho nghiệm thu trên iPhone thật.

## Sửa nhật ký mở giật hai nhịp — 23/10/2026

- Nguyên nhân: `openJournal()` mở dialog thấp với dòng Đang tải, tải danh sách
  rồi đệ quy tải ngày, cuối cùng dựng lại dialog khi có form. Đã bỏ dialog chờ:
  nút mở có trạng thái busy, dữ liệu tải xong mới mở đúng màn đọc hoặc form một lần.
- Đọc trực tiếp ngày sinh hoạt đã biết từ trang Thói quen; kiểm tra lại ngày server
  để mở đúng hôm nay khi qua ngày. Giữ version của cả nhật ký đã xóa để tạo lại
  đúng; nháp và các cơ chế chống thưởng trùng giữ nguyên. Đồng bộ nhãn Đã lưu
  từ bản vừa đọc. Lỗi tải trả nút về trạng thái có thể thử lại; đổi ngày thất bại
  giữ form và ngày cũ. Response đến muộn không thay dialog khác hoặc mở lên tab khác.
- Code ứng dụng chỉ đổi `web/features/journals.js`, `web/views/journals.js`,
  `web/views/habits-today.js`, `web/habits-v2.css`. Không sửa shared sheet, backend,
  migration, demo, `.env` hoặc bên trong tháp; 4 hash baseline tháp vẫn khớp.
- 5/5 browser tests liên quan PASS, không skip. Bài mới giữ response chậm để kiểm
  bấm hai lần chỉ có một request, không có dialog khi đang chờ, mọi frame mở đều
  có form đầy đủ và chiều cao không đổi; kiểm thêm tải lỗi/thử lại, đổi ngày lỗi,
  chuyển tab khi đang tải và ngày server mới hơn trang. Các luồng nhật ký thật
  trên DB test gồm nháp/lưu/đọc/sửa/xóa/retry/thưởng một lần vẫn PASS.
  Typecheck web, lint, format, cú pháp 49 module và staging dry-run PASS.
- Backup mới và diễn tập baseline 0046 PASS: integrity OK, 0 lỗi FK, dữ liệu cũ
  giữ nguyên, không có migration mới. Phát hành chỉ staging version
  `bb11042b-86c4-42a4-ad6b-0609d9b1c94c`, cập nhật 4 static assets.
- Kiểm sau deploy bằng bản sao profile đã đăng nhập, chỉ đọc: khung mở 1 lần,
  1 GET ngày, 4 frame đầy đủ, chênh lệch chiều cao 0px, 0 lỗi runtime. Màu caret,
  chữ/nền và khoảng cách bộ đếm vẫn đạt; các viewport 320/390/430/1440px không
  tràn ngang. 14/14 asset remote khớp local, API không đăng nhập trả 401.
  Không ghi dữ liệu thật hoặc nhận thưởng. Một lượt kết nối xác minh bị reset/
  timeout; lượt kiểm lại bằng trình duyệt và curl đều thành công.
- Bằng chứng riêng tư trong `.wrangler/habits-v2-qa/`: `journal-opening-browser.log`,
  `journal-opening-rehearsal.json`, `journal-opening-deploy.log`,
  `journal-opening-staging-smoke.json`, `journal-opening-assets.json`.
  Ảnh tại `trial-results/habits-v2/staging-journal-opening/` và
  `trial-results/habits-v2/live/journal-slow-read-*.png`. Chưa kiểm trực tiếp bằng
  Telegram trên iPhone; chờ người dùng test bản staging mới.

## Chỉnh trạng thái chọn nhiều — 24/10/2026

- Bỏ nền tím và bo góc phủ toàn dòng đã chọn. Giữ nền của danh sách, đường phân
  cách và hình học dòng; ô tick tím là dấu hiệu chọn, tương tự danh sách Hôm nay.
  Ở app tối dùng tick màu tối trên ô tím nhạt để tăng độ rõ.
- Nút Xóa trong thanh chọn nhiều dùng nền đỏ nhạt/chữ đỏ khi app sáng, kể cả OS
  đang tối. Màu tối chỉ áp dụng theo `data-theme` của app; tránh quy tắc OS dark
  cũ làm nút thành đỏ đen trên màn hình sáng như ảnh phản hồi.
- Code ứng dụng chỉ sửa `web/habits-v2.css`; mở rộng ảnh kiểm tra có sẵn trong
  `tests/browser/habits-parity.test.mjs` để xem 2 mục được chọn ở 320/390/430/1440px,
  OS tối/app sáng và app tối. Giữ cơ chế chọn/xóa, demo và bên trong tháp nguyên
  trạng; 4 hash baseline tháp khớp. Chọn mục không làm vị trí/kích thước dòng đổi.
- 5/5 browser tests liên quan PASS; sau chỉnh màu tick tối, bài đối chiếu hình học
  và tháp chạy lại PASS. Lint, format check và staging dry-run PASS. Backup mới
  `selection-style-before-deploy.sql`, diễn tập baseline 0046 integrity OK, 0 lỗi
  FK, dữ liệu cũ giữ nguyên, không có migration mới.
- Phát hành chỉ staging version `db9015f6-9c5b-43c5-a51d-ff87c6519225`.
  14/14 asset remote khớp local, API chưa đăng nhập trả 401. Kiểm UI chỉ đọc trên
  profile sao chép: chọn 2 mục ở sáng/tối, không tràn ngang ở 4 kích thước,
  thoát chọn giữ trạng thái/tiến độ ban đầu, 0 request ghi và 0 lỗi runtime.
  Đã xem ảnh staging; chưa thay cho nghiệm thu Telegram trên iPhone thật.
- Bằng chứng riêng tư: `.wrangler/habits-v2-qa/selection-style-browser.log`,
  `selection-style-final-parity.log`, `selection-style-rehearsal.json`,
  `selection-style-deploy.log`, `selection-style-staging-smoke.json`,
  `selection-style-assets.json`; ảnh tại `trial-results/habits-v2/staging-selection-style/`.

## Sửa đơn vị sau khi chỉnh thói quen — 24/10/2026

- Nguyên nhân: trình sửa lấy definition đang chờ hiệu lực, còn danh sách/chi tiết/ghi nhận
  dùng definition cam kết hôm nay nên vẫn hiện đơn vị cũ. Bổ sung `habitDisplayUnit()`
  trong `web/models/habits.js`, dùng chung tại `web/views/habits-today.js` và
  `web/features/habits.js`: khi cả hai definition đều là số lượng, nhãn lấy đơn vị mới.
  Thay đổi sang loại đo khác vẫn giữ đơn vị hiện tại. Thông báo thay đổi sắp tới trong
  chi tiết hiện thêm mục tiêu và đơn vị để phân biệt với mục tiêu hôm nay.
- Không đổi backend, mục tiêu cam kết, số đã ghi, lịch hiệu lực, lịch sử, thưởng hoặc
  đầu vào tháp. Bốn hash baseline bên trong tháp giữ nguyên; không sửa demo, `.env`,
  migration hoặc production.
- Thêm browser regression qua API/D1 thật ở DB tạm: sửa ly → cốc, tải lại app, xem
  danh sách/chi tiết/ghi nhận, ghi 1,5, đổi mục tiêu tương lai, chốt lịch sử và sang
  ngày mới. Lịch sử giữ đơn vị/giá trị cũ; mục tiêu tương lai áp dụng đúng ngày.
  Bộ browser liên quan chạy cuối PASS 6/6, không skip. Một lượt trước bị timeout chờ
  nút nhật ký disabled; chạy riêng lại PASS và chạy lại toàn bộ PASS, không hạ assertion.
  Typecheck web, lint, format, check 49 module, 14 unit tests web và staging dry-run PASS.
- Backup staging mới `unit-label-before-deploy.sql`; diễn tập baseline 0046: integrity
  OK, 0 lỗi FK, dữ liệu cũ giữ nguyên, không có migration mới. Phát hành staging version
  `6d0e4b4b-c065-47bc-9e16-64a22b43706a`. 15/15 assets remote khớp local;
  API chưa đăng nhập trả 401.
- Kiểm UI staging bằng profile sao chép, chỉ đọc: danh sách hiện `1 / 6 Cốc`, chi tiết,
  ô sửa và ghi nhận thống nhất; 320/390/430/1440px không tràn ngang, 0 request ghi,
  0 lỗi runtime. Lúc kiểm staging không còn bản đổi đơn vị chờ hiệu lực; trường hợp đó
  được kiểm riêng bằng regression API/D1 cục bộ. Đã xem ảnh staging, chưa kiểm iPhone thật.
- Bằng chứng trong `.wrangler/habits-v2-qa/`: `unit-label-browser-final.log`,
  `unit-label-rehearsal.json`, `unit-label-deploy.log`, `unit-label-assets.json`,
  `unit-label-staging-smoke.json`; ảnh `trial-results/habits-v2/staging-unit-label/`.

## Phiên đăng nhập mini app 30 ngày — 24/10/2026

- Người dùng duyệt sửa cơ chế đăng nhập sau khi được giải thích chi phí đọc DB và
  đánh đổi thời hạn phiên. Giữ TTL xác thực Telegram initData ở 15 phút. Sau xác thực
  hợp lệ, GET bootstrap cấp cookie phiên 30 ngày cố định qua bảng browser_sessions
  hiện có, không cần request đăng nhập bổ sung, migration hay polling giữ phiên.
- `src/adapters/d1/browser-auth.ts` cấp token ngẫu nhiên 256 bit, chỉ lưu hash; dọn phiên
  hết hạn và thêm phiên trong một batch. `src/entrypoints/mini-app.ts` ưu tiên cookie
  hợp lệ trước initData để quay lại từ nền vẫn dùng được. Mỗi API có cookie tốn một
  indexed read, không gia hạn hoặc ghi lại phiên. Lỗi kho phiên trả 503 thay vì báo
  nhầm hết đăng nhập. `web/core/http.js` gửi write guard trong cả Telegram và browser.
  Cookie Secure/HttpOnly/SameSite=Strict; cookie POST vẫn kiểm origin/header/fetch site.
- Kiểm hồi quy phát hiện nút Nhật ký mất busy khi refresh nền thay DOM trong lúc tải.
  Sửa state busy trong features/journals.js và views/habits-today.js, đặt lại khi về
  đăng nhập ở features/browser-login.js. Bổ sung kiểm thử bắt buộc refresh nền khi
  response nhật ký đang bị giữ, kiểm nút mới vẫn disabled/busy và chỉ mở sheet một lần.
  Không thay CSS, bản demo hay bất kỳ file bên trong tháp; bốn hash tháp giữ nguyên.
- `npm test` PASS 496/496. Nhóm auth/API/web module PASS 36/36; browser phiên thật
  với API/D1 cục bộ cùng Thói quen/Nhật ký PASS 7/7, nhóm performance PASS 15/15.
  Test phiên dùng cookie trình duyệt thật, server tiến 20 phút, tải lại và ghi task;
  không cấp lại phiên, không thêm round trip, JS không đọc được cookie. Kiểm thêm mốc
  hết hạn đúng 30 ngày, logout, sai chủ tài khoản, chữ ký sai/quá hạn, CSRF và DB outage.
  Typecheck toàn repo/web, lint, format, cú pháp web và staging dry-run đều PASS.
- Backup mới `session-before-deploy.sql`, diễn tập baseline 0046 integrity OK,
  0 lỗi FK, dữ liệu cũ giữ nguyên, không có migration mới. Cloudflare migration listing
  lượt đầu trả lỗi nội bộ 7500; thử lại thành công và xác nhận không có migration cần áp.
- Staging version `7ea380aa-0aaa-403b-8c9e-a47faf9ccb57`. 17/17 asset remote khớp
  local, API chưa đăng nhập trả 401. Kiểm UI bằng bản sao profile có cookie còn hạn:
  header Telegram giả lập đã cũ không làm mất phiên; POST probe vào route không tồn
  tại thiếu guard trả 403, đủ guard đi qua auth rồi trả 404. Không ghi nghiệp vụ,
  đăng xuất tài khoản thật hoặc nhận thưởng; 0 lỗi runtime. Việc cấp cookie từ proof
  Telegram mới và vượt 15 phút được kiểm trên DB/browser cục bộ; chưa kiểm iPhone thật.
- Bằng chứng riêng tư `.wrangler/habits-v2-qa/session-*.log`, `session-assets.json`,
  `session-staging-smoke.json`, `session-rehearsal.json`; ảnh
  `trial-results/habits-v2/staging-session/`. Người dùng cần đóng rồi mở lại mini app
  một lần để tải frontend mới và cấp phiên; phiên cũ đã hết 15 phút không tự hồi sinh.

## Tỷ lệ quay thưởng và sắp xếp thói quen — 24/10/2026

- Người dùng duyệt điều chỉnh Hộ Tâm Phù xuống 0,5%, An Tâm Phù xuống 1%;
  phần phân bổ lại là vé quay linh thú 0,5% và tín vật Minh Anh tăng lên 8%.
  Các mức +1 tu vi 40%, +2 tu vi 15%, Phá Cảnh Phù sơ cấp 35% giữ nguyên;
  tổng 100%. Backend, bảng tỷ lệ và nhãn kết quả frontend cùng bộ phân bổ.
- Vé quay linh thú được cộng vào beast_accounts, không vào inventory tu luyện.
  Bao phủ tài khoản chưa có ví, ví cũ, V2 không đồng hành, có đồng hành và hệ số
  thưởng hiện có. Lỗi giao dịch hoàn tác cả vé đã dùng và phần thưởng; retry không
  cộng trùng. Trúng vé làm hết hạn cache linh thú để lần mở tab sau cập nhật ví.
- Trong Chọn nhiều, mỗi dòng có mũi tên lên/xuống ở bên phải; giữ mục đã chọn,
  khóa nút biên và trong lúc lưu. Sắp xếp trong từng nhóm trạng thái hiện có;
  thứ tự lưu server, giữ sau tải lại/ngày mới. API hoán đổi hai khóa thứ tự bằng
  transaction có kiểm tra cả hai version và receipt; không sửa định nghĩa,
  tiến độ, cam kết hay phần thưởng. Migration mới 0047_habit_order.sql giữ thứ tự
  mặc định created/id cho dữ liệu cũ, kể cả các mục tạo cùng thời điểm.
- Kiểm chứng: npm test PASS 500/500, browser Thói quen/parity PASS 7/7, browser
  tỷ lệ/nhãn thưởng PASS 1/1. Kiểm thử phân bổ quét 10.000 điểm; API/D1 kiểm tra
  đổi thứ tự, reload, cạnh tranh, dữ liệu ngoại tài khoản, mục đã xóa và rollback;
  kiểm thử ví thật dùng DB tạm qua năm chế độ. Typecheck toàn repo/web, lint,
  format, cú pháp 49 module web và staging dry-run PASS.
- Backup mới order-loot-before-deploy.sql; diễn tập từ 0046: integrity OK,
  0 lỗi FK, dữ liệu cũ của 119 bảng giữ nguyên. Áp duy nhất migration 0047 lên
  assistant-staging, không sửa migration cũ. Staging version
  b24e85db-8c01-4c33-b353-47382c7f0562; 20/20 assets remote khớp local,
  API chưa đăng nhập trả 401.
- Smoke staging chỉ đọc qua bản sao profile: 8 dòng đều có hai nút và nhãn
  truy cập, thứ tự DOM khớp API, thoát chọn ẩn nút; 320/390/430/1440px không
  tràn ngang, bảng tỷ lệ đúng, 0 request ghi nghiệp vụ và 0 lỗi runtime.
  Đã xem ảnh staging; thao tác đổi thứ tự và quay thưởng thực tế được kiểm trên
  DB tạm, không dùng dữ liệu/thưởng thật để thử. Chưa thay cho nghiệm thu điện thoại.
- Không sửa .env, prototype, production, webhook hoặc bên trong Tháp giao ước;
  bốn hash baseline tháp giữ nguyên. Bằng chứng tại .wrangler/habits-v2-qa/:
  order-loot-all-tests.log, order-loot-browser.log, order-loot-draw-browser.log,
  order-loot-wallet-final.log, order-loot-rehearsal.json, order-loot-migrate.log,
  order-loot-deploy.log, order-loot-assets.json, order-loot-staging-smoke.json.
  Ảnh: trial-results/habits-v2/staging-order-loot/.

## Giới hạn và nghiệm thu trên điện thoại

- Bàn phím, kích thước và chữ lớn kiểm bằng Chrome/Edge mô phỏng, chưa thay cho
  nghiệm thu bàn phím iOS/Android trên thiết bị thật.
- Nháp lưu trên từng trình duyệt/tài khoản; không đồng bộ nháp giữa thiết bị. Nhật ký
  đã lưu đồng bộ server; xung đột version giữ nháp và yêu cầu chủ động chọn nội dung.
- Giữ giới hạn domain cũ 30 thói quen đang cam kết; archive/delete ẩn ngay nhưng
  cam kết chờ hiệu lực vẫn có thể tính vào giới hạn đến ngày cắt cam kết.
- Thưởng hôm nay, atomic rollback, nhiều thiết bị, retry qua ngày, xóa/tạo lại đã
  kiểm với DB tạm. Trên staging chỉ dùng nhật ký quá khứ để giữ quyền nhận thưởng
  hôm nay cho người dùng, không giả nhận đã kiểm thưởng trên ví thật của họ.
- Người dùng mở URL, đăng nhập hiện hành nếu cần (`/dangnhap MÃ` trong Telegram),
  test tick/hoàn tác, ô số lượng, Khác, chọn/xóa nhiều và nhật ký lưu/đọc/sửa/xóa.
  Tiếp nhận sửa phản hồi trong cùng phạm vi; chưa tự nhận người dùng đã nghiệm thu.
