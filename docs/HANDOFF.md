# Tiếp tục từ đây

Cập nhật 2026-09-12. Đọc file này trước; chỉ mở tài liệu liên quan.

## Trạng thái hiện tại

- User đã thử staging và xác nhận trải nghiệm chưa giải quyết pain point: nhắc sai đối tượng, thiếu chủ động, overview dài và persona cứng.
- Nguyên nhân chính là context/memory chưa đủ, tool không khớp nghiệp vụ và giới hạn một write/turn; không quy toàn bộ lỗi cho Gemini free.
- Đã chốt giữ Gemini free, Telegram + Cloudflare Worker + D1 + cron/outbox; không thêm provider trả phí.
- Đã chốt bỏ Google Calendar integration, vẫn giữ task/event/reminder/lịch nội bộ.
- Đã chốt Gemini nhận context + câu hiện tại và tự chọn chat, hỏi, đọc hoặc nhiều action backend.
- Kiến trúc đích ưu tiên một Gemini request/turn; tối đa hai khi cần read ngoài snapshot. Không model loop dài.
- Dữ liệu công việc không nhạy cảm; giảm policy/privacy ceremony nhưng vẫn giữ auth, secret, schema, idempotency và transaction.
- Kế hoạch mới ở [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md). Yêu cầu sản phẩm ở [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md).

## Source và cloud

- Source/staging vẫn là native Gemini tool runtime cũ: tối đa 3 model call, 2 read, 1 write; reminder gắn task; Google code còn nhưng Calendar off.
- Chưa triển khai kiến trúc one-call, context summary, event/reminder độc lập hoặc proactive planner mới.
- Không sửa migration 0001–0010 đã áp. Thay schema phải dùng migration mới.
- Worker staging, D1, Telegram secret và Gemini secret đang tồn tại; không tự deploy, tăng quota, bật paid fallback hoặc xóa dữ liệu.

## Việc tiếp theo

Trước thay source, đọc plan mới và lập dependency map chính xác: file giữ/sửa/xóa, migration mới, test cần thay. Trình phạm vi đó cho user và chờ duyệt theo `AGENTS.md`; không bắt đầu vá từng lỗi riêng.

Sau duyệt, làm theo một đợt có checkpoint sử dụng được: bỏ Google/dead UI → data/context → one-call actions → exact reminder → proactive loop/overview → pilot thật.

## Git và vận hành

- Nhánh hiện tại `review/p1-p3`, PR #1; không merge/force-push.
- Chỉ stage file trong phạm vi, kiểm diff/secrets rồi commit/push khi có thay đổi.
- Không in `.env`, `.dev.vars`, token, key, URL chứa token hoặc raw provider error.
- Kiểm thử/deploy/secrets/recovery xem [OPERATIONS.md](OPERATIONS.md).
