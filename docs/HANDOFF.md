# Bàn giao dự án

Cập nhật 21/10/2026. Tài liệu này mô tả trạng thái mã nguồn và những điều cần biết để tiếp tục làm việc. Quy tắc sản phẩm ở [PRODUCT_BRIEF](PRODUCT_BRIEF.md), habit ở [HABITS](HABITS.md), Linh thú ở [đặc tả](LINH_THU_SPEC.md); cách chạy và vận hành ở [README](README.md), [OPERATIONS](OPERATIONS.md) và [vận hành Linh thú](LINH_THU_OPERATIONS.md).

## Thay đổi local trong đợt rà soát

Bộ sưu tập dùng bản tổng hợp toàn kho và phân trang riêng từng loài. Với fixture 2.400 cá thể/18 loài, mở atlas giảm từ 100 yêu cầu collection xuống 1; JSON trang cá thể giảm từ 519.603 xuống 5.056 byte, API chính thêm 4.328 byte tổng hợp. Mở loài chỉ dựng 24 thẻ đầu, tải thêm theo yêu cầu. Đây là số đo local, không phải cam kết độ trễ remote.

Đã dọn 66 tệp được duyệt, khoảng 39,6 MB: hai HTML mô phỏng Linh thú, hai module D1 chỉ còn được test dùng, bốn tài liệu checkpoint và ba bộ ảnh thử đã bị loại. Quy tắc còn hiệu lực được gộp vào đặc tả, vận hành, nghiệm thu và quyết định mỹ thuật. Phiên bản đã commit vẫn tra được từ lịch sử Git.

Đã tách `D1BeastReader` cho 16 truy vấn đọc và `linh-thu-maintenance.ts` cho hai job ghép ngày/chốt tuyệt kỹ. Store giữ bốn phương thức ghi/điều phối; phần chuẩn bị hiệu ứng dùng reader và trả statement cho giao dịch của luồng gọi. Đồ thị import thực thi từ Worker có 84 module, không còn cụm phụ thuộc vòng tám module trước đó. SQL, nội dung phương thức, receipt và thứ tự job giữ nguyên; 33 ca benchmark giữ nguyên số truy vấn và byte trả về. Đây là cải thiện ranh giới trách nhiệm, chưa phải bằng chứng giảm latency.

Mục lục, mô tả sản phẩm và vận hành đã khớp năm mục điều hướng, 42 migrations và cách chạy hiện tại. README experiments đã bỏ liên kết thiếu và sửa mô tả dependency kiểm thử.

Kết quả kiểm chứng và giới hạn nằm trong [hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md). Các thay đổi rà soát này chưa được commit/push hoặc deploy.

Lưu ý output sau suite đợt 3: 18 ảnh/báo cáo QA untracked có sẵn đã được test tạo lại; 1.771 tệp untracked còn lại và mọi tracked ngoài phạm vi duyệt giữ hash. Chưa có bản nội dung cũ để khôi phục 18 kết quả QA đó. Đợt 4 được duyệt đã chuyển nơi ghi ảnh/báo cáo của năm tệp browser sang `trial-results/linh-thu/<nhóm>/run-<PID>/`, tách từng tiến trình khỏi tư liệu output có sẵn.

Đã xóa tiếp đúng 185 tệp ảnh/video/bản tổng hợp review triệu hồi cũ, 29.709.257 byte. Giữ bản v22 còn được công cụ nghiệm thu local dùng, HTML v12 làm fixture kiểm thử, nguồn vẽ/prompt/font/giấy phép/tham chiếu và các tệp untracked có sẵn. README Stormlion v2 đã sửa trạng thái để phản ánh ba ảnh được tái sử dụng trong v3. Hồ sơ từng đợt ở `.wrangler/goal-audit-20261021/`; không thêm Markdown checkpoint mới vào cây source.

Kiểm chứng sau đợt 4: toàn bộ 84 bài browser chạy tuần tự đạt, không fail/skip/cancel; asset verifier, format baseline 111 tệp và diff whitespace đạt. Cả 1.839 tệp untracked có sẵn trước đợt 4 giữ hash; mọi tracked ngoài tám tệp sửa và 185 tệp xóa được duyệt giữ hash. Các kết quả browser mới nằm trong `trial-results/`, không tạo thêm tệp untracked. Kiểm 629 tệp văn bản không thấy tham chiếu tới ảnh/video đã xóa; toàn bộ liên kết Markdown local có đích tồn tại.

Tổng bốn đợt dọn: xóa 251 tệp cũ, 69.279.083 byte; Markdown tracked giảm từ 30 xuống 23. Ngoại lệ 18 bản QA bị tạo lại ở đợt 3 vẫn được ghi rõ phía trên.

Đợt 5 tối ưu scheduler và đồng bộ thưởng: 25 vé được phục hồi trong một batch, giữ receipt từng task và guard số dư/version/trạng thái; mở thành tựu và đưa từng thông báo vào outbox cùng commit. Scheduler dùng lại kế hoạch vừa tự kích hoạt; lượt phục hồi inbox gửi phản hồi rồi hoãn bảo trì. Cách chạy và khả năng chờ khi inbox liên tục có lệnh ở [OPERATIONS](OPERATIONS.md). README nguồn Stormlion đã phản ánh ba ảnh được tái sử dụng trong v3, giữ nguyên provenance.

So cùng fixture trước/sau: scheduler có 25 vé tồn giảm 224 → 29 truy vấn; lịch sử đủ bảy thành tựu, không tồn vé giảm 51 → 33; tự lập kế hoạch kèm hai tin chờ giảm 51 → 44. Riêng đồng bộ 25 vé dùng tám truy vấn, toàn bộ thành tựu dùng năm. Với dữ liệu có bản ghi hoàn tất đầy đủ, 80 tổ hợp × năm lượt = 400 lượt scheduler đều ≤50 truy vấn; có ca chạm đúng 50, không khẳng định mọi tải thực tế còn dư ngân sách. Chẩn đoán SQLite và transport giả lập ở `.wrangler/goal-audit-20261021/batch5-scheduler-results.json`; không suy thành CPU Worker hoặc latency remote.

Chưa đo latency remote hoặc nghiệm thu iPhone/Telegram thật; hai ca browser từng dao động trong baseline chưa được chứng minh đã sửa nguyên nhân. Browser gần nhất đạt 84/84 ở đợt 4; đợt 5 không đổi frontend và không chạy lại suite browser.

Kiểm chứng đợt 5: backend 363/363 và experiments 25/25 đạt, không fail/skip/cancel; typecheck backend/frontend, lint, format baseline 111 tệp và hai build dry-run đạt. Worker dry-run 623,84 KiB / gzip 140,18 KiB, 512 assets. Chỉ chín tệp được duyệt thay đổi; cả 1.839 tệp untracked có sẵn giữ hash, không sinh untracked mới. Các liên kết Markdown local đều có đích tồn tại. Không đổi migration, commit/push hoặc deploy. Hồ sơ kết quả: `.wrangler/goal-audit-20261021/batch5-results.json`.

## Hành vi hiện hành cần giữ

- Task/bước nhỏ, habits, lịch/kế hoạch/focus/nhắc, ngủ/thức, điểm/check-in/vật phẩm/đột phá/thành tích, Telegram/AI/auth vẫn là các luồng nền. Tu luyện/Thần Lộ và chiến đấu cũ đã được gỡ; không dùng dữ liệu game lịch sử để chặn luồng nền.
- Linh thú có bốn tab: Đang luyện, Đồng hành, Bộ sưu tập, Triệu hồi. Lò đan là nút tiêu đề; Tháp giao ước nằm ở Habit. Không lặp danh sách ghi habit trong Linh thú.
- Đang luyện/Đồng hành dùng hero ở giữa, tên/trạng thái phía trên; bố cục và năng lực theo vai trò. Nền sáng trắng ngà `#f8f7f4`, tối `#252625`; các nền than/xám trước đó đã bị thay thế.
- Chọn vai trò mới hiển thị ngay sau xác nhận server, kèm nhãn ngày mai. Vai trò có hiệu lực hôm nay vẫn do server quyết định; vẫn truy cập được đúng đồng hành và tuyệt kỹ hôm nay. Refresh/qua ngày không làm phản hồi cũ chiếm sheet mới.
- Tiến hóa và triệu hồi lưu kết quả trước trình diễn. Bỏ qua/xem lại/đóng không hoàn tác hoặc sinh giao dịch mới; mất phản hồi phải phục hồi cùng receipt. Hiệu ứng không có âm thanh và tôn trọng giảm chuyển động.
- Triệu hồi v12 dùng một mở đầu cho ×10 rồi chuyển từng cá thể; tháp giữ phiên ở server. Bản demo chỉ là tư liệu, không cấp quyền điều khiển ví thật.
- Telegram/Gemini dùng chung thời gian còn lại của owner lease, gọi model tối đa 20 giây và chừa 5 giây cho commit; không bắt đầu bước mới khi còn dưới 1 giây, không tự retry hoặc thực hiện tool từ kết quả đến muộn. Log vận hành chỉ có nhãn/mã và số đo, không ghi nội dung chat hoặc khóa provider.

## Phát hành lịch sử và môi trường thật

[Hồ sơ Linh thú 19/10](LINH_THU_RELEASE.md) là lần phát hành đầu với migration 0041, không đại diện phiên bản mới nhất. Mã nguồn hiện có migrations đến 0042; không sửa migration lịch sử khi dọn code.

HANDOFF trước đợt dọn ghi lần phát hành gần nhất ngày 21/10 là version `10691f60-1a5f-4d6c-82f4-c34f45105fb8` cho nền trắng ngà. Đây là trạng thái đã ghi nhận, chưa đối chiếu lại remote trong đợt rà soát. Hồ sơ `output/linh-thu-ivory-20261021/POST_DEPLOY.json` đã được Git theo dõi.

Ứng dụng staging: <https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/>. Kiểm GET/auth và hash assets trong các đợt phát hành trước không chứng minh luồng mutation có đăng nhập, độ trễ chat thực tế hoặc hiệu năng D1 remote. Kiểm Chromium local chưa thay nghiệm thu trực tiếp trên iPhone/Telegram.

Một lần cấp vé riêng trong release triệu hồi 21/10 không phải cơ chế quà mặc định cho tài khoản mới. Không cấp lại khi chạy test hoặc khởi tạo hệ thống.

## Bảo toàn và tiếp tục bảo trì

- Theo AGENTS.md người dùng cung cấp: trình bày file/thay đổi và chờ xác nhận rõ ràng trước khi sửa, tạo, xóa, đổi tên hoặc định dạng code. Quyền deploy/push của đợt cũ không áp dụng cho đợt rà soát này.
- Bảo toàn tệp chưa commit, output chưa được Git theo dõi, secrets, local state, SQL/SQLite và backup. Không reset/clean, tự chạy migration remote hoặc gửi Telegram để QA.
- Nguồn ảnh hiện hành, raw/prompt được tái sử dụng và 72 tham chiếu có vai trò tái lập/đối chiếu; không xóa theo tên “output”. [Manifest và quy trình assets](assets/linh-thu/art/README.md) xác định nguồn còn dùng.
- Các store trong `src/adapters/d1/` là mã ứng dụng; chỉ loại bỏ sau khi đối chiếu imports, entrypoints, tests và giao dịch. Các benchmark habit/Linh thú đang phục vụ kiểm hiệu năng.
- Output đã commit trước đây có thể tra ở `104b4ae3e98fb704e50d94121278af9b00dcbc94`; bản playground lịch sử ở `e5a72c9442bdf71f453fdda50205a20a078ae420`. Xóa trong commit mới không làm nhỏ lịch sử Git; không viết lại lịch sử trong đợt này.
- Checkpoint cleanup 18/10: `.wrangler/cleanup-checkpoint-20261018-956b03c.zip`, manifest cùng tên JSON; log ở `.wrangler/cleanup-validation-20261018-956b03c/`. Khôi phục từng file ra thư mục riêng, kiểm hash/review trước khi thay; không giải nén đè toàn kho. Backup DB và quy trình phục hồi theo OPERATIONS.
- Khi sửa thêm, kiểm cả import thực thi và giao dịch; không chia module chỉ theo kích thước. Các tệp output còn lại cần phân biệt nguồn tái lập, fixture và ảnh review lịch sử trước khi đề xuất dọn tiếp.
