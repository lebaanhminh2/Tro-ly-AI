# Habit/Thần Lộ — kiến trúc và hợp đồng kỹ thuật

Cập nhật 2026-10-12. Thiết kế khung cho triển khai, không phải schema/API đã có. Baseline source ứng dụng: `51f5ffd`, docs trước đợt này: `23a1808`; agent kiểm lại HEAD/schema thực tế khi bắt đầu.

## 1. Tiếp nối kiến trúc

```mermaid
flowchart TD
    WEB[Web models / views / features] --> HTTP[API entrypoints: auth và DTO]
    BOT[Telegram và tools] --> APP[Application use cases]
    HTTP --> APP
    CRON[Cron: lượng việc có giới hạn] --> APP
    APP --> DOMAIN[Domain: habit / luyện / battle thuần]
    APP --> PORT[Ports: lưu và đọc theo use case]
    STORE[Adapters D1: SQL / guards / receipts] -. triển khai .-> PORT
    AI[Gemini adapter] --> BOT
```

| Vùng | Vai trò | Mẫu cần khảo sát |
| --- | --- | --- |
| `src/domain` | Hàm thuần, state transition, thời gian/random truyền vào | `healthy.ts`, `recurrence.ts`, `availability.ts` |
| `src/ports` | Interface cho use case, không expose D1/SQL | `work-store.ts`; tách interface mới vừa đủ |
| `src/application` | Điều phối, validation nghiệp vụ, giao dịch qua port | `schedule-command.ts`, `tool-executor.ts` |
| `src/adapters/d1` | Queries, constraints, receipts, optimistic guards, atomic commit | `healthy-store.ts`, `schedule-store.ts`, `day-plan-store.ts` |
| `src/entrypoints` | Auth/input cap, lỗi, wiring, công việc có giới hạn | `mini-app.ts`, `mini-app/context.ts`, `worker-scheduler.ts` |
| `web` | Server là nguồn chuẩn; models/features/views nhỏ | `core/mutations.js`, `core/http.js`, `features/sleep.js` |

Không SQL/fetch/config/process.env trong domain/ports/application. Không thêm mọi luật vào file trung tâm hoặc abstraction chỉ để dự phòng. Thư mục con/dependency/refactor có thể dùng khi có lợi ích đo/kiểm được; không tự chuyển stack/hosting. Gate import hiện chỉ quét file trực tiếp; agent phải mở rộng phủ thư mục con nếu tạo chúng. Scripts test hiện dùng glob file trực tiếp; test đặt trong thư mục mới phải được discovery/chạy thật, không chỉ được tạo trên đĩa.

## 2. Nhóm dữ liệu cần thiết kế

| Nhóm | Dữ liệu/trách nhiệm | Bất biến |
| --- | --- | --- |
| Habit definitions/revisions | Mục tiêu, lịch, lifecycle, mốc hiệu lực | Lịch sử đọc theo revision hiệu lực, không theo mục tiêu mới |
| Commitments/periods | Q, cửa sổ ngày/tuần, ngày hợp lệ, đóng kỳ | Thay/xóa không xóa nghĩa vụ đã phát sinh |
| Logs | Habit/ngày, giá trị cuối, ghi chú, version | Một trạng thái hiện tại/ngày; ngày đóng chỉ đọc |
| Contributions | Đạt/thiếu mới, nguồn, receiver/chế độ, preview/final | Unique nguồn/kỳ; trung tính không thành success |
| Cultivation | Quyền học, bản luyện, tầng, tiến độ/phẩm chất/provenance | Chất lượng đã khóa và bản cũ bất biến |
| Battles | Bộ chiêu/bản, nền, intent, lựa chọn, turn, HP/status, result | Snapshot và rule/content version xác định kết quả |
| Story/rewards | Đường mở, quyết định truyện, unlock, thần binh, chiến tích | Một reward entitlement; không nhận lại khi refresh/replay |
| Requests/jobs | Receipt, version, lease/fence, checkpoint kết toán | Retry không nhân mutation, job muộn đúng kỳ |

Đây không phải yêu cầu một bảng cho mỗi dòng. Agent chọn SQL/JSON phù hợp và viết actual schema/DTO/transaction notes ở P0. Không nhét 39 môn/bản/history/battle log vào HealthyState JSON: `HealthyStore` hiện giới hạn account/result/request JSON khoảng 12 KB. Không mặc định mọi lần ghi habit phải đụng account.

Các index/constraint cần owner + source/day/period/version; queries bind params, phân trang ổn định và giới hạn history. Snapshot nguồn có giới hạn, không sao chép toàn bộ kế hoạch mỗi lượt. Tách payload log chi tiết khỏi bootstrap.

## 3. Giao dịch và replay

Một use case ghi phải nêu rõ: canonical request, expected day/version, dữ liệu đọc, guards kiểm lúc commit, writes cùng transaction, receipt/result và side effects sau commit.

- Cùng ID + cùng canonical payload: trả kết quả đã lưu. Cùng ID + payload khác: conflict. Receipt đã tồn tại được replay kể cả ngày đóng; không tạo mutation mới.
- Retry qua ngày chưa commit: từ chối stale day, không tính lại ngày/payload và tự ghi sang hôm nay. Server quyết định thời gian; client gửi expected day để phát hiện lệch, không để được chọn ngày cũ.
- D1 batch dùng constraints/guards thật; không giả transaction bằng read → nhiều write độc lập. Concurrency account/habit/battle kiểm version hoặc điều kiện tương đương tại commit.
- Khi có delta Tu Vi/rank/inventory/tickets, delta và kết quả/receipt/reward nguồn phải cùng commit hoặc cùng thất bại. Không lấy lock in-memory Worker làm guarantee.
- Kết toán một nguồn chỉ một lần, theo thứ tự kỳ; hai tab/cron/LLM không nhân. Không tái dùng đóng góp đã thuộc battle cho luyện sau khi rút/thắng.
- Random server được lấy/lưu trong request/result hợp lệ để retry không reroll; không tin roll/damage/reward từ client/model.
- Outbox phát sau commit, có dedupe và lease/version fence. Gửi ngoài hệ thống có thể uncertain; không hứa exactly-once Telegram và không reset uncertain để thử lại hàng loạt.

Use case ghi log, đóng ngày, đổi chế độ, lên tầng, kết toán lượt, cứu/tử trận và thưởng cần integration tests bằng D1/local. Chỉ mocking port không chứng minh atomic writes.

## 4. API và tools: hợp đồng phải có

Tên endpoint/DTO do AI quyết định, không cần cố đóng băng URL từ tài liệu. Web và bot/LLM gọi cùng application rules; mỗi khả năng phải có input, output, lỗi, giới hạn, version và quyền rõ.

| Khả năng | Input cần có | Output/điều kiện chính |
| --- | --- | --- |
| Đọc tổng quan | Phạm vi ngày/kỳ hợp lệ, paging | Server time/day, revisions, preview/final; snapshot giới hạn |
| Quản lý habit | Fields whitelist, expected version, effective policy | Definition/revision và mốc hiệu lực; không mass assignment |
| Ghi habit | Habit ID, tổng hoặc action rõ, expected day/version, request ID | Giá trị đã lưu, trạng thái đạt, preview; day closed/stale/conflict rõ |
| Lịch/nhắc habit | Source ID, giờ/slot/duration, version | Conflict/capacity, occurrence liên kết; không tạo task thưởng |
| Đọc history/export | Bộ lọc/cursor/kỳ có giới hạn | Dữ liệu read-only/versioned, không kích hoạt settlement giả |
| Luyện/đổi chế độ | Bí tịch/bản mục tiêu, ngày hiệu lực theo server | Trạng thái hiện tại và pending; xác nhận luyện lại giữ bản cũ |
| Chuẩn bị/bắt đầu/rút trận | Boss/loadout IDs, expected state/version | Giá/rủi ro/hạn khóa; không owner/damage do client chọn |
| Chọn chiêu | Trận/ngày, môn/bản đã mang, version/request ID | Lựa chọn/preview, chi phí đã công bố; chưa final trước chốt |
| Cứu/nhận kết quả | Trận, quyền cứu, expected state/request ID | Delta/cost/result nguyên tử; không rút sau HP 0 |
| Library/story/log | IDs có quyền xem, cursor | Nội dung đã mở, spoiler policy, rule/content version |

Mọi endpoint kiểm owner từ auth context. Giữ Telegram initData/HMAC/TTL, browser auth/cookie/Origin và error semantics hiện có. Request API hiện có cap 4 KB; nếu payload mới cần đổi cap, chứng minh nhu cầu và vẫn có giới hạn. Không cho AI arbitrary SQL/code/network hay chọn owner/thời gian kết toán.

Tool chỉ ghi khi user có yêu cầu rõ trong cơ chế hiện tại. Hỏi tình trạng không tự tạo habit/đổi chế độ/chọn cấm thuật. Context gồm ngày server, sleep/focus/notification state, tóm tắt habit/chế độ/trận liên quan với revision; không đưa cả catalog/history hoặc dựa summary để suy quyền. Khi Gemini lỗi/quota, web và luật/kết toán vẫn dùng được.

## 5. Thời gian và cron

Ngày sinh hoạt lấy từ `operatingDay/dayWindow`; điểm danh vẫn dùng ngày lịch Việt Nam. Snapshot đầu kỳ phải ổn định khi user đổi settings, mode hay catalog. Các period đã đóng không thể được viết lại bằng sửa giờ máy/client.

- Xử lý các ngày/kỳ cần đóng theo thứ tự thời gian; chốt đóng góp D bằng chế độ D kể cả cron đang ở D+1.
- Công việc có lượng tối đa mỗi lần, checkpoint/resume, indexes và quyền retry rõ. Không sweep mọi user/history hoặc mọi content mỗi phút.
- Tôn trọng cron bốn pha/giới hạn runtime hiện có; đo query count/CPU thực tế tại fixture đại diện và sát giới hạn lớn. Không coi LIMIT hoặc mock test là bằng chứng đủ hiệu năng.
- Delayed/repeated/concurrent jobs, crash giữa commit và outbox, backlog nhiều ngày phải converge tới cùng kết quả. Habit commitments bị thiếu vẫn chốt; trận vắng app theo chính sách safe absence.
- Kết toán dùng engine thuần, không gọi LLM hay sinh ảnh. Clock giả chỉ ở fixture/test tooling local, không để API đổi thời gian/test grant mở trên staging.

## 6. Tích hợp ngủ, focus, lịch và kinh tế

- `/ngu` hoặc web sleep là nguồn trạng thái chuẩn. Chặn lời thúc task/ngủ và lời chủ động tương đương focus; lời nhắc user đã cấu hình tiếp tục, trừ pause/inactive. Không áp một điều kiện ngủ lên toàn outbox.
- Lỗi báo ngủ sớm nhưng còn nhận nhắc chưa được xác định nguyên nhân. Điều tra từ receipt/day/generation/outbox/final-send; thêm regression đúng nguyên nhân rồi sửa. Không suy từ một timestamp rằng đã biết root cause.
- Undo ngủ giữ cửa sổ 5 phút/guards hiện có, không giới hạn mới 1 lần/ngày. Đảo delta ngủ, không khôi phục cả account; đột phá hoặc mutation có liên quan có thể khóa undo theo guard.
- Liên kết habit ngủ/điểm danh là opt-in, shared source và preview; không tự biến streak hiện có thành habit. Delta game đã khóa phải theo thời gian chốt; báo ngủ không chốt trận.
- Slot habit đi qua khả năng plan/availability phù hợp, không viết lại planner và không làm ảnh hưởng task đã xong/cha–con/deadline/work log. ACK reminder khác với hoàn thành task/habit.
- Task thưởng vé lần đầu theo nguồn task gốc; đột phá thông thường, gacha, inventory, sleep penalties tiếp tục theo source hiện tại. Cấm thuật/cứu mạng là delta nghiệp vụ mới có giá/guard riêng.

## 7. Version nội dung và hiệu năng tải

Catalog khai báo data có validate và finite effects. Lưu rule/content version hoặc đủ snapshot cho trận/tầng đang chạy; khi balance đổi, không giải thích log cũ bằng công thức mới hoặc đổi boss âm thầm giữa trận. AI chọn chiến lược publish/compatibility trước batch nội dung đầu.

Bootstrap chỉ có thông tin đủ cho tab/overview; lazy load catalog/chapter/history/art theo màn. Có cache phù hợp cho static immutable assets, hash/version khi thay ảnh. Bounded payload và paging được đo; không preload cả 15 chương/39 môn/ảnh lớn trên mạng di động.

App phục vụ ảnh cuối; model/inference/dependency art chạy local, không trong Worker. D1 data thật, SQL backup, model weights, venv/cache/ảnh nháp và secrets không vào Git.

## 8. Nâng cấp, backup và tắt tính năng

- Migration bổ sung sau số hiện có (khảo sát đang tới 0030); kiểm lại trước tạo. Không sửa migration lịch sử.
- Nâng cấp DB cũ với fixtures task/reminder/healthy/auth/sleep thật về cấu trúc; so counts/invariants, kiểm foreign keys/constraints và queries mới.
- Backup staging trước schema change, giữ riêng ngoài Git và kiểm restore vào DB riêng. Không phát reminder từ DB restore/test.
- Rollback code/config hoặc tắt feature phải có chính sách job đã pending/settlement; không rollback schema bằng xóa dữ liệu. Tắt UI game không tự xóa trận hoặc nghĩa vụ habit.
- Export người dùng và operational backup khác nhau. Import/restore phải idempotent với source IDs và không reissue thưởng, mở ngày cũ hoặc xóa dữ liệu thật để “cho chạy test”.
- Lưu metrics lỗi/latency/backlog có giới hạn, không token/initData/raw chat. Kiểm độ lớn log/history và hướng bảo trì khi tài khoản dùng 1–3 năm.

Tiêu chí release và bằng chứng tại [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md); thao tác cloud tham khảo [OPERATIONS](OPERATIONS.md) và quyền mới nhất trong [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md).
