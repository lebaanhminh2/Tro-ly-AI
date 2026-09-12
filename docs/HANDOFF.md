# Tiếp tục từ đây

Cập nhật 2026-09-13. Đọc file này trước; chỉ mở tài liệu liên quan.

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

Đã rà source và lập phạm vi file/lifecycle/cutover trong TOOL_CALLING_PLAN mục5–7; chờ user duyệt một lần trước thay source theo `AGENTS.md`. Sau duyệt tự kiểm nội bộ xuyên suốt, user nghiệm thu cuối. Chưa chạy Gemini live, test suite hay sửa code trong lượt lập kế hoạch.
- Phát hiện cần xử lý thêm: unique pending/owner, Telegram thiếu reply ID, summary không được nhớ hành động chưa commit, lưu outbox trước gửi, chuyển reminder cũ không gửi lặp.
- Protocol một-call + hành động/lời đáp là mục tiêu cần smoke đúng model; quota20 request/24h trong config là trần app, không phải quota Google. Quyền smoke/deploy đề xuất chưa được cấp lại.

## Vận hành

- Nhánh `review/p1-p3`, PR #1; không merge/force-push.
- Chỉ stage file trong phạm vi, kiểm diff/secrets rồi commit/push khi có thay đổi.
- Không in token/key/raw provider error. Không tự tăng quota, deploy, xóa dữ liệu hoặc tạo paid resource.
- Lệnh test/deploy/recovery xem [OPERATIONS.md](OPERATIONS.md).
