# Bàn giao đợt dọn dự án

## Linh thú ở trung tâm và phát hành staging — 21/10/2026

Người dùng cho phép sửa các file cần thiết, deploy staging rồi đẩy toàn bộ mã nguồn hiện có lên GitHub; không cần hỏi lại theo từng file. Hai tab Đang luyện và Đồng hành dùng cùng bố cục: tên/hạng/trạng thái ở trên, ảnh chính giữa, Chi tiết và Đổi linh thú cùng hàng bên dưới. Tab luyện đặt hành trình và Dấu ấn nỗ lực/nút tiến hóa trước năng lực; tab đồng hành hiển thị năng lực ngay sau hero. Giữ thông báo lựa chọn có hiệu lực từ ngày mai và truy cập đúng cá thể đang hỗ trợ hôm nay. Playground đã cập nhật cùng mã ứng dụng.

Hiệu ứng tiến hóa dùng khối khí gần bằng linh thú, hút khí/đá vụn từ xung quanh, co thành lõi sáng, ghìm 100 ms rồi bung sáng để hiện dạng mới. Không có âm thanh. Sửa chiều cao tối thiểu của dialog để tránh CSS hộp thoại chung làm mất màn tiến hóa trên desktop.

Đã phát hành staging version `ba25782a-32e5-40fe-b596-6a60ea2a1ffc`, nhận 100% lưu lượng; migration 0042 đã áp và không còn migration chờ. Toàn bộ 353 backend + 25 experiment + 83 browser tests đạt (461 tests, không fail/skip). Typecheck, typecheck:web, check:web (43 modules), lint, format baseline, asset gate và staging dry-run đạt. Kiểm bố cục 320/390/1440px xác nhận ảnh ở tâm, nút ít nhất 44px; pending role ở 320px, nền tối và chữ 200% không chồng thông tin. Backup và diễn tập 0042 giữ nguyên dữ liệu cũ trong 111 bảng, integrity/FK đạt.

Kiểm sau deploy: 409/409 tài nguyên web khớp hash local, API yêu cầu đăng nhập trả 401, GET Telegram trả 405. Trang đăng nhập staging mở được ở 390/1440px, không lỗi JS hoặc tràn ngang. [Mở app](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/) · [Hồ sơ phát hành](../output/linh-thu-centered-release-20261021/STAGING_RELEASE.json). Ảnh bố cục trong thư mục hồ sơ dùng fixture local; chưa thử trên điện thoại thật hoặc thao tác vào tài khoản đã đăng nhập. Backup SQL và log riêng ở `.wrangler/linh-thu-centered-release-20261021/`.

## Tối ưu độ trễ chatbot Telegram — 21/10/2026

Đã phát hành staging version `8d3ef3ef-f589-4eb8-beef-092b8f448467`, 100% traffic, theo phạm vi người dùng duyệt. Chuẩn bị context, hierarchy và lịch chạy song song; trạng thái nghỉ/ngủ lấy bằng một truy vấn, không cache. Chat thường bỏ `summary_request` và truy vấn transcript dư, giữ summary đã lưu, lịch sử gần đây, mã task/step, habit và trạng thái ngủ; luồng hành động vẫn được bảo trì summary. Giữ hạn gọi model tối đa 20 giây trong thời gian owner lease còn sống, chừa 5 giây cho commit và không tự retry.

Thêm log thời gian chuẩn bị webhook/context, model, flush phản hồi và toàn lượt; chỉ ghi số liệu vận hành, không ghi nội dung chat, khóa hoặc định danh tài khoản. Thời gian flush không tự chứng minh Telegram đã nhận; cần đối chiếu outbox khi kiểm tra lượt thật. Hai lượt Telegram trước sửa mất khoảng 28–30 giây, trong đó khoảng 8,3–8,8 giây trước model journal; một lượt timeout. So sánh local với độ trễ DB giả lập 20 ms/lần cho phần chuẩn bị: 48 → 43 lượt DB, khoảng 832–857 → 333–345 ms. Đây là mô phỏng, không phải tốc độ Telegram sau phát hành.

341 unit/integration tests đạt, không fail/cancel/skip; TypeScript, lint, format baseline 109 file và staging dry-run đạt. Đã cập nhật điểm chèn báo ngủ trong `rest-notifications.test.ts` theo phê duyệt bổ sung, giữ nguyên mọi assertion chặn lời nhắc. Lần chạy tổng đầu có một test chưa kích hoạt được tình huống vì bám SQL cũ; lần cuối chạy lại toàn bộ đã đạt. Đúng 8 file code được duyệt thay đổi; toàn bộ 407 file web giữ nguyên hash, không upload asset, migration, đổi khóa hoặc sửa thủ công dữ liệu tài khoản.

Sau deploy, app và ba tài nguyên đại diện trả 200 và khớp local; Telegram giữ GET 405/POST thiếu secret 403, API thiếu auth 401. Chưa gửi tin Telegram thật hoặc đo lượt chat có đăng nhập sau bản này; cần người dùng nhắn một tin mới để kiểm chứng. [Hồ sơ phát hành](../output/telegram-chat-latency-20261021/STAGING_RELEASE.json), [kiểm thử](../output/telegram-chat-latency-20261021/VERIFICATION.json). Rollback code: `660a21a1-99eb-4c26-ad21-c6f4bc80f477`; backup nguồn và metadata riêng tại `.wrangler/telegram-chat-latency-20261021/`.

## Sửa hội thoại Telegram / Gemini — 21/10/2026

Đã phát hành staging version `660a21a1-99eb-4c26-ad21-c6f4bc80f477`, 100% traffic. Lần gọi Gemini chờ tối đa 20 giây thay cho 8 giây; mọi bước AI dùng chung thời gian còn lại của owner lease đang sống và chừa 5 giây cho journal/commit. Khi còn dưới 1 giây thì không bắt đầu gọi mới; kết quả đến muộn bị loại trước khi thực hiện tool. Không tự retry model, giữ dedupe/receipt và cấu hình quota hiện hành.

Phân biệt timeout, lỗi mạng, quyền truy cập 401/403, cấu hình/yêu cầu 4xx, gián đoạn Google 5xx, chuyển hướng và phản hồi không hợp lệ. Journal chỉ lưu mã định sẵn hoặc mã HTTP ba chữ số, không lưu lỗi thô/khóa của provider; thông báo bot giải thích đúng nhóm lỗi. Lỗi cũ `STEP_UNAVAILABLE` không thể truy ngược mã gốc.

Đã kiểm tra 336 unit/integration tests (không fail/skip; bao gồm 44 kiểm tra liên quan), TypeScript, lint, format baseline và staging dry-run. Có hồi quy phản hồi chậm hơn 8 giây, hạn chung nhiều bước, chặn ghi từ phản hồi đến muộn, lỗi provider được lưu/phản hồi đúng và replay không gọi lại AI. Adapter mới gọi Gemini thật bằng tin nhắn giả/khóa local thành công trong khoảng 6,3 giây. Không gửi tin vào Telegram thật hoặc sửa dữ liệu tài khoản.

Sau deploy, bốn tài nguyên đại diện khớp local; app trả 200, Telegram giữ GET 405/POST thiếu secret 403, API thiếu auth 401. 407 tài nguyên web giữ nguyên hash local; không upload asset, migration hay repair DB. Chưa kiểm chứng lượt chat Telegram có đăng nhập sau phát hành; người dùng cần gửi một tin mới. [Hồ sơ phát hành](../output/telegram-chat-fix-20261021/STAGING_RELEASE.json). Rollback code: version `66dc7824-5b0e-4dcf-a720-b14d9021b5b8`; backup bảy file ở `.wrangler/telegram-chat-fix-20261021/`.

## Sửa focus triệu hồi và phát hành role UI — 21/10/2026

Đã deploy staging theo yêu cầu người dùng, version `66dc7824-5b0e-4dcf-a720-b14d9021b5b8`, 100% traffic. [Mở app](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/). Bản này gồm toàn bộ thay đổi Đang luyện / Đồng hành bên dưới và sửa khung tím quanh nút × khi mở triệu hồi: hộp thoại nhận focus ban đầu, lúc xem lại và vào tổng kết; nút đóng vẫn có viền focus khi chủ động điều hướng bằng Tab. Giữ Escape, focus trả về nút triệu hồi và luồng ×1/×10.

Sửa thêm `web/ui/beast-reveal.js`, một regression trong `tests/browser/linh-thu-reveal.test.mjs` và mục bàn giao này. 31 browser tests liên quan đạt, không fail/skip; typecheck:web, check:web, lint/format phạm vi sửa, staging readiness và dry-run đạt. Upload đúng 5 assets: model/view/feature Linh thú, CSS và reveal controller; cả 407 assets sau deploy khớp hash local. Trang đăng nhập staging mở được ở 390/1440px, không tràn hoặc lỗi JavaScript; bốn API vẫn trả 401 khi chưa đăng nhập. Không chạy triệu hồi hay đổi role trên tài khoản thật, không ghi DB, migration hoặc cấp thêm vé. Chưa kiểm trực tiếp iPhone/Telegram.

[Hồ sơ phát hành](../output/linh-thu-roles-focus-release-20261021/STAGING_RELEASE.json), ảnh mở bằng bàn phím không còn khung tím ở `opening-keyboard.png` cùng thư mục; log và ảnh staging riêng tại `.wrangler/linh-thu-roles-focus-release-20261021/`. Version trước để hoàn tác: `3cf84923-3c63-472e-9c1d-2cb7c6bda04d`. Demo reveal gốc được giữ nguyên.

## Đang luyện / Đồng hành hiển thị lựa chọn mới — 21/10/2026

Đã triển khai trong đúng phạm vi 9 file người dùng duyệt. Khi server xác nhận chọn, linh thú mới xuất hiện ngay với ảnh, dạng và tiến độ của chính cá thể đó. Nhãn nhỏ ghi “Bắt đầu luyện từ ngày mai” / “Hỗ trợ từ ngày mai”. Nếu đang thay con có hiệu lực hôm nay, một dòng dưới ảnh dẫn tới đúng cá thể cũ; vẫn truy cập được tuyệt kỹ của đồng hành hôm nay. Việc luyện và hỗ trợ tiếp tục theo role hiện hành do server quyết định, không theo ảnh đang hiển thị.

Màn luyện giữ tiến độ, độ thuần và mốc tiến hóa tiếp theo; màn đồng hành chỉ hiện kỹ năng đã mở, dùng xác suất theo dạng đạt được. Bốn dạng, kỹ năng chưa mở và giải thích dài nằm trong “Chi tiết linh thú”. Picker đánh dấu lựa chọn chờ, có “Hủy thay đổi”, không gửi lại khi bấm đúng cá thể đã chọn; cảnh báo khóa lượt chỉ xuất hiện lúc xác nhận thay thú đang luyện. Giữ ảnh/tab/focus khi refresh và qua ngày sinh hoạt; bốn tab xuống dòng trên màn hẹp, không cắt nhãn hoặc hiện thanh cuộn thừa.

Đã kiểm tra 136 tests riêng biệt: 75 browser + 61 unit/integration, không fail/skip; bao gồm API thật và D1 tạm, toàn bộ 108 ảnh, triệu hồi, tháp, lò đan và ứng dụng nền. Có 8 tests mới cho role: chọn đầu tiên, phản hồi chậm, cá thể cùng loài, hủy, lỗi/khôi phục receipt, sheet mới mở trong khi chờ, qua ngày và mobile. Typecheck, typecheck:web, check:web, lint/format phạm vi sửa và build dry-run đạt. Ma trận giao diện 320/375/390/414/1440px, chữ 100/130/200%, sáng/tối; đã xem ảnh chụp Chromium. Chưa nghiệm thu trực tiếp trên iPhone/Telegram thật.

[Hồ sơ kiểm tra và ảnh](../output/linh-thu-roles-20261021/ACCEPTANCE.md). Bản local trong phiên làm việc: <http://127.0.0.1:58078/app/> → Linh thú; fixtures có sẵn hai lựa chọn chờ để thử đổi/hủy, không nối tài khoản thật. Thay đổi role đã được phát hành staging cùng bản sửa focus ở mục trên. Không thay API, database, luật game, demo reveal đã duyệt hoặc cấp thêm vé.

## Triệu hồi v12 trong app — staging, 21/10/2026

Đã tích hợp bản demo v12 người dùng duyệt vào ứng dụng thật và phát hành staging theo yêu cầu tiếp theo. Giữ sao băng, báo rank trước lật, thẻ vuông 5:7 viền xám 4 px và timeline khoảng 7 giây. ×10 chạy mở đầu một lần theo rank cao nhất của receipt; “Tiếp tục” chuyển từng cá thể theo rank; chạm nền chỉ hoàn tất hiệu ứng hiện tại; chữ “Bỏ qua” dưới nút next mới mở tổng kết. Replay/skip không sinh giao dịch. Không thêm âm thanh hoặc đổi luật game.

Renderer mới ở `web/ui/beast-reveal-motion.js`, điều khiển ở `web/ui/beast-reveal.js`; cập nhật reveal CSS và cleanup trong feature. Đối chiếu 28 mốc của bốn rank: hai Canvas khớp hash ảnh với demo gốc, hình học thẻ khớp. 128 tests liên quan đạt cùng typecheck, kiểm tra web, lint/format và build dry-run. Có kiểm tra chữ 130%, màn 320×568 đến desktop, resize giữa hiệu ứng, refresh/ẩn trang, lỗi ảnh/Canvas và focus. Đây là Chromium local; safe area/visibility được mô phỏng, chưa nghiệm thu iPhone/Telegram thật.

Chạy `node output/linh-thu-reveal-integration/serve.mjs`, mở <http://127.0.0.1:53010/> → ứng dụng dùng fixtures local → Linh thú → Triệu hồi. [Hồ sơ nghiệm thu và hoàn tác](../output/linh-thu-reveal-integration/ACCEPTANCE.md), [logs/hash](../output/linh-thu-reveal-integration/CHECKS.json). Kiểm lại đầy đủ bằng `node output/linh-thu-reveal-integration/verify.mjs`. Demo v12 gốc và các sửa ngoài phạm vi ban đầu được giữ nguyên; bản sao 7 file nguồn trước tác vụ nằm trong `baseline/` của hồ sơ.

**Đã deploy staging** `personal-assistant-staging`, version `3cf84923-3c63-472e-9c1d-2cb7c6bda04d`, nhận 100% traffic. [Mở app](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/). Chỉ upload 4 assets reveal; cả 407 tài nguyên web sau deploy khớp SHA256 local. Staging readiness/dry-run, guards 401 và browser đăng nhập 390/1440px đạt; không tự quay trên tài khoản thật, giữ vé cho người dùng thử.

Theo yêu cầu “cho tôi 1 vé quay free đầu tiên”, đã cấp **một lần +1 vé triệu hồi** vào tài khoản hiện hữu: 0 → 1, có biên nhận `admin:summon-welcome:20261021`; không tạo cơ chế tặng mặc định cho mọi tài khoản. Giữ nguyên pity, lò đan, số dư vé thường và các nội dung tài khoản khác. Đã backup DB trước cấp và diễn tập trên bản sao, kiểm tra cấp lặp bị chặn. Không migration, thay schema hoặc sửa code trong đợt phát hành này. [Bằng chứng phát hành đã loại thông tin riêng tư](../output/linh-thu-reveal-integration/STAGING_RELEASE.json). Backup, kế hoạch cấp và log riêng ở `.wrangler/linh-thu-reveal-release-20261021/`; không chia sẻ SQL hoặc token. Các bản staging bên dưới là lịch sử những đợt trước.

## Tháp giao ước trong app — 20/10/2026

Đã tích hợp demo được chốt vào app và deploy staging `personal-assistant-staging`, version `9ce50ffe-8bf5-4b9c-ac00-83f776032e5f`, 100% traffic. [Mở app](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/) → đăng nhập → **Thói quen → Tháp giao ước**. Demo gốc giữ nguyên SHA256 `0461ae1e644ad6de6ec4a34162c0c0509510ade84652b215784b04a79209d27c`.

Thẻ cam/chim ưng/đầu lâu dùng đúng SVG đã duyệt. Sheet có lật lá chọn, bảo hộ, mất quà chưa nhận và biên nhận vé/số dư từ server; nút nhận bên trái, lên tầng bên phải, một lần bấm. Runtime tách tại `web/ui/beast-tower.js` và `beast-tower-art.js`; thay đổi tích hợp/CSS ở `web/features/linh-thu.js`, `web/linh-thu.css`. Khôi phục chống ghi đè sheet khác và giữ biên nhận claim qua chuyển ngày. Luật, kết quả và ví vẫn do API thật quyết định.

Typecheck, typecheck:web, check:web, ESLint phạm vi sửa, staging:check đạt; 80 unit/integration + 33 browser tests liên quan đạt, không fail/skip. Chỉ upload 4 assets thuộc Tháp; 406 assets sau phát hành khớp local. Không sửa backend/schema hoặc dữ liệu thật. Kiểm thử ghi dữ liệu dùng fixtures và D1 tạm; smoke staging chỉ đọc, chưa thay kiểm tra trên thiết bị/phiên Telegram thật. [Hồ sơ nghiệm thu, file, logs và ảnh](../output/tower-implementation-20261020/ACCEPTANCE.md).

## Ghi nhớ cho lần dọn tiếp theo — 20/10/2026

Người dùng yêu cầu ghi nhớ các tệp phát sinh để rà soát sau, tránh dự án phình to. Đây là danh sách cần xem xét, chưa phải phê duyệt xóa:

- `output/`: đã sao lưu 682 tệp ảnh gốc, bản thiết kế thử, ảnh chụp kiểm tra, video hiệu ứng và tài liệu phụ lên GitHub trong commit `104b4ae3e98fb704e50d94121278af9b00dcbc94`, nhánh `review/p1-p3`. Khi dọn cần kiểm tra các liên kết từ tài liệu và script trước khi đề xuất bỏ các bản thử cũ hoặc thay đổi chỗ lưu. Ảnh runtime của ứng dụng nằm trong `web/assets/`.
- `scripts/linh-thu-playground/index.html`: toàn bộ demo FE nằm trong đúng một file, được sao lưu trong commit `e5a72c9442bdf71f453fdda50205a20a078ae420`. Chạy bằng cách mở HTML trực tiếp; dữ liệu giả và xử lý thao tác nằm trong trình duyệt. Không có server/database demo hoặc tích hợp demo trong cấu hình ứng dụng. File đọc ảnh có sẵn trong `web/assets/`. Có thể đề xuất xóa file này khi người dùng thử xong.
- `scripts/benchmark-habit-runtime.ts`, `scripts/benchmark-linh-thu.ts`, `scripts/benchmark-linh-thu-web.mjs`: rà soát còn dùng trong kiểm tra hiệu năng, CI hoặc quy trình vận hành hay không trước khi đề xuất giữ, gộp hoặc bỏ.
- Các store trong `src/adapters/d1/`, gồm `habit-store.ts`, `healthy-store.ts`, `session-store.ts`, `schedule-store.ts`, `task-hierarchy-store.ts` và `task-day-store.ts`, thuộc mã ứng dụng. Cần kiểm tra nơi sử dụng và chức năng thực tế khi dọn code; việc xuất hiện trong tab IDE không có nghĩa là tệp thừa.

Trước khi sửa, tạo, xóa hoặc định dạng tệp code: trình bày rõ danh sách đường dẫn và thay đổi dự kiến, chờ người dùng duyệt theo AGENTS.md. Lần ghi nhớ này chỉ cập nhật tài liệu; không dọn tệp, sửa code, thay schema/dữ liệu hoặc deploy. Việc xóa tệp ở commit mới vẫn giữ các phiên bản cũ trong lịch sử Git; giảm dung lượng lịch sử cần được xem xét riêng.

> Cập nhật19/10/2026: người dùng đã duyệt bản hiện tại và cho phép phát hành staging. Linh thú gồm luyện/đồng hành, triệu hồi, lò đan,18bộ kỹ năng, tháp bốn tầng trong Habit và108ảnh runtime đã phát hành;0041 đã áp. Version `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559` nhận100% lưu lượng, kiểm sau deploy đạt. [Mở staging](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/), [hồ sơ phát hành](LINH_THU_RELEASE.md), [ảnh](../output/imagegen/catalog-v3/index.html), [kiểm tra](LINH_THU_ACCEPTANCE.md) và [vận hành](LINH_THU_OPERATIONS.md). 95%/100% dùng tạm, sửa riêng sau. Phần dưới giữ lịch sử cleanup 18/10, không phải trạng thái Linh thú hiện hành.

Cập nhật 18/10/2026. Phạm vi được người dùng duyệt: bỏ Tu luyện/Thần Lộ, công pháp, luyện và chiến đấu; giữ sản phẩm nền. Bản cleanup đã được deploy lên staging theo yêu cầu tiếp theo của người dùng; người dùng cũng yêu cầu commit/push lên nhánh `review/p1-p3`.

## Trạng thái

Runtime đã bỏ routes/jobs/tools, stores/domain/game UI và assets riêng. Habit companion đổi tên, chỉ phục vụ habit. API game cũ trả 404 sau auth; model step cũ dừng an toàn trước action. Game account, battle, rank lock và receipts lịch sử vẫn trong DB nhưng không còn được dùng để chặn hoặc kết toán chức năng nền.

Giữ task/bước nhỏ, habits/history/report/export, lịch/kế hoạch/focus/nhắc, ngủ/thức, điểm/check-in/vật phẩm/đột phá/thành tích, Telegram/AI/auth và guards giao dịch. 38 migrations và dữ liệu local được bảo vệ. Không đổi luật điểm hoặc xây game thay thế.

Tài liệu còn 6 Markdown chính và prototype habit. Thông tin UX habit còn giá trị đã gộp vào [HABITS](HABITS.md); prototype giữ nguyên, không áp redesign mới. Các proposal/review/goal/game art hết hiệu lực được bỏ; lịch sử đã commit vẫn tra Git.

## Checkpoint và phạm vi

- Branch ban đầu: `review/p1-p3`, HEAD `956b03c34838a06a13e98f0362601d9f3fe2649c`.
- Backup: `.wrangler/cleanup-checkpoint-20261018-956b03c.zip` (418 file, 11.676.506 bytes).
- Manifest: `.wrangler/cleanup-checkpoint-20261018-956b03c.json`, chứa đường dẫn đã duyệt, hashes, Git status ban đầu và dữ liệu kiểm kê.
- ZIP SHA256: `2f32d91eb50a1d6134d8fb0fb90af1e5eadb4abdccb431999ddd0072b54c1cf8`.
- Đã bảo toàn bản sửa sẵn `docs/HABIT_GAME_UX_REVIEW.md` và toàn bộ 41 file untracked trong ZIP trước khi dọn; prototype habit tiếp tục được giữ trong working tree.

Khôi phục theo từng file từ ZIP vào thư mục riêng, kiểm hash rồi review diff trước thay thế. Không reset/clean hoặc giải nén đè cả kho. Backup là checkpoint local, không phải snapshot DB hoặc bản deploy. Hướng dẫn dữ liệu tại [OPERATIONS](OPERATIONS.md).

## Kiểm chứng

Baseline trước sửa: typecheck, check:web (47 modules), build dry-run, 378 main +25 experiments +44 browser đạt, không fail/skip. Browser baseline cần chạy ngoài sandbox Windows do lỗi GPU/CDP của Chrome trong sandbox.

Sau sửa: **246 main +25 experiments +25 browser đạt, 0 fail/skip**. Các tests game đã duyệt gỡ được loại theo tính năng; tests nền vẫn giữ. Có regression cho 13 endpoint game cũ (GET/POST), auth/Origin, rank lock cũ không chặn check-in/đột phá, journal replay hai tool đã nghỉ và đủ 12 tổ hợp cron không đọc/ghi bảng game.

Typecheck, check:web (33 modules), build dry-run local/staging và diff whitespace đạt. Worker 719,90→446,05 KiB (gzip 166,71→103,67 KiB). Bốn fixture benchmark habit 6/30×1095 ngày, backlog 7/365 ngày đạt; migration/restore trên DB tạm giữ legacy data và không dispatch. Đã xem ảnh habit, Hôm nay, Thành tích và cài đặt sau sửa; browser kiểm mobile/desktop, chữ lớn, sáng/tối, mất mạng và nháp.

Đối chiếu checkpoint: 183 file cần giữ +22 file state local khớp SHA256; 38 migrations và prototype habit nguyên vẹn. ZIP 418 mục khớp hash, chứa toàn bộ 41 file untracked ban đầu. Git diff chỉ nằm trong danh sách được duyệt, link tài liệu hợp lệ.

| Phần                                            | File trước → sau   |
| ----------------------------------------------- | ------------------ |
| Toàn dự án, không tính ignored/dependencies/Git | 586 →225           |
| src                                             | 106 →73            |
| web                                             | 222 →35            |
| tests                                           | 71 →46             |
| scripts                                         | 16 →5              |
| docs                                            | 112 →7             |
| experiments / migrations                        | 13 /38, giữ nguyên |

Đã bỏ 361 file dự án và 14 output simulation, tổng 83.139.123 bytes (79,29 MiB); simulation chiếm 69,11 MiB. Dung lượng file dự án từ 12.464.221 bytes xuống khoảng 1,68 MB. Checkpoint ZIP 11,14 MiB và artifact kiểm tra khoảng 20,7 MiB được giữ; không coi tổng tệp đã xóa là mức giải phóng ròng. .wrangler từ khoảng 1,614 GB còn 1,572 GB tại lần đo cuối; các browser profiles lớn vẫn còn.

Logs/build/ảnh ở `.wrangler/cleanup-validation-20261018-956b03c/`. Kết quả chỉ chứng minh local bằng fixtures, không thay nghiệm thu thiết bị thật hoặc owner API staging.

## Staging và giới hạn

Đã deploy `personal-assistant-staging` ngày 18/10/2026, version `4469dfad-7311-486c-b856-7c68e0fc12ad`, phục vụ 100% traffic. URL: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ . Version trước cleanup là `ef677def-9126-4af5-857b-39c3bcf6f103`.

Trước deploy, typecheck/check:web/staging dry-run và readiness gate đạt; remote không có migration chờ áp dụng. Không áp migration hoặc reset DB. Sau deploy, 35 assets khớp SHA256 local, 149 file đầu vào không đổi, 4 tab đúng, API thiếu auth trả 401 và assets game đã gỡ trả 404. Chưa kiểm mutation bằng phiên đăng nhập người dùng trên staging. Bằng chứng ở `.wrangler/cleanup-validation-20261018-956b03c/deploy-source.json`, `staging-deploy-verification.json` trong cùng thư mục và `logs/staging-deploy.log`.

Browser profiles/cache lớn trong .wrangler được giữ vì chưa đủ bằng chứng nguồn gốc/tình trạng đang dùng. Không dọn node_modules, secrets, state, SQL/SQLite backups hoặc thư mục ngoài workspace. Chỉ các simulation output đã kiểm kê và duyệt mới bị xóa.

Yêu cầu deploy và push của người dùng áp dụng cho bản cleanup này. Các thay đổi schema/dữ liệu hoặc phát hành tiếp theo tuân theo chỉ dẫn mới; không chạy lại goal game hoặc kế thừa quyền trong tài liệu cũ.
