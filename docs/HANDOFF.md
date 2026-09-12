# Tiếp tục từ đây
Cập nhật 2026-09-13. Bản staging sẵn sàng cho user nghiệm thu luồng cốt lõi; không coi đánh giá persona/năng suất đã được user chấp nhận.

## Đang chạy
- Worker version655db497-775d-44dd-8911-9feafdecdc8a; migration0001–0011 đã áp. Không sửa migration đã phát hành.
- Gemini native tools duy nhất + respond(message), nhiều action + clarification trong một lượt; tối đa2 model request, không gọi model sau write.
- Production gom mutations/receipt/pending/history/outbox cùng outer transaction; kiểm rollback và không replay nghiệp vụ.
- Summary đọc từ đoạn cũ chưa bao phủ, recent12 cặp; snapshot20 active task + event/session/nhắc. today/tomorrow và now có +07:00 để tránh lệch ngày sau nửa đêm.
- Task/reminder độc lập/event, lập và cập nhật buổi làm, reply đúng reminder, pause, complete/cancel hoạt động. Google runtime đã bỏ.
- /tasks hiện3 việc trước + xem toàn bộ; /today rút gọn; chat thường không bị wizard chặn.
- Nhóm có duplicate chờ confirmation chung (chưa ghi nửa nhóm); clarification có thể nhiều mục độc lập. Không có nhiều nhóm confirmation đồng thời: đề xuất mới thay nhóm cũ.

## Kiểm chứng
- Full suite + experiments đạt; typecheck/dry-run đạt. Test bổ sung: atomic outer rollback, batch confirmation, old history summary, migration/standalone/event và planning conflict.
- Live staging QA1309: phát hiện sai ngày mai, đã sửa today/tomorrow. QA1309B lưu hạn14/09 đúng; hỏi giờ → trả lời đổi giờ → reminder gửi → complete hủy follow-up.
- 4 tin QA dùng4 request; Telegram replies67–69/71, reminder70 sent_at1789238114411. Message IDs là bằng chứng Telegram nhận, không chứng minh push trên iPhone.
- Đã xóa đúng2 task QA,2 clarification,1 reminder, undo và4 history giả. Receipt/outbox giữ audit. Không sửa task thật; dữ liệu QA có thể dựng lại từ receipt.
- Đợt trước tối đa16 request direct smoke (bao gồm1 probe bị dừng không rõ provider); đợt này4 runtime requests. Không gọi tiếp vô hạn.

## Quyền/quota
- User duyệt nới hạn mức: trần APP từ20 lên40/rolling24h, giữ4/phút; không phải quota Google.
- Sau QA runtime dùng24/40, còn16 tại thời điểm kiểm (user dùng sẽ thay đổi). Không reset counters hoặc paid fallback.
- Pilot vẫn hết2026-09-13 18:42:18 VN; chưa được gia hạn. Bot báo rõ quota/time-limit, reminder đã lưu tiếp tục chạy.
- Git commit local; chưa push vì môi trường từ chối quyền xuất bản riêng. Không tự tăng budget hoặc thay secret.

## Giới hạn cần nói thật
- Model có thể hiểu sai, prompt không phải bảo đảm. Nghiệm thu live đã chứng minh một chuỗi, không tất cả cách nói.
- Summary là nén mất mát; raw history30 ngày. Persona cần user dùng đánh giá; không hứa như người thật.
- Chủ động dựa giờ rảnh/work plan đã biết; không tự gọi Gemini mỗi phút/không planner nền độc lập. Không biết lịch ngoài sau bỏ Google.
- Nếu cần nhiều confirmation độc lập, pending proposal mới thay cũ hoặc conflict batch chọn lại: đó là mở rộng tiếp theo, không tuyên bố đã có đầy đủ.
- Backup trước0011: .wrangler/staging-before-0011.sql ignored, restore local + migration giữ counts/FK. Không commit/in dữ liệu backup.
