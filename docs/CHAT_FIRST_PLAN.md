# Hội thoại thực hiện công việc — kế hoạch ưu tiên

2026-09-12. Yêu cầu sản phẩm đã chốt; danh sách code ở cuối chờ duyệt. Dừng mở rộng wizard/menu; UI hiện tại là hỗ trợ, không phải đường dùng chính. Không bật AI trả phí hoặc gọi thử model vô hạn.

## 1. Trải nghiệm bắt buộc

User: “Tớ có bài tiếng Anh, deadline ngày mai.”
Bot sau commit: “Ừ, tớ ghi bài tiếng Anh rồi, hạn ngày mai nhé.” Không xuất card/nút mặc định, không hỏi lại tên/hạn đã rõ.

Ngày mai được backend quy đổi theo thời điểm nhận tin và Asia/Ho_Chi_Minh, lưu deadline dạng ngày. Không tự gán 23:59, không tự tạo lịch làm/nhắc nếu user chỉ cung cấp hạn. Nếu cần giờ để lên nhắc, hỏi sau đúng thời điểm cần, không chặn capture.

User: “Nhắc tớ làm bài ấy mai 9 giờ sáng.” → resolve việc đang nói → đặt lần hẹn/nhắc theo yêu cầu rõ. Không bắt chọn lại ngày trên nút. Thiếu thời lượng thì hỏi nếu thao tác thực sự cần duration; không tự coi duration mặc định là estimate toàn task.

User: “Ừ chuyển đi.” → chỉ xác nhận proposal đang chờ đúng owner/version/expiry; nếu nhiều đề xuất hoặc ý không rõ thì hỏi một câu. Có thể dùng nút thay lời, không bắt buộc.

User: “Tớ mệt quá.” → trò chuyện/chia sẻ và đề xuất hỗ trợ; không tự hủy/dời lịch từ nhận định cảm xúc. User muốn tổng quan → tóm tắt gọn, card chỉ khi giúp kiểm tra/chọn.

## 2. Khoảng cách source hiện tại

- ai/contracts.ts chỉ một draft, một field/value, capture chỉ title: chưa biểu diễn tạo task có cả tên+hạn, deadline ngày-only hoặc nhiều hành động.
- ai/chat.ts capture luôn proposal+button, update đẩy về /tasks: trái trải nghiệm đã chốt.
- domain/work.ts task deadline là string không có precision; time.ts chỉ DD/MM/YYYY HH:mm. Không được lưu ngày-only như timestamp giả.
- context-builder chỉ focus hoặc 10 task đầu, thiếu sessions/pending clarification/proposal: không đủ để hiểu “bài ấy”, “ừ chuyển đi” trên toàn backlog.
- task/proposal SQL gắn trigger capture/deadline cũ; chưa direct-create đa trường có validation/result receipt chung.
- Trả lời phải đi từ dữ liệu commit; text model nói “đã lưu” không chứng minh thành công.
- Runtime Gemini đang off, adapter có schema cũ. Không coi bật cờ là đã có conversational executor.

## 3. Luồng xử lý mới

1. Webhook xác thực → durable inbox, chống update trùng, thời điểm nhận tin là mốc ngày tương đối.
2. Command/nút rõ ràng hoặc xác nhận ngắn không mơ hồ → fast path, không gọi model. Hội thoại còn lại → context nhỏ có facts/history/focus/pending và kết quả tìm việc.
3. Một lần Gemini cho lượt bình thường: chat/clarify hoặc typed intent (title, deadline date/time+precision, entity reference, evidence). Không xuất SQL, callback, provider URL hoặc tự quyết quyền.
4. Backend resolve entity, chuẩn hóa ngày, kiểm owner/version, mức rõ ràng và quy tắc thao tác. Thiếu dữ kiện mới hỏi; tránh đưa người dùng về form.
5. Auto-execute được phép → transaction business change+audit+result+reply outbox. Confirm cần thiết → pending proposal bền vững+text, nút tùy chọn. Clarification → lưu draft còn thiếu+TTL, câu sau bổ sung draft không tạo lại task.
6. Reply nghiệp vụ từ committed result: lời ngắn theo persona, dùng formatter + mẫu đa dạng đã kiểm soát, không gọi LLM lần hai chỉ để nói “đã thêm”. Chat thuần dùng lời model; không tự nảy sinh mutation.

Không bắt mọi câu là intent công việc. Với nhiều ý trong một câu, bản đầu hỗ trợ một thao tác nghiệp vụ rõ, lưu draft/hỏi phần còn lại; không bỏ qua âm thầm hoặc tự chạy chuỗi agent dài.

## 4. Quyền theo thao tác (đề xuất triển khai)

| Trường hợp | Hành vi |
| --- | --- |
| User khai báo rõ task mới + thông tin rõ | Lưu ngay tên và các trường đã biết, báo sau commit |
| Ngày-only rõ | Lưu ngày, không bịa giờ hoặc tạo reminder |
| “hình như mai” | Lưu task, giữ hạn tentative/draft chưa coi là cam kết chắc; hỏi xác minh khi cần |
| Lệnh rõ sửa một việc chính xác | Auto-execute thay đổi nhỏ, có bản ghi trước/sau; không thêm confirmation máy móc |
| Dời/xóa hàng loạt, xóa dữ liệu, xung đột đáng kể, hành động ghi Google | Tóm tắt tác động và xin confirm theo policy hiện tại |
| Trùng tên/không rõ thực thể hoặc giờ “9h” chưa phân biệt được | Hỏi ngắn trước mutation liên quan, không chọn bừa |
| Tự suy từ mood, im lặng, gợi ý của AI | Không coi là lệnh; đề xuất trước |
| Quá quota/provider lỗi | Không báo đã lưu; giữ input đã nhận/draft có trạng thái rõ, fallback hiện có, không tự gửi lại hàng loạt |

Không dùng điểm tự tin do model tự khai làm quyền auto-execute. Validate schema/evidence/current user intent và domain rules. Bằng chứng trích dẫn không tự đảm bảo ý nghĩa, cần bộ ca adversarial/ambiguity cố định.

## 5. Thực hiện theo lát cắt dùng được

**C1 — “task + deadline” bằng hội thoại:** contract đa trường, deadline date-only, direct capture atomically, chat/clarify và reply đúng kết quả; giữ /add và UI cũ tương thích. Trọng tâm trước khi mở rộng bất kỳ chức năng khác.

**C2 — tiếp nối bối cảnh:** tìm task ngoài 10 mục đầu theo truy vấn có giới hạn, pending draft, phân biệt sửa hạn/dời session, yes/no bằng lời và hết hạn proposal. Không tự thêm vector DB; query có owner/index, chỉ gửi tập ứng viên nhỏ.

**C3 — session/nhắc và tổng quan:** lời nói → thao tác nghiệp vụ hiện có, guard nhiều buổi/trùng lịch, card chỉ cho confirm/overview. Memory user yêu cầu rõ lưu được; không tự giữ mọi suy đoán thành facts. Việc chưa hỗ trợ nói rõ, không pretend.

**C4 — staging với Gemini thật:** xác minh model/quota free đang khả dụng trước bật; trình ngân sách smoke nhỏ cố định và dữ liệu tổng hợp. Giữ không retry provider tự động. Không đổi model qua nhiều vòng chỉ để polish persona. User thử chat trên iPhone sau kết quả smoke.

Mục tiêu latency: tối đa 1 LLM call/lượt thông thường, 0 cho nút/confirmation rõ. Retrieval nếu cần lượt bổ sung thì giới hạn và đo, không hứa mọi câu đúng trong một call. Đo inbox/context/LLM/commit/delivery riêng, log chỉ thời lượng/mã, không nội dung/secrets. Không bỏ transaction/authorization để chạy nhanh.

## 6. Files dự kiến C1–C3 (duyệt trước code)

- Sửa `src/ai/{contracts,chat,persona,policy}.ts`; `gemini.ts` chỉ nếu cần contract/timeout phù hợp, không thêm SDK/provider.
- Mới `src/application/{conversation-command,conversation-reply}.ts`, `src/domain/conversation.ts` để tách parsing/decision/result khỏi Telegram UI.
- Sửa `src/application/{context-builder,plan-command,process-inbox}.ts`, `src/domain/{work,time,session}.ts`, `src/ports/work-store.ts`.
- Sửa `src/adapters/d1/{work-store,session-store,memory}.ts`, `src/entrypoints/worker.ts` để nối direct operations, pending draft/confirmation và instrumentation an toàn.
- Migration MỚI `0009_conversation_commands.sql`: precision ngày/hạn, draft/receipt/undo metadata cần thiết; không sửa 0008 đã áp. Các mốc sau chỉ thêm schema có nhu cầu thực, không dựng trước mọi tính năng.
- Mới `tests/integration/conversation-flow.test.ts`, `tests/unit/conversation.test.ts`; cập nhật ai-runtime/contracts/context tests, workers-fetch, migration tests. Bộ ca cố định không gọi API thật trong phát triển.
- Docs HANDOFF/PRODUCT_BRIEF/DECISIONS/MODEL_VERDICT cập nhật phạm vi thật, không viết lại toàn bộ docs.

## 7. Tiêu chí nghiệm thu

- “task A, dl ngày mai” lưu đúng tên+date-only, một lần, không confirmation/form/nút bắt buộc; không tự sinh session.
- Thiếu/mơ hồ hỏi đúng phần, câu sau nối draft; user đổi ý/hủy không tạo task thừa.
- Nói “đã xong” phân biệt task/session; chưa có domain operation thì không pretend, không dùng completion session thay task.
- “Ừ” không confirm proposal cũ hoặc của owner khác; lệnh trích trong Calendar/history không thành quyền.
- Trùng webhook/restart/concurrent updates không ghi trùng; provider lỗi không có lời khẳng định đã thực hiện sai sự thật.
- Chat thuần không bỗng xuất menu; overview mới có card; model và nút dùng cùng domain transaction.
- Không deploy/bật provider chỉ dựa số test xanh; C1–C3 offline rồi smoke C4 có ngân sách và kiểm tra sử dụng thật.
