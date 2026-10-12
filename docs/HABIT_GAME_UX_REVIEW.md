# Đề xuất cải thiện Thói quen và Thần Lộ

Cập nhật 2026-10-12. User chưa nghiệm thu thiết kế, luồng sử dụng và tốc độ của **hai tab mới**. Sau khi trình phương án và inventory ở mục 8, user yêu cầu: “bạn tự chụp và xem lại màn hình, đánh giá vấn đề và sửa đi”. Vòng sửa hiện tại được triển khai trong inventory đó; nghiệm thu thẩm mỹ vẫn thuộc user.

## 1. Phạm vi và bằng chứng

Phạm vi giao diện gồm Thói quen, Thần Lộ và các form/màn chi tiết của chúng. Thay đổi cách tải dữ liệu chung chỉ nhằm phục vụ hai tab và phải giữ hành vi của các tính năng nền.

- Source `02da227`; các module `views/habits.js`, `views/game.js`, `views/journey.js`, `core/live-data.js`, `app.js` vừa được đối chiếu trên staging: HTTP200, SHA256 khớp local.
- Đã xem ảnh Chrome390px của danh sách habit, màn chưa luyện, đang luyện và hành trình. Đây là ảnh QA trước release, không phải ảnh chụp mới từ phiên cá nhân hiện tại. Nội dung fixture không mô tả dữ liệu của user.
- Mẫu owner traffic thật đã ghi khi release hôm nay: habits4requests wall1247–1420ms; game5requests1521–1593ms; catalog1request219ms; bootstrap3requests6186–6551ms. Mẫu tiếp theo có game2242–2269ms và bootstrap6377–6619ms. Đây là Worker wall trong mẫu trước, không phải phép đo mới trên điện thoại hoặc p95.
- Import graph từ `web/app.js`:44module/289.947bytes source chưa nén, trong đó16module liên quan habit/game/practice/battle/journey. Phụ thuộc tĩnh này không đồng nghĩa289KB transferred mỗi lượt hoặc là nguyên nhân duy nhất gây chậm.

## 2. Những vấn đề cần giải quyết

| Finding | Bằng chứng và ảnh hưởng | Hướng sửa |
| --- | --- | --- |
| Habit có nhiều lớp điều khiển trước danh sách | Tiêu đề/lời dẫn, Hôm nay/Nhịp đã qua, nút thêm, Đang theo dõi/Đã lưu trữ; nhiều mục phải đọc trước khi ghi một habit | Heading ngắn và danh sách chính; lịch sử/lưu trữ thành lối phụ |
| Thẻ habit quá cao | Tên/lịch/trạng thái/số lượng/nút ghi/xếp giờ/giờ nhắc/pending/note cùng xuất hiện | Một hàng gọn, tiến độ và một hành động; tùy chọn nằm trong chi tiết |
| Game giải thích lặp khi mới chơi | Hướng dẫn ở đầu và thẻ chọn luyện cùng nói “một habit là đủ”; nút bắt đầu nằm thấp | Một thẻ bắt đầu và hướng dẫn đúng lúc |
| Bốn tab con ngang nhau | Tu luyện/Hành trình/Công pháp/Sưu tập; khó biết đang làm gì và nên chọn gì trước | Màn mặc định theo trạng thái; nhóm khám phá có thứ bậc riêng |
| Trạng thái luyện dễ gây hiểu nhầm | Bar3/3 đầy nhưng cả bốn tầng hiện “Chưa chốt”; lý do chờ tuần dài và nằm sau số liệu | Tầng hiện tại, trạng thái chờ và điều kiện còn thiếu rõ ràng |
| Hành trình chưa ưu tiên trận tiếp theo | Chọn chương → ảnh → tiêu đề → đọc truyện → thẻ boss/cơ chế; hành động chơi nằm sâu | Trận đang chơi/trận tiếp theo lên trước, chương/truyện mở riêng |
| Chọn luyện và chuẩn bị trận mất nhiều bước đọc | `openTechnique` đặt đường học/lịch sử/giải thích trước nút bắt đầu; `prepareBoss` đặt art/lore và5select trước submit | Tóm tắt và cấu hình cần thiết trước; bản cũ/lore/công thức mở thêm |
| Tải tab có thể chồng request | `app.js` gọi loader riêng rồi `refreshOnReturn`; refresh lại đọc tab kèm bootstrap/history khi throttle cho phép | Một đầu mối tải theo tab, gộp request đang chạy |
| Lưu nhỏ phải chờ toàn app | `liveMutation` gọi `refreshLive`; `performLive` khóa mọi button và chờ bootstrap trước reconcile | Refresh phần liên quan; pending tại thao tác, xác nhận từ server |
| Quay lại/mở chi tiết còn chờ | Loader tải mỗi lần; practice versions/boss/loadout có chặng riêng | Snapshot trong phiên và prefetch có chọn lọc |
| GET game có nhiều chặng server | Bounded settle → read game → battle overview, có nhiều lượt D1 nối tiếp | Đo từng chặng, tối ưu đường đọc; giữ settlement và invariants |

Tests xanh, nút44px và không tràn ngang chưa chứng minh luồng dễ hiểu hoặc giao diện đẹp. Bản trước kiểm tốt điều kiện kỹ thuật nhưng chưa giải quyết thứ bậc thông tin và trải nghiệm.

## 3. Thói quen: mở ra là ghi nhận được

### Màn chính

```text
Thói quen                           + Thêm
Hôm nay · 12/10                  2 đã đạt

○ Đọc sách                    15 / 20 phút
  Tuần này 1 / 3 ngày             Ghi nhận

○ Thiền                      10 phút/ngày
  Chưa đạt hôm nay                 Đánh dấu

✓ Đi bộ                            Đã đạt
  T2 · T4 · T6

Lịch sử & báo cáo                  Quản lý
```

Đây là wireframe thông tin, chưa phải thiết kế pixel.

- Tên, mục tiêu, kết quả và nút ghi là một nhóm. Khoảng5–6habit dễ quan sát; đã đạt vẫn thấy để đối chiếu nhưng gọn và dịu hơn.
- Không đổi vị trí hàng ngay sau tick làm người dùng mất mốc. Giữ thứ tự và vị trí cuộn trong phiên.
- “2 đã đạt” chỉ đếm đạt mục tiêu hôm nay. Ngày ngoài lịch/trung tính không được giả gọi là hoàn thành; không ép làm đủ mọi habit để chơi.
- Quota tuần ghi `1/3 ngày tuần này`. Chỉ cảnh báo khi có thiếu mới; không lặp nguyên tắc quota trên mỗi hàng. Ngoài lịch/đủ quota có nhãn riêng, vẫn cho ghi theo luật hiện tại.
- Nhấn tên hoặc `···` mở chi tiết: sửa tổng hôm nay, ghi chú, giờ nhắc, xếp giờ, chỉnh/lưu trữ. Hành động ghi nhận tách rõ khỏi mở chi tiết.
- Lịch sử/báo cáo có màn riêng trong tab; quản lý/lưu trữ là lối phụ. Không đặt nhiều thanh lọc trước danh sách hằng ngày.

### Luồng thao tác

| Tình huống | Luồng đề xuất |
| --- | --- |
| Tick | Chạm Đánh dấu → pending tại hàng → server xác nhận → Đã đạt |
| Định lượng | Chạm15/20 hoặc Ghi nhận → sheet gọn với tổng hôm nay và Lưu → trở về đúng hàng; ghi chú mở thêm |
| Tạo habit | Một form: tên → mục tiêu/kiểu ghi → lịch; nhắc và ghi chú trong Tùy chọn. Không wizard nhiều màn |
| Sửa/lưu trữ | Chi tiết → chọn thao tác → thấy ngày hiệu lực rõ; giữ lịch sử và nghĩa vụ cũ |
| Xem tuần | Lịch sử & báo cáo →7/30ngày → xem một habit khi cần; phân biệt lượng đã làm với đạt cam kết |

## 4. Thần Lộ: biết đang ở đâu và tiếp theo làm gì

### Màn mặc định

```text
Thần Lộ                         Cách chơi

[thẻ trạng thái chính]
Kiếm Ý · bản 1
Đang luyện Nhập môn                 2 / 3
Hôm nay: cam kết đã đạt / còn cần làm
Chốt khi kết thúc ngày sinh hoạt

[hành động phù hợp trạng thái]

Hành trình       Công pháp       Sưu tập
```

Thẻ chính phục vụ việc đang làm. Ba lối khám phá gọn nằm sau, mở màn bên trong có đường quay lại rõ và giữ vị trí.

| Trạng thái | Màn mặc định |
| --- | --- |
| Chưa chơi | Một giới thiệu ngắn với art đã có; **Thử trận đầu** bằng Võ Kỹ và xác nhận chuẩn bị rõ. Chọn luyện là lối phụ; không ép tạo habit để thử trận |
| Đang luyện | Môn/bản/tầng hiện tại, tiến độ, phẩm chất đã chốt và nguồn đóng góp hôm nay. Khi đã ghi đủ, có thể chỉ hiện chờ chốt; không cần nút thao tác giả |
| Chờ tuần | “Đủ tiến độ · chờ chốt tuần”, điều kiện còn thiếu nếu dữ liệu chứng minh được; tránh bar đầy và bốn tầng “Chưa chốt” cùng nổi |
| Đã chọn cho ngày sau | Trạng thái hiện tại và lựa chọn sắp có hiệu lực tách rõ, có ngày/giờ theo dữ liệu server |
| Trong trận | Boss/sinh lực/đòn sắp tới/chiêu đã chọn; **Chọn chiêu hôm nay** hoặc **Đổi chiêu**. Lore/nhật ký/rút nằm sau |
| Chờ cứu | Giá/thời hạn/phương án cứu ở thẻ chính; không lẫn vào danh sách boss hoặc tự trả giá |
| Có backlog | Giữ kết quả đã xác nhận, thông báo xử lý ngày cũ; không ghi dựa version cũ hoặc bỏ settlement để màn có vẻ nhanh |
| Vừa thắng/thua/quay lại | Một kết quả ngắn và bước tiếp theo; không bắt đọc catalog hoặc nhiều hướng dẫn lặp |

### Màn bên trong

- **Hành trình:** trận tiếp theo hoặc trận hiện tại ở đầu; vài mốc gọn cho toàn cảnh chương/đường đi. Truyện, nhánh và chương khác mở khi cần. Boss khóa vẫn xem được điều kiện, không dựng hàng loạt thẻ lớn/nút disabled.
- **Công pháp:** mặc định Đã mở; hàng tên/phái/trạng thái/lợi ích ngắn. Mở một môn mới thấy đường học, công thức, bản cũ. Nút chọn luyện dễ tới, ngày hiệu lực rõ;39môn vẫn đầy đủ qua tìm/lọc.
- **Chuẩn bị trận:** gợi ý Võ Kỹ hoặc bộ chiêu hợp lệ để người dùng xác nhận; danh sách/chip rõ thay vì5dropdown dài. Presets, bản cũ và giá chiêu mở thêm. Không tự xuất chiến hoặc chấp nhận giá cấm thuật.
- **Sưu tập:** phái/bí tịch/thần binh/chiến tích theo nhóm compact, có điều kiện và tiến độ rõ; export/history là công cụ phụ. Không cắt nội dung hoặc đổi kinh tế để đơn giản hóa màn.
- **Giải thích đúng lúc:** trước chuyển mode nêu ngày sau; cạnh tinh thuần giải thích phẩm chất khác tiến độ; cạnh ghi nhận giải thích tổng thay thế; khi chờ tuần nêu nguyên nhân. Cách chơi dài chỉ là tài liệu phụ.

## 5. Hướng hình thức

- Heading20–24px, tên hàng15–16px, chữ phụ12–13px, dãn dòng1,4–1,5, bold vừa để có thứ bậc. Thông số khởi đầu để thử, không test khóa padding.
- Một hành động chính cho trạng thái hiện tại; công cụ quản lý và thông tin đã xong có độ nổi thấp hơn. Không tô accent mọi link/filter.
- Tiên hiệp trầm bằng art, biểu tượng và chi tiết viền tiết chế. Art phục vụ nhân vật/chương; chữ nằm trên nền dễ đọc. Không thêm banner/gradient/hiệu ứng cho mọi màn.
- Thẻ ít lớp, đường chia nhẹ, góc bo nhất quán; giảm khoảng trống từ intro lặp. Giữ alt/contrast/44px/focus/reduced motion và kiểm chữ200%.
- Khoanh CSS vào hai tab và sheet của chúng. Không cần thiết kế lại header/bottomnav toàn app cho việc này.

## 6. Tốc độ là một phần của trải nghiệm

1. **Một đầu mối tải mỗi tab.** Gộp GET đang chạy theo endpoint/phiên; tránh controller loader và full refresh đọc cùng snapshot. Generation chỉ bỏ response cũ, không giảm request đã gửi.
2. **Snapshot trong phiên và revalidate.** Quay lại thấy dữ liệu ngay, báo cập nhật nhỏ; giữ scroll. Xóa cache khi logout/đổi owner, xét ngày/version và kiểm server trước mutation. Cache không cấp quyền ghi hoặc phát thưởng.
3. **Lưu theo phạm vi.** Habit log refresh habit/tóm tắt đóng góp; chọn luyện/chiêu refresh game. Lịch, reminders và healthy chỉ invalidation khi thao tác thực sự ảnh hưởng. Receipt/ACK là nguồn xác nhận, không báo success trước server.
4. **Pending phù hợp.** Thể hiện bận tại hành động; vẫn xem/điều hướng được. Ranh giới write/version/receipt giữ ở backend; không bỏ `runtime.saving` để tạo parallel writes chưa được chứng minh an toàn.
5. **Tải đúng nội dung.** Report/archive/versions/story/preparation khi mở; catalog theo version; thumbnail cho list, ảnh lớn cho detail. Prefetch vừa đủ sau đường tải chính, không tải toàn art/catalog details lúc đầu.
6. **Tối ưu server có đo đạc.** Đo vòng D1, payload, settle/read/overview; gom đọc độc lập và summary bounded. Giữ cron/backlog/idempotency/thứ tự chốt; không bỏ settlement để đạt con số.

### Mục tiêu ban đầu

| Tình huống | Mục tiêu để kiểm chứng |
| --- | --- |
| Quay lại tab đã tải | Hiện snapshot ngay, phản hồi giao diện<200ms trên máy/profile test |
| Mở tab lần đầu | Shell/skeleton đúng màn ngay; dữ liệu mới mục tiêu≤1giây trên kết nối staging bình thường sau auth; nếu chưa đạt phải có số đo chặng |
| Ghi habit/chọn chiêu | Pending<100ms; kết quả đã xác nhận không phải chờ bootstrap6giây; không khóa toàn bộ giao diện đọc |
| Request | Một GET cùng snapshot đang chạy; tab cached không tự gọi bootstrap/history; subview chỉ đọc endpoint cần |
| Chậm/offline | Giữ snapshot/nháp/vị trí, retry cùng receipt, không success giả |

Đây là mục tiêu đề xuất, chưa là kết quả hoặc cam kết trên mọi mạng. So sánh trước/sau cùng fixture và network profile; remote owner traffic đo khi user thao tác thật, không tạo log cá nhân giả.

## 7. Kiểm chứng trước bàn giao

- Người mới tạo và ghi habit, hiểu trạng thái game rồi thử trận/chọn luyện mà không đọc docs bên ngoài.
- Người dùng6habit ghi tick/định lượng, hiểu quota3ngày, sửa tổng và quay lại đúng hàng; tính năng nền giữ hành vi.
- Luyện/chờ tuần/ngày sau/trận/chiêu/cứu có một bước tiếp rõ;39môn/15chương/tuyến phụ vẫn có lối đến.
- Chrome360/390/414, sáng/tối, chữ200%, keyboard. Xem screenshots mới để review thứ bậc, CTA, chiều cao hàng, crop art và contrast; không dùng ảnh F5 để nghiệm thu bản mới.
- Request count/timing, mạng chậm, ACK loss/retry, day boundary, hai tab conflict, logout cache và partial refresh có kiểm chứng; giữ hồi quy hệ cũ.
- Cho user xem preview hai tab và các luồng trước publish. Tests xanh không thay nghiệm thu độ đẹp/dễ dùng.

## 8. Files dự kiến khi duyệt hướng này

Inventory đã trình trước khi sửa, theo AGENTS.md user cung cấp. Chỉ dẫn tiếp theo của user cho phép tự chụp, đánh giá và sửa; các file ngoài inventory vẫn phải trình riêng nếu cần.

| Nhóm | Files | Thay đổi |
| --- | --- | --- |
| Hai tab | `web/views/habits.js`, `web/views/game.js`, `web/views/journey.js`, `web/views/game-collection.js`, `web/styles.css` | Danh sách gọn/trạng thái chính/lối khám phá/sưu tập, CSS có phạm vi |
| Form/luồng | `web/features/habits.js`, `web/features/game.js`, `web/features/battle.js`, `web/features/battle-presets.js`, `web/features/game-guide.js` | Form, CTA, ngày sau, chuẩn bị trận, presets, help |
| Tải tab | `web/app.js`, `web/core/live-data.js`, `web/core/lifecycle.js`, `web/core/mutations.js`, `web/core/http.js` | Dedupe/cache phiên/invalidation/partial refresh/pending |
| API/summary | `src/entrypoints/mini-app/habits.ts`, `src/entrypoints/mini-app/game.ts`, `src/adapters/d1/habit-store.ts`, `src/adapters/d1/game-store.ts`, `src/adapters/d1/battle-store.ts` | Đo/giảm vòng D1 và summary bounded, giữ atomic/rules/time |
| Kiểm chứng | `tests/browser/app-flows.test.mjs`, `tests/integration/habits.test.ts`, `tests/integration/practice.test.ts`, `tests/integration/battle.test.ts` | Luồng mobile, request/timing, guards, partial reads |

Triển khai có preview; quyết định chi tiết dựa trên màn thật và profiling. Nếu cần file/DTO khác, trình thay đổi cụ thể trước. Giữ luật habit/luyện/battle đã chốt, tập trung cách dùng và tốc độ của hai tab.

## 9. Vòng sửa UX hiện tại

### Đã triển khai và phát hành staging

- Thói quen: heading/thêm/tóm tắt ngày, một danh sách có hàng ổn định; tiến độ và ghi nhận là trọng tâm. Chi tiết mở từ tên/`···`; lịch sử/báo cáo và lưu trữ nằm sau danh sách. Form ghi tổng hôm nay và tạo habit thu gọn ghi chú/giờ nhắc.
- Thần Lộ: màn chính phục vụ trạng thái luyện/trận; intro gộp hướng dẫn, có lối chuẩn bị trận đầu. Ba lối Hành trình/Công pháp/Sưu tập nằm sau thẻ chính; các màn bên trong có quay lại. Tầng/tinh thuần mở thêm, giải thích chờ tuần nằm cạnh tiến độ.
- Hành trình: trận tiếp theo nổi trước phần chương; cảnh chương gọn và các boss chưa mở không còn nút disabled lớn. Mọi chương, tuyến phụ và điều kiện luyện vẫn còn.
- Chuẩn bị trận: cơ chế, bộ chiêu đang chọn, ngày hiệu lực và xác nhận nằm trước lore/chỉnh bộ chiêu/bản cũ. Gợi ý một bản ordinary hợp lệ nếu có; người dùng vẫn xác nhận xuất chiến và tự chấp nhận giá chiêu khi chọn trong trận.
- Sưu tập: thần binh thành một nhóm gọn; chiến tích đã đạt hiện trước, chưa đạt mở thêm.
- Tải/lưu: một đầu mối tải tab, gộp GET đang chạy, dữ liệu đã tải hiện ngay khi quay lại, giữ vị trí cuộn. Habit/game/preset có refresh riêng; base data được đánh dấu cần cập nhật sau mutation có ảnh hưởng. Không còn chờ bootstrap/history cho lượt ghi thông thường trong hai tab.
- Pending tập trung tại thao tác; thanh chuyển tab vẫn dùng được. Giữ serialized writes, ngày/version/receipt và phân biệt POST đã xác nhận với refresh thất bại. Reconcile cần đọc cả feature của receipt trước khi cho ghi tiếp.
- D1: read game gồm ngày và một SQL snapshot có giới hạn, bao gồm cả bản luyện đã chọn; habit dùng lại snapshot ngày đã khởi tạo với kiểm tra schedule/settings/boundary. API có Server-Timing theo các chặng, không đưa dữ liệu cá nhân vào header.

### Bằng chứng kiểm tra

- Ảnh trước: `D:/Tro-ly-AI-art/ux-before-*.png`, chụp mới bằng browser fixture chạy app thật ở localhost, không phải dữ liệu cá nhân.
- Các vòng ảnh sau: `ux-pass1-*`, `ux-pass2-*`, `ux-pass3-*`; vòng cuối `ux-final-*` và thư mục `D:/Tro-ly-AI-art/ux-reviewed/` gồm mobile, dark/light, chữ 200%, toàn campaign.
- Browser có kiểm tra request coalescing, cached render <200ms trên fixture, scroll, ghi habit khi bootstrap lỗi, navigation trong khi pending, ACK rồi refresh lỗi, và response cũ sau logout.
- Integration đã kiểm chứng game snapshot tối đa 3 reads và habit 30 hàng tối đa 6 reads trong ngày đã khởi tạo, dữ liệu trả về không đổi. 24 integration habit/practice/battle đã qua; các assertion query budget bổ sung cũng đã chạy qua riêng.
- Vòng browser đầy đủ đầu tiên phát hiện lỗi đổi màn/scroll sau chọn chiêu. Đã sửa controller để giữ màn đang xem; test tap đổi chiêu đã chạy qua lại. Vòng cuối đã qua **37 ca, 0 fail/skip**, gồm đối chiếu layout ba màn cũ với `02da227` và kiểm tra response ghi đến sau chuyển phiên đăng nhập; log `ux-browser-delivery-final.log` ngoài Git. Revision guard ngăn snapshot/thông báo từ phiên cũ áp vào phiên mới.
- So sánh cùng fixture tám habit và hai lần bấm tab: bản `02da227` gửi 3 GET habits + bootstrap + history, bản mới gửi 1 GET habits. Cached render đo 6,5ms trên localhost Chrome; giữ scroll; ghi habit thành công khi bootstrap fixture không khả dụng. Chi tiết: `ux-reviewed/ux-request-comparison.json` ngoài Git.
- Hồi quy toàn app lần đầu: 316/317 qua. Ca còn lại phát hiện guard của bot yêu cầu SQL bắt đầu bằng SELECT; đã bọc CTE bằng SELECT, giữ nguyên guard. Vòng cuối `test:all` hoàn tất exit0: **317 ca chính + 25 experiments, 0 fail/skip**, log `ux-test-all-delivery.log` ngoài Git. Browser cuối riêng **37/37**, tổng 379 ca trên source bàn giao.
- `check:web` (45 modules), typecheck và staging dry-run đã chạy lại trên source cuối và qua; staging config 3/3, bundle 662,11KiB/gzip153,91KiB,224 assets. Không có migration mới.
- Công cụ từ chối mở Chrome với profile có sẵn (`blocked by policy`). Không lấy cookie/key hay tạo dữ liệu cá nhân để thay thế. Chưa có phép đo mới từ phiên đăng nhập staging của user; Server-Timing và read-only natural tail phục vụ quan sát sau deploy. Không gọi số đo localhost là độ trễ trên điện thoại thật.

### Phát hành và nghiệm thu

- Source `59517aa`, push trên `review/p1-p3`; deploy staging exit0, Worker version `662c9da0-304c-4141-9f90-2ff32a5ae985`. Log `D:/Tro-ly-AI-art/ux-staging-deploy.log`; không migration/thay secrets/webhook/cron.
- Kiểm public sau deploy:215 file tĩnh200 và SHA256 khớp local; route `/app/`200/index khớp. Sáu GET API không auth trả401; POST với foreign Origin trả403 trước mutation. Report `ux-staging-public-smoke.json` ngoài Git. Không có owner write hoặc tin thử.
- Natural tail60giây quan sát một cron trên đúng version mới:outcome `ok`,CPU7ms/wall2637ms,parseErrors0 (`ux-staging-natural-runtime.json`). Tiến trình tail được dừng đúng hạn; childExitCode1 là do timed stop. Không có owner request trong mẫu nên chưa có số đo API đăng nhập mới; cron không chứng minh tốc độ hai tab.
- URL nghiệm thu: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ . Tải lại app, thử ghi/sửa tổng habit rồi mở Thần Lộ: trạng thái hiện tại→Hành trình→xem chuẩn bị trận, hoặc Công pháp→xem/chọn luyện. Các ghi nhận thật chỉ do user quyết định.
- Đã tự xem ảnh thực tế của browser fixture qua nhiều vòng sửa; kiểm màn nhỏ/sáng/tối/chữ200% và đối chiếu ba tab cũ. User vẫn cần đánh giá độ dễ dùng/hình thức trên máy thật; không tự xác nhận đã nghiệm thu thiết kế.
