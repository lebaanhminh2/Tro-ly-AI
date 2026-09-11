# Tiếp tục dự án từ đây

Cập nhật: 2026-09-11. Trạng thái công việc, không phải đặc tả đã duyệt.

## Quyền và cách làm

- **Trình bày file/thay đổi và chờ xác nhận trước khi tạo, sửa, xóa hoặc format mã nguồn.** Đồng ý nghiên cứu không phải duyệt code.
- Người dùng cho phép cập nhật tài liệu giữ context; muốn ra sản phẩm nhanh, không hỏi lại điều đã biết.
- Không tự bật billing, deploy, kết nối Calendar hoặc gửi dữ liệu thật tới AI. Không yêu cầu dán khóa/token/mật khẩu vào chat.
- Đọc theo [mục lục](README.md), không nạp toàn bộ docs mặc định.

## Hiện trạng

- Đã triển khai Worker webhook Telegram + SQL/D1 local, task/proposal/nút đổi hạn, chat adapter mock. Chưa deploy/kết nối Telegram thật/Calendar. Xem [LOCAL_BOT.md](LOCAL_BOT.md).
- Hướng đề xuất: Workers + D1 + Cron; ứng viên AI: Gemini 3.5 Flash Lite. Đã gọi API thành công một lượt T07 bằng dữ liệu giả.
- Người dùng vừa gửi spec mục 0–107, nói rõ chưa chốt/chưa đọc hết. Phần bổ sung và lỗi thiết kế được lưu trong [DESIGN_CANDIDATES.md](DESIGN_CANDIDATES.md), không nâng thành yêu cầu được duyệt.
- Quota từ ảnh và rủi ro dữ liệu Gemini nằm ở [DECISIONS.md](DECISIONS.md). Không tiếp tục vòng qua Cockpit nếu không được yêu cầu.
- Hiện 50 tests pass, typecheck/migration 0002 local/Workers dry-run pass. Outbox + callback ack + retry 429 hữu hạn + recovery bảo thủ đã có; mặc định preview, chưa token/live/Cron. Audit 0 sau overrides sharp/undici; xem LOCAL_BOT.
- Live: T07 prompt 0.1 và 6 ca prompt 0.2 đã dùng đủ ngân sách 7/7. Sáu ca mới đều JSON hợp lệ, 5.206 token, trung bình 1.224 ms; T01/T03/T08 fail nghiệp vụ, T06 partial, T10/T12 pass thủ công.

## Bước tiếp theo

Người dùng yêu cầu rà/cơ cấu tài liệu-test cũ và lưu Git mỗi turn. Cuối lượt có file thay đổi: commit cục bộ có chọn lọc và kiểm tra secrets, không empty commit; push chưa được chốt. Đang đề xuất tách thử nghiệm khỏi test sản phẩm; chưa duyệt di chuyển/sửa code. Remote được cung cấp: https://github.com/lebaanhminh2/Tro-ly-AI.git.

**Kế hoạch duyệt hiện tại:** [DELIVERY_PLAN.md](DELIVERY_PLAN.md), chi tiết DATA_DESIGN/UX_FLOWS/SECURITY_RELEASE/VIBE_WORKFLOW. Chờ duyệt P0 và các mặc định D1–D6; chưa được phép refactor/xóa code/deploy/API mới. ARCHITECTURE_PLAN cũ là tham khảo, không mở lại G1.

**Cập nhật mới nhất:** đã tự kiểm chứng và kết luận tại [MODEL_VERDICT.md](MODEL_VERDICT.md). Thêm 24 request (10 loại do harness encoding, 14 hợp lệ); tổng toàn dự án 31. Không gọi thêm mặc định. Gemini phù hợp có điều kiện cho trích xuất/chat ngắn, chưa đạt persona/tự chủ đầy đủ. Quay lại thiết kế dựa trên kết luận, không mở rộng prototype.

**Người dùng đã chốt điều chỉnh quy trình:** dừng code/API/deploy, quay lại thiết kế và kế hoạch trước. Quyết định này thay thế các đề xuất tiếp tục tích hợp/BotFather trong docs cũ.

1. Soạn bản kiến trúc và kế hoạch cô đọng: phạm vi MVP, tiêu chí hoàn thành, chọn công nghệ có lý do, dữ liệu/quyền/bảo mật, luồng UX và vận hành.
   Đã soạn [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md); chờ người dùng duyệt M0. Ngân sách và các cổng trong file là đề xuất, không phải quyền gọi API/code/deploy.
2. Workers + D1 và Gemini là ứng viên, không mặc định đã chốt vì có prototype. Phân loại mã dùng lại/thử nghiệm; không tự xóa hoặc viết lại.
3. Xác định rủi ro cần kiểm chứng, bộ hội thoại cố định và ngân sách trước khi thử; số test chương trình không chứng minh model phù hợp. Quyền riêng tư Gemini vẫn chưa giải quyết.
4. Người dùng duyệt kiến trúc/phạm vi từng mốc, rồi mới triển khai liên tục trong phạm vi đó. Không hỏi duyệt từng sửa nhỏ, không mở rộng âm thầm.
5. Tiết kiệm token: đọc theo nhiệm vụ, chỉ ghi quyết định/kết quả quan trọng, không tối ưu prompt vô hạn hoặc tạo thêm tài liệu trùng.

## Đọc theo nhiệm vụ

| Nhiệm vụ | Tài liệu |
| --- | --- |
| Người dùng, persona, nguyên tắc sản phẩm | [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) |
| Hạ tầng, quota, quyền riêng tư, hướng cũ | [DECISIONS.md](DECISIONS.md) |
| Scheduler/UX/schema từ spec chưa chốt | [DESIGN_CANDIDATES.md](DESIGN_CANDIDATES.md) |
| Cập nhật/tách tài liệu | [README.md](README.md) |
