# Linh thú — tổng hợp thiết kế và quyết định

**Cập nhật 21/10/2026:** đã triển khai cục bộ cơ chế tiến hóa chủ động, khám phá ngoại hình và thanh tiến độ theo từng T; chưa phát hành thay đổi này. Khi phát hành cần áp dụng migration `0042_linh_thu_evolution.sql` trước runtime mới. Các ghi nhận phát hành ngày 19/10 bên dưới chỉ nói về phiên bản trước.

Cập nhật 19/10/2026. Tài liệu tổng hợp quyết định sản phẩm về luyện linh thú, triệu hồi, tháp và kỹ năng. Runtime đã tích hợp và kiểm thử, đủ18loài/108ảnh; người dùng đã duyệt bản hiện tại và cho phép phát hành staging. Migration 0041 và deploy đã hoàn tất, kiểm tra sau phát hành đạt; xem [hồ sơ phát hành](LINH_THU_RELEASE.md) và [tiến độ](LINH_THU_IMPLEMENTATION.md). Ảnh95%/100% dùng tạm theo yêu cầu, có thể chỉnh riêng sau.

Giữ bộ kỹ năng hiện tại làm **bản ban đầu**, cân chỉnh từng loài sau. Goal cho phép triển khai trong phạm vi tính năng, không cần hỏi lại từng file; xác nhận riêng cho đợt staging hiện tại đã nhận và thực hiện. Các lần phát hành tương lai cần quyền tương ứng.

## 1. Mục tiêu và hướng đã chọn

- Ý tưởng bắt đầu từ Tâm Ma: đánh cược/cam kết với bản thân về công việc, thói quen và sinh hoạt tương lai.
- Hướng phát triển được chọn là **sưu tầm linh thú, luyện bằng habit và săn bản hoàn mỹ**. Có gacha và tháp để tạo bất ngờ, có hành trình dài để tạo gắn bó.
- Linh thú phải có tác dụng hỗ trợ thực tế trong ứng dụng: vé, tu vi, phù, lựa chọn khi quay, bảo hộ ngủ/đột phá. Không đặt chỉ số chiến đấu khi ứng dụng chưa có vòng chơi chiến đấu tương ứng.
- Độ thuần 100% mở một khả năng đặc trưng và diện mạo riêng; không chỉ tăng nhẹ một con số.
- Tên thiên phú, Thức tỉnh và tuyệt kỹ trong bản kỹ năng là tên thiết kế của dự án. Không mặc định chúng là kỹ năng từ game nguồn.

## 2. Phân biệt task, habit và báo cáo ngủ

| Dữ liệu | Công dụng trong hệ thống linh thú |
| --- | --- |
| **Task công việc** | Điều kiện mở lượt tháp; kích hoạt kỹ năng task. Không tăng điểm luyện, không tạo/xóa tạp chất. |
| **Habit** | Nguồn duy nhất quyết định điểm luyện, tạp chất và độ thuần. Cũng kích hoạt kỹ năng habit và điều kiện tháp. |
| **Báo cáo ngủ** | Kích hoạt kỹ năng ngủ/bảo hộ và phần sinh hoạt sẵn có. Không thay habit để luyện thú. |

Task hợp lệ là công việc hoàn chỉnh được ghi nhận hoàn thành lần đầu theo luật thưởng hiện hành; bước nhỏ/nhật ký tiến độ không phải một task hoàn chỉnh. Báo cáo ngủ là dữ liệu tự khai, không được mô tả thành giấc ngủ đã được thiết bị xác minh.

Hệ thống hiện có vé thường, tu vi, vật phẩm, thưởng task/habit, quay thường, ghép phù, ngủ và đột phá. Linh thú, vé triệu hồi, độ thuần, tháp và bộ đếm kỹ năng là thiết kế bổ sung. Xem đối chiếu nguồn trong [bộ kỹ năng](LINH_THU_SKILLS.md).

## 3. Bộ sưu tập và bốn dạng

**18 loài: 2 UR + 4 SSR + 6 SR + 6 R.** Mỗi loài có bốn dạng T1–T4, tổng cộng 72 dạng nguồn tham chiếu. Bốn dạng tương ứng **ba lần chuyển từ T1 lên T4**; không tự thêm T5. Trạng thái trứng trước T1, nếu muốn có, cần định nghĩa riêng.

| Rank | T1 | T2 | T3 | T4 |
| --- | --- | --- | --- | --- |
| UR | Pyropup | Pyrohound | Hellhound | **Pyrodaemon** |
| UR | Rubblet | Cobbledon | Rockzilla | **Meteorax** |
| SSR | Frostnip | Frostpaw | Frostique | **Frostluna** |
| SSR | Zappur | Electroar | Blitzmane | **Stormlion** |
| SSR | Skinklet | Skinkoon | Ninjaguana | **Hychroma** |
| SSR | Punchimp | Rockfu | Rockwu | **Rockong** |
| SR | Shardsnail | Gemsnail | Jewelsnail | **Crystalsnail** |
| SR | Flameow | Nekoflare | Silversear | **Cinderclaw** |
| SR | Manteeny | Stalkerix | Serrabloom | **Orchitoria** |
| SR | Fluffle | Nimbuzzy | Galewether | **Cosmoram** |
| SR | Maskfry | Ospisces | Armorjaw | **Dagondeep** |
| SR | Goonbug | Capobeetle | Donscarab | **Beetleknight** |
| R | Humbug | Humbleetle | Zenscarab | **Hierotyrus** |
| R | Hootlet | Tikowl | Chronerva | **Hypnostrix** |
| R | Gibber | Turtuff | Rockshell | **Terraton** |
| R | Voltfawn | Sparkdoe | Zapantler | **Magnedart** |
| R | Cheerling | Cheerlet | Cheerspring | **Cheerstella** |
| R | Funglet | Trippet | Hyphoria | **Ecstamira** |

- “RR” đã được xác nhận là **R**, không thêm rank mới.
- Humbug và Hootlet chuyển từ nhóm tám SR ban đầu xuống R, chiếm hai trong sáu suất R.
- Bốn R còn lại do trợ lý chọn theo yêu cầu: rùa đá, hươu nam châm, thỏ tinh tú và nấm mộng.
- Thứ tự khỉ sau điều chỉnh là **Rockwu T3 → Rockong T4**; asset đã lưu đúng thứ tự này, không đảo thêm.
- Ảnh mẫu mèo ban đầu chỉ có ba dạng; đã tìm được **Cinderclaw T4** trong nguồn cộng đồng để làm tham chiếu. Blazereign là tên ý tưởng cũ, chưa thay tên nguồn.
- Rank ở đây là phân hạng của dự án, không khẳng định là độ hiếm trong game nguồn.

## 4. Luyện thú: điểm thực và máu xám

### Một thanh có ba phần

1. **Điểm luyện thực:** phần đã làm được, hiển thị màu chính.
2. **Tạp chất/máu xám:** phần đáng ra có thể nhận nhưng đã bỏ lỡ.
3. **Phần còn trống:** dung lượng còn lại của lượt luyện.

Điểm thực và máu xám cùng chiếm dung lượng thanh. Một ngày thiếu habit vẫn tiến đến kết thúc lượt luyện, nhưng chất lượng cuối thấp hơn. Làm tốt ngày sau không tự rửa phần xám đã có. Không giảm độ thuần cố định 5 điểm phần trăm mỗi lần trượt.

### Điểm tối đa trong ngày

Gọi N là số habit có kết quả cần xét trong ngày sau quyết toán: `achieved + missed`; không tính `neutral`. C là số habit `achieved` trong số đó.

| N | Điểm tối đa B |
| ---: | ---: |
| 0 | 0 |
| 1 | 1,0 |
| 2 | 1,2 |
| 3 | 1,4 |
| Từ 4 | 1,6 |

- Điểm thực ngày = **làm tròn B × C / N đến một chữ số thập phân**.
- Máu xám ngày = **B − điểm thực ngày**.
- Khi N = 0: **+0 điểm thực, +0 máu xám**; không thực hiện phép chia.

Ví dụ bốn habit, hoàn thành ba: `1,6 × 3/4 = 1,2 điểm thực`, phần còn lại `0,4 máu xám`. Không phải mất toàn bộ điểm của ngày.

Ví dụ hôm nay một habit và không làm: **+0 thực, +1 xám**. Hôm sau có hai habit hợp lệ và làm đủ: **+1,2 thực, +0 xám**; một điểm xám cũ vẫn giữ nguyên.

Một habit thời lượng làm 15/20 phút chưa đạt vẫn được hệ thống xét là chưa đạt cho buổi đó; công thức trên chia theo **số habit đạt**, chưa có quyết định thưởng điểm luyện theo tỷ lệ phút/trang bên trong một habit.

Khi triển khai nên lưu điểm luyện ở đơn vị một phần mười để tránh sai số. Vé và tu vi vẫn luôn là số nguyên. Helper `habitSpeedMultiplier` còn trong source có công thức khác; không coi helper đó là bằng chứng cơ chế luyện thú đã được triển khai đúng thiết kế này.

### Độ thuần

- Trong lượt đang luyện: độ thuần tạm tính bằng **điểm thực / (điểm thực + máu xám) × 100%**, khi đã có điểm được quyết toán.
- Lượt chưa có điểm: hiển thị chưa xác định, không coi là đã đạt hoàn mỹ.
- Khi luyện đầy tổng dung lượng Q: **độ thuần cuối = điểm thực / Q × 100%**.
- Ví dụ thanh 40 điểm, gồm 38 thực và 2 xám: độ thuần **95%**. 40 thực và 0 xám: **100%**. Đây là ví dụ tính toán, không ấn định lại ngưỡng của một rank.
- So mốc 95%/100% bằng số gốc, không dùng phần trăm hiển thị đã làm tròn. 99,96% không được nhận tuyệt kỹ hoàn mỹ.
- Ngưỡng luyện tối đa và các mốc chuyển hình được cấu hình theo rank/tư chất. Không dùng chung một ngưỡng cho mọi rank. Thiên phú từng loài cố định; chưa có quyết định bốc thêm chỉ số tư chất ngẫu nhiên trong cùng loài.

**Bảng đã được duyệt, đơn vị điểm:**

| Rank | T2 | T3 | Vào T4 | Luyện đầy |
| --- | ---: | ---: | ---: | ---: |
| R | 10 | 25 | 40 | 60 |
| SR | 15 | 35 | 55 | 80 |
| SSR | 20 | 50 | 80 | 120 |
| UR | 30 | 70 | 110 | 160 |

Ngày cuối chỉ dùng dung lượng còn lại. Chia thực/xám theo tỷ lệ habit đạt, làm tròn một chữ số; nếu còn habit thiếu thì giữ tối thiểu 0,1 xám để không vô tình mở Hoàn mỹ. Vào T4 chưa có nghĩa đã luyện đầy hoặc mở 95%/100%.

### Tiến hóa chủ động và khám phá ngoại hình — duyệt 21/10/2026

- Dạng thực tế được lưu riêng với điểm. Cá thể mới bắt đầu T1; đủ **điểm thực tích lũy** tại mốc trong bảng trên mới có thể bấm tiến hóa. Mỗi lần bấm tăng một T, không trừ điểm, giữ cả điểm vượt mốc. Chưa bấm thì vẫn ở dạng cũ và vẫn tích điểm từ habit.
- Tạp chất chiếm dung lượng nhưng không giúp mở T. Nếu `dung lượng − tạp chất < mốc T kế tiếp`, lượt này không thể đạt T đó. Ví dụ R ở T3 có 32 điểm thực và 24 tạp chất: chỉ còn 4 dung lượng, tối đa 36 điểm thực nên không thể lên T4 ở mốc 40.
- Lượt đã dùng hết dung lượng vẫn được tiến hóa nếu đủ điểm thực; lượt đã khóa do đổi con không được tiến hóa. T4 cần luyện đầy tổng dung lượng rồi mới xét Thức tỉnh từ 95% và Hoàn mỹ chính xác 100%.
- Dấu ấn nỗ lực hiển thị chặng hiện tại: T1→T2, T2→T3, T3→T4, hoặc T4→luyện đầy. Thanh là đoạn tương ứng của hành trình tổng: điểm thực đi từ trái, tạp chất lấn ngược từ cuối tổng dung lượng. Tạp chất chỉ xuất hiện trên thanh chặng khi đã lấn vào chặng đó; phần Chi tiết luôn hiển thị tổng thực/xám/độ thuần.
- Hành trình gồm bốn ô. Dạng chưa khám phá dùng dấu chân, không tải ảnh hoặc hiện tên dạng tương lai. Dạng từng đạt bằng cá thể khác cùng loài hiện xám; dạng cá thể này đã đạt hiện màu. Xem thông tin kỹ năng không được tính là khám phá ngoại hình.
- Khám phá thuộc tài khoản và loài, lấy từ các lượt luyện đã lưu, giữ qua luyện lại. Migration bảo toàn dạng từng đạt theo luật cũ, kể cả khi điểm xám từng góp phần chuyển dạng.
- Trước khi tiến hóa hiển thị chính xác xác suất hiện tại → xác suất mới và thiên phú sắp mở. Sau khi server xác nhận, hiệu ứng tụ năng lượng → chuyển hình → hiện kết quả kéo dài khoảng 3,8 giây; có Bỏ qua hiệu ứng và tự rút gọn khi người dùng bật giảm chuyển động. Mất kết nối phải kiểm tra cùng biên nhận, không tự thực hiện thêm lần tiến hóa.
- Cơ chế tăng thiên phú theo T giữ nguyên bảng trong [bộ kỹ năng](LINH_THU_SKILLS.md). Đợt này chưa thay đổi cách nhận thưởng kỹ năng sang kho chờ nhận.

## 5. Lịch habit, thêm và sửa

- **Không khóa bộ habit trong suốt lượt luyện.** Được thêm, sửa, lưu trữ theo hệ thống habit. Khi thay đổi có hiệu lực, ngày sau đó dùng bộ habit hợp lệ tương ứng.
- Tuần theo lịch chuẩn **thứ Hai–Chủ nhật, UTC+7**, không phải chu kỳ bảy ngày từ lúc bấm tạo.
- Đổi định nghĩa không làm biến mất điểm thực hoặc tạp chất của các ngày đã chốt. Không phạt cho thời gian trước khi cam kết có hiệu lực.
- Ngày ngoài lịch, chưa có hiệu lực, đã đủ quota hoặc còn linh hoạt được tính theo kết quả `neutral`; không tự xem tất cả là thất bại.
- Ngày không có nghĩa vụ được xét: +0 thực, +0 xám. Không tự tăng bộ đếm thưởng ngày đủ habit.

### Nhận diện habit và ngày hiệu lực hiện có

Habit được nhận diện bằng **ID**; sửa tạo phiên bản định nghĩa mới cho cùng ID, không tự tạo habit khác chỉ vì đổi tên, target, metric hoặc lịch. Muốn theo dõi một thói quen khác độc lập có thể tạo một habit mới. Việc chỉnh sửa không viết lại nghĩa vụ của ngày đã chốt.

Theo [hợp đồng habit hiện hành](HABITS.md):

| Thay đổi | Hiệu lực |
| --- | --- |
| Tạo habit hằng ngày/chọn thứ | Ngày sinh hoạt kế tiếp |
| Tạo habit X ngày/tuần | Thứ Hai kế tiếp |
| Sửa habit không liên quan lịch X ngày/tuần | Ngày sinh hoạt kế tiếp |
| Lịch cũ hoặc mới là X ngày/tuần | Thứ Hai kế tiếp |
| Sửa giờ nhắc riêng | Cập nhật ngay; không tự thay nghĩa vụ đã có |

Ví dụ quota bốn ngày/tuần đổi còn một ngày/tuần vào thứ Tư: tuần hiện tại tiếp tục theo phiên bản bốn ngày; từ thứ Hai kế tiếp mới theo một ngày. Giao diện cần hiển thị rõ bản đang áp dụng và bản đang chờ. Đây là hành vi hiện có, không phải chỉnh xong rồi phạt ngược các ngày đầu tuần.

Với quota linh hoạt bốn ngày, không làm thứ Hai chưa mặc định là trượt nếu vẫn còn đủ cơ hội hoàn thành bốn ngày trong tuần. Dùng kết quả domain hiện tại; không làm thêm một bộ lịch riêng cho linh thú. Nếu muốn thay cách xử lý tuần chuyển tiếp để mềm hơn nữa, đó sẽ là thay đổi riêng cần xác nhận.

Ngày habit là ngày sinh hoạt do server xác định; tuần dùng lịch chuẩn. Không đồng nhất mọi cơ chế đổi ngày với 00:00 nếu cửa sổ habit hiện hành khác ngày lịch. Ranh giới có hiệu lực của việc đổi con đang luyện cần dùng cùng ngày habit để không có hai con nhận cùng một ngày.

## 6. Đổi con đang luyện và khóa lượt

Đây là **quyết định mới thay thế** ý tưởng trước đó về lùi về đầu mốc tiến hóa:

1. Hôm nay chọn một linh thú khác để luyện.
2. Trong hôm nay, có thể xem hình con mới nhưng phải ghi rõ: **“Ngày hôm nay vẫn được tính cho linh thú cũ. Linh thú mới bắt đầu từ ngày kế tiếp.”**
3. Quyết toán ngày hiện tại cho con cũ, gồm cả điểm thực và phần xám.
4. Khi sang ngày habit kế tiếp, con mới bắt đầu được tính luyện.
5. Con cũ **khóa vĩnh viễn lượt luyện ở đúng tiến độ/hình dạng/điểm xám đã có**. Không tự quay về đầu mốc; không được chọn tiếp tục luyện lượt đó sau này.
6. Muốn làm lại chính cá thể đó cần Tịnh Linh Đan, khởi động một lượt luyện mới từ đầu.

Con đã khóa vẫn thuộc bộ sưu tập. Khả năng đồng hành dùng theo dạng/kỹ năng đã đủ điều kiện; việc khóa lượt không tự xóa quyền sở hữu. Không cho một con đang luyện dở mở mốc 95%/100% chỉ vì tỷ lệ tạm thời đẹp.

**Đổi đồng hành nhận buff** là thao tác riêng, không tự kích hoạt luật khóa luyện. Phải phân biệt rõ hai nút trong giao diện.

## 7. Tịnh Linh Đan và luyện lại

- Vật phẩm hiếm cho phép reset lượt luyện để thử lại với chính linh thú đã sở hữu.
- Luyện lại từ đầu, thay vì trả một khoản nhỏ để tẩy vài điểm xám tại chỗ.
- Nếu không có đan, hướng khác là triệu hồi lại ra một cá thể cùng loài và luyện cá thể đó. Với loài hiếm, cần tài nguyên, sự kiên trì và may mắn.
- Không dùng Phá Cảnh Phù hay cơ chế ghép phù hiện có làm vật thay thế mặc định. Đây là một mục tiêu dài hạn riêng.
- Reset không xóa lịch sử task để nhận thưởng lần nữa, không hoàn lại hạn mức tuyệt kỹ đã sử dụng.

**Công thức đã được duyệt:** tích 30 ngày đủ habit; neutral tạm dừng, missed đứt chuỗi. Đủ 30 giữ sẵn đến khi luyện. Mỗi mẻ tiêu toàn bộ chuỗi dù thành công hay thất bại, 40% thành công; sau hai mẻ thất bại mẻ tiếp theo chắc chắn thành công. Chạy cùng luyện thú, không cần task. Thành công nhận một Tịnh Linh Đan; dùng một đan mở lượt mới của đúng cá thể.

## 8. Triệu hồi và bảo hiểm

### Vé và tỷ lệ nền

- **20 vé thường → 1 vé triệu hồi → 1 lần triệu hồi linh thú.** Hai loại vé phải phân biệt trong ví và phần thưởng.
- Vé/tu vi trả nguyên; không có vé triệu hồi 0,2 hoặc nợ phần thưởng lẻ.

| Rank | Tỷ lệ thường | Số loài | Tỷ lệ một loài cụ thể nếu chia đều trong rank |
| --- | ---: | ---: | ---: |
| R | 70% | 6 | Khoảng 11,6667% |
| SR | 25% | 6 | Khoảng 4,1667% |
| SSR | 4,5% | 4 | 1,125% |
| UR | 0,5% | 2 | 0,25% |

Bản ban đầu dùng chọn đều loài trong cùng rank, không thêm banner tăng tỷ lệ riêng.

### Hai bộ đếm

- Sau **19 lượt liên tiếp không có SSR trở lên**, lượt thứ 20 bảo đảm SSR+, với tỷ lệ **90% SSR / 10% UR**.
- Sau **79 lượt liên tiếp không có UR**, lượt thứ 80 bảo đảm UR.
- Nếu cùng chạm hai bảo hiểm, **ưu tiên UR**.

| Kết quả thực nhận | Bộ đếm SSR+ | Bộ đếm UR |
| --- | --- | --- |
| R/SR | +1 | +1 |
| SSR | Về 0 | +1 |
| UR | Về 0 | Về 0 |

Vì vậy nhận SSR sớm sẽ bắt đầu lại chu kỳ SSR+, không làm mất tiến độ chờ UR. Nhận UR đặt lại cả hai. Lượt quay có tuyệt kỹ ba ứng viên của Pyrodaemon chỉ cập nhật một lần theo con đã chọn.

**Đã duyệt:** mỗi lần triệu hồi tạo một cá thể T1 riêng, kể cả trùng loài. Kho phân trang; không tự chuyển thú trùng thành vật phẩm. Tài khoản mới bắt đầu bộ sưu tập trống, không cấp thú hoặc vé mẫu.

## 9. Tháp lật bài trong tab Habit

### Điều kiện và luật

- Đặt trong **tab Habit**.
- Chơi **ngay khi đủ điều kiện**, không phải đợi hết ngày.
- Server chụp điều kiện khi bắt đầu: ít nhất một habit đạt, không có habit missed cần xét, và một task hoàn thành hợp lệ trong ngày. Quota tuần còn linh hoạt chưa làm giữ neutral.
- Sau bắt đầu vẫn sửa log được; không thu hồi lượt/quà. Kết quả luyện thú độc lập, dùng log cuối ngày.
- Sang ngày mới, lượt chưa kết thúc tự nhận tổng quà của tầng đã qua, chưa qua tầng nào nhận 0; không chiếm lượt mới.
- Mỗi ngày một lượt miễn phí; điều kiện gồm **đã hoàn thành đủ habit cần làm và ít nhất một task công việc hợp lệ trong ngày**.
- Đây là điều kiện chơi tháp, không phải điều kiện được luyện thú.
- Mỗi tầng có đúng một bẫy, số lá **4 → 4 → 3 → 2**.
- Tầng 1 xong vẫn giữ bốn lá và xáo lại cho tầng 2; từ sau tầng 2 bỏ lá thưởng vừa chọn để còn ba, rồi hai lá. Bẫy luôn còn trong bộ.
- Qua một tầng được chọn **dừng nhận quà hoặc tiếp tục**. Tiếp tục thì quà vẫn đang rủi ro.
- Trúng bẫy mất toàn bộ quà chưa chốt của lượt đó, không trừ tài sản đã có trong ví.
- Quà mỗi tầng là **tổng nhận nếu dừng tại tầng đó**, không cộng các tầng lại.

| Tầng | Số lá | Cơ hội qua riêng tầng | Tổng quà khi dừng |
| --- | ---: | ---: | --- |
| 1 | 4 | 75% | **2 vé thường** |
| 2 | 4 | 75% | **3 vé thường** |
| 3 | 3 | 2/3 | **1 vé triệu hồi** |
| 4 | 2 | 50% | **2 vé triệu hồi** |

Thắng tầng 4 nhận tổng hai vé triệu hồi, không phải ba vé. Phần thưởng tầng 2 cuối cùng là ba vé thường, thay cho mức năm vé đã bàn trước đó.

### Xác suất và độ khó

| Mục tiêu từ đầu lượt | Xác suất |
| --- | ---: |
| Qua tầng 1 | 75% |
| Qua tầng 2 | 56,25% |
| Qua tầng 3 | 37,5% |
| Qua tầng 4 | 18,75% |

Dừng sau tầng 3 hoặc luôn chơi đến tầng 4 đều cho kỳ vọng **0,375 vé triệu hồi/lượt**. Chơi đủ điều kiện bảy ngày cho trung bình dài hạn 2,625 vé/tuần từ lựa chọn đó, không bảo đảm tuần nào cũng nhận đúng mức ấy. Khoảng 2,67 lượt đủ điều kiện cho một vé theo trung bình, không phải bảo hiểm.

Tầng 4 tạo lựa chọn 50/50 giữa giữ một vé và đánh cược lấy hai vé. Không hạ kỳ vọng vé triệu hồi so với dừng tầng 3, nhưng biến động lớn hơn. Chưa có mô phỏng toàn bộ kinh tế để kết luận mọi nguồn thưởng đã cân bằng.

Tuyệt kỹ Rockong là ngoại lệ trong bộ ban đầu: mỗi lượt có một lần cứu bẫy tầng 1–3; không cứu tầng 4 và không thêm lượt/ngày. Khi có hiệu ứng, cơ hội qua tầng 3 là 68,75%, qua tầng 4 là 34,375%; kỳ vọng 0,6875 vé/lượt.

**Còn cần quy định khi triển khai:** snapshot điều kiện với quota tuần linh hoạt, hoàn tác log sau lúc mở tháp, đổi habit sau lúc đủ điều kiện và lượt đang chơi qua ranh giới ngày. Phải giữ một lượt/ngày, không tái cấp quà khi tải lại/mất mạng. Không lấy điều kiện tạm thời đủ để kết luận sớm rằng con thú đã có một ngày luyện hoàn mỹ.

## 10. Bộ kỹ năng ban đầu

Người dùng chấp nhận giữ bộ này làm bản ban đầu, hoàn thiện hệ thống rồi cân chỉnh từng con. Các giá trị có thể đổi trong đợt cân bằng sau; không coi là số bất biến.

### Mở khóa và bốn dạng

- R/SR: một thiên phú nền. SSR/UR: hai thiên phú nền.
- Từ 95% ở cuối lượt T4: thêm Thức tỉnh.
- Chính xác 100% ở cuối lượt T4: thêm tuyệt kỹ hoàn mỹ và diện mạo riêng; vẫn giữ Thức tỉnh.
- Trong bản ban đầu, độ thuần không nhân giảm thêm lượng thưởng thiên phú. Khác biệt lớn nằm ở các khóa 95%/100%.
- Có thể đồng hành từ T1; chưa định nghĩa kỹ năng cho trứng.

| Dạng | Xác suất thiên phú 1 so với gốc | Thiên phú 2 của SSR/UR |
| --- | ---: | ---: |
| T1 | 25% | Chưa mở |
| T2 | 50% | Chưa mở |
| T3 | 75% | 50% |
| T4 | 100% | 100% |

Giữ nguyên lượng thưởng nguyên. Ví dụ thiên phú gốc chắc chắn +1 vé thì T1 có 25% nhận một vé, không nhận 0,25 vé. Thiên phú gốc 40% thì T1 còn 10%, T2 20%, T3 30%, T4 40%.

### Toàn bộ hiệu ứng tại T4

Số trong bảng là thưởng thêm ngoài phần thưởng gốc. Mốc tích lũy không cần liên tiếp; các tuyệt kỹ có nhiệm vụ phải hoàn thành sau kích hoạt và trước hết hạn. Tên đầy đủ và tương tác xem [LINH_THU_SKILLS.md](LINH_THU_SKILLS.md).

| Loài | Thiên phú nền | Thức tỉnh 95% | Tuyệt kỹ 100% |
| --- | --- | --- | --- |
| **Pyrodaemon · UR** | Mỗi task +1 tu vi; độc lập 80% +1 vé thường. | Mỗi 20 task tích lũy +1 vé triệu hồi. | **Tam Thủ Chiêu Hồn:** lần triệu hồi tiếp theo xem ba ứng viên, chọn một, tốn một vé triệu hồi. |
| **Meteorax · UR** | Ngày đủ habit +4 tu vi; ngủ đúng giờ +3 tu vi. | Mỗi năm ngày vừa đủ habit vừa ngủ đúng giờ +1 vé triệu hồi. | **Tinh Vẫn Kết Giới:** hai lượt bảo hộ ngủ, một lượt hoàn toàn bộ tổn thất đột phá; lượt dư cuối tuần đổi 5 tu vi/lượt. |
| **Frostluna · SSR** | Ngủ đúng giờ +3 tu vi; ngày đủ habit 10% +1 An Tâm Phù. | Ngày vừa đủ habit vừa ngủ đúng giờ +1 vé thường. | **Băng Nguyệt Phong Ấn:** ba kỳ ngủ tiếp theo; đúng giờ +5 tu vi/kỳ, vi phạm được giữ chuỗi và tránh mất tu vi. |
| **Stormlion · SSR** | Mỗi task: 50% +1 vé thường, độc lập 50% +1 tu vi. | Task thứ ba/ngày +2 vé thường. | **Lôi Vương Bảo Khố:** làm năm task trong tuần, chọn 2 vé triệu hồi hoặc 40 tu vi. |
| **Hychroma · SSR** | Quay thường ra tu vi: 60% +1 tu vi; đột phá thất bại hoàn tối đa 3 tu vi thực mất. | Mỗi ba lượt quay thường có tu vi +3 tu vi. | **Ảo Ảnh Tam Phân:** ba lượt quay thường tiếp theo, mỗi lượt trả một vé, hiện ba kết quả chọn hai. |
| **Rockong · SSR** | Ngày đủ habit +3 tu vi và +1 vé thường. | Mỗi năm ngày đủ habit +1 vé triệu hồi. | **Phân Thân Thế Mệnh:** phần tuần còn lại, mỗi lượt tháp một lần cứu bẫy tầng 1–3; không cứu tầng 4. |
| **Crystalsnail · SR** | Ngày đủ habit +1 vé thường. | Mỗi năm ngày đủ habit +3 vé thường. | **Tinh Hốc Bí Tàng:** đạt ba ngày đủ habit trong tuần +1 vé triệu hồi. |
| **Cinderclaw · SR** | Mỗi task 50% +1 tu vi. | Task thứ ba/ngày +3 tu vi. | **Hỏa Liên Trảm:** ba task tiếp theo trong ngày thưởng 3 → 5 → 10 tu vi. |
| **Orchitoria · SR** | Mỗi task 40% +1 vé thường. | Task thứ ba/ngày +1 vé thường. | **Song Liêm Khế:** chọn hai task chưa xong; mỗi task hoàn thành +5 vé thường, cả hai thêm 5 tu vi. |
| **Cosmoram · SR** | Ngủ đúng giờ +2 tu vi. | Mỗi ba báo cáo đúng giờ tích lũy +5 tu vi. | **Thiên Cung Mộng Du:** ba báo cáo đúng giờ trong tuần +1 vé triệu hồi. |
| **Dagondeep · SR** | Đột phá thất bại hoàn tối đa 3 tu vi thực mất. | Ngày đủ habit +2 tu vi. | **Giao Ước Vực Sâu:** chọn trước thưởng 1 vé triệu hồi nếu thành công, hoặc hoàn toàn bộ tổn thất nếu thất bại. |
| **Beetleknight · SR** | Ngày đủ habit 7% +1 An Tâm Phù. | Sáu ngày đủ habit không trúng thì ngày đủ habit thứ bảy chắc chắn có phù; trúng reset bộ đếm. | **Hiệp Sĩ Hộ Vệ:** canh một kỳ ngủ; vi phạm giữ chuỗi/tu vi, đúng giờ nhận 1 Hộ Tâm Phù + 1 An Tâm Phù. |
| **Hierotyrus · R** | Ngày đủ habit 10% +1 phù sơ cấp. | Mỗi ba ngày đủ habit +1 phù sơ cấp. | **Luyện Phù Song Sinh:** lần ghép sơ→trung tiếp theo thành công nhận hai phù trung, thất bại hoàn một phù sơ thực mất; vẫn cần ba đầu vào, tỷ lệ 80%. |
| **Hypnostrix · R** | Ngủ đúng giờ +1 tu vi. | Ba báo cáo đúng giờ trong tuần +1 Hộ Tâm Phù, một lần/tuần. | **Đêm Đứng Yên:** canh một kỳ ngủ; vi phạm giữ chuỗi, đúng giờ chọn 5 vé thường hoặc 12 tu vi. |
| **Terraton · R** | Đột phá thất bại hoàn tối đa 1 tu vi thực mất. | Ngày đủ habit +1 tu vi. | **Mai Đá Hộ Thể:** lần đột phá tiếp theo thất bại hoàn tổng tối đa 10 tu vi thực mất, thành công +5 tu vi. |
| **Magnedart · R** | Mỗi task 25% +1 tu vi. | Task thứ ba/ngày +1 tu vi. | **Cực Từ Đảo Chiều:** đánh dấu tối đa ba task chưa xong; mỗi task hoàn thành chọn thêm 1 vé thường hoặc 3 tu vi. |
| **Cheerstella · R** | Mỗi task 20% +1 vé thường. | Task thứ ba/ngày +1 vé thường. | **Tinh Tú Dẫn Lối:** lượt quay thường tiếp theo xem hai kết quả, chọn một, vẫn trả một vé. |
| **Ecstamira · R** | Ngày đủ habit +1 tu vi. | Ngày vừa đủ habit vừa ngủ đúng giờ thêm 1 tu vi. | **Mộng Cảnh:** ba ngày đủ habit trong tuần, chọn 6 vé thường hoặc 15 tu vi. |

### Hạn mức bản ban đầu

- Một đồng hành hiệu lực/ngày. Đổi đồng hành hiệu lực ngày kế tiếp; có thể sửa lựa chọn chờ trước lúc chuyển.
- Thưởng kỹ năng task xét **năm task hợp lệ đầu tiên/tài khoản/ngày**. Mốc task thứ ba dùng cùng bộ đếm.
- Kỹ năng quay thường xét **mười lượt có trả vé đầu tiên/ngày**. Một lượt có nhiều ô lựa chọn vẫn là một lượt.
- **Một lần kích hoạt tuyệt kỹ/tài khoản/tuần lịch**, dùng chung mọi cá thể và mọi loài.
- Kích hoạt tuyệt kỹ không tốn vé; các hành động được tăng cường vẫn trả chi phí gốc.
- Hết hạn cuối tuần; riêng combo Cinderclaw hết hạn trong ngày kích hoạt. Phần chưa hoàn thành không tự chuyển sang tuần sau.
- Tuyệt kỹ đang chạy được giữ đến hết hạn khi đổi đồng hành; thiên phú của con cũ dừng khi đổi có hiệu lực. Không được dùng thêm tuyệt kỹ khác cùng tuần.
- Bộ đếm tích lũy gắn cá thể, chỉ tăng khi cá thể đó đồng hành và đã mở kỹ năng; giữ phần dư khi đổi đồng hành. Bộ đếm tuần kết thúc theo tuần.
- Nhiệm vụ đánh dấu task không được đổi mục tiêu sau kích hoạt. Không dùng task từng hoàn thành để nhận lại thưởng.
- Thưởng kỹ năng không tự kích hoạt thêm thưởng kỹ năng, không phát bù lịch sử, không bốc lại vận may khi retry/hoàn tác.
- Không kỹ năng nào can thiệp điểm luyện, xám, thuần hoặc độ hiếm của đan reset.

### Tương tác đặc biệt

- Pyrodaemon: ba rank được bốc từ cùng bảng trước lượt quay, chọn đều loài chưa có trong ba ô nếu còn; hết loài mới được trùng. Không nhận nguyên liệu từ hai ứng viên bị bỏ. Cơ hội có ít nhất một UR là khoảng 1,4925% lượt thường, 27,1% lượt bảo hiểm SSR+, 100% lượt bảo hiểm UR.
- Hychroma/Cheerstella: dùng bảng quay thường hiện tại, không phải tỷ lệ triệu hồi. Được trùng vật phẩm; không cộng thêm một phần thưởng gốc ngoài các ô đã chọn.
- Hoàn tu vi không bao giờ vượt số thực bị trừ, không ghi là thu nhập mới để kích hoạt thưởng khác. Tổng hoàn từ thiên phú và tuyệt kỹ không cộng trùng.
- Bảo hộ ngủ kích hoạt trước mốc giờ ngủ, không cứu hồi tố. Phù đã dùng được xét trước, kết giới che phần còn thiếu. Bảo vệ tu vi trước khi xử lý nguy cơ tụt cảnh giới, không trừ rồi hoàn sau gây tụt oan.
- Bảo hộ không sửa báo cáo vi phạm thành đúng giờ, không tạo thưởng/chuỗi tăng cho một đêm vi phạm và không che quy tắc tài khoản ngừng hoạt động.
- Kỳ ngủ thuộc tuần nào dùng ngày mà hệ thống gán cho kỳ đó; kỳ Chủ nhật quyết toán sau nửa đêm vẫn thuộc Chủ nhật.

## 11. Mỹ thuật và asset

- Tham khảo **Clash of Critters / Chiến Thú Hỗn Chiến**. Ảnh người dùng chụp dùng để nhận diện loài và hướng tham khảo, không coi là sprite thành phẩm.
- Đã lưu **72 WebP tĩnh 512×512 có alpha**, đủ 18 loài × bốn dạng, kèm bốn bảng ảnh UR/SSR/SR/R.
- Nguồn tải trực tiếp là kho cộng đồng [MilkRoad / tatari-companion](https://github.com/kenzkunz/tatari-companion), commit `771b7c760d7cf47e19c355aa865ed6a1d2beaebf`, dữ liệu `0.49.1`. Không gọi đây là asset chính thức do nhà phát hành cấp.
- Danh mục, URL, SHA-256, mã loài, thứ tự dạng và kết quả kiểm tra ảnh nằm trong [thư mục tham chiếu](assets/linh-thu/reference/README.md).
- Mục tiêu vẽ lại: giữ nhận diện, nâng hình thể/tư thế/vật liệu/ánh sáng, càng lên rank và dạng càng có uy thế. T4 phải khác về cấu trúc, không chỉ phóng lớn T1.
- Hoàn mỹ là biến thể riêng của T4: dấu ấn bản mệnh, hiệu ứng/hoạt ảnh và tuyệt kỹ gắn cùng bản sắc loài. Không tự lấy skin `color_1` của nguồn làm bản hoàn mỹ.
- Đề xuất ảnh gốc mới tối thiểu 1024×1024, nền trong suốt, toàn thân; đọc rõ ở 128 px và kiểm thêm 64 px. Duy trì góc nhìn và điểm neo nhất quán khi tiến hóa.
- Đã nghiên cứu và lưu hướng mỹ thuật; **chưa sinh/vẽ bộ ảnh mới, chưa huấn luyện hoặc tinh chỉnh mô hình**. Tên Việt hóa và thành phẩm từng dạng cần duyệt khi có bản cụ thể.

## 12. Thiết kế để chỉnh kỹ năng sau

Đây là hướng đã thống nhất: làm đầy đủ vòng chơi trước, chỉnh bộ kỹ năng từng loài sau, không phải viết lại hệ thống mỗi lần đổi số.

1. **Cấu hình từng loài:** mã loài/kỹ năng, loại sự kiện, xác suất, lượng thưởng, mốc tích lũy, hạn mức và điều kiện mở khóa.
2. **Logic cơ chế dùng chung:** thưởng task, thưởng habit, đếm ngày, hoàn tổn thất, bảo hộ, lựa chọn kết quả quay. Sửa thông số dùng lại logic này; thêm cơ chế mới thì cần bổ sung và kiểm tra.
3. **Dữ liệu từng cá thể:** ID sở hữu, dạng, điểm thực/xám, trạng thái lượt luyện, kỹ năng đủ điều kiện và bộ đếm. Không mất thú hay độ thuần chỉ vì cân chỉnh skill.
4. **Phiên bản kỹ năng:** thay đổi áp dụng sự kiện mới. Thưởng đã nhận giữ nguyên; tuyệt kỹ đang chạy dùng hết luật cũ rồi mới chuyển phiên bản. Không tự tái phát phần thưởng khi đổi cấu hình.

Đổi 50% thành 40%, 20 task thành 25 task hoặc thay lượng thưởng là việc cấu hình. Đổi từ thưởng task sang cơ chế thưởng habit đã có cũng tái sử dụng được. Thêm cơ chế chưa từng có như can thiệp luật tháp cần viết thêm logic, xử lý dữ liệu và kiểm tra tương ứng.

## 13. Những hướng cũ không dùng để triển khai

| Ý tưởng trước đây | Quyết định dùng hiện tại |
| --- | --- |
| Mỗi ngày trượt trừ cố định 5% thuần | Chia điểm thực/xám theo tỷ lệ habit đạt trong ngày. |
| Chỉ đủ toàn bộ habit mới có điểm; thiếu thì +0 toàn bộ | Vẫn có điểm phần đã làm, phần còn thiếu thành xám. |
| Khóa danh sách habit suốt lượt luyện | Cho thay đổi theo ngày hiệu lực của hệ thống habit. |
| Task làm tăng tốc luyện | Chỉ habit ảnh hưởng luyện thú. |
| Đổi con thì quay về đầu mốc rồi có thể luyện tiếp | Khóa vĩnh viễn lượt cũ tại tiến độ hiện có; muốn làm lại cần đan. |
| Gọi buff nhận tài nguyên là Công | Dùng thiên phú/buff, Thức tỉnh và tuyệt kỹ. |
| Tăng nhẹ chỉ số là toàn bộ lợi ích của 100% | Mở tuyệt kỹ đặc trưng và ngoại hình hoàn mỹ. |
| 4 UR, 8 SSR, 12 SR, 12 R hoặc tám SR | Bộ 2 UR, 4 SSR, 6 SR, 6 R. |
| RR là rank mới | RR chính là R. |
| Tầng 2 tháp thưởng 5 vé | Tổng 3 vé thường. |
| Tầng 4 cộng thêm hai vé ngoài tầng 3 | Tổng hai vé triệu hồi khi dừng tầng 4. |
| Vé/tu vi thưởng lẻ | Thanh toán nguyên; xác suất và bộ đếm cho phép phân phối thưởng. |

## 14. Kiểm chứng và nghiệm thu

Các luật điểm, ngày cuối, đan, thú trùng và tháp đã được duyệt. Không hỏi lại các quyết định này. Checklist triển khai dưới đây đã có bằng chứng trong [hồ sơ nghiệm thu](LINH_THU_ACCEPTANCE.md); bản hiện tại đã được duyệt và phát hành staging. Ảnh95%/100% dùng tạm, cân bằng skill có thể điều chỉnh ở đợt sau:

- Hoàn thiện và kiểm chứng mọi đường UI → API → DB → receipt → UI, toàn bộ 18 bộ kỹ năng và tác dụng kết hợp.
- Kiểm lịch quota tuần, sửa/khôi phục habit, các ranh giới ngày/tuần, quyết toán trễ, replay, auth, concurrency, rollback và nâng cấp/khôi phục DB.
- Kiểm tra giao diện thật, chữ lớn, bàn phím, giảm chuyển động, sáng/tối và mất mạng theo goal.
- Cân bằng toàn bộ nguồn vé/tu vi và tốc độ nhận thú sau khi vòng chơi chạy được; bộ skill hiện tại là baseline để bắt đầu.
- Ảnh vẽ lại/hoạt ảnh, tên Việt hóa và các biến thể hoàn mỹ cần bản mẫu thực tế để duyệt.

## 15. Tài liệu và phạm vi đã làm

| Tài liệu | Vai trò |
| --- | --- |
| Tài liệu này | Tổng hợp quyết định, công thức, vòng chơi và các khoảng trống. |
| [LINH_THU_SKILLS.md](LINH_THU_SKILLS.md) | Toàn bộ kỹ năng với tên, con số, tương tác và phép tính cân bằng sơ bộ. |
| [LINH_THU_REFERENCES.md](LINH_THU_REFERENCES.md) | Nhận diện 18 loài, nguồn mẫu và quyết định phân rank/thứ tự dạng. |
| [LINH_THU_ART_DIRECTION.md](LINH_THU_ART_DIRECTION.md) | Hướng vẽ lại và bản hoàn mỹ theo từng loài. |
| [Asset tham chiếu](assets/linh-thu/reference/README.md) | 72 ảnh nguồn, bảng ảnh và thông tin truy xuất. |
| [HABITS.md](HABITS.md) | Hành vi habit đang có; không đồng nhất thiết kế mới với runtime. |

Đã có runtime mới, đủ72dạng thường  +18thức tỉnh  +18hoàn mỹ, migration 0041 đã áp và Worker staging đã phát hành sau xác nhận riêng. Tham chiếu giữ nguyên; ảnh95%/100% dùng tạm. Quyền triển khai theo goal là ngoại lệ có phạm vi cho quy tắc xác nhận từng file; xem [kế hoạch và tiến độ](LINH_THU_IMPLEMENTATION.md), [bằng chứng phát hành](LINH_THU_RELEASE.md).
