# Kế hoạch sửa luồng hội thoại

Cập nhật 2026-09-12. Luồng sản phẩm đã chốt; phạm vi sửa source chưa được duyệt. Trước thay code phải trình file và thay đổi theo `AGENTS.md`.

## Luồng đích

```text
Telegram
→ xác thực/dedupe
→ tạo Context Snapshot
→ gọi Gemini
→ nhận message + actions_now[] + pending[]
→ validate nhóm action
→ commit D1
→ gửi message
→ lưu turn/context update
```

Một lượt có thể đồng thời trò chuyện, thực hiện nhiều action rõ và hỏi/xin xác nhận phần còn lại. Các action phụ thuộc nhau cùng pending phải được ghi nguyên tử; không thực hiện âm thầm một nửa.

## Giới hạn Gemini free

- Mặc định một request cho mỗi tin nhắn.
- Context tải trước active work để giảm read loop.
- Chỉ thêm tối đa một request khi cần kết quả đọc chưa có trong snapshot.
- Không gọi model lần hai chỉ để diễn đạt write đã thành công.
- Summary update ghép vào lượt đang có.
- Cron không gọi Gemini mỗi phút; exact reminder dùng message đã lưu/fallback.
- Không paid fallback; có app-level quota.

Gemini có thể soạn message cùng action. Backend giữ message đến khi commit thành công; nếu lỗi thì thay bằng fallback đúng thực tế.

## Context Snapshot

Nguồn và vòng đời:

| Phần | Nguồn | Vòng đời |
| --- | --- | --- |
| Current message | Telegram | Luôn là đầu vào cuối cùng của request |
| Recent turns | Tin đã gửi/nhận | Giữ thô có thời hạn; chỉ lấy 8–12 lượt |
| Rolling summary | Gemini cập nhật khi đến ngưỡng | Thay theo version, soft context |
| Pending | Gemini tạo khi thiếu/xác nhận | Waiting → applied/cancelled/expired |
| Memory/social state | User hoặc context update | Persistent hoặc tạm thời có expiry |
| Work state | D1 | Đọc mới mỗi lượt; nguồn sự thật |

Khi quy mô còn 10–20 active task, gửi compact toàn bộ active work. Khi lớn hơn, gửi workload summary + item liên quan và dùng read đặc biệt khi cần.

## Hành động nghiệp vụ tối thiểu

- Tìm/đọc work khi snapshot chưa đủ.
- Tạo/sửa/hoàn thành task; có thể kèm deadline và reminder.
- Tạo/sửa/hủy event nội bộ.
- Tạo/sửa/hủy reminder độc lập hoặc liên kết.
- Lưu/điều chỉnh work plan và proactive nudge.
- Lưu memory hoặc pending context.

Không generic SQL/URL. Cho phép nhiều action; giới hạn payload/số lượng chỉ để tránh output lỗi. Backend kiểm owner, schema, ID/time, idempotency và transaction, không xây bộ máy hiểu lại ngữ nghĩa để đấu với Gemini.

## Reminder và theo sát

- Exact reminder: user yêu cầu/đồng ý rõ; scheduler đảm bảo gửi.
- Proactive nudge: trợ lý tạo từ deadline/work plan, có thể điều chỉnh.
- Phản hồi phải gắn đúng reminder bằng Telegram reply/button hoặc Gemini dựa trên active nudge trong context.
- Tin nhắn không liên quan không được đóng tất cả reminder.
- Bỏ lỡ kế hoạch dẫn tới replan, không tạo nợ/spam.

## Giữ, thay và bỏ

Giữ Telegram webhook, D1, outbox, cron, receipts/idempotency và transaction.

Thay context builder, conversation summary/pending, orchestrator một-write hiện tại, tool contracts/executor, reminder độc lập, event, nudge và overview ưu tiên.

Bỏ Google Calendar runtime/OAuth/vault/sync/config/UI/tests và wizard không còn consumer. Không sửa migration đã áp; schema mới dùng migration tiếp theo.

## Thứ tự sau khi duyệt code

1. Lập dependency map và trình file giữ/sửa/xóa.
2. Bỏ Google/dead consumers.
3. Bổ sung data model và lifecycle.
4. Xây Context Snapshot + summary/pending.
5. Đổi sang one-call multi-action turn.
6. Sửa exact reminder/follow-up đúng scope.
7. Thêm work plan, proactive nudge và overview 1–3 việc.
8. Test fake rồi pilot live có quota rõ.

## Nghiệm thu tối thiểu

- Reminder mới không gắn task sai.
- Một câu tạo task + deadline + reminder trong một request/transaction.
- Event không bị biến thành task.
- Chat xã hội không ghi nghiệp vụ.
- Câu trả lời tiếp nối hoàn tất đúng pending.
- Hội thoại dài giữ được mạch nhờ summary.
- Reminder thật đến iPhone và follow-up đúng item.
- Overview không dump 10–20 dòng.
- Gemini lỗi/quota không gây mất nhắc, ghi trùng hay báo sai thành công.
