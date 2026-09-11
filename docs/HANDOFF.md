# Tiếp tục dự án từ đây

Cập nhật: 2026-09-11. Phân biệt prototype, kế hoạch và sản phẩm đã triển khai.

## Quyền và quy trình

- Trình file/phạm vi và chờ xác nhận trước khi sửa, tạo, xóa hoặc format mã nguồn; làm liên tục trong phạm vi đã duyệt.
- Cuối lượt có thay đổi: kiểm tra staged diff/secrets và commit cục bộ có chọn lọc; không empty commit. Push chưa được người dùng chốt.
- Remote: https://github.com/lebaanhminh2/Tro-ly-AI.git. Checkpoint trước cơ cấu: `f37233c`.
- Không tự gọi API, bật billing, deploy hoặc đọc/in secrets. Đọc docs theo nhiệm vụ, không nạp hết mặc định.

## Trạng thái hiện tại

- Đã cơ cấu theo phê duyệt: code thử/memory/fixtures ở `experiments/ai-trial/`; unit ở `tests/unit/`, tích hợp D1 ở `tests/integration/`.
- `src/domain/time.ts` là nguồn hàm ngày dùng chung; runtime không import experiments/tests.
- P1 đã triển khai cấu trúc entrypoints/application/domain/ports/adapters/config và transaction command + task + outbox; xem [P1_ACCEPTANCE.md](P1_ACCEPTANCE.md).
- Không thêm chức năng sản phẩm hoặc gọi API trong đợt cơ cấu. Local bot vẫn là prototype, chưa deploy/Calendar thật.
- Live đã dừng: tổng 31 request toàn dự án, kết luận tại [MODEL_VERDICT.md](MODEL_VERDICT.md). Không mở lại chiến dịch cũ.
- Audit gần nhất trước cơ cấu: 0 với overrides sharp/undici; không coi là chứng nhận bảo mật.

## Bước tiếp theo

P2 người dùng đã duyệt với quy tắc **2 lượt mỗi lần hẹn, không trần theo ngày**. Đã triển khai local sessions/Today/nhắc/settings; bằng chứng và giới hạn tại [P2_ACCEPTANCE.md](P2_ACCEPTANCE.md). Không tự mở P3 hoặc gọi API/live.

1. P1 đã được người dùng duyệt và thực hiện local; ghi kết quả tại P1_ACCEPTANCE. Không tự suy đã duyệt D1–D6 toàn bộ.
2. Mốc tiếp theo P2 (Today/session/nhắc), trình phạm vi trước khi code. Không cấu hình BotFather hoặc deploy mặc định.
3. Dùng kết luận model đã có; giải quyết dữ liệu AI trước live cá nhân, không thử prompt vô hạn.

## Đọc theo nhu cầu

| Nhiệm vụ | Nguồn |
| --- | --- |
| Mốc, phạm vi và tiêu chí | [DELIVERY_PLAN.md](DELIVERY_PLAN.md) |
| Persona/người dùng | [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) |
| Module/database/nhớ | [DATA_DESIGN.md](DATA_DESIGN.md) |
| UI và luồng | [UX_FLOWS.md](UX_FLOWS.md) |
| Bảo mật/phát hành | [SECURITY_RELEASE.md](SECURITY_RELEASE.md) |
| Prompt giao việc | [VIBE_WORKFLOW.md](VIBE_WORKFLOW.md) |
| Prototype và cách chạy | [LOCAL_BOT.md](LOCAL_BOT.md) |
| Mục lục/nguồn lịch sử | [README.md](README.md) |
