# Kế hoạch triển khai Phá trì hoãn và nghiệm thu staging

Ngày lập: **16/11/2026**. Người dùng yêu cầu AI triển khai, đối chiếu thiết kế, tự kiểm thử/sửa hồi quy rồi bàn giao **staging hiện tại** để người dùng chỉ test thành phẩm. Tệp này là kế hoạch cho goal tiếp theo, chưa khởi chạy goal hoặc triển khai tính năng.

## 1. Nguồn chuẩn và thứ tự ưu tiên

1. Chỉ dẫn mới nhất của người dùng và phạm vi ủy quyền trong lệnh goal.
2. [Bản chốt thiết kế/hành vi](prototypes/anti-procrastination/README.md).
3. [HTML chuẩn](prototypes/anti-procrastination/index.html), [manifest](prototypes/anti-procrastination/reference/manifest.json), ảnh và GIF trong cùng bộ bàn giao.
4. Kế hoạch này cho kiến trúc, những khoảng trống của demo và cách nghiệm thu.
5. Mã nguồn hiện hành cho giao thức, xác thực, migration, ví và quy tắc ngoài tính năng.

Hash HTML đã chốt: `5a406bd64347177f5094858414302739a846b6cc48473f12e7da174fa56bfe6f`. Kiểm toàn bộ manifest trước và sau goal. Không sửa HTML, tài liệu thiết kế hoặc ảnh chuẩn để khiến implementation trông như đã đạt. [Kiểm chứng demo](prototypes/anti-procrastination/VERIFICATION.md) chỉ chứng minh demo; không được tính lại thành bằng chứng sản phẩm thật.

Tái sử dụng markup/SVG, giá trị CSS, hình học sao băng và nhịp hiệu ứng từ HTML. Có thể tách thành module, bỏ quy tắc cũ dư thừa có chứng minh; không viết một hiệu ứng khác từ mô tả “giống Genshin”.

## 2. Kết quả đối chiếu repository khi lập kế hoạch

| Phần hiện có | Nguồn và hệ quả cho triển khai |
| --- | --- |
| Giao diện Habit v2 | `web/views/habits-today.js`, `web/habits-v2.css`; vị trí thêm card là sau panel danh sách, trước Nhật ký/Tháp, trong trang active khi không chọn nhiều. Không chèn vào archive, lịch sử hoặc nhật ký. |
| Bộ điều khiển Habit | `web/features/habits.js`; có cache, revision, intent và khôi phục request. Feature mới cần phối hợp được với cơ chế hiện tại. |
| Dựng trang | `web/core/lifecycle.js` đang `replaceChildren()` ở phần lớn trang; chỉ Linh thú có reconcile riêng. Dựng lại DOM không được cắt một lần giữ hợp lệ, làm mất pointer capture hoặc khởi động lại hiệu ứng. |
| Giao dịch frontend | `web/core/http.js`, `mutations.js`, `live-data.js`, `state.js`; có request identity, trạng thái chưa xác nhận, session/revision và khóa ghi chung. Phải tích hợp, không dựng kênh ghi bỏ qua auth hoặc cập nhật ví hai lần. |
| Ví thật | `src/adapters/d1/healthy-store.ts`, `src/domain/healthy.ts`; `qi` và `earned` cùng tăng khi nhận tu vi, `tickets` là vé quay thường. Vé triệu hồi Linh thú nằm trong account khác. |
| Thưởng Habit | `D1HabitStore` gọi `HealthyStore.prepareHabitTicket()`, có quota ngày/tuần và tác động Linh thú. Không dùng luồng này để phát thưởng Phá trì hoãn. |
| Atomicity có sẵn | `HealthyStore.mutateWithAccount()` đọc receipt/ví, guard version và batch statements; có thể tận dụng cho hoàn tất lượt + hai khoản thưởng trong một transaction. |
| API thật | `src/entrypoints/mini-app.ts`, `mini-app/context.ts`; dùng session/Telegram owner, same-origin guards, body giới hạn, request id và ánh xạ lỗi. Chưa có API Phá trì hoãn. |
| Kiểm thử | Browser harness có API fixture, thích hợp kiểm UI; integration Miniflare dùng migrations và D1 thật. Cần thêm kiểm xuyên suốt UI → Worker → D1, không dùng API fixture làm bằng chứng backend. |
| Schema hiện tại | Có migrations **0001–0047**, mới nhất khi đọc là `0047_habit_order.sql`. Tài liệu vận hành cũ ghi 42 không thay thế source hiện hành. Khi thực hiện phải liệt kê lại, chọn số migration kế tiếp chưa tồn tại. |
| Đích phát hành | `wrangler.jsonc`: Worker `personal-assistant-staging`, DB `assistant-staging`, binding `DB`. Phải đối chiếu account/database/version thực tế trước ghi remote; không suy từ tên trong tài liệu. |
| Working tree | Đang có thư mục prototype chưa track và `docs/README.md` đã sửa; còn output cá nhân chưa track. Ghi baseline và bảo toàn toàn bộ. Không reset/clean, xóa output hay format cả repo. |

Đây là bản đồ điểm gọi, không khóa giải pháp vào tên module mới. AI được điều chỉnh tổ chức module có lý do và bằng chứng, giữ phạm vi tính năng.

## 3. Hợp đồng sản phẩm phải giữ

- Giữ liên tục **3000 ms**, hiển thị 1–2–3; sao băng xanh lao tới, chuyển vàng/tách mảnh, vút qua rồi chuyển đồng hồ. Hoàn tất tự động tại ngưỡng, không cần nhả hoặc bấm thêm.
- Thả sớm, kéo quá 45 px, Escape, mất focus hoặc ẩn tab khi đang giữ: hủy thao tác; không tạo lượt/thưởng. Resize thật cũng hủy thao tác đang giữ.
- Một lượt đang mở cho mỗi owner, kể cả khi đã hết giờ nhưng chưa xử lý. Đồng hồ **300000 ms**; rời app, tải lại, mở tab khác không mất lượt.
- Hết giờ chỉ hiện bước tự xác nhận đã làm. App không tự biết công việc, không bắt chọn/nhập tên việc, không tự thưởng khi hết giờ.
- Mỗi lượt tự xác nhận hợp lệ: **+1 tu vi, +1 vé quay thường**, không giới hạn lượt/ngày. Một occurrence chỉ cấp thưởng một lần, kể cả đổi request id.
- Giữ “Đã tự làm 5 phút” và bước xác nhận như demo; không bắt người đã làm ngoài app phải chờ thêm 5 phút. Đây là tự khai báo một lượt riêng, không được dùng để nhận lại occurrence đã xong/hủy.
- Hủy từ menu ba chấm, có xác nhận. Hủy không cộng thưởng, không mất thưởng cũ; reload không làm lượt hủy sống lại. Back/Escape giữ nguyên timer; hủy được cả lượt đã hết nhưng chưa nhận thưởng.
- “Bắt đầu bằng một chạm” trong menu là phương án truy cập thay thế. Giữ hỗ trợ bàn phím, giảm chuyển động và Canvas fallback.
- Thưởng cố định, không dùng multiplier hoặc trigger task/habit/ngủ/Linh thú cho lượt này; không đánh dấu Habit hoàn thành, không giúp đủ điều kiện Tháp, không tự sinh task.
- Bỏ công cụ DEMO/tua nhanh/xem thưởng/reset khỏi runtime. Không import dữ liệu hoặc phần thưởng từ localStorage của prototype vào tài khoản.
- Giữ phần chữ đã chốt; không thêm tên mỹ miều, rarity, SSR, lựa chọn việc hoặc luồng chơi kéo dài.

### Những mặc định được ủy quyền để goal không bị treo vì quyết định nhỏ

- State machine server: `active → completed | canceled`; “running/ready” được suy từ `endsAt`, không cần cron mỗi giây/phút. Trạng thái hoàn tất/hủy là terminal.
- Một active occurrence cho mỗi owner; khi xung đột, tải và tiếp tục lượt đã lưu. Không âm thầm tạo thêm lượt ở tab thứ hai.
- Lượt không bị xóa hoặc tự phát thưởng lúc qua ngày/qua giờ ngủ. Chấp nhận claim sau khi mở lại, miễn chưa hủy/hoàn tất; không thưởng hồi tố lịch sử.
- Quy tắc nghiệp vụ riêng này không yêu cầu owner có một Habit cụ thể hoặc đang đúng lịch Habit. Auth và quy tắc tài khoản chung hiện hành vẫn được tôn trọng; nếu có xung đột, ghi quyết định và test, không tạo ngoại lệ bypass auth.
- Thông báo lưu/lỗi/retry ở trạng thái mạng bất thường được thêm gọn trong card, không đổi thiết kế đường đi bình thường. Không yêu cầu người dùng quyết định giao thức kỹ thuật.
- Dùng source-first, tên gợi ý `first-step` cho module/route. Không thêm dependency runtime hoặc framework mới khi nền tảng hiện tại đã đáp ứng.
- Không mở rộng sang AI tools/Telegram commands, notification, scheduler thưởng tự động, thống kê mới hoặc thay thiết kế Habit.

## 4. Thiết kế dữ liệu và giao dịch

### 4.1. Hai loại định danh

`occurrenceId` xác định một lần thực hiện; `requestId` xác định một yêu cầu được retry. Tách hai giá trị này. Một lượt không thể thưởng lại bằng request id khác; một request id không được tái dùng cho payload/operation khác.

Một bảng lượt mới, tên gợi ý `first_step_occurrences`, chứa owner, id, source, status, version, started_at, ends_at, completed_at/canceled_at hoặc timestamp terminal tương đương. Ràng buộc owner/id duy nhất và tối đa một active/owner, ưu tiên unique partial index. Lượt outside có mốc tự khai báo theo thời gian server; không cho client chọn reward hoặc timestamp để vượt điều kiện timer.

Có thể dùng receipt hiện có cho wallet/claim, kết hợp receipt riêng tối thiểu cho start/cancel. Không tạo sổ cái độc lập cạnh tranh với ví hiện hành. Thiết kế phải giải thích đường retry, race và số truy vấn; chỉ mục phải làm truy vấn trạng thái active có giới hạn.

### 4.2. Hoàn tất và thưởng là cùng một commit

Trong **một** batch/transaction D1 được guard:

1. Xác nhận đúng owner/occurrence, chưa completed/canceled, đủ hạn server với source timer.
2. Chuyển occurrence thành completed.
3. Tăng `qi += 1`, `earned += 1`, `tickets += 1` qua cơ chế ví/version hiện hành; không đụng `summonTickets` hay trường khác.
4. Lưu receipt và kết quả đủ để phục hồi.

Thất bại bất kỳ statement nào phải rollback cả trạng thái lượt, ví và receipt. Retry đọc receipt trước điều kiện đã thay đổi. Race claim/claim chỉ thưởng một lần; claim/cancel chỉ một trạng thái terminal thắng; write thưởng/quay/check-in đồng thời không ghi đè số dư.

Start/cancel cũng cần transaction/guard phù hợp và kiểm owner. Chỉ serialize phía client không đủ để chứng minh đúng khi có hai tab.

### 4.3. Start/cancel chưa rõ đã commit

Phải giải quyết được tình huống: người dùng đủ 3 giây → request start đã gửi → mất phản hồi → bấm hủy → start đến muộn. Có thể dùng tombstone canceled theo occurrence id hoặc thứ tự phục hồi được chứng minh. Bất biến bắt buộc: **lượt đã được xác nhận hủy không thể xuất hiện lại do start/retry đến muộn**.

Không xóa pending intent để tạo request mới khi network chưa rõ kết quả. Giữ id/payload để recovery qua reload; xóa intent sau khi có kết quả server xác định. Lỗi xác thực/logout phải dọn runtime và tránh response của phiên cũ cập nhật ví/scene phiên mới.

### 4.4. Thời gian và payload

Server chọn mốc bắt đầu/kết thúc và xác minh 5 phút; client chỉ trình bày. Trả `serverNow` để ước lượng đồng hồ theo thời gian server và mốc monotonic. Thay đồng hồ máy không mở được claim sớm. Khi return/reload, refresh trạng thái có giới hạn; không polling DB mỗi giây.

Tại ngưỡng giữ, chạy nhịp launch ngay, gửi start một lần với định danh bền. Đồng hồ tạm trên client chưa phải bằng chứng đã lưu. Khi server trả lời, reconcile mượt theo mốc chính thức; request chậm/lỗi có trạng thái rõ, không nhận thưởng hoặc coi là hủy thành công trước commit. Không trì hoãn hiệu ứng giữ vì fetch chưa xong, không âm thầm coi start lỗi là thành công.

## 5. Kiến trúc frontend và tương đương thị giác

Tách controller trạng thái/API, view card và module chuyển động; sử dụng cấu trúc ES modules hiện tại. Tên gợi ý:

| Tệp/nhóm dự kiến | Vai trò |
| --- | --- |
| `src/domain/first-step.ts` | Luật trạng thái/validation/payload và thưởng cố định nếu cần tách pure rule. |
| `src/application/first-step-service.ts`, `src/ports/first-step-store.ts` | Use case và hợp đồng lưu. |
| `src/adapters/d1/first-step-store.ts` | Reads, guard, transaction, receipt, prepare statements phối hợp ví. |
| `src/entrypoints/mini-app/first-step.ts`, router `mini-app.ts` | GET trạng thái/receipt và POST start/claim/cancel/outside theo auth hiện có. |
| Migration kế tiếp | Additive bảng/index mới; không sửa migration lịch sử. |
| `web/features/first-step.js` | Input, pending intent/recovery, thời gian, mạng, lifecycle. |
| `web/views/first-step.js` | Card, menu, xác nhận, accessibility. |
| `web/ui/first-step-motion.js`, `web/first-step.css` | Chuyển nguyên bộ vẽ/CSS đã chốt, có cleanup. |
| `web/app.js`, `web/index.html`, `web/views/habits-today.js` | Wiring/import/vị trí card. |
| `web/core/{state,live-data,mutations,lifecycle}.js` | Snapshot, đồng bộ ví/phiên, giữ DOM card qua refresh; chỉ sửa phần cần thiết. |
| `web/core/http.js` và entrypoint errors | Ánh xạ lỗi, retry đúng danh tính nếu cần. |
| Tests hiện hành + tests `first-step` mới | Unit, D1/API, browser real input, parity và E2E thật. |
| Docs/progress/verification | Bằng chứng và bàn giao; không biến artifact test thành source thiết kế. |

Đây là phạm vi tệp dự kiến để người dùng duyệt một lần trong prompt goal; có thể phát sinh điểm gọi liên quan. Không đưa nghiệp vụ vào `web/app.js` hoặc router, không gộp mọi thứ vào một module dài.

### 5.1. Rerender không được phá thao tác

Controller sở hữu một runtime độc lập với DOM nhất thời. Cần reconcile/bảo toàn subtree card khi vẫn ở cùng screen và việc giữ còn hợp lệ; tick đồng hồ cập nhật node, không render cả app. Khi rời screen, logout, unmount hoặc resize thật: hủy giữ và dọn rAF/listener/timeout/canvas; giữ lượt server nếu đã start. Không làm rơi pointer capture vì refresh Habit ở nền.

Không dùng cờ khóa render toàn app trong 3 giây rồi quên mở. Đo listener/rAF sau nhiều vòng mount/unmount. Session/revision guard phải bao cả pending responses và callbacks animation.

### 5.2. Những vùng phải giống demo

Card gồm idle, 1–2–3, flight/signal/pass, launch, running, ready, xác nhận outside, menu hủy và xác nhận hủy phải giữ hình, chữ, tỷ lệ, palette, nhịp và sự liền mạch. Vùng cơ sở ở viewport 390: card **346 × 113**, pill **102 × 42**; rộng desktop tối đa 504; 320 px card 288 × 113.

Không mang brand header/nav/ví giả của demo vào app. Header/ví thật là nguồn dữ liệu và đích nhận vật phẩm; hiệu ứng thưởng được neo vào vị trí thực của ví hoặc đích thay thế có sẵn, giữ scene/hai vật phẩm/nhịp của demo. Nếu vì bối cảnh app phải đổi tọa độ đích bay, ghi rõ, không thay thiết kế card.

CSS scope dưới root feature; không để `button`, `svg`, `h2`, dark theme hoặc style Habit/Linh thú làm biến dạng hình. Không thay background/theme cả app để đạt ảnh card.

## 6. Các pha thực hiện và điều kiện chuyển pha

| Pha | Công việc | Chỉ chuyển pha khi |
| --- | --- | --- |
| A — baseline | Đọc chỉ dẫn/docs/source, kiểm manifest, ghi Git/diff/hash tệp sẵn có, lập traceability hành vi → code → test. Kiểm môi trường và baseline gates cần thiết. | Đã biết source chuẩn, vùng sửa, migration hiện hành; có danh sách lỗi baseline nếu có. |
| B — contract/data | Chốt state machine, API/error/result, schema/index, atomic reward/replay/race và test kỳ vọng độc lập. | Integration chứng minh không thưởng trùng, không thưởng khi hủy/chưa đủ giờ, dữ liệu cũ bảo toàn. |
| C — runtime/UI | Wiring thật, recovery, time sync, scoped view/CSS/VFX, lifecycle reconcile. | App thật chạy đủ start → timer → ready → claim/cancel; không chỉ module hoặc demo riêng. |
| D — QA có đối chiếu | Browser input thật, hình ảnh cùng mốc, lỗi mạng/phiên/two-tab, E2E client→Worker→D1 và hồi quy. | Hết lỗi phạm vi, có ảnh/video/diff và log đầy đủ; đúng hình lẫn dữ liệu. |
| E — review/gates | Tự review diff và invariants; chạy các gates toàn repo liên quan, dry-run build, migration rehearsal. | Không regression do thay đổi; không skip/nới assert/baseline ảnh để che lỗi. |
| F — staging | Backup mới/đối chiếu đích, chỉ apply migration được kiểm, deploy version đã kiểm, smoke và lưu proof. | Worker/schema/assets đúng; không mất dữ liệu cũ; URL thành phẩm dùng được. |
| G — bàn giao | Cập nhật docs, báo cáo thật, hướng dẫn test ngắn. | Có đủ định nghĩa hoàn thành bên dưới; không còn công việc bắt buộc để người dùng làm hộ. |

Thứ tự trong từng pha có thể tối ưu; không triển khai remote trước khi đạt các gates local. Không báo hoàn tất ở pha lập kế hoạch/backend/UI riêng lẻ.

## 7. Ma trận nghiệm thu bắt buộc

Mỗi mục phải có test/assert hoặc bằng chứng phù hợp, nguồn chạy và kết quả. Không chỉ ghi tên test.

| ID | Trường hợp | Kỳ vọng độc lập |
| --- | --- | --- |
| F01 | Giữ <3000 ms; giữ nhiều lần ngắn | Không start/thưởng, không cộng dồn. |
| F02 | Giữ đủ 3 giây bằng chuột/touch/Space/Enter | Một start, tự chuyển đồng hồ; không cần nhả; không thưởng. |
| F03 | Pointer cancel/lost capture, >45 px, Escape, blur/hidden/resize | Hủy giữ và cleanup đúng; giữ lại từ đầu được. |
| F04 | Refresh dữ liệu Habit/ảnh app trong khi giữ | Không ngắt thao tác vì thay DOM nội bộ; không nhân listener/rAF. |
| F05 | Rời app/reload/tab khác trong 5 phút | Cùng occurrence và endsAt, không reset thời gian. |
| F06 | Client sửa Date.now hoặc gửi endsAt/reward trái phép | Server không cho claim sớm/chọn reward. |
| F07 | Hết hạn, chưa xác nhận | 0 thay đổi ví; hiện ready. |
| F08 | Xác nhận timer | qi +1, earned +1, tickets +1; đúng owner, không thay dữ liệu khác. |
| F09 | Nhiều lượt cùng ngày/qua ngày | Mỗi lượt +1/+1, không cap ngày/tuần hoặc reset mất lượt cũ. |
| F10 | Outside confirm/back | Không chờ thêm 5 phút; chỉ confirm mới thưởng, một occurrence chỉ một lần. |
| C01 | Hủy trong running/ready/launch | Menu, bước xác nhận, hủy, thông báo đúng; không thưởng. |
| C02 | Back/Escape trong xác nhận hủy; timer hết khi đang xác nhận | Giữ nguyên id/deadline; back về đúng running/ready. |
| C03 | Hủy rồi reload/retry start muộn | Không hồi sinh, không thưởng. |
| C04 | Hủy một lượt sau các lượt đã nhận | Không mất thưởng cũ. |
| D01 | Retry cùng id/payload sau commit/mất phản hồi | Kết quả xác định, không ghi/thưởng lặp. |
| D02 | Cùng request id khác operation/payload/owner | Từ chối hoặc cách ly đúng owner; không tiết lộ dữ liệu. |
| D03 | Hai request id claim cùng occurrence | Một thưởng duy nhất. |
| D04 | Hai tab start; claim/claim; claim/cancel | Tối đa một active/owner và một terminal outcome hợp lệ. |
| D05 | Claim đồng thời draw/check-in/Habit reward | Không lost update ví, không double credit hoặc trigger skill ngoài phạm vi. |
| D06 | SQL fail giữa batch | Rollback occurrence, wallet và receipt; retry đúng. |
| N01 | Mất phản hồi start/claim/cancel, JSON lỗi/5xx/timeouts | Pending rõ ràng, giữ định danh; recovery reload đúng, không giả thành công. |
| N02 | Offline trước khi gửi/đang làm/rồi trở lại | Không phát thưởng offline; phục hồi cùng occurrence khi kết nối, thời gian không mất. |
| N03 | Response cũ đến sau refresh/logout/đổi phiên | Không ghi đè state/ví hoặc bật scene cũ. |
| N04 | Click nhiều lần, đổi tab/filter/open sheet khi request pending | Không duplicate, không đánh cắp focus hoặc phá trang khác. |
| A01 | Keyboard, focus, menu đóng ngoài, screen reader | Thao tác được, không focus trap; announce vừa đủ, không đọc timer mỗi tick. |
| A02 | Reduced motion/Canvas null/DPR 1–2 | Hành vi đầy đủ, không flash/tilt trong reduced mode; scene cleanup. |
| V01 | Idle/blue/gold/pass/launch/running/ready/cancel/reward | Đúng ảnh/card/nhịp, không chồng chữ, không lóe nền hoặc nhảy bố cục. |
| V02 | 320/375/390/430/768/1440, sáng/tối | Không tràn, card nhỏ; không đổi style Habit/Tháp/Linh thú. |
| V03 | 20 vòng mount/unmount/hold-cancel, đổi theme/resize | Không canvas/listener/rAF dư; không scene dính lại hoặc tự bắt đầu. |
| M01 | Migration trên DB trống và bản seed schema cũ | Thành công, chỉ thêm schema cần thiết; old-table count/hash bảo toàn khi không có traffic. |
| M02 | Owner khác/không auth/CSRF/payload quá cỡ | Guards API như route khác; không thể dùng id client vượt owner. |
| R01 | Habit v2, nhật ký, Tháp, Linh thú, task, ngủ, check-in, x1/x10 | Các luồng cũ và giới hạn thưởng hiện hành không thay đổi. |
| E01 | UI thật gọi Worker thật ghi D1 thật, đọc lại wallet | Chứng minh wiring từ giao diện đến DB, không chỉ API fixture. |
| E02 | Ít nhất một phiên đủ **5 phút thời gian thực** ở browser local | Không shortcut production; đổi tab/nền/return rồi ready, tự confirm mới ghi thưởng. |
| S01 | Staging schema/version/assets/auth/basic routes | Đúng bản đã test và đích đã cho phép, không lỗi mới hoặc ghi thử vào dữ liệu người dùng. |

Kiểm auth bằng secret test được sinh riêng trong local fixture; không dùng token thực hoặc bỏ auth route để thuận tiện kiểm thử. Browser harness fixture được dùng cho parity và mô phỏng lỗi; phải phân biệt với E01.

## 8. Quy trình đối chiếu hình và chuyển động

1. Phục vụ HTML nguồn chuẩn và app từ cùng browser/version, cùng font, theme, DPR, viewport và fixture nội dung. Giữ seed, clock và tiến độ hiệu ứng xác định trong test.
2. Chụp reference runtime và actual cùng thời điểm: idle; p = 0,4; 2/3; 29/30; sau ngưỡng q = 0; 0,1; 0,2; 0,3; 0,55; 0,78; 1,0 s; rồi ready/hủy/thưởng.
3. Ngoài PNG phải lưu video/GIF chu kỳ input thật để duyệt continuity: đủ 3 giây không giật/cắt/trắng khung, không đợi server mới bắt đầu sao băng.
4. Khóa tiêu chí trước khi chỉnh UI: ở điều kiện render giống nhau, sai số geometry card/pill/vị trí tương đối tối đa **1 CSS px**, copy/font/color/radius/gradient đúng nguồn. So riêng vùng pill, cảnh sao băng và chữ; MAE mục tiêu **≤2/255 mỗi kênh** cho ảnh xác định. Không dùng điểm trung bình toàn trang để che sai nút hoặc đuôi sao.
5. Chỉ được mask giá trị vốn động như số dư/timer thật sau khi đã kiểm chúng bằng assert riêng; không mask nút, sao, đuôi, màu, progress hoặc bố cục. Không tăng ngưỡng, ghi đè ảnh chuẩn hoặc sửa prototype để lấy PASS.
6. Nếu khác do raster/font/browser: tái chụp cả hai bằng cùng pipeline, xác định nguyên nhân, lưu diff/overlay; không gọi “giống hệt” khi chưa giải thích được sai lệch.
7. Mở và xem ảnh/video bằng công cụ hình ảnh. Chỉ test computed style hoặc đọc code không đủ để nghiệm thu chất lượng.
8. Không captureBeyondViewport làm resize viewport giữa một lần giữ thật; ảnh mốc cố định và kiểm input timing là hai bài riêng.

Ảnh trong thư mục reference đã chốt để kiểm thiết kế. Artifact mới ghi vào `trial-results/anti-procrastination/implementation/<run-id>/`, không ghi đè nguồn/reference hoặc output cá nhân.

## 9. Gates kỹ thuật và chất lượng mã

Chạy theo package/config thực tế. Trên PowerShell dùng `npm.cmd` và Node 24. Nhóm tối thiểu:

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:web
npm.cmd run lint
npm.cmd run format:check
npm.cmd run check:web
npm.cmd run test:all
npm.cmd run test:browser
npm.cmd run build:check
npm.cmd run staging:check
git diff --check
```

Thêm test đặc thù feature, E2E Worker/D1 thật, migration rehearsal và visual comparison. Browser chạy tuần tự như package hiện hành; test thiếu browser/skip không tính là đã đạt. Với source mới ngoài format baseline, kiểm định dạng có chọn lọc và thêm vào baseline nếu phù hợp; không format các tệp lịch sử ngoài phạm vi. Gates tài nguyên/benchmark có sẵn được chạy khi module/build liên quan thay đổi và theo CI hiện hành.

Kiểm baseline trước khi sửa. Nếu gate vốn lỗi, phân biệt bằng lần chạy baseline và diff; được sửa nguyên nhân liên quan để hoàn tất sản phẩm, không “chấp nhận fail” không bằng chứng, xóa test, nới assert hay skip test mới. Nếu lỗi ngoài phạm vi thực sự cản nghiệm thu, ghi chính xác và không báo hoàn tất/deploy bất chấp.

Review riêng transaction SQL, stale responses, cleanup, CSS scope và public API payload. Không thêm `any`/ts-ignore hoặc bắt lỗi rỗng để che lỗi nghiệp vụ. Không duplicate toàn bộ code game/reveal khác chỉ để dùng một feature; phần vẽ chốt được tách rõ và có trách nhiệm riêng.

Đo số query và kích thước response ở trạng thái thường và fixture nhiều dữ liệu; không đọc toàn bộ lịch sử để mở card. Không polling mạng theo từng giây, không toàn trang rerender mỗi tick, không vô tình làm nặng bootstrap hoặc vượt budget hiện hành. Đo frame/tài nguyên local khi cần, ghi điều kiện đo; không suy thành 60 FPS hay latency remote khi chưa đo.

## 10. Phát hành staging đã được yêu cầu

Đích được người dùng chọn trong hội thoại là **staging hiện tại**, không phải production hay môi trường mới. Lệnh goal phải xác nhận rõ quyền deploy và migration staging để việc đó không phải xin duyệt giữa đêm.

Trình tự bắt buộc:

1. Đối chiếu Cloudflare account, Worker, DB id/binding và listing migration remote bằng thao tác đọc; lưu metadata, không in secret/session.
2. Xuất backup **mới** của DB staging vào thư mục private local bị Git bỏ qua; ghi hash/thời điểm/đích. Backup không đưa vào Git, report chỉ chứa metadata.
3. Kiểm baseline schema trên bản sao tạm và áp **chính các migration dự định phát hành**; kiểm integrity/FK và count/hash cột dữ liệu cũ trên bản sao tĩnh. Không áp thử vào DB người dùng.
4. Nếu phát hiện migrations remote còn thiếu ngoài phạm vi feature, xác minh lịch sử và rehearse đầy đủ trước. Không dùng lệnh apply tất cả mù quáng.
5. Chỉ sau khi đạt gates và rehearsal mới apply additive migration đã kiểm lên đúng staging, rồi deploy Worker/assets tương ứng bằng scripts staging hiện hành.
6. Không đổi secrets, webhook, cron, owner, model AI hoặc cơ chế thông báo vì feature này. Không tự gửi Telegram/email, gọi provider thật hoặc giả thao tác người dùng để QA.
7. Lưu deployment version, thời điểm, migration listing và asset/hash của mã đã kiểm. Kiểm URL app, assets mới, basic/auth behavior và read có sẵn nếu có phiên hợp lệ.
8. Remote smoke không tự cấp tu vi/vé, tạo task/Habit hay ghi thử vào dữ liệu người dùng. Luồng write đầy đủ đã được kiểm trên local Worker/D1; nếu không có phiên remote để kiểm auth, ghi đúng phạm vi thay vì yêu cầu người dùng thức dậy đăng nhập hộ.
9. Traffic thật/cron có thể làm dữ liệu remote thay đổi tự nhiên; không yêu cầu toàn DB remote hash bất biến giữa hai thời điểm. Chứng minh migration bảo toàn trên bản sao tĩnh và đối chiếu chỉ tiêu remote phù hợp, không “sửa lại” dữ liệu đang sống để ép hash.
10. Nếu phát hành lỗi: xử lý theo hướng tiến tới trong phạm vi đã duyệt và giữ dữ liệu. Chỉ rollback binary khi đã chứng minh tương thích schema/state; không rollback schema, import backup cũ đè writes mới hoặc reset DB.

Nếu credentials/quyền mạng/môi trường thật không cho phép deploy: hoàn thành phần local độc lập, lưu lý do và bước còn thiếu chính xác. Không lặp vô ích, không báo staged thành công hoặc goal complete khi chưa đạt đích. Goal không thể tự cấp quyền hệ thống/hạn mức.

Không tự commit hoặc push. Bảo toàn working tree; có thể dùng bản copy/worktree tạm nếu cần, không làm mất prototype/tài liệu chưa track.

## 11. Hồ sơ tiến độ và định nghĩa hoàn thành

Khi thực hiện, duy trì `docs/ANTI_PROCRASTINATION_PROGRESS.md` và `docs/ANTI_PROCRASTINATION_VERIFICATION.md`:

- Source/hash đang đối chiếu; baseline và danh sách tệp thay đổi thực tế.
- Quyết định kỹ thuật, schema/API, pending/replay/concurrency.
- Bảng ID nghiệm thu → test/artifact/lệnh → kết quả và giới hạn.
- Việc đã xong/còn lại/bước kế tiếp, đường dẫn log và run-id.
- Lệnh đã thực chạy, exit code, số pass/fail/skip; ảnh/video/diff đã xem.
- Deployment/schema/backup metadata và cách tiếp tục sau rút gọn context.

Không để secret, dữ liệu nhạy cảm hoặc SQL backup trong các Markdown. Tiếp tục từ checkpoint sau context rollover; không lặp lại công việc đã xác minh.

Goal chỉ hoàn tất khi:

- Tính năng nối frontend → auth/API → DB/receipt → ví thật và dùng được trong app staging đã phát hành.
- Đủ hành vi/chuyển động như source chuẩn, kể cả hủy, reload và recovery mạng; source chuẩn giữ nguyên hash.
- Tests trọng yếu, hồi quy và gates đã chạy đạt; có E2E thật, 5 phút thực và bằng chứng parity.
- Không hồi quy Habit/Tháp/Linh thú/tu vi/vé, không mất dữ liệu cũ, không tooling demo lọt runtime.
- Có hồ sơ xác minh và URL/version của bản thành phẩm; không còn TODO bắt buộc mà đẩy sang người dùng.

Báo cáo cuối ngắn: link app staging, kết quả chính, kiểm thử đã đạt, hồ sơ bằng chứng và giới hạn nếu có. Hướng dẫn người dùng test thành phẩm bằng vài thao tác: thả sớm; giữ đủ thấy hiệu ứng; hủy qua ba chấm; làm một lượt 5 phút rồi tự xác nhận và nhìn ví. Người dùng không phải dựng fixture, chạy migration, đọc diff hoặc duyệt lại thiết kế.
