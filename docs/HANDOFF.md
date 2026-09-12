# Tiếp tục từ đây
Cập nhật 2026-09-13. User đã duyệt phạm vi TOOL_CALLING_PLAN và tối đa20 provider request; không tự tăng trần/gia hạn pilot.

## Đang triển khai, chưa nghiệm thu
- Google runtime/routes/config/tests chuyên Google đã gỡ; migration cũ giữ. Xóa source có thể phục hồi từ Git.
- Native function calling duy nhất: multi-write batch + respond(message), tối đa2 model bước; không gọi model sau write.
- Thử JSON tổng hợp không đạt (400 hoặc sai fields), đã bỏ toàn bộ nhánh đó. Không khẳng định schema đúng = đúng ý.
- Có clarification riêng nhiều mục, summary có version/covered_through, history12 cặp, snapshot20 active tasks + events/appointments/sessions.
- Reminder độc lập dùng lại task_appointments/dispatcher, nullable task_id. Event riêng; reminder liên kết event bị hủy khi event thay đổi.
- Có plan_work/session_action/acknowledge/cancel/reschedule tools; chat thường không bị wizard chặn.
- Reply Telegram được giữ và chỉ acknowledge đúng message; xác định bằng chat qua tool.
- Migration0011 đã áp cloud; Worker version8eb288f1-2193-4209-a8f9-0ba81f44e41c đã deploy staging (quota/end giữ nguyên). Backup .wrangler/staging-before-0011.sql ignored; restore + migration trong SQLite đạt và giữ số task/reminder, không lỗi FK.
- Source batch hiện lưu receipt+mutations trước outer commit/outbox (replay được, nhưng chưa hợp nhất thành một transaction duy nhất như plan). Generic multi-confirmation và overview UI còn cần review. Không coi hoàn tất toàn bộ plan.

## Kiểm chứng và ngân sách
- Baseline82+25 đạt. Full sau sửa82+25 đạt; nhóm mới7/7 đạt gồm planning/conflict/event cancel. Typecheck/dry-run đạt.
- Provider smoke đã dùng8/8: small schema đạt; schema đầy đủ400, flat schema sai field. Không gọi thêm smoke không giới hạn.
- Nghiệm thu đã dùng tối đa8/12, tổng tối đa16/20 (tính cả một Worker-local probe treo, đã dừng, không biết có gọi provider không).
- Native thật: capture+clarify+respond đúng sau sửa prompt; event start-only giữ end/remind_at=null; pending answer tạo reminder+close không resolve_confirmation; social chat không write; standalone cắm cơm không gắn task cũ.
- Còn tối đa4 provider request toàn đợt. Không tái sử dụng quota cũ, không paid fallback.
- Config giữ20 request/24h, trial ends2026-09-13T11:42:18Z (18:42 VN). Chưa gia hạn; hạn mức Google thật không suy từ config.

## Cần tiếp tục
- BLOCKER nghiệm thu AI staging: đã dùng20/20 request app rolling24h; không phải kết luận Google quota hết. Slot đầu dự kiến2026-09-13 12:05:06 VN; cần chờ cửa sổ hoặc user duyệt thay trần. Chưa kiểm hội thoại thật trên staging mới.
- Release smoke scheduler sent, message_id66, sent_at1789237159110; reminder có nhãn release-smoke-0011-20260913, responded=1 không follow-up. Telegram nhận không chứng minh iPhone hiển thị push.
- GET / và OAuth cũ404; POST /telegram thiếu secret403 trên bản mới. Cần hoàn tất chức năng còn thiếu (multi-confirmation, overview UI, atomic outer commit, summary continuity khi hơn12 lượt chưa nén) trước tuyên bố nghiệm thu toàn bộ. Không downgrade về code nhiều bước sau cutover mà thiếu kế hoạch.
- Git local checkpoint; không push vì môi trường đã từ chối quyền xuất bản riêng. Không đổi secret, không xóa dữ liệu user.
