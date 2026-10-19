# Định hướng mỹ thuật linh thú

## Quyết định mới nhất — ưu tiên áp dụng

Người dùng đã duyệt Stormlion T4 v2 và bảng 95%/100%; tiếp tục hoàn thiện toàn dự án, ưu tiên T1–T4 chắc, 95%/100% dùng tạm rồi sửa riêng sau. Quy tắc và lịch sử được lưu tại [LINH_THU_ART_APPROVALS.md](LINH_THU_ART_APPROVALS.md). Bộ SSR v1 bị loại vì mất nét tinh gọn của nguồn. Giữ tỷ lệ, viền đậm, mảng màu lớn và ít cấp bóng; chỉnh có chọn lọc. Các ý tưởng tăng vật liệu/ánh sáng, vầng trăng kép hoặc vòng lôi quang bên dưới chỉ còn là thăm dò cũ, không được dùng thay quyết định mới.

## Cơ sở nghiên cứu và trạng thái

Checkpoint cuối 19/10/2026: **đã tích hợp 72 hình thường T1–T4, 18 Thức tỉnh 95%, 18 Hoàn mỹ 100%**. [Gallery hiện hành](../output/imagegen/catalog-v3/index.html) có đầy đủ 18 loài và ba trạng thái T4. Nguồn PNG 1024px, prompt/model/hash ở `docs/assets/linh-thu/art/MANIFEST.json`; runtime dùng WebP 512/128px và registry sinh tự động, cổng `--require-complete` đạt. 72 tham chiếu giữ nguyên hash, không đếm thành hình mới. 95%/100% dùng tạm theo yêu cầu, chưa tự coi là đã nghiệm thu thị giác từng ảnh. Xem [hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md) và [quy trình thay từng ảnh](assets/linh-thu/art/README.md).

Đã xem và đối chiếu **72 ảnh của 18 loài**, bốn dạng mỗi loài, qua các bảng [UR](assets/linh-thu/reference/ur-evolutions.png), [SSR](assets/linh-thu/reference/ssr-evolutions.png), [SR](assets/linh-thu/reference/sr-evolutions.png) và [R](assets/linh-thu/reference/r-evolutions.png). Các ảnh khớp với nhận diện trong ảnh chụp người dùng cung cấp.

Tài liệu này giữ hướng nghiên cứu và lịch sử thăm dò. Bộ hiện hành dùng CLI chính thức của skill imagegen qua gateway Cockpit, model `gpt-image-2.5`; không huấn luyện hay tinh chỉnh trọng số mô hình. Tên và hình nguồn ở [hồ sơ tham chiếu](LINH_THU_REFERENCES.md). Bộ thiên phú, Thức tỉnh 95% và tuyệt kỹ 100% nằm trong [bộ kỹ năng](LINH_THU_SKILLS.md), được giữ làm cơ sở rồi cân chỉnh riêng sau. [Đặc tả](LINH_THU_SPEC.md) và code runtime là cơ sở kiểm gameplay; đổi ảnh không đổi kỹ năng.

## Đặc điểm nhìn thấy trong bộ nguồn

- Nét hoạt hình hai chiều, đường viền đậm có màu tối theo từng loài; mảng màu lớn và bóng đổ ít cấp.
- T1 thường có đầu và mắt lớn so với thân, tay chân ngắn, một đặc điểm nhận diện chính: tinh thể, đuôi, sừng hoặc mũ.
- Tiến hóa thay đổi tỉ lệ thân, tư thế, cấu trúc giáp, chi và phụ kiện. T4 không chỉ là T1 phóng lớn.
- Đỏ cam thường đi cùng lửa; trắng và lam với băng; tím–xanh ngọc với phép thuật; nâu–vàng với đá và giáp.
- Vòng tròn, đường xoắn, trăng khuyết và đuôi cong được dùng để tạo đường viền dễ nhớ.
- Các ảnh đang lưu đều là WebP tĩnh 512 × 512 có alpha. Một số nét nguồn đã mềm hoặc răng cưa; phóng to đơn thuần không bổ sung chi tiết thực.

## Mục tiêu vẽ lại

Giữ nhân vật nhận diện được từ mẫu, nâng chất lượng qua **độ rõ hình thể, nét viền, biểu cảm và mảng màu có chọn lọc**. Độ ngầu đến từ tư thế, nét mặt và điểm nhấn lớn theo nguồn; giữ tỷ lệ và mức độ tinh gọn của bản gốc.

### Tiến hóa

| Dạng | Mục tiêu thiết kế |
| --- | --- |
| T1 | Thú con dễ mến, rõ loài, một đặc điểm nổi bật. |
| T2 | Có năng lực và tính cách; chi hoặc phụ kiện bắt đầu phát triển. |
| T3 | Chiến binh trưởng thành, tư thế chủ động, năng lực thể hiện qua hình thể. |
| T4 | Dáng hoàn chỉnh có uy thế; thay đổi đáng kể đường viền, giáp hoặc biểu tượng so với T3. |

### Phân hạng và hoàn mỹ

- **R:** một chủ đề chính, ít cụm hiệu ứng, bốn dạng vẫn đủ khác biệt.
- **SR:** cấu trúc và vật liệu rõ hơn, một điểm năng lượng đặc trưng.
- **SSR:** có biểu tượng lớn và bố cục nhân vật hoàn chỉnh; ánh sáng, trang phục và vũ khí được kiểm soát.
- **UR:** hình thể có uy lực của một thủ lĩnh, các bộ phận lớn có chức năng rõ, điểm nhấn nhìn thấy ngay ở kích thước nhỏ.
- **Hoàn mỹ 100%:** biến thể riêng của T4, giữ cùng loài và cùng hình thể gốc nhưng bổ sung dấu ấn bản mệnh, vật liệu hoặc hoạt ảnh riêng. Mỗi loài có cách thể hiện khác nhau; chưa mặc định dùng skin `color_1` của game nguồn.
- Mốc **95%** có thể có dấu hiệu thức tỉnh nhỏ; thiết kế cụ thể chờ duyệt. Không để hiệu ứng che khuôn mặt hoặc lấn mất bản sắc loài.

## Hướng cải thiện theo từng loài

Tất cả hướng dưới đây là đề xuất mỹ thuật, chưa phải hình đã duyệt hoặc hiệu ứng gameplay đã chốt.

| Rank / loài | Yếu tố giữ lại | Hướng nâng cấp T4 | Ý tưởng dấu ấn hoàn mỹ |
| --- | --- | --- | --- |
| UR / Pyropup | Khuyển lửa, một → hai → ba đầu; thân tối, mặt kem. | Ba đầu có vị trí và biểu cảm riêng, chân chắc, giáp tối và bờm lửa tạo khối rõ. | Biểu tượng nhật thực với ba nhánh lửa, lõi sáng riêng cho từng đầu. |
| UR / Rubblet | Thú đá dáng khủng long, tinh thể xanh tím trên lưng. | Vai và bàn chân lớn, giáp có tầng chịu lực, tinh thể lớn tạo vương miện phía sau đầu. | Mảnh đá nhỏ lơ lửng trong quỹ đạo quanh lõi tinh thể. |
| SSR / Frostnip | Mặt sáng, đốm xanh, đuôi băng và trăng khuyết. | Tăng độ trong của băng, giữ đường cong trăng khuyết sạch và mặt sáng rõ. | Vầng trăng kép mảnh cùng tinh thể tuyết xoay chậm. |
| SSR / Zappur | Bờm tia sét, vàng cam, bốn chân. | Khối bờm chính sắc và chắc; tia sét phụ bám cấu trúc bờm và chân. | Vòng lôi quang phía sau bờm, điện chạy thành nhịp trên giáp lông. |
| SSR / Skinklet | Đuôi xoắn, mắt sắc, tím–xanh ngọc, tư thế nhẫn giả. | Bàn tay và tư thế rõ hơn, vạt áo có hướng chuyển động, năng lượng tập trung quanh tay. | Dư ảnh chuyển sắc và một ấn nhẫn thuật riêng. |
| SSR / Punchimp | Khỉ võ đạo, trường côn, giáp vàng, bờm sáng. | Giữ **Rockong làm T4**, côn và dáng người tạo trục lực rõ, dải trang trí đầu có nhịp mềm. | Linh văn vàng chạy trên côn và một ấn chiến thần sau lưng. |
| SR / Shardsnail | Vỏ xoắn nâu–kem, thân vàng cam, tinh thể tím. | Vỏ nhiều tầng nhưng giữ đọc được một đường xoắn chính; tinh thể có mặt cắt và ánh xuyên. | Lõi thạch anh sáng trong lòng xoắn, vài mảnh tinh thể xoay chậm. |
| SR / Flameow | Mặt kem, thân tối, lõi lửa và tư thế mèo linh hoạt. | Dùng **Cinderclaw T4** làm tham chiếu; rõ bàn tay, vuốt và chân, các dải lửa có nhịp thay vì chồng lấp. | Ấn hỏa miêu trên ngực cùng dấu chân lửa thoáng hiện khi chuyển động. |
| SR / Manteeny | Hồng hoa, xanh lá, hai liềm và dáng bọ ngựa. | Liềm tách khỏi váy hoa, góc liềm dẫn mắt về mặt, cánh hoa phân lớp có độ dày. | Vòng cánh lan mỏng với hai vệt sáng theo đường chém của liềm. |
| SR / Fluffle | Sừng xoắn cam, thân mây trắng xanh, lơ lửng. | Mây thành các cụm rõ, sừng và khuôn mặt không chìm vào lông; tia sét đi xuống thành nhịp. | Quầng mây thiên thể và vài điểm sao trong mây. |
| SR / Maskfry | Mặt nạ sáng, giáp vây xanh đậm, điểm xanh ngọc. | Giáp có lớp rõ trên vai và ngực, tay không lẫn với vây, đường sống lưng đọc được. | Ấn vực sâu và ánh sáng lan qua khe giáp như thủy triều. |
| SR / Goonbug | Sừng bọ, xanh lá, giáp và cánh trắng. | Tách mũ–ngực–vai, cánh tạo dáng áo choàng có cấu trúc; bàn tay và chân rõ. | Huy hiệu giáp bọ trên ngực cùng một vòng sáng ngắn khi ra tư thế. |
| R / Humbug | Dấu xoắn, bọ hung, giáp nghi lễ cam vàng. | Tăng độ rõ của biểu tượng tam giác và hai đĩa bên; giữ khối cơ thể gọn. | Con mắt trên biểu tượng mở sáng, một quầng nghi lễ đơn giản. |
| R / Hootlet | Mắt cú, con lắc, quạt lông xanh–vàng. | Quạt lông chia thành vài mảng lớn, mắt và con lắc là hai điểm nhìn chính. | Mặt đồng hồ mờ xuất hiện theo nhịp đung đưa con lắc. |
| R / Gibber | Mai đá, nâu–vàng, trọng tâm thấp. | Mai đá xếp theo cấu trúc rõ, chân chịu lực và mặt hiền nhưng vững. | Một dấu cổ thạch phát sáng trong khe mai. |
| R / Voltfawn | Sừng nam châm đầu đỏ–xanh, thân hươu. | Làm sừng và hướng lực từ trường thành bản sắc, tránh hiệu ứng bờm sét giống sư tử. | Hai cung từ trường mảnh nối hai cực sừng. |
| R / Cheerling | Tai dài, sao vàng, trắng–tím, dáng biểu diễn. | Tai và sao tạo một đường chuyển động chính, tay chân và trang phục tách mảng rõ. | Chòm sao nhỏ vẽ theo vệt tai trong một động tác đặc trưng. |
| R / Funglet | Mũ nấm bất đối xứng, mắt buồn ngủ, tím–xanh–cam. | Mũ có độ dày và mặt dưới rõ, tua có điểm bám, giữ mặt không bị che. | Bào tử sáng tụ thành một vòng mộng nhỏ phía dưới mũ. |

## Yêu cầu nguồn ảnh và các lần chỉnh tiếp

- Ảnh nhân vật riêng từng dạng, nền alpha thật, toàn thân, cùng góc nhìn ba phần tư và hướng mặt trong một chuỗi.
- Bộ dựng hiện nhận nguồn vuông tối thiểu **1024 × 1024**, xuất full 512px và thumbnail 128px. Kích thước trong UI co theo viewport, giữ tỉ lệ ảnh.
- Chừa khoảng thở cho tai, sừng, vũ khí và hiệu ứng; không cắt đuôi hoặc bàn chân.
- Giữ mặt, đặc điểm loài và mốc tiến hóa đọc được ở **128 px**; kiểm tra thêm ở 64 px.
- Dùng điểm neo chân hoặc tâm lơ lửng nhất quán để đổi dạng không bị nhảy vị trí.
- Tách nhân vật khỏi hiệu ứng ánh sáng khi cần hoạt ảnh; không biến quầng sáng thành khối nền đục.
- Xuất bản thường và hoàn mỹ riêng. Lưu bản nguồn tham chiếu nguyên trạng, mỗi bản mới có tên phiên bản để đối chiếu.
- Giai đoạn nghiên cứu trước đây không sửa code. Hiện đã tích hợp đủ 108 ảnh trong phạm vi goal được phép; các biến thể dùng tạm không tự được coi là người dùng đã duyệt mỹ thuật cuối.
