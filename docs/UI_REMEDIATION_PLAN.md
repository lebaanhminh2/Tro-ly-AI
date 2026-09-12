# Kế hoạch sửa UI Telegram theo hệ thống

2026-09-12. Người dùng đã duyệt tiếp tục sửa UI/UX, đồng thời xác nhận hội thoại là chính. Kế hoạch đang triển khai, chưa nghiệm thu. Tài liệu này thay cách xử lý từng lỗi ảnh trong UX_REVIEW; các khoảng trống nghiệp vụ ở đó vẫn còn. Không mở rộng wizard thành đường chính, không bật provider trong đợt UI.

## 1. Ranh giới LLM và UI

### Tiến độ triển khai (chưa nghiệm thu)

- Đã có renderer chung và tests grapheme/layout.
- Đã thêm `domain/ui.ts`, migration `0008_ui_cards.sql`, `adapters/d1/ui-store.ts`: card/action/delivery bền vững, callback token opaque gắn owner/message/revision, statement builders ghép cùng transaction nghiệp vụ, lease từng card và guard kết quả sender.
- Đã thêm Telegram editMessageText/no-op edit và test trong workerd. Test lifecycle bao phủ replay, sai owner/message, chưa render, rollback nghiệp vụ+UI, restart store, sender quá hạn và uncertain không tự retry.
- Đã nối UI store vào `createWorker(..., cardsEnabled=true)`, prepareUi trước nghiệp vụ, commit cùng UI transition và dispatcher webhook/cron. Worker mặc định vẫn false: chưa bật chế độ mới trên cloud, migration chưa áp remote. Test Worker đã đi qua capture, list/detail/back và wizard trên cùng card; không dùng đường cũ để chứng minh test mới.
- Có notice cho callback cũ bằng answerCallbackQuery, retry 429 có budget lưu D1. Còn ACK sớm cho thao tác chậm, fallback card bị xóa, recovery/reconcile edit uncertain, chuyển reminder sang card mới và compatibility cho keyboard cũ. Module mới hiện từ chối raw callback cũ; chưa được bật trước khi migration reminder/compatibility hoàn tất. Calendar dùng side effect riêng nên cần test/guard cùng transition, chưa coi đã tích hợp toàn bộ A→B→C.

Cập nhật sau checkpoint trên: early ACK trước nghiệp vụ qua flush riêng ID, card bị xóa/không sửa được có replacement một lần và action token mới. Reminder raw có cầu nối chỉ từ outbox sent đúng owner/chat/message/session generation; không nhận raw callback tùy ý. Các request timeout vẫn uncertain không tự gửi lại. Mode mới vẫn tắt, Calendar transition/uncertain recovery còn phải nghiệm thu.

Chat tự nhiên là đường nhập chính mong muốn: người dùng nói yêu cầu → LLM trích ý định/tham số → backend xác thực/đòi thông tin thiếu → đề xuất → xác nhận khi cần. Nút là đường nhanh và fallback, không ép người dùng đi wizard nếu câu nói đã đủ. LLM và nút phải dùng cùng application command và cùng renderer. Không giao layout, callback payload, quyền thực thi hay vòng đời card cho model.

Thực tế src/ai/chat.ts hiện chỉ tạo proposal capture trong trường hợp hẹp, update_task đẩy về nút. Chưa có việc LLM gọi đầy đủ form lên lịch/đổi hạn. Không hứa bật Gemini là tự có hành vi ấy. Tích hợp đó là bước sau, không phải điều kiện sửa UI.

## 2. Nguyên nhân ở source

| Nguồn | Phát hiện | Hệ quả |
| --- | --- | --- |
| domain/work.ts View | Chỉ text/buttons/silent, không có screen/card/revision/render mode | Không mô tả được cập nhật tại chỗ, toast hay kết thúc flow |
| d1/work-store.ts commit | Luôn sendMessage khi không silent | List/detail/back và mỗi bước wizard tích lũy tin |
| work-store clear keyboard | Chỉ resolve/session-action/memory-resolve/silent; clear ID chỉ theo message ID | Bỏ sót navigation, cancel, wizard, forget thành công, Calendar. Một card nếu tái sử dụng thì clear cũ có thể chặn lần clear sau |
| telegram/api.ts | Có editMessageReplyMarkup, chưa editMessageText | Không thể cập nhật cả nội dung+keyboard của card hiện tại |
| worker.ts ACK | ACK rỗng, chung hàng đợi với replies | Silent stale không có giải thích; ACK có thể bị chậm bởi gửi tin khác |
| outbox.ts | Xếp available/id, không revision card/dependency | Khi thêm edit tại chỗ, job edit cũ có nguy cơ ghi đè màn mới; cần giải quyết trước |
| application/*.ts, domain/session.ts, Calendar service, ai/chat.ts | Tự tạo Button[][] ở nhiều nơi, tự slice 25/30/35/40 ký tự | Nhãn dài, cắt Unicode; cùng hành động có nhiều cách bố trí |
| session/plan-command wizard | Chỉ task+expiry; day/time/duration không có revision bước; cancel-input không gắn flow | Nút bước trước vẫn hợp lệ trong cùng expiry; hủy từ card cũ có thể hủy flow mới |
| session-command session detail | Chỉ tên/giờ/phút, không luôn nêu trạng thái | Khó phân biệt đang chạy/tạm dừng/bỏ buổi |
| memory-command | Forget cũ silent; forget thành công không thuộc điều kiện clear | Keyboard danh sách không được cập nhật nhất quán |
| Calendar service | Trả View với changes rỗng, tự mutation; toggle chỉ callback ID lịch | Cơ chế clear dựa changes không bao phủ; toggle lặp bằng update mới có thể đảo lựa chọn trở lại |
| plan-command task list | next page khi đúng 10 mục, không lấy mục thứ 11 để xác định còn trang | Có thể dẫn tới trang rỗng; title/deadline lặp, deadline có thể ISO thô |

Đây là rà tĩnh toàn bộ nơi tạo UI/callback và đường delivery. Không tuyên bố đã tái hiện từng race trên cloud. Ảnh cho thấy truncation/layout nhưng chưa đo hết mọi mức cỡ chữ iOS; test chuỗi không chứng minh hiển thị đẹp.

## 3. Hợp đồng UI cần chốt trước code

- Ba loại phản hồi: `send` (tin trò chuyện/nhắc mới), `edit` (điều hướng/card thao tác), `notice` (toast ngắn cho stale/error nhẹ). Không dùng boolean silent thay cho kết quả UX.
- Card có owner/chat/message_id, kind, entity/flow ID, revision, status active/completed/expired. Xác nhận đã xong → thay bằng trạng thái kết quả, bỏ nút mutation đã dùng; có thể giữ nút điều hướng tiếp theo.
- Một card đang thao tác cho mỗi flow. List → detail → back sửa tại chỗ, không đẻ thêm card. Chat và nhắc vẫn là tin riêng; không sửa lời người dùng hay toàn bộ lịch sử.
- Bấm lặp: không mutation lặp; báo ngắn. Nút cũ có thể dẫn tới bản mới nhưng không tự áp dữ liệu mới. Không cố xóa mọi nút điều hướng sau một lần bấm: nút vẫn hữu ích thì giữ/cập nhật đúng trạng thái.
- Mọi bước wizard/cancel/back gắn flow ID+revision và kiểm tra owner/TTL. Chọn lại ngày/thời lượng → vô hiệu bước cũ. Restart không mất bản nháp hợp lệ.
- Renderer chung: nhãn động dài nằm trong nội dung, nút dùng động từ ngắn; một nút mỗi hàng cho chọn tên, tối đa hai nút hành động, tối đa bốn ô HH:mm. Cắt theo grapheme + dấu … chỉ là fallback, không bảo đảm chiều rộng. Tên đầy đủ luôn đọc được ở detail.
- Formatter ngày giờ thống nhất DD/MM/YYYY HH:mm giờ Việt Nam. Tên trạng thái thống nhất; thành công nói rõ thay đổi và hành động tiếp theo.
- ACK sớm không cần Gemini. Nếu đã ACK trước khi xử lý xong, kết quả stale phải cập nhật card/thông báo thích hợp; không giả Telegram cho phép ACK nhiều lần vô hạn.
- Không thay quiet đã bỏ; giữ pause và 2 lượt/lần hẹn. Không bật AI hay Calendar thật trong đợt này.

## 4. Ma trận bao phủ bắt buộc

| Luồng | Card/nút sau thao tác | Nhánh phải kiểm |
| --- | --- | --- |
| Start/help/settings | Menu điều hướng rõ, capability đúng | AI off/on, quay về, pause/resume |
| Task list/detail/page | Edit card, tên đầy đủ ở detail | Rỗng, 10/11 mục, tên dài/emoji, back lặp |
| Capture qua lệnh hoặc AI | Proposal → kết quả có hành động tiếp | Yes/no, expiry, duplicate, card mất |
| Deadline | Một flow/card, kết quả trước/sau | Ngày/giờ/phút, đổi ngày, cancel cũ, task version đổi |
| Schedule | Một flow/card, thời gian tuyệt đối | Day/time/duration/back/cancel, near-midnight, restart |
| Today/detail/session | Trạng thái + nút đúng phiên bản | Start/pause/resume/finish/skip/snooze, nhiều buổi |
| Reminder | Action thuộc đúng session/generation | Tin nhắc cũ, nhiều card cùng session, response suppression |
| Memory/list/forget/forgetall | Edit danh sách hoặc kết quả rõ | Xóa lặp, page rỗng sau xóa, confirmation cũ |
| Calendar controls/list/slots | Chung renderer và lifecycle | Setup/disconnect confirm, explicit selected state thay toggle mù, slot stale; fake provider |
| AI capture/update/focus | Chung card nghiệp vụ, không tự tạo layout | Model lỗi/quota/mơ hồ, không bịa đã thực hiện |

## 5. Thứ tự triển khai và files

**A — Hạ tầng UI dùng chung, chưa chỉnh từng câu riêng:**
- Mới `src/domain/ui.ts`, `src/application/ui-renderer.ts`, `src/adapters/d1/ui-store.ts`.
- `domain/work.ts`, `ports/work-store.ts`, `entrypoints/worker.ts`, `application/process-inbox.ts`, `adapters/d1/{work-store,outbox}.ts`, `adapters/telegram/api.ts`.
- Migration `0008_ui_cards.sql` thêm card/flow revisions và thông tin delivery cần thiết; không drop tasks/sessions/history.
- Lưu intent edit cùng transaction dữ liệu. Serialize/fence theo card, kiểm revision trước gửi. Request cũ đã rời hệ thống không thu hồi chắc chắn: reconcile render revision mới nhất, không hứa exactly-once.
- Telegram “message is not modified” xử lý idempotent đúng method; card bị xóa/không edit được thì fallback send có giới hạn và nối lại card ID. Timeout không blind retry send; lỗi UI không rollback dữ liệu nghiệp vụ đã commit.

**B — Chuyển toàn bộ nhà sản xuất UI sang hợp đồng chung:**
- `application/{plan-command,session-command,memory-command}.ts`, `domain/session.ts`, `adapters/d1/{session-store,memory,reminders}.ts`, `adapters/google-calendar/service.ts`, `ai/chat.ts`.
- Không cho LLM trả callback/UI tự do. Flow chat có đủ dữ kiện bỏ qua bước nhập tương ứng, nhưng hoàn thiện parser/intent Gemini riêng sau UI.
- Loại các nhánh render riêng sau khi migration, không giữ hai renderer song song lâu dài.

**C — Nghiệm thu ngang tất cả luồng rồi mới deploy:**
- Mới `tests/unit/ui-renderer.test.ts`, `tests/integration/ui-lifecycle.test.ts`; cập nhật ux-flow/telegram/workers-fetch/sessions/memory/calendar/ai-runtime.
- Snapshot mô tả từng màn: text, rows, callback kind, state; validator text/callback byte limit và grapheme, không chụp rồi tuyên bố đẹp.
- Test adapter thật trong workerd, Telegram transport giả có kiểm edit/send/ACK; race edit A/B, replay, crash, 429, timeout, deleted card, no-op edit.
- Chạy đầy đủ + typecheck/dry-run, scan secrets, commit/push. Chỉ deploy sau khi cả A+B+C đạt; không deploy từng vá nhỏ.
- Chốt thử iPhone ngắn cho chữ thường/lớn, keyboard mở/đóng, tên dài và wizard; đây là bằng chứng hiển thị cần thiết, không yêu cầu user tìm lỗi nghiệp vụ thay agent.

## 6. Tiêu chí hoàn tất đợt

Mỗi dòng ma trận có test thành công và stale/cancel/error phù hợp; navigation/wizard không tích lũy tin, nút mutation cũ không còn tác dụng và có phản hồi rõ; không card edit cũ ghi đè trạng thái mới không được xử lý; tên đầy đủ dễ tìm, nhãn nút thống nhất; nghiệp vụ không phụ thuộc AI. Không đếm số test làm tiêu chí UX duy nhất.

Ngoài phạm vi: Mini App, gamification, task lifecycle mới, Google PATCH hai chiều, bật provider/billing. Không dựng thêm menu từ khóa thay cho hoàn thiện trải nghiệm card; hỗ trợ “Thêm việc” là lối vào tiện dụng, không phải trọng tâm bản sửa này.
