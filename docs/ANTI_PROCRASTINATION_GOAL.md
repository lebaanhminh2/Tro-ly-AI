# Lệnh goal triển khai Phá trì hoãn qua đêm

Ngày lập: **16/11/2026**. **Tệp này chỉ lưu lệnh; chưa khởi chạy goal, sửa runtime hoặc deploy.**

Mở đúng workspace `D:\Code\troLyAI\Tro-ly-AI` và gửi nguyên khối dưới. Kế hoạch đầy đủ: [ANTI_PROCRASTINATION_IMPLEMENTATION.md](ANTI_PROCRASTINATION_IMPLEMENTATION.md). Người dùng đã chọn đích bàn giao staging trong hội thoại; khối lệnh có quyền sửa code và phát hành staging để tránh phải xin duyệt giữa đêm.

Khối lệnh không đặt ngân sách token hoặc thời gian kết thúc tùy ý. Goal theo định nghĩa hoàn thành và bằng chứng; quyền hệ thống/hạn mức thực tế vẫn áp dụng. Đây không phải cam kết hoàn tất trong một số giờ cố định.

```text
/goal Hoàn tất tính năng Phá trì hoãn trong Habit tại D:\Code\troLyAI\Tro-ly-AI, triển khai lên staging hiện tại và tự kiểm chứng đến khi sẵn sàng để tôi chỉ mở app test thành phẩm.

Đọc docs/ANTI_PROCRASTINATION_IMPLEMENTATION.md và toàn bộ bộ bàn giao docs/prototypes/anti-procrastination/ trước khi làm. HTML index.html trong bộ đó là nguồn chuẩn đã duyệt, SHA-256 5a406bd64347177f5094858414302739a846b6cc48473f12e7da174fa56bfe6f. Giữ nguyên nguồn/ảnh/GIF chuẩn; tái sử dụng CSS, SVG và bộ vẽ để thành phẩm khớp demo, không thiết kế lại hoặc sửa reference cho test đạt.

Tôi xác nhận trước việc sửa/tạo/tái cấu trúc code, SQL migration mới, test và tài liệu liên quan theo phạm vi tệp ở mục 5 của kế hoạch, kể cả điểm gọi liên quan phát hiện thêm. Đây là ngoại lệ rõ ràng cho yêu cầu hỏi xác nhận mỗi lần sửa code trong AGENTS.md, chỉ trong goal này. Công bố phạm vi rồi triển khai; tự quyết lựa chọn kỹ thuật hợp lý, ghi căn cứ và kiểm chứng, không dừng chờ tôi duyệt từng bước hoặc làm QA hộ. Bảo toàn thay đổi và dữ liệu sẵn có; không reset/clean hoặc format toàn repo.

Tôi cho phép kiểm tra đích, backup mới, diễn tập migration trên bản sao, áp additive migration đã kiểm vào đúng DB assistant-staging và deploy đúng Worker personal-assistant-staging theo config được xác minh. Chỉ phát hành sau khi gates local đạt và backup/rehearsal có bằng chứng. Không deploy production, sửa migration lịch sử, reset DB, đổi secrets/webhook/cron, gửi tin nhắn, tạo thưởng hoặc ghi thử vào dữ liệu người dùng. Không tự commit/push.

Giữ đúng hợp đồng: giữ liên tục 3000 ms, đếm 1–2–3; sao băng xanh lao tới, chuyển vàng/tách mảnh, vút qua rồi mở đồng hồ 300000 ms. Hết giờ phải tự xác nhận đã làm mới thưởng. Mỗi occurrence hợp lệ +1 tu vi và +1 vé quay thường, không cap ngày; không thưởng trùng, không áp bonus Habit/Linh thú. Giữ luồng tự làm ngoài app, lựa chọn truy cập một chạm, bàn phím và reduced motion. Hủy qua ba chấm có xác nhận, không thưởng, không hồi sinh khi reload/retry. Không yêu cầu chọn việc; không làm thay đổi Habit, Tháp hoặc hệ khác. Không mang tooling DEMO vào runtime.

Triển khai xuyên suốt frontend → auth/API → D1/receipt → ví thật. Thời gian/quyền nhận thưởng do server quyết định; completed/canceled, hai khoản thưởng và receipt phải atomic, chống race/retry/đổi request id. Xử lý cả start/claim/cancel mất phản hồi, response cũ, logout và hai tab. Tích hợp lifecycle để refresh/rerender không cắt giữ hoặc animation; dọn listener/rAF/canvas khi unmount, tick đồng hồ không render toàn app.

Tự kiểm theo toàn bộ ma trận trong kế hoạch: unit, integration/API/D1 thật, browser input chuột/touch/Space/Enter, visual parity, E2E UI→Worker→D1 thật, ít nhất một lượt 5 phút thời gian thực, migration preservation, hồi quy và các gates package/build. Browser fixture không thay bằng chứng backend. Chụp cả demo và app cùng điều kiện/mốc animation; mở xem ảnh/video, đo geometry và diff theo ngưỡng đã khóa. Kiểm cả sáng/tối, 320–1440 px, lỗi mạng, hủy, reload và reduced motion. Không hạ assertion, skip ca bắt buộc, nâng ngưỡng ảnh hoặc sửa nguồn chốt để che lỗi.

Ghi baseline trước khi sửa; duy trì docs/ANTI_PROCRASTINATION_PROGRESS.md và docs/ANTI_PROCRASTINATION_VERIFICATION.md với quyết định, việc còn lại, lệnh/exit code/pass-fail-skip, ma trận bằng chứng và deployment metadata. Artifact mới để trial-results/anti-procrastination/implementation/<run-id>/; không ghi đè tư liệu cũ. Sau rút gọn context, đọc checkpoint rồi tiếp tục. Tự review diff, sửa lỗi và chạy lại phần cần thiết đến khi đủ định nghĩa hoàn thành; không dừng ở kế hoạch, demo riêng, backend rời hoặc UI chưa nối dữ liệu.

Cuối goal bàn giao URL staging và version đã phát hành, kết quả test thực chạy, liên kết bằng chứng, giới hạn thực tế và vài thao tác để tôi test thành phẩm. Thiếu quyền hệ thống/credentials/hạn mức thì hoàn tất phần độc lập và ghi rõ phần chưa đạt; không giả PASS/deploy hoặc báo goal complete khi đích chưa đạt. Bắt đầu thực hiện ngay sau khi nhận lệnh này.
```

## Nguồn để tiếp tục ở phiên mới

- [Kế hoạch triển khai, ma trận nghiệm thu và quy trình staging](ANTI_PROCRASTINATION_IMPLEMENTATION.md).
- [Thiết kế và hành vi đã chốt](prototypes/anti-procrastination/README.md).
- [HTML chuẩn chạy được](prototypes/anti-procrastination/index.html).
- [Hash/tư liệu đối chiếu](prototypes/anti-procrastination/reference/manifest.json).
- Progress/verification của implementation sẽ được tạo khi thực hiện; không lấy kiểm chứng demo làm kiểm chứng app.

Cú pháp goal được đối chiếu với [Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex). Lệnh này dành cho Codex có hỗ trợ Goals. Tài liệu local không tự cấp quyền sửa code; khi người dùng gửi nguyên khối, phần xác nhận trở thành chỉ dẫn trực tiếp cho phạm vi goal đó.
