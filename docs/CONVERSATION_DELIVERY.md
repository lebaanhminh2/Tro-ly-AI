# Trợ lý hội thoại — kế hoạch thực thi đã chỉnh hướng

2026-09-12. Yêu cầu sản phẩm đã chốt. Phạm vi code bên dưới chờ duyệt; chưa bật provider/deploy trong lượt lập kế hoạch. Ưu tiên tài liệu này hơn việc mở rộng menu/wizard/UI_REMEDIATION_PLAN. Giữ nền dữ liệu và UI an toàn đã xây, không viết lại toàn bộ.

## 1. Định nghĩa hoàn thành

### Tiến độ code (không phải nghiệm thu toàn kế hoạch)

Checkpoint completion: kind complete/reopen, tasks.status và task_completion_undo thêm vào0009 (chưa remote). User nói rõ xong task → transaction đổi status/version, cancel task_appointments + reminders, đóng sessions còn mở (running/paused thành completed, planned/draft thành skipped); không tăng phần trăm tự suy. Reopen trong15 phút và đúng version mới mở active; không phục hồi lịch/nhắc cũ. “Xong rồi”, “chưa làm xong”, “xong một phần/buổi” bị chặn auto-complete. Detail hiện trạng thái, không đưa nút lên lịch cho completed; entry lên lịch cũ cũng kiểm tra status. Full suite69+25 đạt trước test partial-completion cuối, test unit3+typecheck đạt sau. Còn live model, confirmation/undo ngoài completion, metadata/latency và độ bao phủ ngôn ngữ trước nghiệm thu.

Checkpoint tiếp theo: thêm nhắc độc lập `task_appointments`, không tạo session/duration; một hẹn active/task, yêu cầu hẹn giờ mới thay hẹn trước và báo rõ. Nhắc chính + follow-up 15 phút sau sent_at, tối đa hai; user phản hồi suppress follow-up, pause cancel tới hết ngày cả khi resume trước cron, không gửi bù sau một giờ trễ. Queue khi AI_MODE=conversation (user /ai off vẫn không tắt lịch đã lưu). Migration0009 vẫn local, chưa deploy/live. Cần đưa giới hạn trễ một giờ vào nghiệm thu thực tế, không coi là SLA.

Thêm kind overview/rest/resume, overview mới có button hỗ trợ; “mệt” không tự rest. Query task theo tên được nhắc tìm ngoài trang đầu (tối đa20 kết quả), duplicate exact title hỏi xác nhận; “ừ, thêm đi” dùng pending hiện hành và không gọi model lại, pendingId kiểm trong transaction. Vẫn còn giới hạn Unicode case matching của SQLite, chưa fuzzy name resolution. Chưa hoàn thành confirmation tổng quát/complete task/undo, metadata inference, persona/live. Test mới bao phủ duplicate voice confirmation, task ngoài trang đầu, rest/overview, lịch nhắc không duration và cancellation/2 lượt.

User đã duyệt toàn bộ phạm vi. C1 đã có nhánh runtime `AI_MODE=conversation` (staging vẫn off): schema typed capture title+deadline / update deadline, parse nguồn ngày VN giữ precision, conversation receipt chống gọi lại sau commit lỗi, pending clarification ngày lưu D1 và câu trả lời ngày rõ không gọi AI lại. Mutation task/date + receipt applied + focus + reply intent chung transaction. receivedAt lấy từ inbox.created để retry qua nửa đêm không đổi nghĩa “mai”. Migration 0009 chưa áp remote. Full suite 66+25 đạt trước bổ sung receivedAt; tests conversation + typecheck đạt sau bổ sung.

Giới hạn C1 hiện tại: chỉ nhận một số mẫu yêu cầu trực tiếp có evidence; ngày weekday chưa normalize, sẽ hỏi ngày cụ thể. Không được coi đây là hiểu hội thoại đầy đủ. Context vẫn focus hoặc trang đầu; chưa entity search toàn bộ, chưa duplicate-title resolution, inference receipt chưa lưu model/prompt version, lời chat không-mutation vẫn cần guard khẳng định kết quả sai và test live. Pending clarify mới dành cho deadline, chưa confirmation bằng lời hoặc nhiều trường chưa biết. C2 hẹn không bịa duration, task completion, yes/no có binding và C3 live chưa triển khai. Chưa deploy, chưa gọi provider thật. Không yêu cầu user duyệt lại các phần kế tiếp trong phạm vi đã chốt.

Người dùng trò chuyện như với trợ lý. Câu yêu cầu rõ → tự làm trong quyền cho phép → báo kết quả. Chỉ hỏi phần thiếu, xin xác nhận khi có rủi ro/đề xuất chưa được đồng ý. Nút xuất hiện khi cần xác nhận hoặc người dùng muốn tổng quan; không đẩy người dùng sang form chỉ vì chưa nối được nghiệp vụ.

Ví dụ bắt buộc: “Tớ có bài tập tiếng Anh, deadline ngày mai” → một task có title và deadline ngày mai, lưu nguyên tử → “Tớ ghi bài tiếng Anh rồi, hạn ngày mai nhé.” Không hỏi lại có thêm không, không bịa giờ 23:59, không tự xếp buổi. Trả lời có thể ghi rõ ngày DD/MM để người dùng phát hiện hiểu nhầm.

## 2. Khoảng lệch đã kiểm tra trong source

- ai/contracts.ts: Draft có một field/value, capture chỉ title, không biểu diễn task nhiều trường hay chuỗi thao tác phụ thuộc.
- ai/chat.ts: capture luôn proposal; update_task trả nút chọn hạn, không thực thi; shortcut capture đi riêng policy.
- ai/policy.ts: selectedScope lấy từ UI là điều kiện cho update, VALUE_VALIDATION_NOT_IMPLEMENTED vẫn là điểm dừng. Đây là guard thử nghiệm, không phải yêu cầu UX cuối.
- context-builder.ts: chỉ task focus/trang đầu, memories và 4 cặp chat; thiếu sessions/pending action. “Ừ chuyển đi” chưa có đích xác nhận bền vững.
- domain/work.ts + D1: deadline string chưa có precision date/datetime; Task chưa có trạng thái hoàn thành, proposal chỉ capture/deadline. Không thể giả supported bằng prompt.
- process-inbox + Gemini: chưa lưu kết quả hiểu yêu cầu theo update trước bước commit; quota chặn gọi lại nhưng có thể mất kết quả AI sau crash. UI test không chứng minh hội thoại làm việc.

## 3. Luồng đề xuất

1. Nhận Telegram, xác thực owner và dedupe như hiện tại. Nút confirmation/read command rõ dùng thẳng backend, không gọi model.
2. Tải song song context có giới hạn: thời gian hiện tại VN, dữ liệu liên quan, session hiện tại/sắp tới, preference, memory, pending proposal/clarification và lịch sử ngắn. Không gửi cả DB. Tìm entity phải xét toàn bộ tập liên quan, không chỉ 10 task đầu; nhiều trùng tên thì hỏi.
3. Một lượt Gemini trả envelope typed: `chat | clarify | actions`, reply dự kiến, từng action với tham số có kiểu và nguồn dữ liệu. Lưu inference receipt theo owner/update/model/prompt version; không lưu key/raw lỗi. Ràng buộc danh sách action ngắn, không agent loop tự gọi vô hạn.
4. Backend normalize/validate: entity owner/version, ngày giờ, trường được phép, nguồn yêu cầu hiện tại + câu bổ sung gắn draft. Model confidence không cấp quyền. Không đọc instructions trong task/Calendar như lệnh người dùng.
5. Bộ quyết định: execute / ask missing field / await confirmation. Mỗi yêu cầu có operation ID, trạng thái planned/pending/applied/failed/uncertain và dữ liệu trước/sau cần cho hoàn tác an toàn. Local changes cùng transaction; tác vụ Google dùng intent+reconcile cũ, không hứa đồng bộ tức thì.
6. Sau commit gửi một phản hồi tự nhiên dựa trên kết quả thực tế. Reply dự kiến chỉ dùng cho thành công nếu khớp action đã áp dụng; không cho free text model khẳng định mutation ngoài kết quả. Lỗi dùng câu ngắn có bước phục hồi. Không gọi model lần hai chỉ để nói “đã thêm”.

Chat xã hội không phải task: có thể nghe, trêu, tâm sự theo persona mà không cố khai thác action. Việc LLM làm ngầm vẫn phải minh bạch trong lời xác nhận kết quả, không giấu việc đã đổi lịch/dữ liệu.

## 4. Quyền thực hiện mặc định

| Tình huống | Cách xử lý |
| --- | --- |
| User trực tiếp nêu task cần làm + dữ liệu rõ | Tự ghi task và các trường rõ, trả kết quả; không confirm thừa |
| “Mai 9h nhắc bài đó” xác định được task/time, chưa có xung đột biết được | Tự tạo hẹn nhắc; cần phân biệt hẹn nhắc và buổi làm có duration, không bịa duration |
| User yêu cầu rõ sửa một task/hẹn cụ thể | Đổi trong phạm vi nhỏ, version đúng; báo nội dung đã đổi |
| “Xong rồi” | Chỉ cập nhật khi rõ xong task hay buổi; nếu chưa rõ hỏi một câu |
| User nói mệt hoặc “chắc mai làm” | Context/tentative, không tự đổi lịch; cô ấy có thể đề xuất |
| Trợ lý tự đề xuất đổi lịch, xóa, nhiều thay đổi hoặc có xung đột | Tóm tắt thay đổi rồi xác nhận bằng lời hoặc nút |
| “Ừ”, “đồng ý”, “chuyển đi” | Chỉ nhận nếu đúng một proposal hiện hành và mạch chat phù hợp; hết hạn/đổi entity/version hoặc nhiều proposal thì hỏi lại |
| User muốn tổng quan | Trả tóm tắt ngắn + card khi cần, không đẩy form vào mọi câu |

Đây là chính sách ứng dụng, không để LLM tự chọn thao tác nào bỏ xác nhận. Luật destructive/bulk/external không bị bỏ vì user “chỉ có dữ liệu lịch”.

## 5. Thời gian và trí nhớ

- “Ngày mai” lấy theo thời điểm nhận tin ở Asia/Ho_Chi_Minh; lưu ngày tuyệt đối + precision=date. Không gán giờ giả. Chỉ hỏi giờ khi đang tạo một nhắc cần thời điểm, không hỏi để cản capture.
- Deadline không đồng nghĩa thời điểm làm hoặc nhắc. Không tự tạo session từ deadline. Nhắc task-date cần quy tắc riêng được người dùng chọn.
- Các câu bổ sung “à hạn thứ sáu” nối vào task/draft đang nói đến, không tạo task thứ hai. Lưu pending context có TTL và entity version trong D1, không chỉ prompt history.
- Preference rõ, yêu cầu nhớ trực tiếp có thể lưu; suy đoán/tâm trạng không thành fact dài hạn. Không tự suy im lặng là chưa làm.
- Hủy/đổi ý khi đang chờ confirmation cập nhật pending state, không chạy proposal cũ. Nút và lời nói đi chung executor.

## 6. Tối ưu chi phí và tốc độ

- Bình thường 1 lượt model/tin tự nhiên cần hiểu. 0 lượt cho nút, retry webhook và xác nhận yes/no rõ có binding hợp lệ. Lời xác nhận pha sửa thông tin vẫn cần model/validation.
- Context bounded, truy vấn độc lập song song, không tóm tắt bằng model ở mọi lượt; không đọc toàn bộ lịch sử.
- Một commit local cho cả task+deadline+receipt+reply intent. Không vòng LLM → tool → LLM cho thao tác CRUD đơn giản.
- Quota hiện 4 request/60s và daily cap là giới hạn ứng dụng, không khẳng định bằng quota Google. Phải đối chiếu account/model thực tế trước live và chọn cap phù hợp hội thoại. Không tự paid fallback.
- Đo stage durations riêng: inbox, context, inference, commit, Telegram. Chỉ log ID/status/timing, không nội dung/keys. Không hứa số giây trước đo.
- Provider timeout/hết quota báo trung thực; không silently vứt yêu cầu. Receipt thể hiện cần thử lại, không giả đã thêm. Không mở lại chiến dịch thử persona vô hạn.

## 7. Triển khai theo đầu ra, một đợt duyệt code

**C1 — Câu nói tạo/sửa task có nhiều trường:** schema intent mới, capture+deadline atomic, date precision, pending clarification, inference receipt và executor local. Dùng Gemini adapter đang có, không thêm agent framework/vector DB. Hoàn tác chỉ khi version còn khớp, không ghi đè thay đổi mới.

**C2 — Lời nói điều khiển hẹn/buổi và xác nhận:** entity resolution, reminder time khác duration, schedule/reschedule/rest, trạng thái task tối thiểu, pending proposal yes/no/đổi ý bằng lời. Cùng executor cho nút và chat. Không thêm wizard mới; cần schema hỗ trợ nhắc độc lập hoặc phân biệt rõ session thay vì ép duration.

**C3 — Kiểm thử và bật thử:** tự chạy hội thoại nhiều lượt bằng model giả + D1/workerd; bộ ca rõ/mơ hồ/tentative/xung đột/crash/quota/duplicate. Sau đạt mới trình model/quota/request budget live và quyền gửi context thật. Khởi đầu đề xuất không quá 10 request synthetic smoke, không dùng ngân sách này làm lý do lặp prompt. Staging vẫn AI off trước duyệt live; người dùng chỉ cần thử một vòng hội thoại hoàn chỉnh sau đó.

### Files dự kiến

- `src/ai/{contracts,chat,policy,persona,gemini}.ts`: envelope nhiều trường, persona chat-first, output validation và inference adapter.
- Mới `src/domain/conversation.ts`, `src/application/conversation-command.ts`; sửa `domain/{work,time,session}.ts`, `application/{context-builder,plan-command,process-inbox}.ts`, `ports/work-store.ts`: quyền hành động, thời gian chính xác, lời xác nhận và executor.
- Mới `src/adapters/d1/conversation-store.ts`; sửa `adapters/d1/{work-store,session-store,memory,reminders}.ts`: receipts/drafts/transaction. `entrypoints/worker.ts`, `config/env.ts`: nối runtime, metrics và quota hợp lệ. UI store chỉ sửa khi cần cho confirmation/read view, không xây thêm màn.
- Migration tiến tới mới `0009_conversation.sql` (tên kiểm tra lại lúc triển khai); không sửa 0001–0008 đã lên cloud, không xóa data. Giữ compatibility của dữ liệu cũ; backfill precision rõ, không đoán deadline semantics.
- Mới `tests/integration/conversation.test.ts`, `tests/unit/conversation.test.ts`; cập nhật ai-runtime/ai-adapter/policy/time/memory/workers-fetch và fixture có lý do. Không xóa test để che hành vi sai.
- PRODUCT_BRIEF/DECISIONS/HANDOFF cập nhật theo kết quả, không cần thêm bộ spec dài.

## 8. Cổng nghiệm thu hội thoại

1. “Có bài tiếng Anh, dl mai” tạo đúng một task+deadline ngày, không form/confirm thừa.
2. “À đổi thành thứ sáu” chọn đúng task vừa nói, không tạo task trùng; nhiều cách hiểu phải hỏi.
3. “Mai 9h nhắc bài ấy” tạo đúng hẹn hoặc hỏi đúng phần thiếu; không tự bịa duration.
4. “Nay mệt” không đổi lịch. Đề xuất → “ừ chuyển đi” áp đúng một lần; bấm nút hoặc nói yes có cùng kết quả.
5. “Hôm nay còn gì?” đọc DB đã commit, không bịa, card chỉ hỗ trợ overview.
6. Prompt injection/unknown IDs/version đổi/date sai bị backend chặn; không lấy câu assistant làm user authorization.
7. Retry/crash không duplicate mutation, receipt AI không bị mất rồi gọi vô hạn. Hết quota/timeout không nói đã lưu.
8. Persona tự nhiên trong chat và báo kết quả, không ép mọi câu cute, không liên tục hỏi/đẻ button. Latency đo thật và công bố giới hạn trước nghiệm thu.
