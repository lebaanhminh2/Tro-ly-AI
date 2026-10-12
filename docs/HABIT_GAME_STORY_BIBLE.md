# Thần Lộ — hồ sơ truyện và nhân vật

Cập nhật 2026-10-12. Thiết kế A08/A09 để triển khai F5; các chương sau mở đầu chưa được gọi là sản phẩm đã hoàn tất. Luật/cơ chế tại REVIEW/GAMEPLAY, phạm vi tại PRODUCT, tiến độ thật tại PROGRESS. AI có thể biên tập lời thoại và bố cục theo trải nghiệm, giữ động cơ, danh tính, quan hệ và đường mở nội dung nhất quán.

## 1. Trục truyện

Tuyển Tiên Lệnh hứa đưa người có căn cơ lên thiên giới. Thực chất, tên trong sổ là mắt xích nuôi Cửu Trụ: thần lực đến từ việc tước quyền lựa chọn của người dưới núi. Người chơi ban đầu chỉ muốn cứu A Lạc, rồi biết việc xóa một tên riêng không phá được cả sổ. Kết thúc là phá hệ thống giữ tên, cứu những người có thể cứu và chấp nhận những lựa chọn khác mình.

Habit ngoài đời là nguồn tiến bộ của hệ game. Nhân vật không suy diễn đạo đức, sức khỏe hay giá trị của người dùng từ số lần hoàn thành. Truyện được viết sẵn và mở bằng kết quả server; không cần LLM để phát thưởng hoặc vượt chương. Không thêm lựa chọn thoại giả có các nút cùng kết quả.

## 2. Cast và nhận diện

| ID / nhân vật | Động cơ và diễn biến | Nhận diện / giọng nói |
| --- | --- | --- |
| `tich-van` / Tịch Vân | Người giữ thư các từng sao lệnh; cứu người để sửa phần mình đã tham gia. Đọc được nét mực nhưng không biết mọi sự thật. Chương09 tự công bố tên mình trong sổ | Áo xám/cổ ngà, tóc búi/trâm đồng; nói ngắn, đưa một việc cụ thể. Portrait đã tích hợp |
| `a-lac` / A Lạc | Người thân bị bắt; tự tổ chức người bị giam giấu tên và phá một trụ từ bên trong. Gặp lại ở chương11, tham gia đoạn cuối thay vì chỉ được đưa về | Nữ trẻ, tóc đen ngang vai búi một phần sau, áo vải ngà/đai than; viết thư gọn, quan sát tinh. Portrait thật thay ý tưởng khăn chàm chưa có trong ảnh |
| `ky-hanh` / Kỷ Hành | Thiên kiêu bảo vệ đoàn người bằng cách nhận chức giữ lệnh. Ba lần gặp: kiểm tra năng lực cứu người → chống lệnh cùng điều kiện riêng → buộc người chơi phá Thiên Môn để đoàn tù thoát | Nam khoảng25, tóc đen buộc sau, áo ngà/than và giáp vai đồng, kiếm thẳng. Sẹo ở ý tưởng ban đầu không có trong portrait, không dùng làm dấu nhận diện bắt buộc. Câu nói chính xác, ít gọi người chơi bằng danh xưng |
| `moc-an` / Mộc An | Y sĩ tìm người mất tích của trạm thuốc. Giúp giải sổ thương tích và giữ lối rút; không chữa miễn phí hậu quả kinh tế hoặc tự hoàn thành habit | Nữ khoảng30, tóc búi/lọn thả bên mặt, áo xám ngà giản dị, góc nghiêng. Không gán túi thuốc hoặc màu xanh khi portrait thật không có; hỏi về người còn kẹt lại |
| `ta-truong-sinh` / Tạ Trường Sinh | Đã sống qua nhiều lần hiến cảnh giới để giữ cửa ngục. Hồi sinh giới hạn có báo, sau thua trao Nghịch Mệnh kèm lời cảnh báo về giá | Nam lớn tuổi, tóc bạc, mặt nhiều nếp nhăn/nụ cười nhẹ, áo ngà cổ trong đen. Thẻ gỗ gãy là đạo cụ trong truyện, không được gán vào portrait; giọng hơi hài khô, không ca tụng hy sinh |
| `la-sat` / La Sát Nữ Đế | Giữ Huyết Hải để che dấu người trốn lệnh; chấp nhận cái giá sinh lực nhưng không muốn người khác trả thay. Sau thua đồng ý mở đường theo luật rõ | Nữ trưởng thành, tóc đen búi, áo xám ngà/cổ đỏ nâu kín; giọng điềm tĩnh, không tình dục hóa. Portrait v2 đã tạo; không gán tóc điểm bạc/huyết ấn đồng khi ảnh không có |
| `than-chu` / Thần Chủ | Đồng nhất trật tự với quyền sở hữu mọi tên người. Ba pha chiến đấu phá sổ, phá thân và đối diện ý chí còn lại; không chỉ tăng HP rồi gọi thành pha | Thực thể trưởng thành tóc trắng, mặt mộc không vay IP, áo ngà/than, vòng ấn đồng; không sử dụng chữ cần đọc trong raster |

Boss còn lại có mục tiêu/vật liệu riêng: canh thú, cổ thư/ấn lệnh, khôi lỗi, thủ mộ, chấp kiếm và thần tướng. Tái ngộ giữ identity; variants chỉ thay dấu thương/trang phục/ánh sáng có lý do. Người Giữ Kiếm Trầm là người già với tóc bạc/áo xám đã tạo, không đổi thành Kỷ Hành.

### Identity tuyến phụ đã tạo

13chân dung tuyến cấm thuật/Ngoại Đạo đã tạo, nguồn được xem và alt theo hình thật tại `docs/art/branches.json`. Người Giữ Nhật Tàn là người phụ nữ tóc bạc, Người Giữ Luân Khuyết tóc đen búi cao và Người Giữ Kiếm Âm tóc đen búi thấp. Không tiếp tục dùng tuổi/màu tóc/đại từ của prompt chưa đạt để mô tả hình cuối. Sáu người giữ Ngoại Đạo khác nhau về tuổi, áo/giáp, khăn và silhouette, không đổi một mặt cho cả sáu. Thần Sổ là cổ thư bìa da sẫm với ấn tròn, không còn là tháp/người/bia; ký hiệu trên bìa chỉ trang trí, không là chữ user cần đọc.

Thần binh là vật phẩm có hình riêng: Thạch Tâm là hộ phù đá/vòng đồng; Định Tâm là mặt hộ phù ngà/than trên dây hạt; Thuận Phong là kiếm bạc chuôi ngà cạnh phiến đá. Art này không đổi effect/tradeoff. Art năm phái dùng bí tịch/ấn/ngọc/thiên bàn theo hình cuối, không yêu cầu cả năm thành cùng một quyển sách. 39biểu tượng nét tại `docs/art/technique-symbols.json` diễn tả identity chiến thuật, có glyph riêng và viền phân biệt trấn phái/cấm thuật/Ngoại Đạo.

## 3. Nhịp15chương

| Chương | Mở và thay đổi | Kết quả cần dẫn sang chương tiếp |
| --- | --- | --- |
| 01 Hắc Lệnh Qua Thôn | Tịch Vân dẫn qua cầu, canh thú và cổ thư giữ dấu đoàn tù; Thiết Lệnh Sứ cố tình chậm một chuyến xe | Có tên A Lạc và đường tới đại hội. Bốn môn thường mỗi phái mở dần; truyền thừa Thiên Kiếm là nhánh tùy chọn |
| 02 Thiên Kiêu Không Tên | Kỷ Hành tỷ thí để biết người chơi có đưa được người yếu khỏi ngục hay chỉ biết đánh | Trao thẻ dự hội nhưng giữ đoàn tù dưới quyền mình; Mộc An tìm dấu sổ thương tích ở Huyết Hà |
| 03 Huyết Hà Tà Vực | Huyết Hà Đạo Nhân chữa người bằng cách lấy tên của người khác; hồi phục theo nhịp dễ nhận biết | Mộc An giữ bản sổ thay thế, người chơi thấy cái giá của cách cứu bằng một mạng khác |
| 04 Cửu Mệnh Lão Quái | Tạ Trường Sinh chặn cửa vì người phía trong chưa có lối rút; mỗi hồi sinh được báo và hữu hạn | Ông trao quyền học Nghịch Mệnh, không cho một bản luyện sẵn; chỉ đường vào hội |
| 05 Bách Tông Đại Hội | Khôi lỗi chiến thắng mọi phái bằng cách lặp chiêu của người khác; năm truyền thừa trở thành những đường học thật | Tịch Vân nhận ra ấn của thư các mình; hội là khâu chọn người cho thiên ngục |
| 06 Sát Lục Thiên Bảng | Vô Ảnh Sát Chủ săn người giữ sổ, có nhịp áp lực và sơ hở rõ | Mộc An giữ sổ ở trạm cũ, người chơi đến thần mộ tìm cách phá nét mực |
| 07 Thần Mộ Không Người Chết | Thủ Mộ Nhân giữ di sản không thuộc năm phái; giáp và cửa sổ phản công thử cách đọc intent | Mở Ngoại Đạo/Kiếm Đồ và thần binh đầu. Chúng bổ trợ chiến thuật, không bắt sưu tập đủ để đi tiếp |
| 08 Huyết Hải Nữ Đế | La Sát bảo vệ người trốn lệnh; thử cách dồn lực, giữ sinh lực và chịu giá | Đồng ý cùng cứu người, nhánh cấm thuật có ngưỡng riêng; không bắt người chơi hiến rank để tiến truyện |
| 09 Ngũ Tông Phá Sơn | Thiên Luật Chấp Kiếm Sứ đòi Tịch Vân giao bản sổ; Tịch Vân tự nhận việc mình đã làm | Năm phái mở cửa cũ, nguồn thần lực của Cửu Trụ được chỉ ra |
| 10 Thiên Kiêu Phản Đạo | Kỷ Hành vẫn giữ chức nhưng bí mật chuyển người; thế kiếm mạnh/nghỉ khác trận đầu | Thư do A Lạc viết xác nhận người bị giam đã tự phá một phần trụ |
| 11 Cửu Trụ Thiên Ngục | Ba thần tướng giữ ba cụm trụ với nhịp thủ/hồi/chuỗi hit khác nhau; A Lạc giúp mở cửa từ trong | Đoàn người thoát, nhưng sổ tên vẫn giữ họ; cứu người và phá hệ thống thành cùng nhiệm vụ |
| 12 Vạn Đạo Thần Thể | Thần khôi hợp các dấu ấn cướp từ năm phái; intent rõ, không đổi sau khi nhìn chiêu hôm nay | Thân giả bị phá, đường Thiên Môn còn bị khóa bằng quyền của Kỷ Hành |
| 13 Thiên Môn Phản Chiến | Kỷ Hành yêu cầu đánh phá cả quyền giữ cửa của mình; đây là trận cuối của ba lần tái ngộ | Thẻ của Kỷ Hành mất quyền, nhân vật tiếp tục bảo vệ người bằng lựa chọn của mình |
| 14 Cổ Thần Chiến Trường | Thần Chiến Vương giữ chiến trường cũ; đồng minh giữ lối thoát, người chơi giải nhịp đa hit/giáp/hồi sinh | Tạ Trường Sinh buông cửa ngục đã trống; trận cuối có đường rút đã chuẩn bị |
| 15 Thiên Mệnh Thần Chủ | Ba encounter nối nhau: Thiên Mệnh Thần Sổ → Thần Thể → Thần Chủ. Mỗi trận có quyền cứu/HP và giới hạn công bố riêng | Chiến thắng cuối commit DIỆT THẦN một lần; A Lạc và đồng minh chọn đường sau đó. Đọc lại/đánh lại không nhân thưởng |

## 4. Nội dung mở và trạng thái chưa hoàn thành

Các chương có đoạn mở, log giao chiến, thắng/thua và mục tiêu tiếp. UI đọc ngắn theo nhu cầu, nhật ký giữ bản text và quyền đọc lại theo chiến tích. Chưa chiến thắng thì không hiện đoạn kết tương lai. Số câu và số cảnh có thể sửa để hợp màn mobile; không cần 15 tiểu thuyết hoặc một lời nhắc mới mỗi ngày.

Tuyến phụ: bốn truyền thừa còn lại, tám thử thách cấm thuật, sáu điểm di sản Ngoại Đạo và Dị Giáo. Mỗi tuyến có lý do gặp/thử thách/thưởng riêng, không dùng một boss đổi tên làm mọi tuyến. Điểm học truyền thừa yêu cầu bốn môn thường đạt Nhập môn; tuyến chính không yêu cầu trấn phái hoặc cấm thuật chưa mở.

## 5. Art inventory và QA

Nguồn tái tạo ở `docs/art/*.json`, provenance/final/QA ở `docs/art/assets.json`. `campaign.json` gồm Kỷ Hành/Mộc An/cảnh02; `campaign-03-05.json` gồm Huyết Hà/Tạ Trường Sinh/A Lạc, khôi lỗi cơ khí và cảnh03–05. Bản khôi lỗi đầu ra thành người đeo giáp được chuyển có chủ đích sang Vô Ảnh; bản2 có khớp cơ khí riêng. Các final này đã xem source và crop trong UI, evidence ở inventory; không suy toàn art đã hoàn tất từ manifest batch. Mỗi danh tính boss và mỗi chương còn cần final riêng hoặc biến thể tái ngộ có chủ đích.

Biểu tượng39môn/nămphái/chiến tích có thể vẽ vector đồng nhất; nhân vật/boss/cảnh dùng raster. Text UI không nằm trong ảnh. Hình và câu chuyện không phụ thuộc API trả phí; model/cache/drafts ở thư mục art ngoàiGit.
