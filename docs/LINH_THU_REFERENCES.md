# Tham chiếu thiết kế linh thú

## Trạng thái và phạm vi

- Giai đoạn nghiên cứu ban đầu chỉ duyệt ý tưởng. Goal19/10/2026 đã cho phép triển khai; bản hiện tại đã được người dùng duyệt, kiểm thử và phát hành staging. Ảnh95%/100% dùng tạm; không suy thành duyệt thị giác cuối từng ảnh. Xem [tiến độ](LINH_THU_IMPLEMENTATION.md) và [phát hành](LINH_THU_RELEASE.md).
- Người dùng sẽ cung cấp dần ảnh mẫu của các linh thú theo rank.
- Tổng bộ sưu tập dự kiến: **2 UR, 4 SSR, 6 SR, 6 R**.
- Đã đủ **18 loài: 2 UR, 4 SSR, 6 SR, 6 R**. Mười bốn loài do người dùng chọn; bốn loài R còn lại được trợ lý chọn theo yêu cầu người dùng.
- Người dùng đã xác nhận “RR” là **rank R**, không phải rank mới. **Humbug và Hootlet chiếm hai trong sáu suất R**.
- Mỗi chuỗi có **bốn dạng T1–T4**. Chuỗi khỉ đã được đối chiếu theo yêu cầu đảo hai dạng cuối trong ảnh chụp: dùng **Rockwu T3 → Rockong T4**. Asset đã tải có đúng thứ tự này; không đảo thêm.
- Ảnh chụp chuỗi mèo lửa có ba dạng; người dùng giao bổ sung dạng thứ tư. Đã tìm thấy asset tham chiếu **Cinderclaw T4** trong nguồn cộng đồng, dùng làm cơ sở nghiên cứu thiết kế; hướng vẽ lại Blazereign trước đó vẫn chỉ là đề xuất.
- Yêu cầu mỹ thuật: phát triển từ mẫu để thiết kế đẹp, ngầu và nổi bật hơn, nhất là dạng cuối và biến thể hoàn mỹ.
- Nguồn trực tiếp: mười bốn ảnh người dùng đính kèm trong cuộc trò chuyện ngày 2026-10-19, gồm hai ảnh UR, bốn ảnh SSR và tám ảnh được phân lại thành sáu SR, hai R. Người dùng nêu hướng tham khảo Clash of Critters / Chiến Thú Hỗn Chiến.
- Đã đối chiếu tên và hình với kho cộng đồng [MilkRoad · Clash of Critters companion](https://github.com/kenzkunz/tatari-companion), tại commit `771b7c760d7cf47e19c355aa865ed6a1d2beaebf`, dữ liệu phiên bản `0.49.1`.
- Đã tải **72 ảnh WebP tham chiếu**, đủ bốn dạng của 18 loài, vào [docs/assets/linh-thu/reference](assets/linh-thu/reference/README.md). Mỗi ảnh có kích thước **512 × 512, nền trong suốt, một khung hình**. Đây là bản ảnh từ kho cộng đồng, chưa phải ảnh thiết kế lại.
- Bốn bảng ảnh để duyệt: [UR](assets/linh-thu/reference/ur-evolutions.png), [SSR](assets/linh-thu/reference/ssr-evolutions.png), [SR](assets/linh-thu/reference/sr-evolutions.png), [R](assets/linh-thu/reference/r-evolutions.png).
- Các ảnh chụp người dùng cung cấp dùng để xác định loài và hướng tham khảo. Tệp đã tải có nguồn và SHA-256 trong [SOURCES.csv](assets/linh-thu/reference/SOURCES.csv); không lấy ảnh chụp làm sprite thành phẩm.
- Phân tích và định hướng mỹ thuật nằm trong [LINH_THU_ART_DIRECTION.md](LINH_THU_ART_DIRECTION.md); quyết định toàn hệ thống ở [LINH_THU_SPEC.md](LINH_THU_SPEC.md). Runtime đã thay bằng **108 ảnh v3**: 72 thường  +18 thức tỉnh  +18 hoàn mỹ, có nguồn/prompt/hash riêng. [Xem gallery](../output/imagegen/catalog-v3/index.html). 72 tham chiếu dưới đây giữ nguyên để đối chiếu; 95%/100% của bộ mới dùng tạm theo yêu cầu, chưa tự ghi đã được duyệt từng ảnh.

## UR-01 — Chuỗi khuyển lửa

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Pyropup** | Khuyển con một đầu; thân xám đen, mõm và ngực màu kem, mắt lớn; điểm nhấn đỏ cam ở tai và đuôi. |
| T2 | **Pyrohound** | Hai đầu; dáng chắc hơn, biểu cảm dữ hơn; lửa đỏ cam phát triển quanh thân và cổ. |
| T3 | **Hellhound** | Ba đầu; nanh rõ, tư thế chiến đấu; bờm lửa lớn tạo đường viền nổi bật. |
| T4 | **Pyrodaemon** | Khuyển ba đầu hoàn chỉnh; hình thể nặng và uy lực hơn, lửa bao quanh; chi tiết giáp, vòng cổ và bàn chân nổi bật. |

### Những yếu tố cần giữ từ mẫu

- Nhận diện chính: khuyển lửa, tiến hóa từ một đầu thành nhiều đầu.
- Bảng màu chính: xám đen, kem trắng, đỏ và cam vàng.
- Nét hoạt hình với viền đậm, khối rõ; mỗi dạng cần nhận ra được khi hiển thị nhỏ.
- T3 và T4 cùng có ba đầu; khác biệt dạng cuối cần đến từ hình thể, giáp, tư thế và lửa, thay vì chỉ thêm đầu.

### Hướng nâng cấp đề xuất — chưa duyệt

- Tăng khác biệt hình dáng giữa các dạng: từ thú con đến quái khuyển có uy thế của một thủ lĩnh.
- Dạng cuối có ba đầu với biểu cảm và vị trí riêng, tránh chồng chi tiết gây khó đọc.
- Phối các mảng giáp tối lớn với lửa có lõi sáng để tăng chiều sâu.
- Biến thể hoàn mỹ có thể khai thác hình tượng **nhật thực và tam diệm**, với linh văn và hoạt ảnh riêng; đây là hướng thăm dò, chưa phải thiết kế đã chốt.

## UR-02 — Chuỗi thú đá và tinh thể

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Rubblet** | Thú nhỏ dáng bò sát; thân nâu, bụng kem, mắt lớn; tinh thể xanh lam và tím trên lưng, đuôi và chân. |
| T2 | **Cobbledon** | Thân và vai lớn hơn, tư thế dựng cao hơn; hàm rõ hơn, tinh thể dọc sống lưng phát triển. |
| T3 | **Rockzilla** | Dáng quái thú đứng vững, thân cao và nặng; mảng đá, vảy và gai tinh thể rõ hơn; xuất hiện hiệu ứng năng lượng quanh lưng. |
| T4 | **Meteorax** | Vai và giáp đồ sộ; cụm tinh thể tím–lam lớn tạo dáng như vương miện; năng lượng sáng và các tia quanh thân. |

### Những yếu tố cần giữ từ mẫu

- Nhận diện chính: thú đá dáng khủng long, tinh thể phát triển cùng quá trình tiến hóa.
- Bảng màu chính: nâu đá, bụng kem, tinh thể xanh lam và tím, điểm sáng trắng.
- Tăng khối vai và số tinh thể có chọn lọc; ưu tiên nhận diện rõ khi nhìn nghiêng.
- T4 cần thể hiện sức nặng qua tư thế, bàn chân và mảng giáp, đồng thời giữ điểm nhấn tinh thể rõ ràng.

### Hướng nâng cấp đề xuất — chưa duyệt

- Làm mảng giáp lớn và có cấu trúc, tinh thể có vai trò rõ trên vai, đầu và sống lưng.
- Phân biệt từng dạng bằng tỉ lệ đầu–thân, độ cao tư thế và đường viền tinh thể.
- Dạng cuối khai thác hình tượng thiên thạch và địa chấn, với hiệu ứng năng lượng có kiểm soát.
- Biến thể hoàn mỹ có thể khai thác hình tượng **tinh vẫn đế giáp**, với các mảnh đá lơ lửng và quỹ đạo năng lượng riêng; đây là hướng thăm dò, chưa phải thiết kế đã chốt.

## SSR-01 — Chuỗi băng nguyệt

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Frostnip** | Thú con dáng mèo; đầu lớn, mắt xanh lam, lông trắng với các mảng xanh; đuôi dựng phía sau. |
| T2 | **Frostpaw** | Lông cổ và thân dày hơn; các đốm xanh rõ, đuôi lớn cuộn quanh chân; xuất hiện khối băng bên dưới. |
| T3 | **Frostique** | Tư thế cao hơn, điểm nhấn nhọn trên đầu; đuôi lớn uốn quanh thân, mảng băng và đốm trên lông rõ hơn. |
| T4 | **Frostluna** | Đuôi hoặc dải băng lớn tạo đường viền hình trăng khuyết bao quanh thân; đầu và mắt nhỏ hơn tương đối, dáng thanh thoát. |

### Những yếu tố cần giữ từ mẫu

- Bảng màu trắng, xanh băng, lam đậm và điểm tím.
- Nhận diện qua đốm lông, đuôi lớn và hình trăng khuyết của dạng cuối.
- T1 dễ thương; các dạng sau tăng vẻ thanh thoát và huyền bí.

### Hướng nâng cấp đề xuất — chưa duyệt

- Làm hình trăng khuyết ở T4 sắc nét, có chiều sâu như băng trong.
- Dùng tinh thể và ánh trăng làm điểm nhấn chọn lọc, giữ rõ mặt và đường viền thân.
- Dành dấu ấn riêng cho biến thể hoàn mỹ khi thiết kế chi tiết sau.

## SSR-02 — Chuỗi sư tử sét

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Zappur** | Thú con vàng cam; tai tròn lớn, dấu tia sét trên tai và đuôi; chân ngắn, mặt nghiêm. |
| T2 | **Electroar** | Bờm phát triển thành các mảng nhọn; dấu sét trắng trên trán và quanh mặt; dáng đứng bốn chân chắc hơn. |
| T3 | **Blitzmane** | Bờm lớn dạng tia sét, chân và thân dài hơn; tư thế đang bước, gương mặt mạnh mẽ hơn. |
| T4 | **Stormlion** | Bờm sét mở rộng thành nhiều nhánh; hiệu ứng trắng vàng ôm quanh thân, tư thế giàu chuyển động. |

### Những yếu tố cần giữ từ mẫu

- Bảng màu vàng cam, nâu đậm và tia sét trắng vàng.
- Bờm sét là điểm nhận diện chính của các dạng trưởng thành.
- Giữ chất sư tử và tư thế bốn chân, với cảm giác nhanh và mạnh.
- Chữ “Support” trên ảnh chỉ là nhãn của mẫu; vai trò kỹ năng trong dự án chưa được gán từ nhãn này.

### Hướng nâng cấp đề xuất — chưa duyệt

- Dạng cuối có khối bờm chính rõ, các nhánh điện phụ hỗ trợ hình dáng tổng thể.
- Tăng độ chắc của vai, bàn chân và biểu cảm để thể hiện sức mạnh ngay cả khi đứng yên.
- Hoạt ảnh tương lai có thể nhấn vào điện chạy dọc bờm và chân.

## SSR-03 — Chuỗi tắc kè nhẫn giả

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Skinklet** | Thú con dáng tắc kè; đầu lớn, mắt nửa khép, đuôi xoắn; mảng màu tím và xanh ngọc. |
| T2 | **Skinkoon** | Đứng thẳng bằng hai chân, đầu có các góc nhọn; đuôi cuộn lớn, bụng sáng màu và mắt sắc hơn. |
| T3 | **Ninjaguana** | Tư thế tung người; tay tạo dấu hoặc điều khiển các khối năng lượng xanh tím; thân gọn và đuôi dài cuộn. |
| T4 | **Hychroma** | Dáng chiến binh đứng thẳng; trang phục và khăn sáng màu, đầu có điểm sáng; năng lượng quanh tay và đuôi lớn tạo khung phía sau. |

### Những yếu tố cần giữ từ mẫu

- Bảng màu tím, xanh ngọc, xanh lam và các mảng sáng trắng.
- Đuôi xoắn, mắt sắc và ngôn ngữ hình thể của một nhẫn giả.
- Các dạng sau thể hiện sự lanh lợi, kỹ thuật và khả năng điều khiển năng lượng.

### Hướng nâng cấp đề xuất — chưa duyệt

- Nhấn mạnh tư thế, bàn tay và ánh mắt; giữ trang phục có mảng lớn để đọc rõ khi thu nhỏ.
- Dùng năng lượng và dấu ấn nhẫn thuật có chọn lọc, tạo khác biệt với hiệu ứng điện của sư tử sét.
- Biến thể hoàn mỹ có thể khai thác dư ảnh hoặc hiệu ứng chuyển sắc khi thiết kế sau.

## SSR-04 — Chuỗi khỉ võ đạo, đã đảo T3 và T4

Người dùng nhận xét dạng T3 của mẫu đẹp hơn T4 và yêu cầu đảo lại. **Thứ tự sử dụng trong dự án: Punchimp → Rockfu → Rockwu → Rockong.**

| Dạng trong dự án | Tên | Nguồn hình trong ảnh mẫu | Đặc điểm cần giữ |
| --- | --- | --- | --- |
| T1 | **Punchimp** | T1 gốc | Khỉ con nâu và kem; mảng mặt đỏ cam, đuôi dựng, dáng ngồi tròn và biểu cảm tinh nghịch. |
| T2 | **Rockfu** | T2 gốc | Dáng khỉ võ sinh; đầu có chỏm, một tay chống thân và một tay giơ lên; bắt đầu có chi tiết giáp hoặc đá. |
| T3 | **Rockwu** | **T4 gốc** | Dáng võ sĩ khỉ với giáp đá, băng trán hoặc chi tiết đội đầu; tư thế chiến đấu, vũ khí đặt chéo phía sau vai. |
| T4 | **Rockong** | **T3 gốc** | Dáng khỉ chiến thần; bờm sáng dựng lớn, giáp và vòng vàng, dải trang trí dài trên đầu, trường côn và tư thế đầy uy lực. |

### Quyết định đã chốt theo người dùng

- Đảo **cả hình tham khảo và tên** giữa hai dạng cuối, không chỉ đổi nhãn T3/T4.
- Lấy hình **Rockong ở T3 gốc** làm cơ sở thiết kế cho **T4 cuối cùng**.
- Lấy hình **Rockwu ở T4 gốc** làm cơ sở cho **T3**.
- Dấu sao đi kèm tên hai dạng cuối trong ảnh chỉ được ghi nhận là ký hiệu trên mẫu, chưa được gán ý nghĩa trong hệ thống.
- Nguồn cộng đồng đã có **Rockwu ở evolution 3 và Rockong ở evolution 4**, hình khớp thứ tự người dùng muốn. Bộ ảnh tải về giữ thứ tự này, không đảo thêm lần nữa.

### Hướng nâng cấp đề xuất — chưa duyệt

- Giữ cảm hứng khỉ chiến thần và võ đạo, với bảng màu nâu, kem, vàng và đỏ cam.
- T3 thể hiện một võ sĩ trưởng thành; T4 nổi bật hơn qua bờm, trường côn, giáp và tư thế.
- Tăng chất kim loại và nhịp điệu của dải trang trí, giữ mặt và vũ khí nhận diện rõ ở kích thước nhỏ.

## SR-01 — Chuỗi ốc sên tinh thể

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Shardsnail** | Ốc sên vàng cam với vỏ nâu lớn có đường xoắn, một cụm tinh thể tím ở cạnh vỏ. |
| T2 | **Gemsnail** | Vỏ tròn hơn, các vệt sáng kem và tím chạy theo đường xoắn; tinh thể cạnh vỏ lớn hơn. |
| T3 | **Jewelsnail** | Nhiều tinh thể tím mọc trên vỏ và quanh thân; lòng đường xoắn như một hốc đá quý. |
| T4 | **Crystalsnail** | Vỏ đá thành nhiều tầng có cạnh rõ, đội cụm tinh thể lớn; thân vàng cam có điểm sáng xanh hình trái tim. |

### Hướng mỹ thuật

- Giữ đường xoắn lớn, bảng màu nâu–kem và tinh thể tím; tinh thể mọc theo cấu trúc vỏ.
- Nâng cấp cảm giác khoáng vật và độ trong của đá quý; giữ khuôn mặt nhỏ hiền, dễ đọc.

## SR-02 — Chuỗi mèo lửa, đã tìm thấy tham chiếu T4

| Dạng | Tên | Nguồn và đặc điểm |
| --- | --- | --- |
| T1 | **Flameow** | Có trong ảnh: mèo con xanh tím đậm, mặt và ngực sáng, tai và đuôi đỏ cam, đeo vật tròn có lõi lửa. |
| T2 | **Nekoflare** | Có trong ảnh: tư thế đứng và giơ chân trước, mảng sáng trên mặt và bàn chân; đuôi lớn hơn, điểm nhấn lửa rõ hơn. |
| T3 | **Silversear** | Có trong ảnh: thân cao hơn, tư thế chiến đấu, mắt sắc; bờm và đuôi đỏ cam, bàn chân có lõi lửa. |
| T4 | **Cinderclaw — tên trong nguồn cộng đồng** | Đã tải ảnh T4: mèo lửa trưởng thành đang tung đòn, thân xanh tím và mặt sáng; các dải đỏ cam và trắng lớn bao quanh thân, một tay hướng ra trước với điểm lửa ở đầu ngón. |

### Thiết kế T4 nâng cấp đề xuất — chưa duyệt hình thành phẩm

- Dùng Cinderclaw làm tham chiếu T4 hiện có. **Blazereign** chỉ là tên ý tưởng vẽ lại trước lúc tìm được asset, chưa thay tên gốc hoặc trở thành loài mới.
- Giữ tai mèo, khuôn mặt sáng và lông xanh tím đậm để nối tiếp đúng chuỗi.
- Tăng uy lực qua vai, tư thế và vuốt; dùng lửa tập trung ở ngực, gáy và đuôi.
- Giữ gương mặt rõ, các mảng sáng lớn và nét hoạt hình; thể hiện một hỏa miêu chiến đấu có kiểm soát.
- T4 này là dạng tiến hóa thường. Bộ v3 đã có biến thể hoàn mỹ 100% riêng, không dùng để lấp dạng tiến hóa còn thiếu.

## SR-03 — Chuỗi bọ ngựa phong lan

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Manteeny** | Bọ ngựa con màu hồng và xanh lá nhạt, đầu lớn, mắt xanh; hai chân trước nhỏ như cánh hoa. |
| T2 | **Stalkerix** | Thân dựng cao hơn, chi trước dài và cong, phần lưng có các mảng lá. |
| T3 | **Serrabloom** | Dáng bọ ngựa thanh mảnh với hai lưỡi liềm lớn; vai và đầu có cánh hoa nhọn, thân như thân cây. |
| T4 | **Orchitoria** | Cánh hoa nhiều lớp trên đầu, vai và thân; hai liềm mở lớn, tua lá và cánh hoa tạo dáng như một chiến binh phong lan. |

### Hướng mỹ thuật

- Giữ tương phản hồng hoa và xanh lá; lưỡi liềm sắc nhưng dáng nhẹ, thanh thoát.
- Tách rõ hai chi trước khỏi phần váy hoa và cánh lá khi thu nhỏ.

## SR-04 — Chuỗi cừu mây giông

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Fluffle** | Cừu con thân mây trắng xanh, mặt xanh đậm, mắt cam; có tia sét phía dưới. |
| T2 | **Nimbuzzy** | Sừng cam cuộn, các dải mây có viền cam, thân tròn và tư thế lơ lửng. |
| T3 | **Galewether** | Sừng lớn hơn, mây dày phủ thân; nhiều nhánh cam và tia sét bên dưới tạo chuyển động giông gió. |
| T4 | **Cosmoram** | Mây xếp tầng lớn, sừng xoắn nổi bật, điểm xanh sáng và tia sét cam dài; tạo dáng cừu giông trưởng thành. |

### Hướng mỹ thuật

- Giữ khối lông mây là hình dáng chính; sừng, viền mây và tia sét tăng theo từng dạng.
- Tạo khác biệt với sư tử sét SSR bằng mây dày, cảm giác trôi nổi và nhịp chuyển động giông gió.

## SR-05 — Chuỗi cá chiến binh biển sâu

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Maskfry** | Sinh vật nhỏ xanh lam–kem, khuôn mặt như mặt nạ, vây và gai sáng màu; có các chi ngắn. |
| T2 | **Ospisces** | Thân chắc hơn, mặt nghiêm, các vây nhọn dựng lên; đuôi có mảng sáng. |
| T3 | **Armorjaw** | Dáng chiến đấu thấp, giáp và gai lớn quanh đầu và lưng; vây, đuôi và các chi có điểm xanh sáng. |
| T4 | **Dagondeep** | Dáng chiến binh biển sâu dựng cao, giáp gai, đỉnh đầu nhọn, tay lớn và các mảng xanh ngọc sáng; ảnh mẫu có dấu sao. |

### Ghi chú nguồn và hướng mỹ thuật

- Chú thích trong ảnh chụp nêu T4 có tên **Dagondeep-glitch-4** trong bộ nguồn của ảnh chụp.
- Nguồn cộng đồng mới có riêng `appearance-default` và `appearance-color_1` cho Dagondeep T4; ảnh `appearance-default` đã tải có hình khớp mẫu người dùng gửi. Không suy ra “glitch” từ tên ảnh chụp, và không tự coi biến thể nguồn là trạng thái hoàn mỹ 100% của dự án.
- Giữ bảng màu lam đậm, xanh ngọc và kem; phát triển cấu trúc giáp, vây và mặt nạ biển sâu.

## SR-06 — Chuỗi bọ cánh cứng hiệp sĩ

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Goonbug** | Bọ con xanh lá, đầu lớn có sừng hoặc mũi vàng cam, mai xanh đậm với đốm vàng. |
| T2 | **Capobeetle** | Dáng đứng thẳng, sừng cong kép, các mảng giáp trắng kem ở hai bên và tay trước ngực. |
| T3 | **Donscarab** | Vai và ngực mở rộng, mắt nghiêm, giáp kem và xanh lá; mảng cánh trắng hai bên tạo hình áo choàng. |
| T4 | **Beetleknight** | Giáp và mũ rõ cấu trúc, sừng viền vàng, vai nhọn, hai chân giáp và cánh trắng phía sau. |

### Hướng mỹ thuật

- Giữ cấu trúc đầu–thân–chi rõ, xanh lá làm màu chính và viền vàng cho dạng cuối.
- T4 phát triển cảm giác hiệp sĩ giáp bọ; các lớp giáp và cánh có vị trí rõ ràng.

## R-01 — Chuỗi bọ hung nghi lễ, chuyển từ nhóm SR ban đầu

Người dùng đã chuyển chuỗi **Humbug** xuống rank **R**, chiếm một trong sáu suất R.

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Humbug** | Bọ con nâu cam với mai lớn, mắt đen tròn, bụng có dấu xoắn vàng. |
| T2 | **Humbleetle** | Thân tròn chắc, mặt phẳng và mắt nửa khép; mai, bụng và các chân có mảng vàng cam. |
| T3 | **Zenscarab** | Dáng bọ nghi lễ đứng thẳng với nhiều chi mở; các đĩa tròn có dấu xoắn và biểu tượng sáng phía trên đầu. |
| T4 | **Hierotyrus** | Giáp và mũ đội đầu xếp tầng, mắt hoặc biểu tượng tam giác trên đỉnh, hai đĩa tròn hai bên cùng chi tiết sáng xanh trắng. |

### Hướng mỹ thuật

- Giữ hình tượng bọ hung, đường xoắn và giáp nghi lễ; bảng màu nâu, cam, vàng với điểm xanh sáng.
- Khi hoàn thiện, giữ mức độ hiệu ứng phù hợp rank R nhưng vẫn đủ bốn dạng có nhận diện riêng.

## R-02 — Chuỗi cú thôi miên và thời gian, chuyển từ nhóm SR ban đầu

Người dùng đã chuyển chuỗi **Hootlet** xuống rank **R**, chiếm một trong sáu suất R.

| Dạng | Tên trong ảnh | Đặc điểm quan sát từ ảnh mẫu |
| --- | --- | --- |
| T1 | **Hootlet** | Cú con xanh lá, mắt vàng lớn, ngực sáng, móc hoặc dây mang vật tròn vàng phía dưới. |
| T2 | **Tikowl** | Cánh mở rộng, lông ngực sáng màu, các điểm đỏ cam và vật tròn vàng gợi đồng hồ hoặc con lắc. |
| T3 | **Chronerva** | Thân lớn, chân rõ, lông và cánh vàng kem mở hai bên; đầu có cấu trúc nhiều lớp và vật tròn phía trên. |
| T4 | **Hypnostrix** | Quạt lông vàng kem lớn quanh đầu, nhiều vật tròn và chi tiết xanh–vàng, thân cú đứng vững. |

### Hướng mỹ thuật

- Giữ mắt lớn, con lắc và biểu tượng đồng hồ làm điểm nhận diện.
- Giữ bảng màu xanh lá, vàng kem và đỏ cam; hạn chế hiệu ứng phụ khi hiển thị nhỏ.

## R-03 — Chuỗi rùa đá, bổ sung từ asset nguồn

Được trợ lý chọn theo yêu cầu tự tìm bốn R còn thiếu. Nguồn xác nhận loài `Tortoise`, unit ID `19`, có đủ bốn dạng.

| Dạng | Tên trong nguồn | Đặc điểm quan sát từ ảnh đã tải |
| --- | --- | --- |
| T1 | **Gibber** | Rùa con thân vàng kem, mắt lớn, mai nâu vàng với vài chóp đá. |
| T2 | **Turtuff** | Tư thế thấp hơn, mai đá lớn che vai, biểu cảm trầm và chắc. |
| T3 | **Rockshell** | Các khối đá dựng cao trên mai, đầu và chân nhỏ so với mai; dáng chịu lực. |
| T4 | **Terraton** | Đầu và chân trước lớn, giáp đá bao quanh thân và lưng, các mảng kem và vàng giữ rõ gương mặt. |

### Hướng mỹ thuật

- Giữ trọng tâm thấp, cấu trúc mai đá và cảm giác bền vững.
- Khi nâng cấp, làm vật liệu đá rõ và tăng sức nặng của tư thế; dùng ít điểm sáng.

## R-04 — Chuỗi hươu từ trường, bổ sung từ asset nguồn

Được trợ lý chọn theo yêu cầu tự tìm bốn R còn thiếu. Nguồn xác nhận loài `Deer`, unit ID `20`, có đủ bốn dạng.

| Dạng | Tên trong nguồn | Đặc điểm quan sát từ ảnh đã tải |
| --- | --- | --- |
| T1 | **Voltfawn** | Hươu con vàng kem, sừng nhỏ dạng nam châm với hai đầu đỏ và xanh. |
| T2 | **Sparkdoe** | Sừng to hơn, lông cổ dựng thành vòng vàng cam, dáng đứng chắc. |
| T3 | **Zapantler** | Sừng phân nhánh và uốn cong, thân dài hơn, lông cổ và chân có mảng góc cạnh. |
| T4 | **Magnedart** | Sừng nam châm mở rộng cao, ngực và chân đậm màu, vòng lông cổ vàng cam sắc và dày. |

### Hướng mỹ thuật

- Nhấn bản sắc từ trường qua sừng đỏ–xanh và các đường lực có chọn lọc.
- Giữ thân hươu bốn chân và dáng thanh; tách biệt với sư tử sét và cừu mây giông.

## R-05 — Chuỗi thỏ tinh tú, bổ sung từ asset nguồn

Được trợ lý chọn theo yêu cầu tự tìm bốn R còn thiếu. Nguồn xác nhận loài `Rabbit`, unit ID `40`, có đủ bốn dạng.

| Dạng | Tên trong nguồn | Đặc điểm quan sát từ ảnh đã tải |
| --- | --- | --- |
| T1 | **Cheerling** | Thỏ con trắng tím với hai điểm sao vàng cam lớn, thân nhỏ tròn. |
| T2 | **Cheerlet** | Tai cuộn lớn, mắt hồng, các ngôi sao đặt thấp quanh thân. |
| T3 | **Cheerspring** | Dáng đứng cao hơn, trang phục tím và biểu tượng sáng trước ngực; hai sao tách rõ hai bên. |
| T4 | **Cheerstella** | Hai tai dài mở rộng sau đầu, dáng như nghệ sĩ biểu diễn, trang phục tím cam và các chi tiết sao. |

### Hướng mỹ thuật

- Giữ tai dài, ngôi sao và vẻ lanh lợi làm ba yếu tố nhận diện.
- Cải thiện tư thế và mảng trang phục để thấy rõ sự trưởng thành ở T4.

## R-06 — Chuỗi nấm mộng, bổ sung từ asset nguồn

Được trợ lý chọn theo yêu cầu tự tìm bốn R còn thiếu. Nguồn xác nhận loài `Mushroom`, unit ID `48`, có đủ bốn dạng.

| Dạng | Tên trong nguồn | Đặc điểm quan sát từ ảnh đã tải |
| --- | --- | --- |
| T1 | **Funglet** | Nấm con thân kem với mũ tím lớn, đốm xanh và cam, mắt buồn ngủ. |
| T2 | **Trippet** | Chân tay rõ hơn, mũ nấm mềm nghiêng, thân thấp và nét mặt lơ đãng. |
| T3 | **Hyphoria** | Mũ nấm mở rộng thành vành sáng, thân cao với các tua xanh tím, mắt nửa khép. |
| T4 | **Ecstamira** | Mũ và tua lớn uốn nhiều nhịp, các mảng phát sáng xanh–kem và điểm cam; dáng pháp sư nấm. |

### Hướng mỹ thuật

- Giữ mũ nấm bất đối xứng, mắt buồn ngủ và bảng màu tím–xanh–cam.
- Tăng chiều sâu của mũ và độ rõ của khuôn mặt, dùng bào tử sáng làm điểm nhấn nhỏ.

## Các mục còn chờ duyệt

- Tên Việt hóa và tên loài hiển thị trong sản phẩm.
- Thiết kế cuối cùng cho từng dạng và biến thể hoàn mỹ.
- Cân chỉnh [bộ kỹ năng của 18 loài](LINH_THU_SKILLS.md) sau khi hoàn thiện hệ thống: thiên phú cố định, Thức tỉnh 95% và tuyệt kỹ hoàn mỹ 100%. Bản ban đầu đang được triển khai; xem [tiến độ](LINH_THU_IMPLEMENTATION.md).
- Bộ ảnh mới thiết kế lại để đưa vào ứng dụng; 72 ảnh đã tải hiện là bộ tham chiếu nguồn.

## Cách cập nhật tiếp

- Ghi nhận mẫu mới theo rank, tên các dạng và đặc điểm thực sự thấy được trong ảnh.
- Phân biệt quyết định đã được người dùng chọn với hướng mỹ thuật mới chỉ đang đề xuất.
- Quy tắc xác nhận code chung vẫn áp dụng ngoài phạm vi đã duyệt. Goal Linh thú hiện tại cho phép triển khai sau khảo sát/kế hoạch và người dùng yêu cầu không hỏi lại các phần đã chốt; không cần duyệt lại từng file trong phạm vi đó. Deploy/dữ liệu thật cần xác nhận riêng khi bản review đã đủ.
