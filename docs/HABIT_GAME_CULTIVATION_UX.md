# Tu luyện — giao diện và luồng

Cập nhật: 2026-10-13. Bản HTML đã được người dùng đồng ý làm nền tảng; **luồng mới và bộ art cuối đã tích hợp trong app thật, hoàn tất QA local**, xem [checkpoint hiện tại](HABIT_GAME_CULTIVATION_PROGRESS.md). Các số giao chiến trong HTML vẫn chỉ là mô phỏng. Trạng thái/commit/version staging thực tại RELEASE; phần kiểm bản thử bên dưới là lịch sử, không mô tả app hiện hành.

Mở [bản HTML tương tác](prototypes/cultivation/index.html) trực tiếp trong Chrome/Edge. Không cần đăng nhập, cài thư viện hoặc có mạng. Dữ liệu mẫu lưu trong trình duyệt, độc lập với dữ liệu của app. Nút **Đổi tình huống** giúp xem các trạng thái mà không phải chơi nhiều ngày.

## 1. Phạm vi vòng tạo HTML trước

- `web/index.html`, `web/styles.css`: sửa icon Thói quen thành ô tick SVG, giữ đúng thứ tự điều hướng đã chốt.
- `docs/prototypes/cultivation/index.html`: một file HTML tự chứa CSS/JS/dữ liệu mẫu, có thể bấm thử các luồng bên dưới.
- Tài liệu này ghi quyết định thiết kế và các điểm cần xử lý khi áp dụng vào app.

HTML dùng dấu ấn đơn giản để chốt luồng. Mục tiêu hiện tại đã cho phép làm art cuối, code app thật và các thay đổi backend cần thiết; không dùng danh sách file của vòng HTML làm giới hạn triển khai. Trận mới bỏ vũ khí; snapshot của trận cũ phải giữ tương thích.

## 2. Những vấn đề của cách tổ chức hiện tại

| Phần hiện tại | Vấn đề | Cách tổ chức trong bản thử |
| --- | --- | --- |
| Luyện, thư viện, nguồn mở khóa và bản luyện | Phải đi qua nhiều bảng và đọc nhiều thông tin mới hiểu mình nên làm gì | Mở tab thấy ngay môn/bản/tầng đang luyện; quyền học và các bản nằm trong chi tiết công pháp |
| Hành trình theo chương và encounter | Khó thấy đường tiến lên và đối thủ tiếp theo | Các trận chính thành tầng có số; tầng hiện tại được ưu tiên, các tầng khác nằm trong từng nhóm bốn tầng |
| Sưu tập | Vũ khí chiếm trọng tâm, thành quả đánh boss khó nhìn | Thành tựu lấy boss đã thắng làm nội dung chính, có bản ghi trận và phần truyện sau chiến thắng |
| Bí tịch đặc biệt | Danh mục và điều kiện mở chưa tạo cảm giác tìm thấy một thứ mới | Phân biệt chưa phát hiện, đã tìm thấy và đã mở quyền học |
| Chuẩn bị và giao chiến | Nhiều lựa chọn/cấu hình cạnh tranh sự chú ý | Chuẩn bị bộ công pháp một lần; khi giao chiến chỉ chọn chiêu cho ngày hiện tại |
| Thông tin sau trận | Dễ lẫn luyện lại với một trận vừa kết thúc | Có màn hình kết quả riêng, nêu thứ vừa mở và lịch quay lại luyện |

Đây là nhận xét về cấu trúc và các màn hình đã đọc/chụp. Các thay đổi tải API của Tu luyện cần đo riêng khi áp dụng vào app; tốc độ HTML cục bộ không chứng minh độ trễ của API staging.

## 3. Bốn mục cố định

### Hiện tại

Tên này thay cho “Đang luyện” trong bản thử vì cùng một vị trí phải thể hiện cả luyện và xuất chiến.

- **Chưa chọn môn:** một lời dẫn ngắn và nút Chọn công pháp.
- **Đang luyện:** tên môn, phái, bản luyện, tầng đang hướng đến, tiến độ và tinh thuần đã chốt. Bốn tầng nằm trên một đường tiến độ chung. Bản chưa hoàn thành Nhập môn hiện “Chưa chốt tinh thuần”.
- **Lựa chọn ngày mai:** một dòng báo đã hẹn, bấm để xem/đổi. Không biến thao tác chuẩn bị thành chuyển chế độ ngay trong ngày.
- **Đang giao chiến:** đối thủ, sinh lực hai bên, ngày giao chiến, đòn đã báo, bộ chiêu hôm nay và chiêu đã chọn.
- **Chờ cứu mạng:** hạn quyết định và lựa chọn cứu/tử trận thay phần chọn chiêu.
- **Trận kết thúc:** kết quả, chiến tích/bí tịch vừa mở, thông tin tiếp tục luyện và đường tới thử thách kế tiếp.

Đóng góp habit nằm dưới thẻ đang luyện, mở rộng khi cần xem từng habit. Habit chưa đủ mục tiêu góp 0; ngày linh hoạt trong tuần chưa bị thiếu cam kết vẫn trung tính. Khi đang đánh boss, đóng góp đi vào lượt chiến đấu. Không tạo một danh sách habit có thể tick lần thứ hai trong tab này.

### Công pháp

Mặc định **Đã mở**, chọn phái/nhóm bằng một bộ lọc; **Khám phá** dành cho những môn chưa có quyền luyện. Tìm kiếm theo tên hoặc công dụng, hỗ trợ gõ không dấu.

Mỗi thẻ sách gồm dấu ấn, tên môn, một dòng về vai trò chiến đấu và trạng thái luyện. Chạm thẻ để mở:

1. Công dụng và điểm khác biệt khi dùng trong trận.
2. Bốn tầng và đặc điểm tốc độ luyện.
3. Điều kiện mở quyền học, nếu chưa mở.
4. Các bản luyện, tầng/tinh thuần từng bản, nếu đã sở hữu.
5. Một hành động chính: luyện một bản, bắt đầu luyện, hoặc đến thử thách mở khóa.

**Luyện lại** có xác nhận, tạo bản mới từ Nhập môn. Bản cũ giữ tinh thuần, tiến độ và quyền dùng trong trận. Chọn bản khác/luyện mới áp dụng từ ngày sinh hoạt kế tiếp. App thật yêu cầu hủy chuẩn bị hoặc kết thúc trận trước khi đổi lịch luyện; không âm thầm thay lựa chọn xuất chiến và không tạo bản mới khi thao tác bị chặn.

**Đã mở** nghĩa là đã có quyền học. Công pháp mới mở chưa có sẵn một bản đạt Nhập môn để mang vào trận.

### Vượt tầng

Danh mục hiện có gồm **22 trận chính và 18 cơ duyên**. Bản thử ánh xạ 22 trận chính thành tầng 01–22, giữ chuỗi điều kiện hiện có. Đây là thay đổi trình bày, chưa đổi engine hay thêm trận mới.

- Đầu trang: số tầng đã vượt và thẻ đối thủ kế tiếp.
- Dưới: đường tầng nối liền; nhóm bốn tầng giúp xem tiến trình mà không kéo qua 22 thẻ.
- Tầng đã vượt mở chiến tích; tầng mở được xem chi tiết/chuẩn bị; tầng chưa đến hiển thị số tầng và điều kiện trước đó.
- **Cơ duyên** là các thử thách phụ đã tìm thấy, xuất hiện riêng dưới đường tầng. Chúng mở công pháp đặc biệt và có thể có điều kiện luyện riêng.
- Chi tiết boss nêu cơ chế nổi bật, số ngày giao chiến tối đa, cảnh giới gợi ý, quyền luyện sẽ mở và truyện trước trận trong phần mở rộng.

Luồng chuẩn bị:

**Chọn tầng/cơ duyên → xem đối thủ → chọn tối đa 5 công pháp → chọn một bản đã đạt Nhập môn cho mỗi môn → xác nhận xuất chiến ngày mai.**

Võ Kỹ luôn có sẵn. Không có bước chọn Thần binh. Có thể xem/đổi bộ chiêu hoặc hủy chuẩn bị trước khi trận bắt đầu. Các bộ chiêu lưu sẵn của app thật nên được giữ dưới lựa chọn nâng cao khi triển khai, không chiếm trang chính. Bản HTML này chưa mô phỏng thư viện preset.

### Thành tựu

Nội dung chính là **boss đã thắng**, không phải danh sách toàn bộ boss chưa đánh:

- Số boss đã vượt, số tầng chính và cơ duyên.
- Mỗi chiến tích có tên đối thủ, tầng hoặc loại cơ duyên, ngày thắng và số ngày giao chiến.
- Chi tiết lưu công pháp đã dùng, có dùng cứu mạng hay không, quyền luyện đã mở và truyện sau trận.
- Danh hiệu nằm trong phần mở rộng phía dưới. Hai danh hiệu trong HTML là dữ liệu minh họa; app thật lấy danh hiệu từ dữ liệu hiện có.
- Lịch sử giao chiến giữ cả trận thua, hết lượt và rút lui. Những trạng thái này không làm tăng số boss đã thắng.

“Thành tựu” thuộc Tu luyện; tab “Thành tích” ở thanh chính tiếp tục phục vụ cảnh giới/hỏa mạch và các nội dung hiện có.

## 4. Bí tịch ẩn và cấm thuật

| Trạng thái | Người dùng nhìn thấy | Có thể làm |
| --- | --- | --- |
| Chưa phát hiện | Một mục gom các trang còn niêm phong; chưa lộ tên từng công pháp | Xem manh mối về tầng/cơ duyên dẫn tới bí tịch |
| Đã tìm thấy | Tên, vai trò, cái giá và thử thách mở quyền học | Xem điều kiện cụ thể, luyện các môn còn thiếu, chuẩn bị thử thách khi đủ điều kiện |
| Đã mở quyền học | Thẻ trong Đã mở, trạng thái Chưa luyện | Bắt đầu luyện từ Nhập môn |
| Đã luyện | Các bản/tầng/tinh thuần đã đạt | Tiếp tục luyện hoặc chọn một bản hợp lệ cho trận |

Không rải 14 thẻ khóa giống nhau. Mục **Xem manh mối** mở danh sách khi người dùng thực sự muốn khám phá.

Đề xuất phát hiện dựa trên các chiến thắng tiền đề của thử thách: đủ điều kiện tìm thấy cơ duyên thì hé lộ tên. Điều kiện vào trận có thể còn yêu cầu luyện công pháp. Không thêm rơi đồ ngẫu nhiên hoặc một tài nguyên riêng để mua bí tịch trong vòng này.

Ví dụ lấy từ nội dung dự án:

- **Kiếm Vực Khai Thiên:** vượt Thiết Lệnh Sứ, luyện các môn Thiên Kiếm yêu cầu tới Nhập môn, thắng Người Giữ Kiếm Trầm để có quyền học.
- **Nghịch Mệnh Hoán Sinh:** theo đường chính qua Huyết Hà, thắng Tạ Trường Sinh để mở quyền luyện.
- **Thâu Thiên Hoán Mệnh:** sau tầng 08, tìm thấy Người Đoạt Huyết; thắng cơ duyên này mở cấm thuật.
- **Vô Môn Dịch Kinh:** cũng có dấu vết sau tầng 08, mở qua Khách Không Môn.
- **Tứ Ấn Vấn Thiên:** cần các chiến thắng/công pháp ngoài phái trước đó; điều kiện thể hiện thành danh sách trong chi tiết.

Ẩn tên/phát hiện là thiết kế mới của vòng này. Backend đang triển khai redaction theo tiến trình, không chỉ ẩn bằng CSS. Người chơi cũ đã sở hữu hoặc luyện vẫn giữ quyền; không khóa lại bí tịch của họ.

## 5. Giao chiến, kết quả và cứu mạng

**Ngày xuất chiến bắt đầu → xem đòn đã báo → chọn một chiêu → hoàn thành habit trong ngày → kết toán cuối ngày → xem lượt mới hoặc kết quả trận.**

- Bấm chiêu lưu lựa chọn cho ngày hiện tại; có thể đổi trước khi ngày kết thúc.
- Cấm thuật nêu đánh đổi trước khi xác nhận. Cái giá được thực thi khi kết toán, không phải mỗi lần mở/đổi lựa chọn.
- Chưa chọn chiêu thì trận chờ; sau ba ngày chưa chọn sẽ rút an toàn theo luật hiện có.
- Thắng ghi chiến tích và mở quyền học tự động.
- Kết thúc trận khôi phục lịch luyện theo cơ chế hiện tại, từ ngày sinh hoạt hợp lệ tiếp theo. Màn hình kết quả nêu ngày này rõ ràng; không tự cộng lại đóng góp của ngày chiến đấu vào luyện.
- Mất sinh lực mở trạng thái cứu, có hạn quyết định. Hộ Mệnh và Nghịch Mệnh dùng chung tối đa một quyền cứu mỗi trận.
- Nghịch Mệnh cần được chuẩn bị qua chiêu ở lượt bị hạ và đủ cảnh giới; bảng xác nhận nêu bậc trước/sau và khóa đột phá ba ngày.
- Tử trận phải hiện khoản Tu Vi mất trước xác nhận, chỉ thực thi một lần. Rút lui giữ cái giá của các lượt đã chốt.

HTML mô phỏng để thử thứ tự thao tác; sát thương, sinh lực, đóng góp, chi phí Hộ Mệnh và tiến độ là số mẫu. Đây không phải bản sao engine hay quyết định cân bằng mới. Các báo giá/điều kiện thật khi triển khai phải lấy từ API và luật domain hiện có.

## 6. Cách nghiệm thu nhanh

Trong **Đổi tình huống**:

1. **Người mới:** chọn công pháp → chọn luyện → Sang ngày mẫu kế.
2. **Đang luyện:** xem các bản Kiếm Ý, chọn bản cũ hoặc luyện lại; kiểm tra ngày hiệu lực và tinh thuần cũ.
3. **Đã chuẩn bị trận:** xem/đổi bộ công pháp và hủy chuẩn bị.
4. **Đang đánh boss:** chọn/đổi chiêu, xem nhật ký; Sang ngày mẫu kế để xem lượt mới.
5. **Đã tìm thấy cấm thuật/bí tịch ẩn:** vào Công pháp → Khám phá → Bí tịch đặc biệt; xem điều kiện và đến cơ duyên.
6. **Sinh lực cạn:** thử Hộ Mệnh hoặc tình huống có Nghịch Mệnh; cũng có thể chấp nhận tử trận.
7. **Đã thắng cơ duyên:** xem kết quả, công pháp vừa mở và Thành tựu.

Có nút đổi sáng/tối và xuất JSON **dữ liệu mẫu** trong điều khiển mô phỏng. Không gửi dữ liệu, không tạo habit/task/battle thật.

## 7. Tham khảo và hướng hình ảnh

- [Habitica — hiển thị quest đang làm/đã hoàn thành](https://tools.habitica.com/habitica_user_data_display.html?sectionOpen=questsCompletedSection): tham khảo sự gắn kết giữa việc làm hằng ngày, tiến độ boss và bản ghi quest.
- [Wuthering Waves — thông tin tháp và ghi nhận tiến độ từ Kuro Games](https://wutheringwaves.kurogames.com/en/main/news/detail/3194): tham khảo đường tầng và cách giữ tiến trình rõ ràng.
- [Kuro Games — bản sắc kỹ năng và cách chiến đấu](https://blog.playstation.com/2025/03/21/wuthering-waves-version-2-2-launches-march-26-tangled-truth-in-inverted-tower/): tham khảo việc mỗi bộ kỹ năng có cách dùng riêng.

Bản thử dùng bố cục riêng: nền giấy/than, một màu nhấn đồng, chữ hệ thống có dấu tiếng Việt nhất quán; dấu ấn sách/tầng/chiến tích là hình thay chỗ. Chưa chọn lại phong cách ảnh cuối và chưa sao chép nhân vật, art hoặc UI của các nguồn tham khảo.

## 8. Yêu cầu kỹ thuật khi áp dụng vào app thật

Mục tiêu `/goal` hiện tại đã duyệt trước các file và công việc cần thiết trong phạm vi redesign; không cần xin duyệt từng file. Lựa chọn phát sinh được tự quyết có căn cứ và ghi checkpoint.

Các yêu cầu kỹ thuật của vòng triển khai:

- Giữ tầng UI/view/model/features và application/domain/ports/adapters hiện có; không mang mô phỏng JS trong HTML vào làm engine.
- Giữ ngày sinh hoạt, phiên bản chống ghi đè, kết toán một lần, bản luyện/tinh thuần bất biến và entitlement đã có.
- Đo đường tải thực tế của từng màn hình. Tổng quan dùng snapshot gọn; catalog có cache/version; truyện, bản luyện, nhật ký và bộ chiêu tải khi mở. Thao tác chuyển mục phải phản hồi ngay, có trạng thái tải/lỗi/thử lại rõ ràng.
- Tránh preload ảnh chương/boss cho những trang không dùng ảnh; ảnh cuối có kích thước phù hợp và tải khi cần.
- Khi bỏ Thần binh: kiểm tác động HP/công/thủ và phần thưởng; giữ snapshot cho trận cũ, dùng content version mới cho trận mới. Không xóa vật phẩm/trận lịch sử để khớp bố cục mới.
- Ánh xạ tầng dùng ID boss hiện có. Đổi tên route không tạo bản ghi chiến thắng mới.
- Discovery được suy ra từ tiến trình hiện có hoặc bổ sung trạng thái có version; người chơi cũ giữ quyền học.
- Giữ preset/export/history của app, đưa vào nơi phù hợp dưới chi tiết/cấu hình.
- Kiểm trên màn hình nhỏ, chữ lớn, bàn phím, mạng chậm/mất mạng, dữ liệu rỗng và nhiều bản luyện. Màn kết quả/cứu mạng cần báo hệ quả thật trước hành động.
- Làm mẫu art, kiểm trong UI thật, sửa rồi hoàn thiện cả bộ. Chỉ deploy staging sau các kiểm tra cần thiết; giao một bản tích hợp đầy đủ để người dùng nghiệm thu.

## 9. Kiểm tra bản thử và phát hành icon — lịch sử trước redesign

Đã kiểm trực tiếp bằng Chrome headless, hồ sơ tạm và dữ liệu mẫu:

- Chọn môn khi chưa có bản luyện; hiệu lực ngày kế tiếp.
- Chọn bản cũ/luyện lại, giữ các bản và tinh thuần cũ. Hủy thay chế độ không tạo bản mới.
- Chưa phát hiện → cơ duyên đã tìm thấy → chuẩn bị trận → chọn chiêu mỗi ngày → thắng → mở quyền luyện → chiến tích. Công pháp vừa mở chưa có bản luyện tự sinh.
- Đổi bản trong bộ chiêu đã chuẩn bị; mở lại giữ đúng lựa chọn. Tối đa năm môn khác nhau, chặn môn thứ sáu.
- Hộ Mệnh/Nghịch Mệnh, giới hạn cứu chung, thiếu điều kiện và ngăn trừ hai lần. Hiện thay đổi cảnh giới và mốc khóa đột phá trong xác nhận mẫu.
- Ba ngày chưa chọn chiêu → rút an toàn; tử trận ghi lịch sử và chỉ trừ Tu Vi một lần.
- Bốn trang ở 320/360/390/414/1440 px không tràn ngang; chữ 200% ở 320/390 px không tràn ngang. Bảng ngắn 320×460 vẫn giữ tiêu đề, nút đóng và hành động cuối. Có kiểm bàn phím và giao diện tối.
- HTML không phát sinh request tải tài nguyên ngoài. Inline script parse được; `check:web` đạt 45 module.
- Icon trong app thật ở 390/1440 px: SVG 22×22, giữ trạng thái/màu tab đang chọn, không có lỗi browser.
- Kiểm staging: ba kiểm tra cấu hình và dry-run bundle đạt. Sandbox chặn đường ghi log Wrangler mặc định; thao tác phát hành dùng đường log trong workspace.

Ảnh kiểm tra cục bộ ở `.wrangler/cultivation-qa/` (ngoài Git). Đây là Chrome emulation; chưa thay cho nghiệm thu cảm giác sử dụng trên điện thoại thật của người dùng. Không dùng dữ liệu cá nhân để thử các thao tác.

**Phát hành icon:** commit `b419934` đã push lên `review/p1-p3`; Worker staging version `d4990393-e797-4e8c-ba9d-fcd822af51aa`, readiness 4/4, deploy exit0. `/app/` và `/app/styles.css` HTTP200, SHA256 khớp local. Bản HTML nằm trong `docs/`, không được đóng gói vào app. Tab Tu luyện thật vẫn dùng UI trước vòng này.
