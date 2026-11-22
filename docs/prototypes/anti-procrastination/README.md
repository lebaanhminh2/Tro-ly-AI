# Phá trì hoãn — bản thiết kế đã chốt

Chốt với người dùng ngày **16/11/2026**. Đây là bộ bàn giao để triển khai tính năng nhỏ trong Habit. **Giao diện và chuyển động lấy trực tiếp từ [index.html](index.html); không dựng lại theo diễn giải của AI.** HTML là demo độc lập chạy local, chưa nối tài khoản, ví hoặc backend của ứng dụng.

## Mở và đọc theo thứ tự

1. Mở [index.html](index.html) trong Chrome/Edge. Không cần cài gói, build hay mạng. Cuộn xuống dưới danh sách Habit, giữ nút “Bắt đầu” đủ 3 giây.
2. Xem [GIF bản đã duyệt](reference/approved-motion.gif) và [GIF từ HTML hoàn thiện](reference/implemented-motion.gif). Hai GIF có 2,3 giây chờ, 3 giây giữ và phần chuyển sang đồng hồ.
3. Đọc hợp đồng hành vi và thông số bên dưới trước khi ghép vào app.
4. Đối chiếu ảnh trong [reference/](reference/) và hash trong [reference/manifest.json](reference/manifest.json). Hồ sơ kiểm tra ở [VERIFICATION.md](VERIFICATION.md).

Nếu chỉ giao một bộ tư liệu cho AI khác, giao **toàn bộ thư mục này**, gồm HTML, Markdown và reference. Không chỉ giao ảnh hoặc GIF. Điểm vào từ mục lục dự án: [docs/README.md](../../README.md).

## Ý định sản phẩm đã được người dùng xác nhận

Tạo cú hích **ngay lúc đang trì hoãn để bắt đầu làm ở đời thực**. App không biết công việc cụ thể và không yêu cầu chọn hoặc nhập việc. Người dùng muốn nhìn thấy một nút đẹp, muốn chạm; khi giữ có cảm giác tích lực và tới cao trào thấy đã.

Hướng đã chốt: **sao băng lao tới → từ xanh chuyển vàng, tách mảnh → tăng tốc vút qua → mở đồng hồ 5 phút**, gợi chuyển động gacha Genshin và Linh thú trong app. Đây là trình diễn cho thao tác bắt đầu; phần thưởng vẫn cố định.

Giữ nút pill tối hiện tại. Không đổi sang hình tròn, viên đá, huy hiệu, khung kim loại dày hoặc vật thể 3D khác. Không thay sao băng bằng quầng sáng xanh tím đứng yên. Không mở sân khấu toàn màn hình lúc giữ. Tính năng nằm dưới danh sách Habit, trước Nhật ký/Tháp, không chiếm vai trò chính của trang.

## Hợp đồng hành vi

| Trạng thái / thao tác | Kết quả bắt buộc |
| --- | --- |
| Chưa bắt đầu | Hiển thị “Đang muốn để sau?”, “Bắt đầu 5 phút thôi.”; nút “Bắt đầu”, nhãn “Giữ 3 giây”. |
| Giữ chuột/chạm hoặc Space/Enter | Đếm 1–2–3 trong **3000 ms liên tục**. Sao băng bám theo tiến độ giữ. |
| Thả trước 3000 ms | Hủy thao tác giữ, trở lại bình thường; không tạo lượt, không chạy đồng hồ, không thưởng. Không tích lũy thời gian giữa các lần giữ. |
| Kéo quá 45 px, Escape, mất focus, tab bị ẩn hoặc resize khi giữ | Hủy thao tác và dọn canvas/animation; có thể giữ lại từ đầu. |
| Giữ đủ 3000 ms | Tự bắt đầu một lượt 5 phút ngay tại ngưỡng. Không cần thả tay hoặc bấm thêm. Chuyển nhãn thành đồng hồ, “Làm ngay.” / “Chỉ 5 phút thôi.” rồi “5 phút đầu tiên” / “Hết giờ, cậu có thể dừng.” |
| Đang chạy | Đếm theo thời điểm kết thúc tuyệt đối; rời app/tải lại không làm mất hoặc khởi động lại thời gian. Không cần giữ app mở. |
| Hết 5 phút | Hỏi “Đã làm 5 phút chưa?” / “Ghi nhận nếu đã thực sự làm.”; chờ bấm “Đã làm, nhận thưởng”. Không tự thưởng khi đồng hồ hết. |
| Xác nhận đã làm | Mỗi lần hợp lệ cộng **+1 tu vi và +1 vé quay thường**, không giới hạn số lần trong ngày. Một lượt chỉ thưởng một lần. |
| Đã tự làm ngoài app | “Đã tự làm 5 phút” mở bước xác nhận đã đếm 1–3 và bắt tay làm việc đang né; xác nhận mới thưởng cùng mức. |
| Menu ba chấm khi có lượt | Hiển thị **“Hủy lượt đang làm”** trước nhóm công cụ demo, kể cả lượt đã hết giờ nhưng chưa nhận thưởng. |
| Chọn hủy | Hiện “Hủy lượt này?”, “Không nhận thưởng. Có thể bắt đầu lại.”; nút “Hủy lượt”, liên kết “Tiếp tục làm” (lượt đã hết: “Quay lại”). |
| Xác nhận hủy | Xóa lượt đang làm, dừng đồng hồ, quay về nút ban đầu; thông báo “Đã hủy lượt, không cộng thưởng.” Không cộng tu vi/vé, không xóa thưởng các lượt trước. Tải lại vẫn giữ kết quả hủy. |
| Quay lại / Escape trong bước hủy | Giữ nguyên id, thời điểm bắt đầu và kết thúc; không reset đồng hồ. Nếu thời gian đã hết thì về bước tự xác nhận đã làm. |
| Bấm hủy ngay trong pha chuyển sang đồng hồ | Dừng animation và timeout chuyển trạng thái. Bước hủy không bị timeout cũ ghi đè. |
| Giảm chuyển động / không có Canvas 2D | Nút, đếm số, giữ đủ 3 giây, đồng hồ và hủy vẫn hoạt động. Giữ phần chữ dễ đọc; không sao băng, lóe sáng hoặc nghiêng/rung nút. |

Không dùng lượt này để tự đánh dấu Habit hoàn thành, thay đổi quota, eligibility Tháp hay kết quả luyện Linh thú. Không tự suy người dùng đã làm việc chỉ từ thời gian, thao tác chuột hay việc rời app.

## Kích thước và hình ảnh cần giữ

Ở viewport **390 × 844 CSS px**, card có kích thước **346 × 113 CSS px**, lề trang 22 px; nút pill **102 × 42 px**, bo 22 px, nằm trong vùng thao tác 108 × tối thiểu 62 px. Card bo 16 px, có hàng thông tin mảnh phía dưới. Ở desktop nội dung card tối đa 504 px; tại 320 px card rộng 288 px và vẫn cao 113 px.

| Thành phần | Giá trị chuẩn trong HTML |
| --- | --- |
| Nút | Gradient 145°, `#29323e → #18212d` ở 70%; viền `#34404e`; giữ độ nổi nhẹ. |
| Biểu tượng | Sao bốn cánh SVG, 16 × 19 px; vàng ngà `#d9c79e`, mặt sáng `#f7eed9`. |
| Nền cảnh | Gradient `#101a2b → #080d1a → #10172a`; chỉ trong card, không đổi kích thước bố cục. |
| Sao băng | Lõi trắng nhọn, ba lớp đuôi bất đối xứng; màu đầu `[135,191,251]`, màu vàng `[248,186,90]`. |
| Sao nền | 78 điểm với seed cố định; tốc độ/parallax tăng theo pha. Không random lại mỗi frame. |
| Giữ | Pill nén khoảng 2,2%; nghiêng nhẹ tối đa khoảng 6° theo chiều Y, 0,45° theo Z; ánh vàng bám viền. |
| Đồng hồ | Font hệ thống như trang; 20 px, chữ số tabular, vàng ngà `#f4e5c9`; nằm trong chính pill. |
| Giới hạn render | Canvas theo kích thước card, DPR tối đa 2; tạo lại đúng kích thước mỗi lần. Không kéo giãn một canvas cũ sau resize. |

Trong lúc có sao băng, ẩn bằng `visibility` phần chữ bên trái và hàng thông tin dưới, giữ nguyên diện tích. Nút và hàng 1–2–3 vẫn hiện. Lúc hoàn tất, trả lại chữ với màu nội suy theo nền cảnh để không có chữ tối trên nền tối.

Không thêm âm thanh. Rung ngắn nếu trình duyệt hỗ trợ là phụ trợ; không phụ thuộc vào rung để hiểu tương tác.

## Nhịp chuyển động chính xác

Tiến độ giữ `p = clamp((performance.now() - holdStartedAt) / 3000)`. Trong bộ vẽ, `seconds = p × 3.94`. **3,94 giây là trục thời gian hình học của sao băng gốc, không phải thời gian giữ.**

| Thời gian thực từ lúc giữ | Điều gì xảy ra |
| --- | --- |
| 0–1,00 s | Số 1; sao xanh xuất hiện rồi lao tới, đuôi kéo dài và nền sao chuyển động. |
| 1,00–2,00 s | Số 2; tiếp tục áp sát. Chuyển xanh → vàng khoảng **1,675–1,865 s**; lóe và tách mảnh cuốn ngược theo đường bay. |
| 2,00–3,00 s | Số 3; tăng tốc mạnh từ khoảng **2,589 s**, chớp quét qua từ khoảng 2,655 s; vật thể đi ra khỏi khung trước khi mở đồng hồ. |
| Đủ 3,00 s | Tạo lượt và mốc kết thúc sau 300000 ms; cảnh hoàn tất kéo dài thêm **1000 ms**, thời gian làm việc đã bắt đầu chạy. |
| 0–90 ms sau ngưỡng | Nhãn nút cũ biến mất. |
| 100–300 ms sau ngưỡng | Đồng hồ hiện lên; không chồng chữ “Bắt đầu” lên đồng hồ. |
| 220–780 ms sau ngưỡng | Cảnh tối nhạt dần, màu chữ trả về theme hiện hành. |
| 550 ms sau ngưỡng | Chuyển “Làm ngay.” sang “5 phút đầu tiên”. |
| 1000 ms sau ngưỡng | Dọn canvas và biến hiệu ứng; tiếp tục đồng hồ thông thường trong pill. |

Không thay spline, seed, bảng màu, easing, thời lượng hoặc thứ tự các lớp bằng hiệu ứng CSS “tương tự”. Tái sử dụng các hàm vẽ để giữ đúng hình học và nhịp đã duyệt.

## Điểm lấy mã khi triển khai vào app

Tất cả nằm trong [index.html](index.html), không có dependency tải ngoài:

- **CSS**: nhóm `.pb-entry`, `.pb-switch`, `.pb-socket`, `.pb-edge-*`, `.pb-counts`, `.pb-refined-clock`, `.pb-gacha-wipe`, các trạng thái `data-refined-phase` và `data-gacha-mode`, cùng theme/giảm chuyển động. Mang cả quy tắc bố cục gốc và phần chốt hiệu ứng.
- **Markup/SVG chuẩn**: `pbSparkArt`, `pbFace()`, `pbInner()`, `pbMenu()`.
- **Hiệu ứng giữ**: nhóm có chú thích `APPROVED MOTION`, từ `pbGachaVars`, `pbMakeMeteor()` đến `pbReleaseMeteor()`. `meteorPosition()`, `drawComet()` và `drawScene()` nằm trong closure của scene để dùng kích thước hiện tại. Hình học lấy từ `web/ui/beast-reveal-motion.js` rồi đóng băng trong HTML này.
- **Nhập và vòng đời**: `pbBeginHold()`, `pbCancelHold()`, `pbStart()`, các listener pointer/key/blur/visibility/resize. Chuyển DOM từ idle sang launch phải dựng lại scene và vẽ frame đầu ngay, không làm nháy nhãn hoặc hụt cảnh.
- **Đồng hồ**: `pbUpdateTime()`, `pbTick()`; dùng `endsAt`, không trừ từng giây để suy thời gian đã làm.
- **Hủy**: action `stop`, `stop-confirm`, `back`, Escape. Phải hủy `pbTransition`, dọn scene và lưu trạng thái khi xác nhận hủy.
- **Nhận thưởng**: `pbClaim()` và hiệu ứng `pbReward()` / `pbFlight()`. Phần thưởng được xác nhận trước trình diễn; animation không quyết định có phát thưởng hay không.

Có thể đổi cách tổ chức component khi ghép vào app; giữ markup hữu hình, giá trị CSS, bộ vẽ và chuỗi trạng thái tương đương. Kiểm trực quan ở cùng viewport, theme và mốc thời gian trước khi coi là hoàn tất.

## Dữ liệu demo và ranh giới tích hợp

Demo dùng localStorage key `minh-anh-first-step-compact-v2`:

```text
version: 2
events: [{ id, title: "", at, source: "timer" | "outside" }]
active: { id, title: "", startedAt, endsAt } | null
theme: "light" | "dark"
```

Ví ở đầu trang là số lượt tự xác nhận trong demo, không phải ví tài khoản thật. Menu “Tua tới 3 giây cuối”, “Xem thử hiệu ứng thưởng”, nút “Đặt lại” và thanh DEMO phục vụ kiểm thử; không đưa các công cụ này vào sản phẩm thật. “Bắt đầu bằng một chạm” là lựa chọn truy cập thay thế trong menu, phải giữ khả năng sử dụng mà không bắt buộc chạm giữ.

Khi triển khai thật, thay tầng lưu local/giả lập ví bằng nguồn dữ liệu của ứng dụng: một id cho một lượt, xác nhận/hủy rõ ràng, receipt/idempotency cho nhận thưởng, ghi lượt hoàn tất và hai khoản thưởng trong cùng giao dịch. Retry/tải lại/hai tab không được thưởng trùng; trạng thái server quyết định lượt đã xác nhận/hủy. Không dùng bộ đếm `events.length` của demo làm số dư ví thật. Chi tiết API/schema sẽ được xác định ở đợt triển khai, không tự suy rằng đã có backend cho tính năng này.

Tuân thủ `AGENTS.md` người dùng cung cấp: trước khi sửa/tạo/xóa/format code trong đợt triển khai tiếp theo, trình bày tệp và thay đổi rồi chờ xác nhận. Tài liệu này mô tả thiết kế đã chốt, không cấp quyền deploy hoặc sửa toàn bộ ứng dụng.

## Ảnh để nghiệm thu

| Tư liệu | Vai trò |
| --- | --- |
| [01-idle](reference/01-idle.png) | Dáng nút, sao, tỷ lệ và nội dung khi chưa giữ. |
| [02-blue-flight](reference/02-blue-flight.png) | 1,2 giây sau khi giữ. |
| [03-gold-signal](reference/03-gold-signal.png) | 2,0 giây sau khi giữ. |
| [04-close-pass](reference/04-close-pass.png) | 2,9 giây sau khi giữ. |
| [05-launch](reference/05-launch.png) | 200 ms sau khi đủ 3 giây. |
| [06-running](reference/06-running.png) | 1,1 giây sau ngưỡng, cảnh đã nhạt hết. |
| [07-menu](reference/07-cancel-menu.png), [08-confirm](reference/08-cancel-confirm.png), [09-canceled](reference/09-after-cancel.png) | Toàn bộ luồng hủy từ ba chấm. |
| [10-reduced-motion](reference/10-reduced-motion.png) | Giữ với tùy chọn giảm chuyển động. |
| [Habit 390 sáng](reference/habit-390-light.png), [390 tối](reference/habit-390-dark.png), [320 tối](reference/habit-320-dark.png), [desktop](reference/habit-1440-light.png) | Vị trí và tỷ lệ của tính năng trong trang. |

Các ảnh 01–06 là crop card với lề 10 px ngang/8 px dọc, render ×2 từ viewport 390 × 844. Ảnh toàn trang chụp ở DPR 1. Khi so pixel, dùng cùng browser, font, DPR, viewport và thời điểm; raster chữ/anti-alias giữa trình duyệt có thể khác. Giá trị chuẩn để tái tạo là HTML và bộ vẽ được đóng băng, các ảnh/GIF giúp phát hiện sai lệch.

Bộ này chỉ chốt phần Phá trì hoãn. Habit/nhật ký/tháp xung quanh là bối cảnh demo; không lấy toàn bộ HTML để ghi đè ứng dụng hiện hành.
