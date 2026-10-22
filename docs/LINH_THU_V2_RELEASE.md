# Phát hành Linh thú v2 lên staging

## Phân vùng bảng con và tiến trình kỹ năng — 22/10/2026

Đã phát hành version `93540661-f2fa-4ec3-8661-b92a82673b51` theo duyệt của người dùng. Các bảng con dùng đường phân cách xám mờ dưới tiêu đề cố định; các chân bảng có hành động cố định giữ đường phân cách riêng. Bảng Tháp dùng bố cục flex/grid, chỉ vùng nội dung cuộn để tiêu đề, phản hồi và nút hành động luôn nằm trong khung, kể cả màn hình nhỏ hoặc chữ phóng to.

Tiến trình nằm ngay dưới từng kỹ năng đồng hành đã mở: mốc nhỏ dùng các đoạn, mốc dài dùng thanh liền, hạn mức hiển thị lượt còn lại, cơ chế quay x10 hiển thị xác suất tiếp theo. Trạng thái sẵn sàng/đã dùng không tạo thanh mục tiêu giả cho kỹ năng không có giới hạn. Áp dụng cho 18 loài; kỹ năng xác suất độc lập như Thạch Giáp T1 không có bộ đếm. Không lặp bộ đếm ở cuối thẻ, không đặt tiến trình cá nhân vào bảng kỹ năng tương lai. Cảnh báo nhân ba đã chốt trong ngày vẫn được giữ khi đổi trạng thái linh thú.

Server chiếu trạng thái thực theo tài khoản, cá thể, lượt luyện và ngày. Trạng thái đã nhận thưởng dựa trên biên nhận tương ứng, không suy ra chỉ từ tổng công việc; lượt luyện mới không kế thừa biên nhận lượt cũ. Phần đọc tiến trình không phát thưởng hoặc sửa trạng thái. Bỏ metadata tiến trình tĩnh trùng lặp khỏi danh mục trả về, giữ nguyên các cổng hiệu năng.

Kiểm chứng: 86/86 ca backend/domain/model liên quan PASS. Lượt browser rộng ban đầu đạt 123/124; ca khôi phục nhận thưởng Tháp phát hiện nút bị đẩy khỏi khung khi hiện phản hồi lỗi. Đã sửa bố cục và chạy lại toàn bộ nhóm chịu ảnh hưởng: 19/19 ca Tháp, bảng con và v2 PASS, gồm màn hình nhỏ, chữ phóng to và phục hồi sau xung đột. Không tuyên bố đã chạy lại toàn bộ 124 ca sau sửa. Typecheck backend/web, ESLint, web syntax, format và staging readiness/dry-run PASS. Benchmark 96 phép đo với 24/2400 cá thể PASS, tối đa 50 queries / 37.119 bytes; không nới cổng kiểm tra.

HTTP sau deploy với user agent iPhone: HTML và bốn asset trả 200, SHA256 khớp local; API chưa đăng nhập trả 401. Đây là kiểm tra HTTP và trình duyệt mô phỏng, chưa phải nghiệm thu trên iPhone thật. Truy vấn chỉ đọc xác nhận `v2_active_now=1`; không có migration hoặc sửa dữ liệu tài khoản trong đợt này. Các giới hạn của bộ fixture v1 đã ghi ở lần phát hành trước vẫn được giữ nguyên trong hồ sơ.

Ảnh giao diện: `trial-results/linh-thu/v2/run-32424/`. Log và bằng chứng: `.wrangler/linh-thu-v2-audit/meters-*`, gồm `meters-tower-regressions-final.log`, `meters-benchmark-final.json`, `meters-http-smoke.json` và `meters-cutover-check.json`.

## Sửa đường nối năng lực và phần so sánh tiến hóa — 22/10/2026

Đã phát hành version `78bbbad9-618e-4346-9f78-2247c18431f6` theo duyệt sau hai ảnh chụp lỗi trên điện thoại. Bảng v2 dùng một đường nối trên khung chung qua T1–T4–95%–100%; dòng điều kiện mở khóa không cắt đường nối và đường kết thúc ở tâm chấm 100%. Các chấm được căn theo nhãn, kể cả khi phóng to chữ. Kiểm tra trước chỉ xác nhận căn lề nên đã bỏ sót lỗi đường nối; kiểm thử mới kiểm cả trục, tâm chấm, điểm đầu/cuối và loại bỏ các đoạn border riêng.

“Lên T2 sẽ nhận” giờ tách tên, dòng **Xác suất: 25% → 50%**, rồi một mô tả tác dụng, không ghép hai đoạn T1/T2. Dữ liệu xác suất lấy từ cấu hình server. Kỹ năng mới mở có nhãn “Mở mới” và giữ đầy đủ mô tả; hiệu ứng đặc biệt như Thế Thân không bị diễn giải thành một lần bốc xác suất độc lập. Màn hình kết quả tiến hóa dùng cùng cách trình bày. Không đổi luật thưởng, nguồn sự kiện hoặc dữ liệu tài khoản.

Kiểm chứng: 30/30 unit/domain/model và 24/24 browser v2/roles/evolution PASS; kiểm lại ảnh Thạch Giáp riêng PASS. Đã kiểm cả 18 loài tại 320/390/430/1024px; trường hợp Thạch Giáp kiểm thêm hai giao diện sáng/tối và chữ 150%. Typecheck backend/web, web syntax, ESLint, format, staging readiness/dry-run PASS. Benchmark 96 phép đo giữ cổng cũ, tối đa 49 queries / 39.314 bytes. Không chạy lại toàn bộ test suite; ba lỗi fixture v1 đã ghi ở đợt trước vẫn là giới hạn kiểm chứng chung.

HTTP sau deploy mô phỏng iPhone: HTML và bốn asset sửa trả 200, hash khớp source local. Kiểm tra chỉ đọc trên DB xác nhận tài khoản người dùng vẫn `v2_active_now=1`, không quay lại chờ ngày mai. Không có migration hoặc mutation dữ liệu tài khoản trong đợt sửa UI này.

Ảnh Thạch Giáp: `trial-results/linh-thu/v2/run-31136/turtle-upgrade-390.png`, `turtle-unlocks-light-390.png`, `turtle-unlocks-dark-390.png`. Log: `.wrangler/linh-thu-v2-audit/rail-*`.

## Kích hoạt ngay cho tài khoản đang sử dụng — 22/10/2026

Theo yêu cầu mới của người dùng, đã chuyển mốc áp dụng của tài khoản hiện tại từ ngày sinh hoạt `20749` về ngày đang mở `20748`. Đây là kích hoạt runtime v2 thật trên ứng dụng đang dùng, không chỉ xem trước bảng kỹ năng. Trước khi chuyển đã xác nhận ngày còn mở, chưa có skill event, quyết toán luyện/ngủ của ngày này và chưa có ngày/trạng thái kỹ năng v2.

Chỉ cập nhật mốc áp dụng và tăng version metadata runtime/tài khoản để vô hiệu dữ liệu cũ đang giữ. Đối chiếu trước/sau xác nhận hai ví, cá thể, attempt luyện và lựa chọn vai trò không đổi; truy vấn ngày đang mở xác nhận `v2_active_now=1`. Không triển khai lại code, không phát thưởng hay sửa lịch sử để kích hoạt. Quyền lợi đã ghi nhận vẫn giữ biên nhận cũ. Quy tắc mặc định chuyển tài khoản cũ sang ngày kế tiếp không thay đổi cho các tài khoản khác.

Snapshot và kết quả đối chiếu riêng tư: `.wrangler/linh-thu-v2-audit/immediate-cutover-before.json`, `immediate-cutover-apply.json`, `immediate-cutover-after.json`. Không đưa các snapshot có dữ liệu tài khoản vào Git.

## Câu chữ và giao diện kỹ năng — 22/10/2026

Đã phát hành version `51b5b9f8-38c7-4e1e-aedf-12019f0433f8`. Viết lại mô tả của 18 loài theo điều kiện → xác suất → phần thưởng; gọi rõ tên Huyễn Tức khi Thế Thân tăng tỷ lệ. Tam Thủ Chiêu Hồn luôn hiện thưởng ×3, phạt tu vi ×3 và tự trừ 36 tu vi/ngày; phạm vi, ngoại lệ và ví dụ nằm trong phần mở rộng ngay dưới kỹ năng. [Bảng câu chữ hiện hành](LINH_THU_V2_PLAYER_COPY.md) đã được đối chiếu tự động với projection server của cả 18 loài.

Giao diện dùng cùng một trục T1–T4–95%–100%, gộp nhãn mốc, bỏ “Không đạt trong lượt này”, “Hoàn mỹ giữ cả Thức tỉnh” và nhãn “Tự động” lặp lại. Điều kiện luyện đầy T4 xuất hiện một lần; hạn mức thiên phú công việc vẫn hiển thị rõ. Không lặp tóm tắt ở thẻ năng lực; không hiện chuỗi ngủ/số công việc không liên quan hoặc thông báo chờ chốt của ngày còn đang diễn ra. Quy ước chung nằm trong một mục mở rộng; không gửi lặp các đoạn quy ước trong dữ liệu của 18 loài.

Kiểm chứng phạm vi sửa: 33/33 unit/domain/model/projection và 23/23 browser v2/roles/evolution PASS. Đã kiểm bố cục 18 loài ở 320/390/430/1024px, không tràn ngang, các mốc thẳng hàng, vùng bấm mở rộng ít nhất 44px; kiểm thao tác bàn phím và xem ảnh chụp giao diện sáng/tối. Ca thời điểm đổi ngày của preview từng timeout trong lượt kiểm tra rộng, đã chạy riêng lại và PASS. Typecheck backend/web, web syntax, ESLint, Prettier, staging readiness/dry-run PASS. Benchmark 96 phép đo với 24/2400 cá thể PASS, tối đa 49 queries và 38.634 bytes, giữ nguyên cổng dưới 40.000 bytes.

Kiểm tra HTTP mô phỏng iPhone sau deploy: HTML, model v2, view Linh thú và CSS trả 200, hash khớp local; API chưa đăng nhập trả 401. Không chạy migration, không sửa dữ liệu tài khoản hoặc luật thưởng. Không dùng smoke HTTP này thay cho kiểm tra thưởng bằng tài khoản thật.

Toàn bộ `npm test`: 462/465 PASS, 3 FAIL, không bỏ qua test. Ba ca lỗi nằm trong `tests/integration/habit-tickets-and-draw.test.ts` chưa cố định fixture trước cutover: chúng khởi tạo tài khoản mới dùng v2 nhưng còn kiểm tra số truy vấn, nhật ký draw và tuyệt kỹ chủ động của v1. Chạy riêng tệp này xác nhận 8 PASS / 3 FAIL. Chưa sửa bộ fixture đó trong đợt câu chữ/UI; không coi toàn bộ test suite là đã PASS. Kết quả tập trung ở trên và benchmark v2 vẫn PASS.

Ảnh kiểm tra: `trial-results/linh-thu/v2/run-14784/`. Log phát hành, kiểm thử, benchmark và HTTP: `.wrangler/linh-thu-v2-audit/copy-*`; chạy riêng lỗi fixture: `draw-recheck.log`, ca đổi ngày: `projection-boundary-recheck.log`.

## Bổ sung bảng năng lực trước giờ chuyển đổi — 22/10/2026

Theo duyệt của người dùng sau ảnh chụp Tiểu Thạch Quy, đã deploy version `f0b5142d-ac3e-497f-9576-c5268b3dfd2d`. Bảng “Toàn bộ năng lực” hiển thị bộ v2 đã chốt ngay khi đang chờ cutover, gồm Thạch Giáp hoàn tối đa5tuvi; có thông báo giờ/ngày áp dụng theo ngày sinh hoạt server và múi giờ Việt Nam. Thẻ năng lực đang hiệu lực vẫn mô tả luật của ngày hiện tại, không đổi runtime/cutover/thưởng.

Kiểm chứng:30/30 tests model/projection/browser v2/roles/evolution PASS; typecheck backend/web, websyntax, ESLint tệp sửa, Prettier và staging dry-run PASS. Sau deploy, HTTP mô phỏng iPhone tải HTML và2module sửa trả200/hash khớp local. Screenshot local tái hiện trạng thái trước cutover: `trial-results/linh-thu/v2/run-17344/pending-turtle-390.png`. Log `.wrangler/linh-thu-v2-audit/roadmap-preview-*`. Không có migration hoặc sửa dữ liệu tài khoản trong bản bổ sung này.

## Lần phát hành ban đầu

Đã triển khai theo yêu cầu người dùng ngày **22/10/2026**, lúc **14:51 Asia/Saigon**.

- Ứng dụng: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/
- Worker: `personal-assistant-staging`; DB: `assistant-staging`.
- Version đang phục vụ100%: `0ceeb93d-45fd-402b-b2bf-17a735cf622a`.
- Version trước: `a7907474-cc07-443b-ab69-a08cb97a1606`.
- Remote trước phát hành đã có0001–0044; áp dụng mới duy nhất `0045_linh_thu_v2.sql` thành công.

## Kiểm chứng

Staging readiness/dry-run PASS. Đã export backup mới, lưu bookmark Time Travel và diễn tập0045 trên bản sao backup: integrity OK, không vi phạm FK,112bảng dữ liệu cũ giữ nguyên, thêm4bảng v2. Không reset dữ liệu.

Sau phát hành: remote listing xác nhận version trên phục vụ100%; schema có4bảng v2, FK check không có lỗi. GET `/app/` và3module v2/cultivation/linh-thu trả200, hash khớp source local; API chưa đăng nhập trả401. Chưa thực hiện mutation có đăng nhập thay người dùng; các kiểm tra này không thay nghiệm thu tài khoản thật.

Log/backup riêng tư nằm trong `.wrangler/linh-thu-v2-release-20261022-145035/`. Không đưa SQL backup, credentials hoặc liên kết tải backup vào Git. Không rollback code v1 đơn thuần sau khi đã có writes v2; xem hướng dẫn phục hồi trong [vận hành v2](LINH_THU_V2_OPERATIONS.md).

## Bắt đầu test

Mở link ứng dụng, đăng nhập rồi vào Linh thú. Tài khoản Linh thú đã tồn tại giữ luật v1 cho ngày sinh hoạt hiện tại; lần quan sát đầu ghi cutover sang ngày sinh hoạt kế tiếp. Tài khoản mới dùng v2 ngay ngày khởi tạo. Không ép cutover hoặc cấp tài nguyên thử vào tài khoản thật trong đợt deploy này.

Các ghi chú “chưa deploy” trong hồ sơ nghiệm thu local phản ánh thời điểm trước lần phát hành này. Hồ sơ này là cập nhật trạng thái staging mới hơn; không sửa kết quả kiểm thử local thành tuyên bố đã kiểm mọi luồng remote.
