# Thay đường hội thoại bằng gọi công cụ — phạm vi duyệt

2026-09-12. Đã được user duyệt triển khai bằng yêu cầu làm một lượt dài. Đang thay source, chưa cutover/deploy. Yêu cầu sản phẩm/persona không đổi; không thêm UI/provider/framework.

**Trạng thái mới nhất:** đã cutover source handler sang native tool calling, chỉ off/on; gỡ directRequest/legacy JSON-intent khỏi src. Pending resolve qua model hoặc nút đều dùng executor; nút không gọi provider. Legacy harness chuyển vào experiments giữ tests. Production giảm khoảng500 dòng, không dependency mới. Cloud chưa deploy,0010 chưa remote. Cần smoke native với quyền mới; generic draft clarification/assistant-origin proposal và semantic authorization vẫn cần kiểm chứng, không coi test pass là mọi ca hội thoại đều đúng. Các checkpoint bên dưới là tiến trình kỹ thuật trước cutover source.

Checkpoint: đã có function declarations/response parsing/data validation và adapter native giữ nguyên model parts/call ID, không dùng JSON response schema cho tool mode. Các entrypoint cũ chưa chuyển, executor/receipts/cleanup chưa hoàn tất; đây chưa phải bot function calling đã chạy. API đối chiếu [Google generateContent](https://ai.google.dev/api/generate-content) và [function calling](https://ai.google.dev/gemini-api/docs/function-calling); không đổi model theo ví dụ tài liệu.

Checkpoint executor: tool-executor dùng typed args/WorkReader, trả result+mutation plan; loop bounded trong conversation-command dùng ports model/execute/commit, không retry mutation khi final-model lỗi. D1 find_tasks/get_agenda owner-scoped/paginated. Còn nối step receipts/pending/commit với runtime, hỗ trợ xóa deadline và dọn các handler cũ; code trung gian chưa deploy. Không thêm file executor thứ hai.

Checkpoint journal: migration0010 thêm tool_steps (unique write/turn) và pending_tool_actions chuẩn. ConversationStore.step/commitWrite lưu kết quả và guard owner lease; model bước mất kết quả không gọi lại, write receipt cùng transaction nghiệp vụ. Pending có owner/TTL/one-use; test rollback/replay/input mismatch/sender hết lease đạt. Chưa nối orchestrator production hoặc áp migration; không coi code legacy đã được dọn.

Checkpoint nối D1: ConversationStore.turn kết nối journal với bounded loop/executor và commit shared mutationStatements, context+reply snapshot trong inbox. Replay trả applied result mà không chạy nghiệp vụ lại; final model lỗi dùng fallback kết quả đã lưu. Test tạo task typed deadline19:00 và mất final reply/model đạt. Chưa handler production/pending confirmation consumption/cleanup; không deploy.

## 1. Luồng duy nhất

Telegram → inbox/owner lease → context nhỏ → Gemini → tool call có kiểu → backend validate/execute → tool result → trả lời người dùng.

Gemini quyết định cần đọc dữ liệu nào, chọn tool và điền trường. Backend quyết định quyền, độ hợp lệ và commit. Không dùng regex mẫu câu để cấp quyền sau model. Câu “thêm cho tớ việc rửa bát deadline 7h tối nay” phải tạo task với deadline 19:00 giờ Việt Nam nếu thời gian còn phù hợp, không đi qua wizard hay confirm thừa. Nếu user chỉ nói deadline ngày thì giữ date-only. Model nhận current time/timezone để normalize; backend kiểm tra ISO/date/calendar validity, precision và thứ tự thời gian, không bắt whitelist cách nói ngày giờ.

Một turn xử lý ba kết quả: chat thuần, tool call, hoặc clarification/confirmation đang chờ. Một executor dùng chung cho lời nói và nút xác nhận; không có “executor UI” và “executor LLM” với hai luật khác nhau.

## 2. Công cụ tối thiểu

| Tool | Trường chính | Quyền |
| --- | --- | --- |
| find_tasks | query, status, cursor | Đọc theo owner do server gắn, kết quả giới hạn/có trang tiếp |
| get_agenda | from, to, cursor | Đọc task deadlines, appointments và sessions local; Google chỉ khi đã kết nối/bật, không giả đã đọc Google |
| create_task | title, deadline {value, precision} hoặc null | Tự ghi yêu cầu trực tiếp rõ; không tự tạo reminder từ deadline |
| update_task | task_id, expected_version, patch deadline/status | Tự đổi khi target và yêu cầu rõ; operation completion/undo tái dùng logic hiện có |
| set_reminder | task_id, expected_version, at | Tái dùng task_appointments, không bịa duration; nói rõ thay hẹn cũ nếu có |
| set_reminder_pause | until hoặc resume | Tái dùng pause, không suy “mệt” thành pause |
| remember_preference | content, lifetime | Chỉ lưu yêu cầu nhớ trực tiếp, không suy diễn fact lâu dài |

Không generic SQL, URL fetch, delete_everything, arbitrary tool name hay patch mọi cột. Không tự thêm Google writes, fuzzy search service, vector DB, scheduler/agent framework. Đọc item detail có thể ghép vào find_tasks theo ID nếu cần, không tạo hàng chục tool CRUD vụn.

## 3. Quyền và confirmation không ép form

- Tool args là dữ liệu không tin cậy: schema strict, owner từ request, ID thuộc owner, version đúng; trường không có trong schema bị từ chối. Confidence do model báo không phải quyền.
- Capture rõ và sửa một mục trong quyền đã chốt tự làm; không kiểm lại câu bằng regex. Giữ metadata nguồn turn/draft để audit, không coi substring evidence là bằng chứng hiểu đúng ngữ nghĩa.
- Cần xác nhận khi trợ lý tự đề xuất thay đổi, nhiều thay đổi, xóa/phạm vi chưa được phép hoặc xung đột. V1 chỉ một tool ghi/turn: nhiều yêu cầu được hỏi/chia rõ, không âm thầm thực hiện một nửa.
- Một pending action chuẩn chứa id/owner/operation/validated args/entity versions/expiry/state. Phân biệt pending clarification (chưa đủ args) và pending confirmation (đủ args nhưng chưa được user đồng ý), không các reason-specific branch completion-scope/existing-or-new/duplicate-title rải rác.
- Nói “ừ”, bổ sung thông tin hoặc đổi ý được Gemini xử lý cùng pending context. Nút có ID pending và đi thẳng cùng executor. Chỉ fast-path yes/no nếu binding duy nhất, đúng TTL/version và không nội dung sửa thêm; không dùng regex để hiểu nghiệp vụ.
- “Mệt”, ví dụ, lời trích dẫn và dữ liệu task/Calendar không phải quyền ghi. Đây vẫn là rủi ro semantic của LLM: phải test nhiều cách nói/phủ định, không hứa tool calling tự bảo đảm đúng.

## 4. Trần chi phí và hành vi lỗi

- Một turn tối đa 3 lượt model (initial → sau read → final sau write), tối đa 2 tool đọc, 1 tool ghi. Batch các read độc lập; không agent loop vô hạn. Chat thuần 1 lượt; write rõ + lời chốt thường 2 lượt. Không hứa mọi task chỉ 1 request.
- Sau write: phản hồi tự nhiên từ tool result đã commit. Nếu hết quota/lỗi model ở lượt cuối, dùng câu xác nhận ngắn do backend dựng từ kết quả, không lặp tool ghi. Không cần model lần hai nếu response không cần diễn giải; đây là tối ưu sau đo, không trộn hai protocol.
- Mỗi provider request đều reserve quota D1; model/tool step có ID và receipt. Retry update/step không tạo mutation trùng. Ghi result local+mutation trong cùng transaction; Google giữ reconciliation riêng.
- 20 request của pilot cũ không đồng nghĩa 20 lượt chat/tool loop. Không tự tăng hoặc gia hạn, không dùng lại budget smoke đã hết. Live mới cần trình request budget rõ.
- Giữ timeout/bounded input/output, endpoint cố định/manual redirects, redacted error. Ghi phase timings và counts để phân biệt DB/model/Telegram, không raw key/chat trong log.
- Chưa gọi công cụ hoặc write thất bại → không nói đã xong. Write đã commit nhưng final chat lỗi → báo kết quả thật bằng fallback, không nói toàn yêu cầu thất bại.

## 5. Giữ / thay / loại bỏ

| Phần hiện tại | Xử lý dứt điểm |
| --- | --- |
| Telegram webhook, D1 transactions, owner isolation, outbox, UI card lifecycle | Giữ, chỉ nối tool result/pending khi cần |
| tasks, sessions, task_appointments, reminders, memory, Calendar adapter | Giữ mục đích nghiệp vụ; không xóa khi còn dữ liệu/consumer |
| ai/gemini.ts GeminiTrial: generate + generateConversation | Thay adapter production bằng một protocol Gemini function calling; trial-only code chỉ trong experiments nếu harness còn cần |
| ai/contracts.ts, ai/policy.ts | Thay bằng schema tool/result và policy thao tác; bỏ selectedScope UI và draft field/value cũ |
| ai/chat.ts trialChat/contextualChat | Xóa khỏi runtime và source production; chuyển đúng phần harness cần sang experiments hoặc bỏ entrypoint harness hết dùng sau đối chiếu tests |
| application/conversation-command.ts | Thay logic intent-kind/regex bằng orchestrator ngắn, không nối thêm branch cạnh code cũ |
| domain/conversation.ts directRequest/conversationDeadline/unsupportedSuccessClaim | Loại khỏi đường runtime sau chuyển; type/schema mới tái dùng file. Giữ domain date validation chung, không giữ whitelist từ ngữ như lớp gate |
| conversation_pending + reason-specific draft | Migration sang pending action versioned; expire pending cũ có thông báo, không execute lại hoặc đoán convert |
| conversation_receipts | Tái dùng/tiến hóa thành model+tool receipts có step IDs; không tạo hệ logging/receipt thứ ba |
| AI_MODE enabled/conversation/off | Kết thúc chỉ off/on và một chat handler production. Chuyển config và tests cùng lần cutover; không duy trì legacy feature flag lâu dài |
| Quota/callsite appointments phụ thuộc AI_MODE=conversation | Bỏ coupling: dữ liệu nhắc đã lưu tiếp tục chạy dù AI off, dùng chung dispatcher, không tạo lịch nền mới |
| Inline prompt trong Gemini và persona cũ chồng nhau | Một persona+tool instruction production có version, không copy ba prompt |
| Tests mock schema cũ/harness | Giữ intent safety/date/replay cases, viết lại assertions theo protocol mới; không xóa failures cho xanh |

## 6. Danh sách file có thể thay đổi

Ưu tiên sửa file hiện hữu, không thêm module nếu chỉ bọc một hàm:
- `src/ai/{gemini,contracts,policy,persona}.ts`: tool declarations, protocol mapping, policy và persona duy nhất. `src/ai/chat.ts` bỏ runtime/xóa sau chuyển test imports.
- `src/application/{conversation-command,context-builder,plan-command,process-inbox}.ts`: orchestrator/context/router; các command UI chỉ chuyển phần nghiệp vụ trùng về executor chung, không viết lại UI.
- `src/domain/{conversation,time,work}.ts`, `src/ports/work-store.ts`: tool/pending contracts và domain validation.
- `src/adapters/d1/{conversation-store,work-store,memory,reminders}.ts`, `src/entrypoints/worker.ts`, `src/config/env.ts`: receipts/executor/query/quota, một runtime; chỉ sửa session-store nếu cần hợp nhất giao dịch dùng chung.
- Tối đa một file mới `src/application/tool-executor.ts` nếu giúp tách orchestration khỏi nghiệp vụ; không thêm registry động/dependency injection framework.
- Migration mới `0010_tool_turns.sql` sau kiểm tra số cuối, **không sửa 0001–0009 đã áp**. Giữ data; obsolete tables/columns chỉ drop sau xác minh zero references và backup/restore, không để chạy job truy cập chúng nữa.
- `wrangler.jsonc`, `package.json`, docs liên quan chỉ khi loại nhánh/script cũ hoặc cấu hình cutover. Không thay dependencies nếu native API đã đủ.
- Tests conversation/ai-adapter/policy/ai-runtime/workers-fetch và architecture; experiments chỉ chỉnh để không import code trial đã bỏ khỏi src. Không rewrite toàn thư mục test.

## 7. Trình tự làm và điều kiện xong

1. Chụp baseline file/import/callsite, bảng/jobs và test; cập nhật bảng giữ/thay/bỏ với dependency thật. Git checkpoint, không copy nguyên src vào archive thứ hai.
2. Triển khai schema+adapter và executor mới trong file thay thế, test fake native function calls/results; chưa bật live hoặc deploy nửa chừng.
3. Chuyển mọi entrypoint/caller, pending/receipt và config một lượt; xóa imports/branches/helpers cũ không dùng, bảo toàn tests hữu ích. Một path AI production, không fallback âm thầm sang protocol cũ.
4. Test end-to-end: capture “thêm cho tớ…7h tối nay”, lookup ngoài trang đầu, nhiều trùng tên, pending answer, read→write→reply, “mệt”/ví dụ/phủ định, stale version, duplicate update/tool call, crash sau commit, quota giữa turn, malformed tool/unknown owner/SQL injection. Workerd thật, provider fake.
5. Kiểm tra sạch: architecture test/import search chứng minh không legacy chat entrypoint/directRequest/runtime regex whitelist; mọi table/job có consumer+mục đích; không dead feature flag. Báo diff số file/LOC/dependencies/bundle để review, không ép chỉ tiêu LOC làm code khó đọc.
6. Cập nhật một hướng dẫn vận hành và HANDOFF mới, chuyển plan cũ thành historical link thay vì nối mãi status mâu thuẫn. Chỉ sau đạt mới xin ngân sách smoke live/cutover cho user thử.

## Không làm trong đợt này

Không thêm UI, multi-agent, Mini App, XP, nhiều provider, lịch nền tự tạo hay rewrite Calendar. Không xóa dữ liệu người dùng để làm code gọn. Không biến “LLM làm mọi việc” thành quyền tùy ý gọi SQL hoặc tự lên lịch khi user chỉ tâm sự.
