# Kế hoạch sửa luồng hội thoại nhẹ và context-driven

Cập nhật 2026-09-12. Tài liệu này thay kế hoạch một-write-per-turn cũ. Chưa phê duyệt thay source; trước khi sửa code phải trình danh sách file/phạm vi theo `AGENTS.md`.

## 1. Nguyên tắc đã chốt

- Gemini là lớp hiểu ý định và giao tiếp: nhận context + câu hiện tại, tự chọn trả lời, hỏi, đọc hoặc yêu cầu nhiều hành động backend.
- Một provider request cho mỗi tin nhắn là mặc định. Không gọi Gemini lại chỉ để diễn đạt kết quả ghi thành công.
- Backend tải trước context nghiệp vụ đủ dùng để giảm read loop. Lượt model thứ hai chỉ dành cho ca thật sự cần kết quả đọc chưa có; tối đa hai request trong một turn.
- Cho phép nhiều action trong một turn. Backend kiểm cả nhóm rồi commit nguyên tử; không thực hiện âm thầm một nửa.
- Công cụ nghiệp vụ phải khớp cách nói đời thường. Một action có thể tạo các bản ghi liên quan, ví dụ task + deadline + reminder.
- Không tối ưu bằng cách bỏ xác thực, bảo vệ secret, schema, idempotency hoặc transaction.

## 2. Luồng đích

Telegram → xác thực/dedupe → Context Snapshot → Gemini → `message + actions[]` hoặc clarification → validate nhóm action → commit D1 → gửi message → lưu turn/context delta.

Gemini có ba kết quả chính:

1. `message` và không action: chat thuần, gửi ngay.
2. Câu hỏi làm rõ: lưu pending intent ngắn rồi gửi câu hỏi.
3. Một hoặc nhiều action kèm lời đáp chỉ được gửi sau khi commit thành công.

Nếu action thất bại, backend dùng lỗi ngắn theo persona; không gửi lời “đã xong” do model soạn trước. Khi Gemini cần đọc ngoài snapshot, backend thực hiện read, nối result vào context và cho phép đúng một lần gọi bổ sung.

## 3. Context Snapshot

Mỗi request nhận:

- thời gian/múi giờ;
- persona và rule ngắn;
- rolling conversation summary;
- 8–12 lượt gần nhất trong ngân sách;
- memory liên quan;
- pending intent;
- trạng thái năng lượng/kế hoạch gần đây nếu có;
- danh sách compact của toàn bộ active task ở quy mô hiện tại, event/reminder gần và work plan hôm nay;
- câu hiện tại.

Khi dữ liệu lớn hơn ngân sách, gửi workload summary + mục liên quan thay vì dump toàn DB. Task/event/reminder thật luôn lấy từ DB, không từ conversation summary.

Summary không dùng một API call riêng theo chu kỳ cứng. Khi đến ngưỡng khoảng 10–12 lượt, đổi chủ đề hoặc context gần đầy, yêu cầu Gemini trả `summary_update` trong cùng response đang xử lý. Summary là soft context; task và memory dài hạn có nguồn riêng.

## 4. Hợp đồng hành động tối thiểu

Ưu tiên ít tool, trường rõ và composite action:

| Action | Mục đích |
| --- | --- |
| `search_work` | Chỉ dùng khi snapshot chưa đủ để xác định item |
| `create_task` | Tạo task, deadline/estimate/next action/reminder tùy chọn trong một transaction |
| `update_task` | Sửa một task đã xác định hoặc đánh dấu hoàn thành |
| `create_event` | Tạo event nội bộ và reminder tùy chọn |
| `create_reminder` | Tạo reminder độc lập hoặc liên kết item |
| `update_reminder` | Đổi giờ/hủy reminder |
| `apply_work_plan` | Ghi/thay kế hoạch làm việc nội bộ, không đổi deadline |
| `remember` | Lưu memory có nguồn, phạm vi và thời hạn |

Không generic SQL, arbitrary URL hay tool registry động. ID cũ phải đến từ snapshot/read result; reminder mới không được buộc gắn một task có sẵn.

## 5. Nhiều action nhưng không loop nặng

- Gemini có thể trả nhiều function call độc lập trong một response.
- Quan hệ phụ thuộc được đóng trong composite action: `create_task` có thể kèm reminder, `create_event` có thể kèm notification.
- Backend validate toàn bộ action trước khi ghi và batch trong một transaction khi cùng DB.
- Message đi kèm action là bản nháp gửi sau thành công; fallback do backend dùng khi commit/model có vấn đề.
- Giới hạn số action và kích thước payload để chống lỗi/quota, không giới hạn cứng một write.
- Không gọi model lần hai sau write. Chỉ read-miss đặc biệt mới được thêm một call.

Mục tiêu request:

- chat thuần: 1;
- capture/update rõ: 1;
- nhiều thay đổi rõ: 1;
- read ngoài snapshot rồi trả lời/thay đổi: tối đa 2;
- exact reminder khi đến hạn: 0 request, trừ khi còn ngân sách và cần lời nhắn mới.

## 6. Quyền tự chủ và xác nhận

Tự làm khi user yêu cầu trực tiếp, target đủ rõ và thay đổi nội bộ có thể hoàn tác. Không cần confirmation chỉ vì có nhiều action.

Hỏi/xác nhận khi thiếu trường bắt buộc, nhiều target hợp lý, user đang giả định/nói ví dụ, xóa/bulk/khó hoàn tác hoặc trợ lý tự đề xuất một thay đổi lớn. Confidence do model chỉ hỗ trợ lựa chọn; backend không xây semantic gate phức tạp.

Giữ owner isolation, tool allowlist/schema, timestamp validity, idempotency, version/transaction và secret redaction. Bỏ các policy ceremony không trực tiếp ngăn mất dữ liệu, ghi nhầm hàng loạt hoặc lạm dụng API.

## 7. Chủ động nhưng tiết kiệm quota

Cron chỉ tìm trigger đến hạn, không gọi Gemini mỗi phút.

- Exact reminder: gửi message đã tạo/lưu trước; luôn có fallback.
- Proactive nudge: được tạo khi lập plan hoặc trong một lượt planning giới hạn, sau đó scheduler gửi.
- Giai đoạn đầu không quá một lượt planning nền/ngày; replanning ưu tiên ghép vào lần user đang chat.
- Follow-up gắn đúng reminder/task và chỉ dừng bởi phản hồi liên quan, không bởi mọi tin nhắn.

App phải có app-level quota, không paid fallback. Khi hết quota, exact reminder và thao tác deterministic vẫn hoạt động; chat AI báo ngắn là tạm hết lượt.

## 8. Giữ, thay và bỏ

Giữ Telegram webhook, D1, outbox, owner lease, receipts/idempotency, transaction, cron và domain logic dùng được.

Thay context builder, conversation summary/pending state, model response orchestration, tool schema/executor, reminder độc lập, event nội bộ, proactive plan/nudge và overview ưu tiên.

Bỏ Google Calendar runtime/OAuth/vault/sync/config/UI/tests liên quan và wizard không còn consumer. Migration đã áp không sửa; bảng cũ có thể để inert cho đến khi có quyết định reset dữ liệu riêng.

## 9. Trình tự triển khai sau duyệt source

1. Chụp dependency map và trình chính xác file giữ/sửa/xóa.
2. Bỏ Google runtime và dead consumers, giữ staging chạy được.
3. Thêm migration mới cho event, reminder độc lập, summary/pending/work state; không sửa migration cũ.
4. Xây Context Snapshot và cơ chế summary piggyback.
5. Đổi protocol sang one-call decision + batched/composite actions.
6. Làm exact reminder và phản hồi đúng scope; kiểm chứng gửi thật.
7. Làm work plan/proactive nudge và overview 1–3 việc.
8. Tinh chỉnh persona trên hội thoại dài, không sửa prompt vô hạn.
9. Test fake toàn luồng, rồi một pilot live có quota/stop criteria rõ.

## 10. Điều kiện nghiệm thu

- “18h48 nhắc cắm cơm” tạo reminder độc lập đúng giờ.
- Một câu tạo task + deadline + reminder bằng một model request và một transaction.
- Event không bị lưu thành task thường.
- Chat xã hội không ghi nghiệp vụ.
- Pending “nhắc làm bài” → “8h tối” nối đúng ý định.
- Qua hơn 20 lượt vẫn giữ quyết định quan trọng nhờ summary + recent turns.
- Follow-up chỉ áp dụng cho đúng item; bỏ lỡ không tạo spam/nợ.
- Overview trả 1–3 hành động ưu tiên thay vì dump 10–20 dòng.
- Gemini lỗi/quota không làm mất exact reminder, ghi trùng hoặc báo sai thành công.
- Không còn runtime/import Google và không có secret trong source/log/Git.
