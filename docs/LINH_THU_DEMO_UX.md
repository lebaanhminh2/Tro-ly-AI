# Demo FE linh thú SSR — thiết kế trước triển khai

Trạng thái: [HTML độc lập đã duyệt](prototypes/linh-thu/index.html) vẫn được giữ nguyên. Runtime đã tích hợp riêng trong `web/`, dùng API và DB, đủ 108 ảnh mới; [xem gallery](../output/imagegen/catalog-v3/index.html). **Bố cục mới nhất ở mục 10**: tím chủ đạo, bốn tab, Lò đan là nút, tháp ở Habit, không lặp danh sách habit. Các mô tả hai/ba tab, màu xanh và ghi habit trong Linh thú ở bản demo cũ bên dưới là lịch sử. Tiến độ kiểm thử xem [LINH_THU_IMPLEMENTATION.md](LINH_THU_IMPLEMENTATION.md).

## 1. Mục tiêu bản demo

Cho người dùng nhìn thấy chất lượng giao diện và trải nghiệm vòng luyện thú, thay vì nhồi toàn bộ tính năng game vào một trang. Dùng asset SSR đã có, lấy chuỗi **Frostnip → Frostpaw → Frostique → Frostluna** làm nhân vật chính. Ba chuỗi SSR khác xuất hiện trong bộ sưu tập để thử xem và đổi con.

Ưu tiên điện thoại, có bố cục riêng cho desktop. Toàn bộ chữ sản phẩm bằng tiếng Việt; giữ tên gốc linh thú để đối chiếu asset.

## 2. File demo thực tế

| File | Nội dung dự kiến |
| --- | --- |
| `docs/prototypes/linh-thu/index.html` | Toàn bộ HTML, CSS và JavaScript của demo: responsive, bốn SSR/bốn dạng, ghi habit, xem kỹ năng, hẹn đổi con và mô phỏng sang ngày. |

Dùng HTML/CSS/JavaScript thuần, tham chiếu trực tiếp các WebP trong `docs/assets/linh-thu/reference/ssr/`. Theo yêu cầu xem HTML, không tách thêm hai file CSS/JS như phương án đầu. Không cần thêm thư viện hoặc thay package. Không sửa `web/index.html`, `web/styles.css`, `web/app.js` hoặc backend trong phạm vi này.

## 3. Hướng thị giác

- Nền sáng ngà pha xanh rất nhẹ, chữ mực đậm; một khung trưng bày linh thú màu xanh đêm, ánh sáng băng nhẹ làm điểm nhấn.
- Màu chính xanh ngọc lạnh và tím dịu; vàng dùng tiết chế cho nhãn SSR hoặc mốc đặc biệt. Không đặt mọi thẻ trong viền vàng/phát sáng.
- Linh thú là trọng tâm thị giác, nguyên thân, không cắt tai/đuôi; có không gian thở, bóng tiếp đất và một quầng nền mờ. Không bóp méo hoặc phóng ảnh nguồn quá lớn.
- Các phần thông tin dùng bề mặt sạch, khoảng cách rõ, ít đường viền. Đường trang trí không cạnh tranh với dữ liệu cần đọc.
- Font hệ thống hỗ trợ tiếng Việt, nội dung chính 15–16px, chú thích tối thiểu 12px. Con số tiến độ dùng chữ số có độ rộng đều.
- Trạng thái có chữ/biểu tượng bên cạnh màu. Máu xám có họa tiết nhẹ hoặc dấu phân biệt để không phụ thuộc màu sắc.
- Chuyển động ngắn khi chuyển dạng/ghi nhận, không rung/lấp lánh liên tục. Tôn trọng `prefers-reduced-motion`.

## 4. Kiến trúc thông tin

Hai mục nội bộ: **Đang luyện** và **Bộ sưu tập**. Triệu hồi và tháp không trở thành tab thứ ba/thứ tư trong bản xem thử này. Chúng có đặc tả riêng trong tổng hợp sản phẩm, sẽ triển khai ở lượt demo tiếp theo khi cần.

### Màn Đang luyện

Thứ tự điện thoại:

1. Dòng nhỏ riêng cho bản demo: nhãn dữ liệu mẫu, Đặt lại và công cụ Sang ngày. Không trộn công cụ mô phỏng với hành động sản phẩm.
2. Tiêu đề Linh thú, điều hướng Đang luyện/Bộ sưu tập.
3. Khung nhân vật: nhãn SSR, tên dạng hiện tại, ảnh lớn, tên chuỗi. Nút phụ Xem tiến hóa mở phần xem bốn dạng.
4. Thanh luyện ba phần, số điểm thực/xám/còn lại, độ thuần ghi rõ **tạm tính** khi chưa kết thúc lượt. Có giải thích xám qua nút thông tin.
5. Tóm tắt hôm nay: 3/4 habit, dự kiến +1,2 điểm thực và +0,4 xám nếu chốt ở trạng thái hiện tại. Tối đa ngày này +1,6. Nhắc kết quả còn thay đổi trước khi đóng ngày.
6. Danh sách bốn habit, trạng thái và hành động ghi nhận từng habit. CTA chính dẫn đến habit còn thiếu, không có nút chung tự nhận điểm luyện.
7. Tóm tắt hiệu ứng đang có; liên kết Xem kỹ năng để mở thiên phú và các điều kiện 95%/100%.
8. Hành động Đổi con luyện nằm trong quản lý, tách khỏi ghi habit để tránh bấm nhầm.

Desktop dùng hai cột: nhân vật và thanh luyện bên trái; việc hôm nay và hiệu ứng bên phải. Giữ cùng thứ tự đọc. Mobile một cột, không có thanh cuộn ngang trang.

### Màn Bộ sưu tập

- Bốn SSR với ảnh, tên, dạng và nhãn trạng thái bằng chữ: Đang luyện / Đã sở hữu / Chờ ngày mai / Lượt luyện đã khóa khi có.
- Chạm một con mở chi tiết. Chạm ảnh hay thẻ không tự đổi con đang luyện.
- Trong chi tiết có hai hành động tách biệt: **Chọn để luyện** và **Đồng hành**. Mỗi hành động giải thích đúng phạm vi; chọn đồng hành không khóa lượt luyện.
- Có đường quay về rõ ràng; không để dialog lồng dialog.

## 5. Những luồng tương tác cần chạy được

### A. Ghi habit và hiểu kết quả hôm nay

Mở demo → thấy Frostique đang luyện → thấy còn một habit Đọc sách 15/20 phút → mở ghi nhận → lưu 20 phút → danh sách thành 4/4 → dự kiến đổi từ 1,2 thực + 0,4 xám thành 1,6 thực + 0 xám.

Chỉ cập nhật dự kiến, không cộng điểm luyện vĩnh viễn ngay khi tick. Dùng Sang ngày trong vùng công cụ demo để quyết toán đúng một lần rồi bắt đầu ngày mới. Được thử bỏ đánh dấu trước chốt; không nhân thưởng khi bấm lặp.

### B. Xem tiến hóa

Mở Xem tiến hóa → bốn ảnh theo đúng chuỗi → chọn dạng để xem hình và tên → đóng trở lại đúng màn hình. **Xem trước không tăng cấp con đang luyện**. Không tự gắn ngưỡng tiến hóa chưa chốt thành luật sản phẩm.

### C. Đổi con đang luyện

Mở Bộ sưu tập → chọn Stormlion → xem chi tiết → Chọn để luyện → màn xác nhận nêu tên cả hai con và hậu quả:

> Hôm nay vẫn tính cho Frostique. Stormlion bắt đầu từ ngày mai. Sau khi chốt hôm nay, lượt luyện Frostique sẽ khóa ở tiến độ hiện tại và giữ tạp chất. Muốn luyện lại cần Tịnh Linh Đan.

Hai lựa chọn: Giữ con hiện tại / Hẹn đổi ngày mai. Sau xác nhận hiển thị trạng thái chờ và cho hủy trước khi sang ngày. Mô phỏng sang ngày: quyết toán con cũ, khóa lượt cũ, chuyển con mới; không đưa con cũ về đầu mốc.

### D. Xem kỹ năng và độ thuần

Mở Xem kỹ năng → phân nhóm Thiên phú / Thức tỉnh 95% / Hoàn mỹ 100% → mỗi kỹ năng có tên, điều kiện, tác dụng và trạng thái. Con đang luyện dở chưa mở 95%/100% dù độ thuần tạm là 100%.

Hiển thị đúng thiên phú theo dạng trong baseline, không dùng sức mạnh T4 cho T3. Các con số và tên lấy từ tài liệu kỹ năng, không rải trong nhiều đoạn xử lý giao diện.

### E. Đổi đồng hành

Trong chi tiết con đã sở hữu → chọn Đồng hành → thông báo hiệu lực từ ngày kế tiếp. Có nhãn riêng cho con đang đồng hành. Không chạy luồng khóa luyện, không dùng chung lời cảnh báo của Đổi con luyện.

## 6. Dữ liệu minh họa và giới hạn

- Ví dụ bộ bốn habit hằng ngày để demo phép tính rõ ràng: Thiền, Vận động, Uống nước, Đọc sách. Không lấy trạng thái từ tài khoản thật.
- Mặc định con đang luyện ở T3, có lịch sử luyện mẫu. Các số điểm/thanh tổng trong demo phải ghi là minh họa; không coi tổng thanh là quyết định ngưỡng rank cuối cùng.
- Độ thuần tạm có thể bắt đầu không xám để thử hành vi trượt ngày. Sang ngày với 3/4 tạo đúng 0,4 xám; làm đủ ngày sau không xóa xám cũ.
- Dùng khóa localStorage riêng cho demo, có Đặt lại. Tải lại không làm mất quyết định đổi đang chờ hoặc cộng lại ngày đã chốt.
- Không có gacha SSR chắc chắn được ngụy trang thành tỷ lệ sản phẩm; bản này là demo bốn SSR được cấp sẵn để trải nghiệm UI.
- Không làm giả ảnh hoàn mỹ chưa được vẽ. Có thể biểu diễn điều kiện khóa và hướng trang trí giao diện, nhưng không gọi recolor đơn giản là asset hoàn mỹ đã duyệt.

## 7. Tiêu chí kiểm tra trước khi bàn giao

- Kiểm tra điện thoại 360px và 390px, desktop; không tràn ngang, các nút chính đủ vùng bấm khoảng 44px, ảnh không vỡ bố cục.
- Kiểm tra bàn phím, focus khi mở/đóng dialog, Escape, nhãn trường nhập, thông báo trạng thái và giảm chuyển động.
- Kiểm tra ghi habit → preview đúng → quyết toán một lần → xám giữ lại → hẹn đổi → hủy → hẹn lại → sang ngày → khóa đúng con.
- Kiểm tra xem tiến hóa không đổi dữ liệu luyện, chọn đồng hành không khóa luyện, xem skill khóa đúng điều kiện.
- Mở bằng trình duyệt để xem hình desktop/mobile và tương tác nếu môi trường có trình duyệt. Nếu không chạy được bước nào phải ghi đúng giới hạn, không báo đã kiểm tra thay cho suy đoán.

Tham chiếu: [thiết kế toàn bộ](LINH_THU_SPEC.md), [kỹ năng](LINH_THU_SKILLS.md), [mỹ thuật](LINH_THU_ART_DIRECTION.md), [asset SSR](assets/linh-thu/reference/ssr-evolutions.png).

## 8. Bổ sung tiếp theo: thanh xám, triệu hồi và mở thẻ

Trạng thái: đã triển khai sau khi người dùng xác nhận; các điều chỉnh mới nhất ở mục 9. File code dự kiến sửa duy nhất là `docs/prototypes/linh-thu/index.html` (CSS/JS tiếp tục nhúng trong HTML), đã được người dùng xác nhận theo AGENTS.md.

### Thanh xám đi ngược từ cuối thanh

- Điểm thực neo **mép trái**, tăng về bên phải.
- Tạp chất neo **mép phải**, tăng về bên trái; không xếp ngay sau phần xanh.
- Phần trống nằm giữa. Hai phần chỉ chạm nhau khi tổng điểm thực và xám bằng dung lượng tối đa.
- Thay vạch sọc hiện tại bằng xám khói có chuyển sắc nhẹ và cạnh trong rõ. Khi tăng xám, cạnh trong lùi sang trái, biểu diễn dung lượng còn có thể luyện sạch đang thu hẹp.
- Ví dụ minh họa tổng 120, thực 72, xám 12: xanh 60% bên trái, trống 30% ở giữa, xám 10% sát bên phải. Số điểm và công thức giữ nguyên; chỉ đổi cách vẽ.
- Có công cụ xem trạng thái mẫu có tạp chất để thấy hiệu ứng ngay, tách khỏi các hành động thật của giao diện.

### Đặt phần quay ở đâu

- Điều hướng linh thú gồm **Đang luyện / Bộ sưu tập / Triệu hồi**; desktop trong sidebar, mobile ba mục ngang.
- Triệu hồi dành cho quay linh thú, không trộn với ghi habit hoặc quay thường hiện có của ứng dụng.
- Màn triệu hồi: khung trưng bày lớn, số vé thường/vé triệu hồi, hai nút **Triệu hồi ×1 / ×10**, hai bộ đếm bảo hiểm và đường mở tỷ lệ/đổi vé.
- Đổi vé trong một dialog gọn, ghi rõ **20 vé thường = 1 vé triệu hồi**, có số lượng và tổng chi phí trước khi đổi.
- Giữ tỷ lệ nền và bảo hiểm đã bàn, không chỉnh tỷ lệ chỉ để demo hay hơn. Công cụ xem thử hiệu ứng theo rank đặt riêng, không làm tăng bảo hiểm hoặc tiêu vé.
- Tháp lật bài giữ điểm vào trong vùng **habit hôm nay**. Bổ sung một thẻ gọn, ghi rõ điều kiện **full habit + một task** và một lượt/ngày. Trải nghiệm tháp mở trong lớp riêng; không tạo thêm tab thứ tư của linh thú.

### Phong cách mở thẻ

Lấy cảm hứng từ nhịp dẫn sáng, chuyển cảnh không gian tối và cách giới thiệu nhân vật của Wuthering Waves; dùng hiệu ứng giao diện tự thiết kế cùng asset linh thú đang có, không mặc định có video hoặc hiệu ứng gốc của game đó.

| Rank | Màu viền theo yêu cầu | Cách thể hiện |
| --- | --- | --- |
| UR | **Đỏ** | Viền đỏ sắc, lõi sáng, quầng năng lượng đỏ sẫm; mức giới thiệu mạnh nhất. |
| SSR | **Cam** | Viền hổ phách/cam, ánh sáng ấm và tia mảnh. |
| SR | **Tím** | Viền tím, tinh vân và hạt sáng tím. |
| R | **Xanh biển** | Viền xanh biển, ánh sáng gọn và ít hiệu ứng hơn. |

Luồng một lượt: bấm triệu hồi → dải sáng hội tụ trong không gian tối → màu rank xuất hiện → thẻ quay/mở ra, hiện ảnh, tên và rank → xác nhận hoặc quay tiếp. Nhịp khoảng 2–3 giây; có **Bỏ qua hiệu ứng** ngay từ đầu. Không phát âm thanh tự động, không nháy liên tục.

Thẻ dùng ảnh thật của đúng loài/dạng. Các loài ngoài SSR có thể dùng asset đã lưu để minh họa đủ bốn màu; không bịa thêm loài. Nếu xem ảnh T4 để giới thiệu tiềm năng thì phải ghi rõ là xem dạng cuối, không nhầm rằng mọi lượt quay đều nhận thú đã luyện xong.

Quay mười lượt kết thúc bằng bảng mười thẻ có viền theo rank, nhìn rõ con hiếm nhất. Có thể mở chi tiết từng thẻ. Không ép xem mười hoạt ảnh dài liên tiếp.

Kết quả được quyết định và ghi nhận trước khi chạy hiệu ứng; bấm liên tiếp, bỏ qua, tải lại không tạo lượt hoặc phần thưởng mới. Với giảm chuyển động, đi thẳng đến mở thẻ nhẹ hoặc kết quả. Dữ liệu tất cả chỉ thuộc demo cục bộ.

### Điểm cần xem khi kiểm tra đợt bổ sung

- Đúng hình học trái–trống–phải của thanh, kể cả xám = 0, gần đầy và đầy thanh.
- Chuyển động xám ngược chiều xanh; không thay phép tính luyện/thuần.
- Ba mục điều hướng vừa điện thoại 360px, không kéo ngang hoặc làm nhầm Triệu hồi với tháp.
- Tỷ lệ/đổi vé/thiếu vé/bảo hiểm rõ ràng; xem hiệu ứng mẫu không ghi thành lượt quay thật của demo.
- Màu UR đỏ, SSR cam, SR tím, R xanh biển đúng ở cả màn mở và danh sách kết quả.
- Có đường thoát hiệu ứng, bàn phím, giảm chuyển động, xử lý tải lại và chặn bấm lặp.


## 9. Bản demo bổ sung đã triển khai — 19/10/2026

Mục này thay thế bố cục ghi habit lặp lại ở mục 4 và mô tả màu xanh tại mục 8. Người dùng đã duyệt sửa HTML và yêu cầu làm rõ hai vai trò luyện/đồng hành.

### Giao diện

- Bảng màu theo web/styles.css: nền #F4F3F8, thẻ trắng, tím #7460D5. Không dùng xanh lá cho UI; asset thú giữ màu gốc.
- Điểm thực neo trái; tạp chất xám khói neo phải và đi lùi sang trái; phần trống ở giữa. Giữ nguyên phép tính.
- Hai thẻ ảnh riêng Đang luyện / Đang đồng hành, đều có tên, dạng và nút xem. Đồng hành có kỹ năng đang hiệu lực và nút đổi riêng.
- Điện thoại có hai ảnh nhỏ đầu màn để nhận biết và chuyển đến từng vai trò. Nếu cùng một con giữ cả hai vai trò, có ghi chú giải thích.
- Bỏ danh sách/check/ghi habit tại trang Linh thú; chỉ còn số habit và điểm dự kiến. Chưa tích hợp tab Habit của ứng dụng chính; tháp không đặt vào trang Linh thú.
- Ba màn: Đang luyện / Bộ sưu tập / Triệu hồi.
- Mẫu mới: Frostique T3 đang luyện (72 thực, 12 xám / 120), Blitzmane T3 đồng hành. Dữ liệu demo đã lưu trước đó vẫn giữ; Đặt lại dùng mẫu mới.

### Triệu hồi

- Ví dùng thử: 240 vé thường, 12 vé triệu hồi, bộ đếm 17/20 và 37/80. Không phải quà cấp của sản phẩm.
- Đổi 20 vé thường = 1 vé triệu hồi, nhập số lượng và xác nhận chi phí; quay ×1/×10.
- Giữ tỷ lệ R70% / SR25% / SSR4,5% / UR0,5%. Bảo hiểm SSR+: SSR90% / UR10%; bảo hiểm UR lượt 80 được ưu tiên. Reset đúng rank nhận được.
- Đủ 18 loài từ 72 asset đã lưu. Triệu hồi nhận dạng I. Banner Frostluna ghi rõ xem trước dạng IV và không có tỷ lệ ưu tiên.
- Toàn màn hình: luồng sáng hội tụ, thẻ xoay/mở, ảnh và rank xuất hiện. Viền UR đỏ / SSR cam / SR tím / R xanh biển; UR thêm vòng ấn hình học và quầng sáng.
- Có bỏ qua hiệu ứng, Escape, nhánh giảm chuyển động. ×10 giới thiệu con có rank cao nhất rồi xem đủ 10 thẻ.
- Lưu kết quả trước hoạt ảnh; chặn quay thêm khi đang mở thẻ. Skip/tải lại không phát sinh lượt. Có xem kết quả gần nhất.
- Thú mới vào bộ sưu tập, thú trùng lưu số bản, chưa quy đổi vật phẩm. Bốn SSR có demo luyện/kỹ năng; rank khác xem đủ bốn dạng.
- localStorage riêng, không API, không ảnh hưởng dữ liệu ứng dụng chính.

### Công cụ xem thử

Nút Thử trạng thái & mở thẻ (desktop) / Thử trạng thái (mobile): chỉnh số habit mẫu, bật/tắt 12 tạp chất, xem riêng hiệu ứng từng rank. Xem hiệu ứng không tiêu vé, không thêm thú hoặc đổi bảo hiểm.

### Kiểm tra

- Chrome cục bộ: hai vai trò, xem tiến hóa không tăng cấp, hẹn/hủy đổi, chốt ngày cho con cũ rồi khóa đúng tiến độ, đồng hành giữ riêng.
- Thanh thực–trống–xám đúng vị trí; không còn danh sách habit ở trang Linh thú.
- Bốn rank đúng màu, xem thử không tiêu vé, đổi vé đúng chi phí, chặn bấm quay lặp, giữ kết quả sau tải lại.
- Chuỗi ×10 với dữ liệu điều khiển kiểm tra reset bộ đếm và ưu tiên UR. Không thay tỷ lệ của demo.
- Đã sửa sự kiện đóng dialog đến muộn sau khi mở lại nhanh.
- Ba màn không tràn ngang ở 360, 390, 768, 1024 và 1440px; đã xem ảnh render desktop/mobile; không có lỗi JS trong các luồng kiểm tra.
- Kiểm tra cú pháp JS và đủ 72 đường dẫn asset.

## 10. Bố cục được duyệt cuối và runtime

- Điểm vào Linh thú trong điều hướng chính; vẫn giữ Hôm nay, Thói quen, Lời nhắc, Thành tích.
- Đúng **bốn tab con**: Đang luyện / Đồng hành / Bộ sưu tập / Triệu hồi. Nút **Lò đan** ở góc tiêu đề; không có tab thứ năm.
- Luyện và Đồng hành đều có khung nhân vật lớn, tên/dạng, nút xem chi tiết và nút đổi vai trò riêng. Đổi luyện cảnh báo khóa lượt cũ sau chốt ngày; đổi đồng hành không khóa luyện.
- Điểm thực tím từ trái; tạp chất xám khói từ phải đi lùi về trái. Không lặp danh sách/check habit trong màn Linh thú.
- Bộ sưu tập hiển thị từng cá thể và phân trang; tổng số loài lấy từ toàn kho, không lấy riêng trang đang tải.
- Triệu hồi ×1/×10 dùng ví thật, ghi kết quả trước hiệu ứng. Có skip/Escape/reduced motion, kết quả gần nhất và phục hồi receipt. Pyrodaemon có màn chọn 1/3 ứng viên được giữ trên server.
- Các phần thưởng tự chọn của kỹ năng và quay thường có trạng thái chờ riêng; đóng hoặc tải lại không mất quà đã trả vé.
- Lò đan có hình lò SVG, chuỗi 30 ngày, kho đan, bảo hiểm, hiệu ứng kết đan có thể bỏ qua và xác nhận reset từng cá thể.
- **Tháp 4 tầng chỉ ở Habit**, mở ngay khi đủ điều kiện. Hiển thị quà đang mạo hiểm, tổng quà tầng tiếp theo, Dừng/Tiếp tục và cảnh báo bẫy. Phiên thật giữ trên server.
- Không dùng dữ liệu mẫu/localStorage của prototype để khởi tạo tài khoản thật. localStorage/sessionStorage chỉ giữ tùy chọn hiển thị và danh tính request đang cần xác nhận, không có quyền cấp thưởng.

Runtime đã được kiểm bốn luồng trình duyệt mới: điều hướng/triệu hồi, tháp, tiến độ tuyệt kỹ và mất phản hồi sau triệu hồi rồi reload. Đã kiểm hình học 360/390/768/1024/1440px, chữ gấp đôi, sáng/tối, bàn phím/reduced motion và xem ảnh render. Nhãn bốn tab xuống dòng trong đúng nút khi chữ lớn; phần chữ nhân vật và ảnh không chồng nhau. Xem [hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md); đây chưa phải xác nhận nghiệm thu. Ảnh hiện dùng bản tham chiếu tối ưu để kiểm bố cục, chưa phải ảnh vẽ lại cuối.
