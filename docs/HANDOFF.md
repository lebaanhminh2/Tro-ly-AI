# Tiếp tục từ đây

Cập nhật 2026-09-12. Đọc file này trước; chỉ mở tài liệu liên quan.

## Đã chốt

- Giữ Telegram + Cloudflare Worker + D1 + Gemini free + cron/outbox; không paid fallback.
- Bỏ Google Calendar integration, vẫn có task/event/reminder/lịch nội bộ.
- Gemini nhận context + câu hiện tại và có thể đồng thời trả lời, thực hiện nhiều action rõ, lưu pending và hỏi phần còn thiếu.
- Mặc định một Gemini request/turn; tối đa hai khi cần read ngoài Context Snapshot.
- Cho Gemini quyền hiểu ngữ nghĩa; backend chỉ giữ kiểm tra cấu trúc/an toàn rẻ nhưng bắt buộc.
- Yêu cầu/persona ở [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md); luồng đích ở [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md).

## Source hiện tại

- Staging vẫn chạy native tool loop cũ: tối đa 3 model call, 2 read, 1 write.
- Context chỉ có history ngắn, chưa có rolling summary/pending đầy đủ.
- Reminder buộc gắn task; chưa có event/reminder độc lập hoặc proactive planner hoàn chỉnh.
- Google code còn nhưng Calendar đang off.
- Migration 0001–0010 đã áp; không sửa lại.

## Tiếp theo

Lập dependency map chính xác và trình danh sách file giữ/sửa/xóa cho user. Chỉ sau khi được duyệt theo `AGENTS.md` mới thay source; không vá riêng từng lỗi hoặc deploy giữa chừng.

## Vận hành

- Nhánh `review/p1-p3`, PR #1; không merge/force-push.
- Chỉ stage file trong phạm vi, kiểm diff/secrets rồi commit/push khi có thay đổi.
- Không in token/key/raw provider error. Không tự tăng quota, deploy, xóa dữ liệu hoặc tạo paid resource.
- Lệnh test/deploy/recovery xem [OPERATIONS.md](OPERATIONS.md).
