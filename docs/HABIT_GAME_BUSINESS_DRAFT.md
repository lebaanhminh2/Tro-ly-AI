# VÔ DANH — THẦN LỘ
## Hồ sơ nghiệp vụ mở để AI agent khảo sát sản phẩm và lập kế hoạch

> **Vai trò tài liệu:** Mô tả *sản phẩm cần đem lại trải nghiệm gì, người chơi làm gì, các quy luật liên hệ ra sao, nội dung game có những gì và những vấn đề phải quyết định*. Đây **không phải** technical design, database schema, API contract, backlog, danh sách test hoặc bảng cân bằng cố định.
>
> **Trạng thái:** Bản biên tập từ các trao đổi thiết kế. Dùng ba ký hiệu: **[Đã thống nhất]** cho định hướng do chủ sản phẩm xác nhận; **[Đề xuất]** cho giải pháp có thể chỉnh; **[Cần quyết định]** cho lựa chọn phải hỏi chủ sản phẩm hoặc nghiên cứu codebase trước khi lập kế hoạch. Không biến ví dụ mô tả thành hằng số production.
>
> **Đọc trước khi lập plan:** Phải xem ứng dụng hiện tại và trao đổi với chủ sản phẩm về các điểm còn mở. Tuyệt đối không mặc định game mới được phép viết lại hệ thống Tu Vi, đột phá, task, streak hay thuật toán xếp lịch đang hoạt động.

---

# 1. Tầm nhìn và ranh giới sản phẩm

**VÔ DANH — THẦN LỘ** là phần game tu tiên dài hạn của một ứng dụng quản lý công việc cá nhân. Người chơi khởi đầu gần như tay trắng, tăng Tu Vi bằng công việc thật, rèn tuyệt học bằng thói quen thật, quyết định thời điểm đem công pháp đã luyện đi thách đấu boss, săn bí tịch và thần binh, rồi tiến đến thành tựu cuối **DIỆT THẦN**.

**Giá trị trải nghiệm cần giữ:**

1. **Khao khát sở hữu:** Một công pháp ẩn hoặc thần binh được giới thiệu rất lâu trước khi người chơi giành được, có ngoại hình, giai thoại và sức mạnh khiến việc sở hữu đáng nhớ.
2. **Sức mạnh do đầu tư thật:** Một bản công pháp được luyện nhiều tuần/tháng có giá trị bền vững; tinh thuần và lựa chọn tu luyện tạo khác biệt thật trong chiến đấu.
3. **Đấu boss có quyết định:** Boss có HP, phản công, các ngày mạnh/yếu, đặc tính dễ nhớ; mỗi ngày chọn một trong tối đa năm công pháp, không cần điều khiển nhân vật 3D.
4. **Rủi ro có chủ đích:** Có thể rút lui, cố chiến, tiêu Tu Vi cứu mạng, hoặc dùng đại cấm thuật hiến tế Cảnh giới. Không biến việc bận, nghỉ ngơi hoặc ốm thành án phạt tự động.
5. **Chơi rất dài nhưng từng trận ngắn:** Một boss thường chỉ vài ngày, boss đặc biệt tối đa khoảng hai tuần. Hành trình 1–3 năm hình thành từ hàng loạt đối thủ, lựa chọn luyện công pháp, truyền thừa và bí mật — không phải một thanh HP kéo dài nhiều tháng.

**Ứng dụng gốc đã có:** người dùng tạo task/deadline/thời lượng dự kiến, khai báo khoảng rảnh, thuật toán tự xếp lịch và ưu tiên; người dùng tick hoàn thành. Task sinh Tu Vi; Cảnh giới/đột phá, streak ngủ sớm, điểm danh, gacha, vật phẩm và túi đồ đã có. Hầu như không biết chính xác thời gian thực làm task, mức tập trung hay mức độ hoàn thành thật ngoài tick tự khai báo.

**Không thuộc phạm vi của feature mới:** thay thế lịch tự động; bắt người dùng nhập lại task, đoán giờ thực làm việc, giả định dữ liệu focus/GPS, bắt chơi minigame thời gian thực; phát minh thêm hệ tiền tệ phức tạp; thay thế streak ngủ sớm hoặc hệ đột phá; dùng game để trừng phạt việc nghỉ ngơi hợp lý.

# 2. Các khái niệm cần nhất quán

| Khái niệm | Ý nghĩa nghiệp vụ |
|---|---|
| **Task** | Công việc thật trong scheduler; hoàn thành luôn thưởng Tu Vi theo cơ chế gốc. Khi chiến đấu, còn góp một phần uy lực ngày. |
| **Habit** | Thói quen có lịch đến hạn, được người dùng xác nhận hoàn thành; **nguồn chính** để luyện công pháp hoặc gia tăng uy lực thi triển. |
| **Tu Vi / Cảnh giới** | Tiến trình nhân vật của app cũ; quyết định nền tảng HP, công/thủ, độ chênh sức mạnh. Không đồng nhất với tầng công pháp. |
| **Công pháp** | Một kỹ năng có bản sắc chiến đấu duy nhất; được tìm bí tịch, tu luyện theo nhiều tầng, lưu độ tinh thuần và phiên bản luyện. |
| **Tầng công pháp** | Nhập môn, Tiểu thành, Đại thành, Viên mãn (tên gợi ý hiện dùng). Chủ yếu tăng mức hiệu quả, không tạo cây kỹ năng mới. |
| **Độ tinh thuần** | Chất lượng một bản luyện; khuyết điểm tầng trước ảnh hưởng giới hạn tổng thể các tầng sau. Không phải cùng một chỉ số với tiến độ luyện. |
| **Tu Luyện** | Trạng thái dùng habit để luyện **một** công pháp, không tiến hành giao chiến. Không gọi “Bế Quan” trên UI. |
| **Xuất Chiến** | Trạng thái thách đấu boss qua các ngày; habit và một phần task giúp công pháp đang chọn mạnh hơn. Không tăng tiến độ luyện công pháp trong trạng thái này. |
| **Bộ năm** | Tối đa năm bản công pháp mang vào một trận, chọn **một** để thi triển mỗi ngày. |
| **Trấn phái** | Tuyệt học đặc biệt của một phái; cũng là một công pháp phải tìm, học, luyện, trang bị. Không phải buff riêng hay hệ đột phá mới. |
| **Ngoại Đạo / Đạo thống ẩn** | Truyền thừa ngoài năm phái cơ bản; công pháp Ngoại Đạo **khó luyện gấp đôi** theo định hướng đã chọn. |
| **Cấm thuật** | Một loại công pháp thật sự có tầng và tinh thuần, cực kỳ khác thường, thường có cái giá/giới hạn lớn; vẫn chiếm ô và một ngày thi triển. |
| **Ngày giao chiến** | Một chu kỳ người chơi chọn công pháp, làm hoạt động thực tế và giải quyết đòn người trước — boss sau. Khác với mọi ngày trên lịch khi trận được phép tạm nghỉ. |

---

# 3. Vòng đời người chơi và hai trạng thái

**[Đã thống nhất]** Người chơi mới **không cần có sẵn công pháp**. Họ có Tu Vi/Cảnh giới từ hệ gốc, học cách thách đấu bằng **Võ Kỹ Cơ Bản** ở chương đầu, sau đó mới tìm và luyện công pháp theo sở thích. Võ Kỹ Cơ Bản là giải pháp nhập môn, không phải công pháp thứ 40 phải luyện lâu.

## 3.1. Tu Luyện

- Chọn **duy nhất một** công pháp đã mở bí tịch để luyện. Có thể dừng rồi tiếp tục về sau; tiến độ đã tích được bảo toàn.
- Chỉ **habit đến lịch** đóng góp vào tiến độ và độ tinh thuần. **Task không luyện công pháp**. Task vẫn tăng Tu Vi gốc như thường.
- Người có **một habit** vẫn học mọi công pháp và có thể tạo bản **100% tinh thuần**. Không bắt buộc tạo nhiều thói quen.
- Có nhiều habit *hợp lệ* thì được hệ số tăng tốc theo các mốc số lượng habit. Nhưng hoàn thành ít % trên tổng habit đến hạn thì tiến độ/ngày tương ứng giảm; không thể tạo vô số habit rồi mặc nhiên tăng tốc.
- Mỗi tầng có độ tinh thuần được xác lập trong khoảng thời gian luyện của tầng đó. Hoàn thành tầng thì khóa chất lượng tầng. Muốn thay đổi phẩm chất của cả công pháp phải **luyện lại từ tầng 1**, giữ phiên bản cũ, không sửa tầng lẻ.
- Khi một tầng được hoàn thành đến mức sử dụng được, phiên bản công pháp đó có thể đem vào chiến đấu; không bắt người chơi chờ đến Viên mãn.

**Cách hình dung không cố định công thức:** Ngày có 4 habit đến hạn, hoàn thành 2 → chất lượng thực hiện ngày đó là 50%; ngày có 1 habit đến hạn, hoàn thành 1 → 100%. Tốc độ luyện được nhân theo mốc số habit đã đủ điều kiện. **Tiến độ** và **độ tinh thuần** phải được xử lý khác nhau: tốc độ giúp học nhanh; không biến một ngày 50% thành ngày luyện hoàn mỹ.

**[Cần quyết định]** Mốc hệ số cụ thể, thế nào là “habit hợp lệ”, phạm vi thời gian để tính số habit, cách chốt ngày không có habit đến hạn và cách xử lý ngày nghỉ phải được chốt khi hiểu mô hình habit thật. Không coi các mốc tốc độ thử nghiệm trước đây là giá trị cố định.

## 3.2. Xuất Chiến

- Chọn boss, trang bị tối đa **5 công pháp đã sử dụng được**, xác nhận bắt đầu trận. Bộ năm thường được khóa trong trận; chỉ có ngoại lệ được mô tả rõ bởi công pháp đặc biệt.
- Mỗi ngày nhìn thấy dự báo hành động của boss, chọn **một công pháp duy nhất**. Từ đó đến lúc kết toán, habit hoàn thành và phần đóng góp nhỏ từ task tăng hiệu lực cho công pháp ấy.
- Hết ngày giải quyết theo thứ tự người ra đòn trước, boss còn sống mới phản công. HP và hiệu ứng tiếp tục sang ngày kế tiếp; trận kết thúc bằng thắng, rút lui, hết thời hạn hoặc tử trận.
- Trong chiến đấu **không cộng tiến độ luyện công pháp**. Song task vẫn cho Tu Vi nguyên bản, hệ thống streak ngủ sớm vẫn vận hành.

**Không được mặc định:** Người dùng sẽ liên tục nhìn app để chiến đấu. Việc chọn công pháp/ngày là một quyết định ngắn; phần còn lại người dùng vẫn làm task/habit theo lịch tự động.

## 3.3. Chuyển trạng thái và tránh tính hai lần

**[Đã thống nhất]** Một hoạt động habit không thể vừa luyện công pháp vừa tích uy lực đánh boss trong cùng chu kỳ ghi nhận. Khi tham gia trận, phần luyện tạm dừng, không bị tính là bỏ buổi luyện.

**[Cần quyết định cùng owner]** Thời điểm chuyển Tu Luyện ↔ Xuất Chiến có hiệu lực (ngay trước lần ghi nhận đầu tiên của ngày, từ ngày kế tiếp, hay theo phiên đóng góp). Mục tiêu nghiệp vụ: dễ hiểu, không tính trùng, không phạt vì thay đổi trạng thái giữa ngày, không tạo kẽ hở đảo trạng thái để farm.

---

# 4. Tu luyện công pháp: tiến độ, phẩm chất, bản luyện

## 4.1. Bốn tầng nhưng không thêm bốn bộ chiêu

Một công pháp được luyện qua các tầng **Nhập môn → Tiểu thành → Đại thành → Viên mãn**. Cùng một đặc trưng chiến đấu xuyên suốt; tăng tầng làm sát thương, giáp, hồi phục hoặc hiệu suất đặc trưng tăng lên. Độ tinh thuần cũng làm chất lượng đặc trưng tăng. Không cần mở 3–4 chiêu con ở các mốc %.

- **Tiến độ:** Trả lời *còn bao lâu hoàn thành tầng này?*
- **Tinh thuần tầng:** Trả lời *mình giữ cam kết habit tốt đến đâu trong thời gian luyện tầng này?*
- **Tinh thuần toàn công pháp:** Tổng hợp chất lượng từng tầng có tính **lan truyền khuyết điểm**; tầng sau hoàn hảo không xóa lỗi của tầng trước.
- **Phiên bản luyện:** Cùng một công pháp có thể có bản 82%, 95%, 100% từ những lần luyện khác nhau. Lưu cả lịch sử, nhưng **không cộng dồn** chỉ số các bản với nhau. Khi dùng, chọn một bản cụ thể.
- **100%:** Đích đáng khao khát, mạnh trong đúng sở trường, có biểu hiện/danh hiệu đẹp; không cần tự động tạo thêm skill phụ khiến người chơi khó nhớ.

**[Đề xuất]** Có thể tổng hợp tinh thuần theo phép nhân chất lượng các tầng hoặc một cách tính suy giảm khác có tính truyền khuyết. Nhưng phải kiểm tra mức độ phạt, bởi “mỗi tầng 95%” khi nhân bốn tầng cho ra khoảng 81,5%, có thể làm người dùng cảm thấy nản. *Giữ tinh thần khuyết điểm tích lũy, không mặc định phép nhân là giải pháp duy nhất.*

## 4.2. Độ khó các nhóm

- **Công pháp thường**: mốc chuẩn tùy công pháp; đại thể hành trình nhiều tuần, có thể 1–2 tháng để luyện sâu.
- **Trấn phái**: khó/hiếm ở **quyền nhận bí tịch và thử thách truyền thừa**, không bắt buộc nhân chi phí tu luyện khi chưa được đồng ý.
- **Ngoại Đạo**: **chi phí luyện ×2 so với chuẩn tương đương**. Đây là độ khó của mỗi thức, không buộc học trọn cả bộ.
- **Cấm thuật**: có đủ tầng và tinh thuần như công pháp thường; hệ số độ khó **chưa chốt**, không tùy tiện ép bằng Ngoại Đạo.

## 4.3. Ngăn sai lệch mục tiêu thói quen

- Thói quen có lịch lặp khác nhau chỉ tính vào mẫu số khi **đến hạn**. Không phạt hôm nghỉ đúng lịch.
- Ngày có habit đến hạn mà không hoàn thành phải được ghi nhận phù hợp, không được lặng lẽ loại khỏi dữ liệu tinh thuần để “lọc ngày đẹp”.
- Ngày không có habit nào đến hạn cần đối xử trung tính; không tự động xem là thất bại.
- Một habit ảo tạo xong trong ngày không nên lập tức giúp tăng mốc tốc độ; việc tính mốc dựa trên **tần suất, thời gian duy trì và lịch hợp lệ**, không dựa hoàn toàn số dòng trong danh sách.
- Không thưởng xứng đáng hơn chỉ vì một người tạo hàng chục habit quá nhỏ hoặc chia một habit thành nhiều bản sao.
- Nếu ngủ sớm đã là streak độc lập, không tự động gộp thêm lần nữa vào việc luyện trừ khi người dùng thực sự đăng ký nó là habit phù hợp.

**[Cần quyết định]** Người dùng được tạo habit tùy ý hay hệ thống gợi ý; chỉnh/xóa lịch habit giữa tầng có ảnh hưởng gì; tỷ trọng các habit có bằng nhau không; pause do ốm/nghỉ phép xử lý ra sao. Giải pháp nên bảo vệ động lực hành vi khỏe mạnh trước khi tối ưu “100% hoàn mỹ”.

---

# 5. Luật giao chiến giữa các ngày

## 5.1. Những điều người chơi cần thấy

Đầu ngày giao chiến, màn hình phải trả lời nhanh: **Boss sắp dùng gì? Nguy hiểm đến đâu? Mình còn HP nào? Trong năm công pháp nên chọn chiêu nào?**

Boss có HP, phòng ngự, số đòn đánh dự kiến và trạng thái hôm nay. Trạng thái thay đổi theo ngày, chẳng hạn cường công (nguy hiểm nhưng sơ hở), thủ thế (chịu đòn tốt nhưng ít tấn công), hồi sức hoặc thần thông đặc biệt theo tính cách boss. Không cần tất cả boss đều có giáp/phân thân/hồi sinh. Công pháp thường **phải hữu dụng ngay cả khi boss không có kỹ năng hiếm**.

## 5.2. Thứ tự giao chiến đã thống nhất

1. Ngày đó có một ý định ra chiêu của boss và một công pháp được người chơi chọn.
2. Cuối chu kỳ, tính đóng góp task/habit và hiệu quả những trạng thái hợp lệ còn từ các ngày trước.
3. **Người chơi đánh trước**, gây sát thương và hiệu ứng của công pháp đang dùng. Nếu boss chết và không có cơ chế hồi sinh đã báo trước, **thắng ngay**, boss không đánh lượt đó.
4. Nếu boss sống, boss đánh theo **các hit thực tế**. Giáp, khiên, giảm sát thương, né và phản thương cần phân biệt rõ để không tính sai.
5. Nếu HP người chơi về 0, chuyển sang tình huống lựa chọn cứu mạng/tử trận khi còn hợp lệ. Nếu sống, cập nhật trạng thái và tiến sang ngày giao chiến tiếp theo.
6. Nếu hết hạn mà chưa thắng, xử lý thất bại do thời hạn **khác với tử trận**.

Trường hợp một cấm thuật/kiếm thức cần biết sức mạnh boss *sắp gây hôm nay*, hiệu lực được tính dựa trên **ý định chiến đấu đã xác lập trước lúc người chơi tấn công**. Không được cho boss tùy tiện sửa sát thương sau khi nhìn thấy công pháp người chơi chỉ để triệt tiêu hiệu ứng này.

## 5.3. Hai dạng đóng góp từ đời thật

- **Habit là chính.** Hoàn thành những habit đến hạn tạo phần lớn hiệu quả công pháp trong ngày; không hoàn thành có thể khiến chiêu yếu đi, nhưng không làm công pháp đã luyện mất cấp.
- **Task là phụ trợ.** Việc hoàn thành task vẫn tăng Tu Vi gốc; trong Xuất Chiến nó có thêm phần đóng góp nhỏ vào sức đánh. Không nhân thưởng task vô hạn hoặc thay thuật toán xếp lịch để farm damage.
- **Cảnh giới, tầng, độ tinh thuần và công pháp** cùng ảnh hưởng kết quả, nhưng có vai trò khác nhau: Cảnh giới là nền tảng, tầng là quy mô, tinh thuần là hiệu suất, công pháp là cách đánh.
- **[Cần quyết định]** Tỷ trọng đóng góp cụ thể, cách quy đổi task rất lớn và task rất nhỏ, cách tính ngày không có habit/task đến hạn; không đưa con số cố định trong hồ sơ nghiệp vụ.

## 5.4. Nhịp và độ dài trận

- Boss mở đầu/boss thường: khoảng **3–5 ngày giao chiến**.
- Boss chương: khoảng **5–7 ngày**.
- Boss thần cấp cao hoặc chung cuộc: có thể kéo dài hơn, **tối đa khoảng 14-17 ngày giao chiến**.
- Boss có thể thay đổi cách đánh theo HP, ngày, chiêu người chơi dùng trước đó, nhưng cần **cảnh báo để lựa chọn có thông tin**. Bất ngờ là biến cố chiến thuật, không phải sát thương bí mật làm tụt cảnh giới.
- **[Đề xuất]** Cho ngày nghỉ/trì hoãn có giới hạn và cơ chế tự rút khỏi trận nếu người chơi vắng lâu; không tự làm nhân vật chết vì app đã không được mở. Quy định thời hạn theo **ngày giao chiến đã giải quyết**, không tự động coi mọi ngày nghỉ ngoài đời là ngày bị boss đánh.

## 5.5. Kết quả, tổn thất, quyết định cứu mạng

| Tình huống | Nghiệp vụ mong muốn |
|---|---|
| **Thắng** | Boss chết trước phản công, nhận chiến tích/cốt truyện/quyền nhận phần thưởng đã đủ điều kiện. |
| **Rút lui chủ động** | Giữ công pháp và Tu Vi hiện có, bỏ tiến độ trận boss; lần sau thách đấu lại. |
| **Hết ngày giới hạn** | Chưa thắng nhưng không tử trận: không phạt Tu Vi như chết, có thể quay lại sau khi chuẩn bị tốt hơn. |
| **HP về 0 lần đầu** | Có **một quyền Hộ Mệnh bằng Tu Vi** cho cả trận. Người chơi có thể chọn trả giá để hồi HP và đánh tiếp, hoặc chấp nhận tử trận. |
| **Nghịch Mệnh Hoán Sinh** | Nếu được trang bị **và đã chọn làm chiêu của ngày đó**, có thể thay Hộ Mệnh bằng cách **hạ một đại cảnh giới** để hồi sinh kèm buff/debuff. |
| **Lại về 0 HP sau khi đã cứu** | Tử trận thật, không hồi sinh liên tục bằng cách trả thêm Tu Vi. |
| **Tử trận thật** | Mất một lượng Tu Vi hợp lý, có thể tụt cảnh giới nếu vượt ngưỡng; không xóa công pháp, thần binh hay thành tựu đã giành được. |

**Phân biệt hai giá phải trả:** Hộ Mệnh *trừ Tu Vi*; Nghịch Mệnh *hiến một đại cảnh giới*, **không thêm khoản trừ Tu Vi để kích hoạt**. Cả hai dùng chung một lượt cứu mạng/trận. Mức Tu Vi mất và % HP hồi là thông số cần cân bằng.

**[Vấn đề nghiệp vụ rất quan trọng]** App hiện tại có thể suy ra Cảnh giới từ Tu Vi. Nếu đốt một đại cảnh giới mà giữ nguyên Tu Vi thì dễ lập tức được nhận diện là đã lên lại; nếu trừ Tu Vi lại mâu thuẫn yêu cầu “chỉ hạ Cảnh giới, không đốt Tu Vi”. Cần hỏi chủ sản phẩm **“hạ Cảnh giới có hiệu lực trong bao lâu, điều kiện tái đột phá là gì, có tác động tới các phần thưởng/tính năng của app gốc không?”** trước khi giao agent thiết kế lưu trữ. Tuyệt đối không tự ý thay hệ đột phá đã có.

**[Vấn đề khác]** Nếu sau khi thấy HP 0 mới được rút lui mà không mất gì, lựa chọn tử trận hoàn toàn vô nghĩa. Quyền rút lui chỉ ở giai đoạn **trước khi kết toán**; sau khi HP chạm 0 chỉ còn cứu mạng hợp lệ hoặc tử trận.

---
# 6. Năm phái cơ bản — danh mục và bản sắc

**[Đã thống nhất về hướng]** Có năm đại phái cơ bản. Mỗi phái hiện có bốn công pháp thường và một **trấn phái**. Người chơi không bị khóa cứng vào nghề/phái: chuyên tu một phái hoặc phối hợp công pháp của nhiều phái (Dị Giáo) đều phải có đường thắng.

**Nguyên tắc thiết kế bắt buộc khi mở rộng danh mục:** Một phái có thể thắng boss chỉ bằng công pháp của chính phái đó. Trấn phái không biến bốn công pháp đầu thành đồ bỏ đi. Không có chiêu thường nào chỉ hoạt động khi boss sở hữu một tính năng hiếm cụ thể (ví dụ “chỉ phá phân thân”); nếu có sở trường khắc chế, vẫn phải có tác dụng cơ bản trước mọi boss.

## 6.1. Thiên Kiếm Tông — Sát phạt trực tiếp

| Công pháp | Điều làm nó đáng chọn | Điều không làm tốt |
|---|---|---|
| **Kiếm Ý** | Chém xuyên phòng ngự, hiệu quả với địch giáp dày | Không tận dụng tối đa những ngày boss hoàn toàn lộ sơ hở |
| **Liên Vân Kiếm** | Một ngày ra nhiều nhát; sát thương chia theo hit, chống né từng phần | Dễ kém hiệu quả trước phòng ngự áp dụng trên từng hit |
| **Tuyệt Mệnh Kiếm** | Càng gần lúc boss gục, khả năng kết liễu càng cao | Giai đoạn boss nhiều HP kém các lựa chọn khác |
| **Vô Hồi Kiếm** | Dồn lực gây sát thương rất cao ngay | Đánh đổi bằng nguy cơ hứng phản kích nặng |
| **Kiếm Vực Khai Thiên** — trấn phái | Dựng kiếm vực: trong vài ngày tiếp, những **kiếm thuật thi triển sau đó** được tăng hiệu quả | Ngày tạo kiếm vực không phải ngày gây sát thương tốt nhất; không chồng nhiều kiếm vực; một lần/trận là hướng giới hạn phù hợp |

**Cách chơi thuần phái:** Chọn nhịp mở kiếm vực, phá phòng ngự, ép HP xuống thấp rồi kết liễu. Kiếm Vực không tự sinh damage vô hạn và không giúp các cấm thuật ngoài kiếm đạo hưởng buff mặc định.

## 6.2. Bất Diệt Sơn — Lấy thủ nuôi công

**Cương Kình:** Nguồn lợi thế chiến đấu sinh ra từ việc **thật sự ngăn được sát thương** nhờ công pháp phù hợp. Có giới hạn chứa; không nhận vô hạn từ một boss quá mạnh. Người chơi không phải nhập thêm habit để tạo Cương Kình.

| Công pháp | Điều làm nó đáng chọn | Điều không làm tốt |
|---|---|---|
| **Bất Diệt Kim Thân** | Vừa đánh vừa giảm sát thương, có thể tích Cương Kình | Đòn đánh trực tiếp không mạnh |
| **Huyền Quy Chân Kinh** | Gây đòn nhẹ, tạo khiên tồn tại sang ngày kế; che chắn cho chu kỳ sau | Khiên không cộng dồn vô hạn; không thay thế việc tạo Cương Kình |
| **Phản Chấn Quyết** | Đánh và phản lại một phần sát thương boss thực sự tung | Nếu boss yếu hoặc bị kết liễu trước khi đánh, phản thương ít/không xảy ra |
| **Trấn Sơn Quyền** | Tiêu Cương Kình đang có để tung cú đánh mạnh | Không có Cương Kình thì chỉ là một đòn trung bình; phòng thủ không tốt |
| **Bất Diệt Chiến Thể** — trấn phái | Vừa tấn công khá tốt vừa giới hạn tổn thất HP khi phải chịu một ngày tấn công khắc nghiệt | Cần tiêu Cương Kình, không sinh thêm Cương Kình; kém hiệu quả khi boss đánh nhẹ; không phải “miễn nhiễm miễn phí mỗi ngày” |

**Phân vai cần giữ:** Kim Thân = tạo Cương Kình; Huyền Quy = chuẩn bị lớp khiên; Phản Chấn = trừng phạt địch đang đánh mạnh; Trấn Sơn = tiêu Cương Kình lấy sát thương; Chiến Thể = dùng Cương Kình để **vừa đánh vừa sống sót** trong ngày nguy hiểm. Đây là năm lựa chọn khác nhau, không phải năm cấp sức mạnh.

## 6.3. U Minh Điện — Sinh mệnh làm vũ khí

| Công pháp | Điều làm nó đáng chọn | Điều không làm tốt |
|---|---|---|
| **Thôn Thiên Ma Công** | Gây thương tích đồng thời hút lại HP | Hồi có trần; khi bản thân đầy máu thì phần hút ít giá trị |
| **Huyết Sát Quyết** | Chủ động hiến HP để đánh mạnh | Có thể tự đưa mình vào vùng chết trước phản kích |
| **Minh Hà Huyết Chú** | Đánh và gây chảy máu kéo dài vài ngày | Không chồng nhiều chú độc lập để nhân damage vô hạn |
| **Tàn Mệnh Chỉ** | Đòn mạnh rõ rệt khi bản thân ở ngưỡng HP thấp | Khó phát huy mà vẫn an toàn nếu boss chuẩn bị cường công |
| **Huyết Hải Phần Thiên** — trấn phái | Hiến một phần **HP tối đa của chính mình** trong trận để làm tổn hại **HP tối đa boss** | Không thể bào đến 0 HP tối đa; trả giá sống còn, kém hợp lý nếu boss gần chết |

**Cách chơi thuần phái:** Tìm điểm cân bằng giữa hút lại máu, hiến máu và gây vết thương dai dẳng. Cấm thuật hạ cảnh giới **không mặc nhiên thuộc** các kỹ năng thường của U Minh Điện, dù lore có thể liên quan tà tu.

## 6.4. Thái Hư Cung — Hư Ảnh: công, thủ hoặc cứu mạng

**Hư Ảnh:** Tối đa một, được tạo bằng Hư Không Tạng; có tác dụng đỡ một phần sát thương nếu giữ lại, hoặc tiêu hao để kích hoạt hiệu ứng tốt hơn. Chỉ tồn tại trong quãng ngắn, không tích được một đội quân phân thân.

| Công pháp | Điều làm nó đáng chọn | Điều không làm tốt |
|---|---|---|
| **Thái Hư Bộ** | Gây sát thương vừa, né một phần sát thương boss **ngay ngày sử dụng** | Không tích lợi thế cho ngày sau |
| **Hư Không Tạng** | Gây sát thương vừa, tạo Hư Ảnh cho ngày kế | Đánh không bùng nổ; tạo lại khi đã có Hư Ảnh không được nhân số lượng |
| **Không Minh Trảm** | Gây sát thương chủ động; tiêu Hư Ảnh để đánh rất mạnh | Mất Hư Ảnh bảo vệ; phải chuẩn bị trước để đạt đỉnh |
| **Hoán Hình Thuật** | Đánh nhẹ và hồi HP; tiêu Hư Ảnh để hồi mạnh hơn | Chọn hồi máu đồng nghĩa bỏ cơ hội dùng ảnh để gây đòn lớn hoặc thủ |
| **Vạn Pháp Quy Hư** — trấn phái | Tiêu Hư Ảnh để tránh sát thương **trực tiếp** rất nguy hiểm trong ngày | Sát thương chủ động thấp; không vô hiệu hóa hiệu ứng độc/chảy máu còn từ trước; không tự tạo Hư Ảnh |

**Khác với ý tưởng cũ đã bỏ:** Không vay chiến lực của ngày mai; không có cơ chế “hoãn đòn boss hôm nay sang ngày mai” khiến spam liên tục. Hư Không Tạng luôn có chút damage dù không sinh được ảnh mới. Trấn phái không thay được Không Minh Trảm (công mạnh) hoặc Hoán Hình (hồi HP).

## 6.5. Thiên Cơ Các — Ép đối thủ đi theo nhịp mình tạo

Không tạo hệ Mệnh Ấn phức tạp; không được spam khóa boss đứng yên. Đặc trưng là **tác động có giới hạn lên thế đánh hôm nay/ngày sau**.

| Công pháp | Vai trò | Ranh giới chống lỗi |
|---|---|---|
| **Quan Thiên Chỉ** | Đòn đánh ổn định và **soi trước nhịp hai ngày giao chiến kế tiếp** để từ hôm nay quyết định có nên chuẩn bị thế công/thủ | Không chỉ xem chiêu của *ngày mai* vốn sẽ được công bố miễn phí khi sang ngày. Nếu trận sắp hết hoặc hành động boss đã quá dễ đoán, chiêu vẫn gây sát thương cơ bản nhưng kém các chiêu chuyên công. |
| **Lạc Tử Ấn** | Đặt một thế cờ: boss đổi thế ngày sau thì người chơi hưởng ưu thế tấn công; boss giữ thế thì sức tấn công của hắn bị bất lợi nhỏ | Chỉ một ấn đang hoạt động, không tích vô hạn |
| **Dẫn Kiếp Chỉ** | Khiêu khích boss đi vào ngày cường công kế tiếp: nguy hiểm hơn nhưng phòng ngự lộ sơ hở | Không cộng dồn, không cưỡng chế boss liên tục bỏ cơ chế đặc biệt |
| **Thất Tinh Sát** | Tận dụng ngày boss cường công để đánh mạnh | Có rủi ro nhận đòn lớn hơn, không tự động thắng |
| **Nghịch Thiên Kỳ** — trấn phái | Đổi vị trí hai hành động hợp lệ của boss giữa **hôm nay và ngày giao chiến tiếp theo** | Không xóa mất hành động; không hoán đổi vô hạn, không “đẩy đại chiêu ra ngoài trận” để vô hiệu hóa miễn phí |

**[Đã sửa hướng, vẫn cần chốt khi thiết kế encounter]** Quan Thiên soi trước **hai ngày** để hỗ trợ việc chuẩn bị từ hôm nay, thay vì chỉ tiết lộ điều ngày mai mọi người vốn đã thấy miễn phí. Dự báo cơ bản của người chơi vẫn đủ để tránh bị phạt oan; Thiên Cơ tạo tầm nhìn **xa hơn** hoặc thay đổi nhịp, không bán lại thông tin đã biết. Nếu trận không còn ngày kế tiếp thì Nghịch Thiên Kỳ cần tác dụng cơ bản hợp lý, không thể thành chiêu rỗng.

## 6.6. Cách tiếp cận công pháp và trấn phái

- Người chơi có thể học công pháp nhiều phái cùng lúc về **quyền sở hữu**; chỉ **một môn đang luyện** tại một thời điểm. Không có nghề/phái khóa vĩnh viễn.
- **[Đã thống nhất hướng mở khóa]** Mỗi phái có **bốn công pháp thường đã đạt Nhập môn** và một **boss truyền thừa**; hoàn thành điều kiện này mới **nhận quyền học trấn phái**. Trấn phái chưa tự có, vẫn phải bắt đầu Tu Luyện từ tầng đầu.
- Đây là **quá trình săn truyền thừa**, không tạo thanh “điểm môn phái” hay buff cộng dồn vì số công pháp cùng phái.
- Thuần phái mạnh nhờ các chiêu bổ trợ tự nhiên. Dị Giáo mạnh nhờ lựa chọn các đặc trưng của nhiều phái. Cả hai phải có đường chiến thắng, không bắt buộc học phái đối nghịch chỉ để xử lý một boss thiết kế thiếu cân bằng.
- **[Đề xuất]** Trấn phái có thể giới hạn một lần/trận. Tuy nhiên **không được coi giới hạn sử dụng là biện pháp cân bằng duy nhất**; chiêu vẫn phải có điểm yếu tự nhiên và cơ hội sử dụng khác bốn môn còn lại.

---

# 7. Tám cấm thuật — chiêu thật, cái giá thật

Cấm thuật được tìm thông qua cốt truyện, truyền thuyết và boss ẩn. Không phải vật phẩm tiêu hao hay buff ngoài trận. **Mỗi cấm thuật là một công pháp riêng**, có tầng, % tinh thuần, nhiều bản luyện và chiếm một ô trong bộ năm. Khi chọn dùng trong ngày, đó là **công pháp duy nhất được thi triển**, trừ những hiệu ứng từ ngày trước đã được kích hoạt đúng luật.

| Cấm thuật | Điều kỳ dị làm được | Giá phải trả / hạn chế nghiệp vụ |
|---|---|---|
| **Nghịch Mệnh Hoán Sinh** | Nếu bị đánh chết **trong ngày đã chọn cấm thuật**, tự hủy **một đại cảnh giới** để hồi sinh, nhận buff công/thủ và nguyền rủa sức mạnh, khả năng hồi máu của boss trong một quãng ngắn | Dùng chung quyền hồi sinh một lần/trận; không trừ Tu Vi để kích hoạt; không thể dùng khi không còn cảnh giới thấp hơn. Nếu chọn ngày nhưng không chết, không được hồi sinh miễn phí ngày sau. |
| **Thâu Thiên Hoán Mệnh** | Cướp một **phần giới hạn** tỷ lệ HP hiện tại của boss để hồi cho mình | Không được tráo đổi nguyên toàn bộ % HP. Có giới hạn bởi uy lực/cảnh giới, có chi phí HP tối đa của bản thân và không được kết liễu boss chỉ bằng chuyển đổi một lần. |
| **Táng Nhật Nhất Kích** | Dồn mạng sống vào một đòn công kích cực lớn; có thể thắng ngay trước khi boss trả đòn | Sau thi triển bản thân còn ở mức HP cực thấp; nếu boss sống sẽ chịu phản kích như thường. Không thể cộng cùng hiệu ứng miễn chết để vô hiệu hóa hoàn toàn cái giá. |
| **Đồng Mệnh Huyết Khế** | Khi boss làm bản thân mất HP thật trong ngày, boss cũng phải gánh một phần thương tổn tương ứng | Bạn **vẫn chịu thương thật**; không phản vô hạn từ raw damage hay giáp ảo; nếu boss đã chết trước khi đánh thì hiệu ứng phản thương không phát sinh. |
| **Cửu U Đoạt Hồn** | Cướp lấy **dấu vết một thần thông từng được boss thi triển**, trả đòn bằng một phiên bản có giới hạn của chính sức mạnh đó | Không sao chép mọi boss/chiêu tùy tiện; phải có khả năng chuẩn bị và phản đòn cơ bản để không trở thành kỹ năng rỗng nếu boss có cơ chế khác thường. |
| **Thiên Táng Phong Thần** | Phong ấn một tuyệt kỹ đáng sợ của boss trong phần còn lại của trận hoặc một giai đoạn hợp lý | Cắt bớt HP tối đa của bản thân; không xóa luôn toàn bộ khả năng đánh cơ bản của boss; không được vượt qua toàn bộ thiết kế boss chỉ bằng một lần bấm. |
| **Tam Nhật Đoạn Mệnh** | Đặt một Tử Ấn, sau vài **ngày giao chiến** phát nổ cực mạnh | Chậm phát huy; chỉ có một Tử Ấn hợp lệ, không spam chồng; phải có giá trị rõ trên boss đủ dài, không bắt mọi boss ngắn chờ nổ. |
| **Nghịch Luân Chuyển Sinh** | Hoàn nguyên **một lợi thế vừa có được** của boss, chẳng hạn hồi HP hoặc tự cường hóa gần đây | Không tua lùi cả trận, không hồi HP của bạn; không đảo ngược phần thưởng hoặc sự kiện đã chốt, không gây lặp vô hạn. |

**Định vị sức mạnh:** Một cấm thuật được phép tạo ra khoảnh khắc cực mạnh so với công pháp thường, vì nó hiếm, mất cả ngày thi triển và có cái giá. Nhưng nó **không phải đáp án tối ưu cho mọi trận**. Đòn liên quan % HP boss, phản damage boss quá cao hoặc phong ấn vĩnh viễn cần giới hạn đủ rõ để không xóa toàn bộ ý nghĩa Cảnh giới và luyện công pháp.

**[Cần quyết định]** Giá cụ thể và cách tăng tầng/tinh thuần cho từng cấm thuật. Tầng cao nên làm hiệu quả/tính ổn định cao hơn, **không tự động xóa đi giá phải trả cốt lõi** (đặc biệt không biến Nghịch Mệnh hoàn mỹ thành hồi sinh không mất cảnh giới).

---

# 8. Ngoại Đạo và Nhân Hoàng Kiếm Đồ

## 8.1. Ngoại Đạo độc lập: Vô Môn Dịch Kinh

**Đặc trưng:** Dùng một ngày để gây một đòn nhỏ và **thay một ô công pháp khác trong bộ năm bằng một công pháp đã sở hữu**, có hiệu lực từ ngày giao chiến tiếp theo. Đây là ngoại lệ có kiểm soát với luật khóa bộ năm.

- Vẫn giữ tối đa năm ô.
- Không nhận lại lượt sử dụng của cấm thuật/trấn phái đã dùng.
- Một lần sử dụng hữu hiệu mỗi trận là mức đề xuất, vì lặp mãi sẽ làm bộ năm mất ý nghĩa.
- Khó luyện **×2** vì là Ngoại Đạo.
- Giá trị tăng khi người chơi đã tích lũy nhiều công pháp, không nên là điều kiện bắt buộc cho người mới.

**Giai thoại gợi ý:** Bí kinh của kẻ bị trục xuất khỏi mọi tông môn vì có thể học và đổi thế võ trong bất kỳ hoàn cảnh nào. Đây là một **công pháp bổ sung độc lập**, không phải phái cơ bản thứ sáu.

## 8.2. Đạo thống ẩn: Nhân Hoàng Kiếm Đồ

**Vị thế:** Bộ năm Ngoại Đạo rất hiếm, khó luyện **gấp đôi từng thức**, mang cảm giác *một người phàm tự tay dùng kiếm chống lại thần linh*. Không có thanh “nét kiếm” phải tích; chỉ có **bốn dấu ấn duy nhất** để chuẩn bị cho tuyệt thức cuối.

**Tên kiếm thức:**

1. **Kiếm Lý Sơn Hà**.
2. **Nhất Kiếm Khai Hoàng Huyết Uông Dương**.
3. **Thượng Hoàng Kiếp Động**.
4. **Kiếm Táng Vạn Cổ**.
5. **Nhân Hoàng Vấn Thiên** — tuyệt thức cuối của bộ phiên bản game.

Tên 1–3 lấy cảm hứng từ tên kiếm đạo trong *Mục Thần Ký*; 4–5 và tiểu sử/gameplay là sáng tác/chuyển thể dành cho sản phẩm này. **Không coi toàn bộ bộ năm là chiêu thức nguyên tác được xác nhận**. Nếu phát hành công khai/thương mại, cần đánh giá quyền sử dụng tên riêng, nhân vật, các đoạn mô tả và mỹ thuật liên quan.

| Kiếm thức | Cơ chế nghiệp vụ | Rủi ro/cân bằng cần nhớ |
|---|---|---|
| **Kiếm Lý Sơn Hà** | Gây sát thương và tạo **Giáp Ảo Sơn Hà trong ngày**. Mỗi hit của boss bắt đầu khi giáp còn >0 được **giảm 40% sát thương trước**, rồi mới trừ vào giáp, phần thừa mới trừ HP. | 40% không phải miễn giảm mọi hit suốt ngày. Chỉ hit có chạm vào giáp đang còn mới hưởng giảm. Lượng giáp tăng theo tầng/tinh thuần; không cộng dồn vô hạn. |
| **Nhất Kiếm Khai Hoàng Huyết Uông Dương** | Đòn lớn + phần sát thương phụ thuộc **HP tối đa boss** + **chảy máu trong hai ngày giao chiến tiếp theo**. | Phần theo HP tối đa có trần phụ thuộc sức công và đẳng cấp boss; chảy máu không chồng vô hạn; thiên công nên thiếu bảo vệ. |
| **Thượng Hoàng Kiếp Động** | Sát thương chủ động được tăng theo lượng sát thương **boss đã chuẩn bị gây trong ngày**. Tính được trước vì ý định boss đã xác định, dù người chơi đánh trước. | Bonus dựa trên dự định hợp lệ, không dựa trên damage thực đã nhận sau né/giáp; có trần để không vô tình one-shot boss thần do boss công cao. |
| **Kiếm Táng Vạn Cổ** | Đòn đánh hôm nay; **ngày giao chiến tiếp theo tái hiện một phần nhát chém**, đồng thời để lại **buff sát thương và hồi HP trong một số ngày tiếp theo**. | Echo chỉ sinh một lần, không tự đẻ echo khác; buff và hồi có thời hạn/trần, không chồng vô hạn; nếu boss chết/trận kết thúc thì hiệu ứng dư không đổi thành thưởng ngoài trận. |
| **Nhân Hoàng Vấn Thiên** | Một nhát kiếm mạnh. Nếu trước đó trong **cùng trận** đã thi triển đủ **bốn kiếm thức khác nhau ở trên**, mỗi thức để một dấu ấn riêng, thì Vấn Thiên **tiêu bốn ấn và bùng nổ sát thương lớn**. | Chưa đủ ấn vẫn dùng được ở hiệu lực thường; bùng nổ phải có trần/điều kiện để không phá boss cuối; một lần bùng nổ/trận là hướng đề xuất. |

### Quy luật Giáp Ảo Sơn Hà — ví dụ bắt buộc phải hiểu đúng

Giả sử giáp ảo còn **20**, boss đánh một hit **100**, bỏ qua những hiệu ứng khác:

- Vì hit bắt đầu khi giáp còn, giảm 40% → còn **60** sát thương.
- Giáp hấp thụ **20** → giáp vỡ; **40** sát thương còn lại đánh vào HP.
- Nếu boss đánh hit tiếp theo **100**, lúc này giáp đã hết → HP mất trọn **100**, không được giảm 40% nữa.

Với giáp **110** và ba hit liên tiếp **100/100/100**: hit 1 trừ giáp 60, còn 50; hit 2 giảm còn 60, trừ hết 50 giáp và mất 10 HP; hit 3 mất 100 HP. Không gộp ba hit thành một con số tổng.

**[Cần quyết định]** Khi cùng tồn tại nhiều loại giáp/khiên/né/giảm sát thương, cần thống nhất nguyên tắc thứ tự; không được lén cho nhiều hiệu ứng cộng tuyến tính thành giảm 100% ngoài chiêu đặc biệt được ghi rõ.

### Dấu ấn Nhân Hoàng — không cần dùng đủ bộ trong mọi trận

- Mỗi **thức trong bốn thức đầu** khi thật sự thi triển hợp lệ trong trận tạo **một ấn có tên riêng**. Dùng lại cùng thức không tạo ấn thứ hai.
- Dấu ấn tồn tại trong **trận hiện tại**, không mang sang boss sau. Dùng một công pháp trộn từ phái khác không xóa dấu cũ.
- Vấn Thiên có thể dùng ngay từ khi đã học, nhưng **chỉ bùng nổ đủ bộ khi có cả bốn ấn**; sau khi nổ không thể nhân thêm lần nữa bằng lặp chiêu.
- Do cần **bốn ngày để thu bốn ấn và một ngày thi triển Vấn Thiên**, dạng hoàn chỉnh phù hợp boss từ **năm ngày giao chiến trở lên**. Boss ba ngày không được bắt người chơi hoàn tất bộ này mới có đường thắng.
- Tất cả năm thức là **năm công pháp riêng** cần tìm và tu luyện; người học một thức riêng lẻ vẫn dùng được trong bộ Dị Giáo.

### Giai thoại ngắn làm nội dung game, không phải hiệu ứng mới

| Thức | Kiếm ý / mẩu truyền thuyết |
|---|---|
| **Kiếm Lý Sơn Hà** | “Một kiếm dựng sơn hà.” Tương truyền kiếm quang hóa thành thành lũy, giữ người trong thành khỏi cuộc đồ sát của thần binh. |
| **Nhất Kiếm Khai Hoàng Huyết Uông Dương** | “Một kiếm Khai Hoàng, máu hóa uông dương.” Người rút kiếm biết bản thân không còn đường lùi; thứ kiếm tìm là một vết thương mà thần cũng phải ghi nhớ. |
| **Thượng Hoàng Kiếp Động** | “Thiên kiếp càng dữ, kiếm ý càng cuồng.” Thiên uy chuẩn bị giáng xuống cũng chính là thước đo sức phản kích của phàm nhân. |
| **Kiếm Táng Vạn Cổ** | “Thân có thể chết, kiếm thế còn lưu.” Nhát chém chưa hoàn thành trong một ngày có thể trở lại khi đối thủ tưởng đã thoát. |
| **Nhân Hoàng Vấn Thiên** | “Thần đứng trên trời, có dám nhận hết năm thức nhân gian?” Bốn dấu ấn là bốn lời thề; thức cuối cho chúng cùng xuất hiện trong một kiếm. |

**[Đề xuất truyện mở khóa]** Cho người chơi **chứng kiến uy lực kiếm đồ rất sớm**, nhưng chỉ có cơ hội học các thức ở những boss/truyền thừa cách xa nhau. Để có quyền nhận bí tịch Vấn Thiên, có thể yêu cầu nhập môn bốn thức đầu + hạ Nhân Hoàng Truyền Thừa Boss. Sau đó vẫn phải luyện Vấn Thiên từ tầng đầu. Không ép đạt hoàn mỹ cả bốn thức trước khi chạm được chiêu cuối.

---
# 9. Boss: không chỉ là HP lớn và sát thương cao

Mỗi boss cần **một cách tạo áp lực rõ ràng**, hai hoặc vài hành động dễ đọc và một câu chuyện gắn với lý do phải đánh hắn. Không thiết kế boss như bài kiểm tra “không mang đúng một công pháp hiếm thì không thể thắng”.

## 9.1. Mẫu mô tả nội dung boss cho người viết và agent

Một boss ở mức nghiệp vụ cần trả lời:

- **Ai?** Danh tính, mong muốn, tại sao hắn cản đường hoặc muốn truy sát người chơi.
- **Vì sao đáng sợ?** Một cơ chế đặc trưng người chơi nhớ được bằng một câu.
- **Nhịp hành động?** Hắn có ngày tấn công mạnh, ngày phòng thủ, khi nào thay chiến thuật và mức độ có thể dự báo.
- **Có thể bị khắc chế theo nhiều cách không?** Ít nhất một chiến thuật thuần phái cơ bản và một chiến thuật pha trộn hợp lý.
- **Rủi ro là gì?** Gặp tình huống nào phải cân nhắc phòng thủ, rút lui, Hộ Mệnh hoặc hy sinh Cảnh giới.
- **Hệ quả thắng?** Mở chương tiếp, mối thù/cốt truyện, bí tịch, manh mối, thần binh, chiến tích; phần thưởng không nhất thiết là tăng Tu Vi.
- **Hệ quả thất bại?** Cho thấy tại sao thua và người chơi có thể cải thiện bằng luyện công pháp, nâng Cảnh giới hoặc chọn lại bộ năm; không làm mất bí tịch đã sở hữu.

**Một số mẫu cơ chế boss nên có trong nội dung dài hạn:**

| Mẫu boss | Điều gây hấp dẫn | Những cách đáp trả hợp lý |
|---|---|---|
| **Kiếm khách dồn sát thương** | Ngày tung tuyệt kỹ cực đau, ngày sau xuống sức | Né, chống chịu, phản thương, hoặc kết liễu khi hắn tụ lực |
| **Giáp sư** | Tăng phòng ngự từng giai đoạn nhưng tự chịu giới hạn sức tấn công | Xuyên giáp, đánh nhiều ngày để bào mòn, công pháp tăng sức qua ngày |
| **Độc tu** | Đòn không mạnh ngay nhưng đe dọa HP về sau | Kết thúc sớm, hồi phục, kháng trạng thái hoặc chặn thời điểm độc bùng phát |
| **Tà tu hiến HP** | Boss tự mất máu để chuẩn bị đòn mạnh, có thể tự đánh đổi quá sâu | Chờ phản sát, chủ động tăng áp lực, dùng cấm thuật đúng lúc |
| **Kẻ săn công pháp** | Phản ứng với cách người chơi dùng lặp một công pháp | Đổi chiêu trong bộ năm, tận dụng hiệu ứng còn từ ngày trước, dùng công pháp khác loại |
| **Lão quái nghịch mệnh** | Có một lần hồi sinh đã được báo trước | Phân bổ sức qua hai lần kết liễu; biết khi nào đáng giữ tuyệt chiêu |
| **Thần tướng nhiều đòn** | Nhiều hit liên tiếp, đòi hiểu giáp ảo từng hit | Giáp, giảm sát thương, né, phản chấn có giới hạn, hoặc giết trước khi hắn ra tay |
| **Thần chủ cuối** | Tái sử dụng những nguyên tắc đã học qua các boss, nhiều pha có giải thích | Bộ năm được chuẩn bị, lựa chọn chiêu theo từng pha, có đường thắng không bắt buộc duy nhất một cấm thuật |

**Cảnh báo:** Nếu một boss có độc chỉ người sở hữu Hoán Hình mới xử lý được thì đó là *khóa nội dung*, không phải chiến thuật. Nên có nhiều cách giảm nguy cơ hoặc vượt qua bằng đủ cảnh giới/HP/sát thương, với chi phí khác nhau.

## 9.2. Cách boss thay đổi theo ngày

- **Dự báo có ý nghĩa:** Trước khi chọn công pháp, phải biết hướng hành động boss trong ngày và mức nguy hiểm đủ để đưa ra quyết định. Không nhất thiết công khai toàn bộ chỉ số tuyệt đối nếu chưa có Quan Thiên, nhưng phải báo được nguy cơ chết.
- **Thay đổi có cá tính:** Boss hiếu chiến thiên về ra đòn; boss nham hiểm thiên về chuẩn bị rồi phản kích; boss tu phòng ngự thiên về ép đối thủ hết ngày. Không dùng một bảng ngẫu nhiên giống nhau cho toàn bộ boss.
- **Không gian phản ứng:** Có thể thích nghi với **lịch sử ngày trước**, ví dụ người chơi spam kiếm thì boss thích nghi vào ngày sau; không vô cớ đổi chiêu sau khi người chơi đã chốt công pháp khiến dự báo thành giả.
- **Hồi máu, che chắn, phân thân, phong ấn** phải có giới hạn/hành vi dự đoán được; không có boss vô hạn kéo dài trận qua thời hạn.
- **Đòn boss nhiều hit** phải mô tả số lần hoặc quy luật hit để những công pháp như Kiếm Lý Sơn Hà, Liên Vân và Phản Chấn hoạt động nhất quán.

## 9.3. Vì sao boss nhiều ngày vẫn đáng chơi

**Chuỗi hệ quả:** Một công pháp hôm nay có thể để lại khiên, Hư Ảnh, Cương Kình, độc, máu không hồi, kiếm vực, echo hay một dấu ấn Nhân Hoàng cho ngày sau. Người chơi không cần thao tác combo trong vài giây; chiến thuật chính là **chọn thứ tự chiêu trong một trận nhiều ngày**.

**Không cho một chiến thuật thống trị toàn bộ game:** Nếu người chơi cứ chọn Kim Thân hằng ngày không bao giờ chết mà vẫn thắng, hoặc chọn cấm thuật theo % HP có thể xử lý mọi boss, cần chỉnh lại chi phí cơ hội/cơ chế boss. Đổi giới hạn tùy boss hợp lý hơn việc trừ ngầm uy lực một công pháp chỉ vì game không muốn người chơi dùng nó.

**Cân bằng theo đời sống thật:** HP và sát thương boss cần xét mức hoạt động *bình thường có thể duy trì* của người chơi, không dựa trên giả định hoàn thành 100% task và habit mỗi ngày. Độ khó có thể do người chơi chủ động lựa chọn hoặc từ yêu cầu Cảnh giới/bộ công pháp, nhưng không tự ý nâng HP boss chỉ vì người chơi đã làm nhiều task. Trận thắng nhờ làm tốt habit là phần thưởng; một ngày thấp năng lượng phải có phương án phòng thủ/rút lui rõ, không tạo áp lực làm thêm task ngoài lịch.

---

# 10. Cốt truyện dài hạn — cuộc săn từ Nhân Giới tới Diệt Thần

**Định hướng truyện [Đề xuất]:** Không kể bằng một chuỗi giải thích thế giới dài. Mỗi bước ngoặt quan trọng được người chơi **chứng kiến qua một boss có kỹ năng, trận đánh và hậu quả đáng nhớ**. Mục tiêu đầu là cứu A Lạc, sau là săn lại những kẻ đã dùng Tuyển Tiên Lệnh cướp những tu sĩ tài năng, cuối cùng đối đầu Thần Chủ và chấm dứt vòng săn công pháp hoàn mỹ.

## 10.1. Bí mật trung tâm và những người sẽ quay lại

**Tuyển Tiên Lệnh** được các môn phái tưởng là lời mời phi thăng. Thực chất nó chọn những người sở hữu căn cơ và tuyệt học đặc biệt để đưa lên Thiên Giới. Một phần thần lực, công pháp hoàn mỹ và ký ức của họ bị lấy đi để bồi đắp **Thần Thể** và người kế vị Thần Chủ.

- **A Lạc:** Người thân thiết bị bắt đi từ thuở phàm nhân. Về sau không còn là “người chờ cứu” thụ động: A Lạc đang giữ một phần trận pháp ngăn Thiên Ngục sụp đổ. Giải cứu sai thời điểm có thể khiến người khác chết.
- **Kỷ Hành:** Thiên tài xuất hiện sớm, vừa là đối thủ vừa có thời điểm giúp đỡ nhân vật chính. Hắn tìm cách giải cứu mọi người từ bên trong Thiên Đình, nhưng cuối cùng bị nhắm làm Thần Chủ kế vị. Người chơi nhiều lần đánh hắn ở những thời điểm quan hệ thay đổi.
- **Tạ Trường Sinh:** Cường giả từng đốt cảnh giới nhiều lần để khỏi chết, nay cảnh giới thấp đến đáng kinh ngạc. Boss giới thiệu bằng hành động Nghịch Mệnh Hoán Sinh trước khi người chơi có thể học cấm thuật này.
- **La Sát Nữ Đế:** Người giữ kho tà thuật và cấm thuật. Đáng sợ vì dám đánh đổi sinh mạng, không phải chỉ vì được gọi “tà”.
- **Thần Chủ:** Kẻ có đủ thần thông của nhiều cường giả bị săn bắt. Hắn không phải đối thủ đầu tiên; chỉ thật sự xuất hiện khi người chơi đã chứng minh đủ nguy hiểm.

**Luật kể chuyện:** Một nhân vật có thể trở lại với trận boss khác hẳn trận trước. Boss từng dùng một cấm thuật có thể để lại mảnh truyền thừa sau nhiều chương; một vũ khí người chơi thấy ở đầu game có thể thành mục tiêu sau vài tháng.

## 10.2. Tuyến chính 15 chương — khung mở, không phải 15 nhiệm vụ khóa cứng

| Chương | Boss/mối đe dọa chính | Diễn biến câu chuyện, bước tiến mong muốn |
|---|---|---|
| **01. Hắc Lệnh Qua Thôn** | **Thiết Lệnh Sứ** — đánh liên tiếp và trấn áp phàm nhân | A Lạc bị bắt dưới Tuyển Tiên Lệnh. Người chơi khởi đầu bằng Võ Kỹ Cơ Bản, thắng kẻ từng coi mình không đáng một đòn. Tìm được đường vào tu hành. |
| **02. Thiên Kiêu Không Tên** | **Kỷ Hành** — kiếm thuật áp đảo ở mức nhập môn game | Lần đầu thấy chênh lệch giữa Cảnh giới và kiếm pháp; giới thiệu các phái, truyền thừa và đối thủ sẽ tái ngộ. Tỷ thí có thể thua mà không bị phạt Tu Vi như tử trận. |
| **03. Huyết Hà Tà Vực** | **Huyết Hà Đạo Nhân** — hút máu và vết thương kéo dài | Cuộc chiến chính–tà hóa ra không trắng đen. Có tà tu cứu phàm nhân, cũng có kẻ dùng tà thuật sát hại người vô tội. Người chơi thấy sức mạnh U Minh. |
| **04. Cửu Mệnh Lão Quái** | **Tạ Trường Sinh** — tự hạ Cảnh giới hồi sinh | Người chơi tưởng đánh chết boss, nhưng chứng kiến cấm thuật hồi sinh. Sau trận biết lý do ông mất gần hết sức mạnh và tìm manh mối cấm thuật. |
| **05. Bách Tông Đại Hội** | **Thiên Kiêu Khôi Lỗi** — mô phỏng chiêu các thiên tài | Kỳ tuyển chọn tu sĩ hóa thành cuộc bắt cóc. Chứng kiến các phái tranh luận nên cứu người hay che giấu sự thật. Mở đường săn trấn phái. |
| **06. Sát Lục Thiên Bảng** | **Vô Ảnh Sát Chủ** — hành động nguy hiểm khi bạn sơ hở | Thiên Đình treo thưởng những người luyện được tuyệt học. Các thợ săn từng là đồng minh xuất hiện; lần đầu người chơi trở thành con mồi bị săn công khai. |
| **07. Thần Mộ Không Người Chết** | **Thủ Mộ Nhân** — sử dụng chiêu thức của cường giả đã mất | Phát hiện người “phi thăng” có thể đã bị lấy công pháp và phong ấn. Lần đầu thấy các di sản Ngoại Đạo, thần binh và mảnh Kiếm Đồ. |
| **08. Huyết Hải Nữ Đế** | **La Sát Nữ Đế** — càng gần chết càng có thể phản sát | Kho cấm thuật mở ra; người chơi phải lựa chọn chiến đấu có tính toán thay vì chỉ gây sát thương nhanh. Nữ Đế có lý do riêng để chống Thiên Đình. |
| **09. Ngũ Tông Phá Sơn** | **Thiên Luật Chấp Kiếm Sứ** — dùng uy lực thần luật áp chế các phái | Tông môn có gắn bó bị tấn công. Thắng trận không chỉ mở bí tịch, mà còn giữ hoặc mất một nhân vật/thánh địa từng quen biết. |
| **10. Thiên Kiêu Phản Đạo** | **Kỷ Hành — lần hai** — tiến bộ rõ về tuyệt học | Kỷ Hành gia nhập Thiên Đình để cứu người từ bên trong. Hắn tiết lộ A Lạc chưa chết. Cuộc tỷ thí giờ mang hậu quả về niềm tin và người được cứu. |
| **11. Cửu Trụ Thiên Ngục** | **Các Thần Tướng giữ Cửu Trụ** — mỗi kẻ một chiến thế | Người chơi phá từng tầng giam giữ; những thần tướng đầu tiên có quyền năng thật, giúp phân biệt rõ *đánh tu sĩ* và *đối đầu thần*. |
| **12. Vạn Đạo Thần Thể** | **Vạn Pháp Thần Khôi** — sử dụng nhiều nguồn tuyệt học bị cướp | Sự thật: Thiên Đình dùng công pháp của kẻ “phi thăng” để lắp một thần thể. Những công pháp bạn từng mơ ước bị biến thành vũ khí chống chính mình. |
| **13. Thiên Môn Phản Chiến** | **Kỷ Hành — lần ba** — bảo vệ Thần Trận | Kỷ Hành ngăn bạn phá Thiên Môn vì A Lạc và tù nhân sẽ chết theo. Người chơi cần đánh bại hắn mà không xem mọi thứ hắn làm là phản bội giản đơn. |
| **14. Cổ Thần Chiến Trường** | **Thần Chiến Vương** — tái hiện các chiến thuật nguy hiểm đã gặp | Cuộc đối đầu tổng kết hành trình: những đòn quen từ boss trước quay lại ở tầm thần linh. Đồng minh và các truyền thừa từng mở có đất diễn. |
| **15. Thiên Mệnh Thần Chủ** | **Thần Chủ** — nhiều giai đoạn, tận dụng sức mạnh bị tước đoạt | Người chơi đứng trước kẻ kiểm soát cuộc săn. A Lạc giữ một phần Thần Trận; Kỷ Hành có nguy cơ thành người kế vị. **Hạ boss cuối mới ghi nhận thành tựu DIỆT THẦN.** |

**Không gán toàn bộ 15 chương vào cùng số lượng quest hoặc cùng loại boss.** Chương đầu ngắn, chương giữa có tuyến phái/đạo thống, chương cuối có nhiều boss thần cấp. Giữa các chương có thể có boss truy nã, boss truyền thừa, thần binh thất lạc, ngoại truyện Nhân Hoàng và các đối thủ quay lại.

## 10.3. Tổ chức nhánh nội dung để duy trì 1–3 năm

| Tuyến phụ | Động lực và vai trò |
|---|---|
| **Truyền thừa 5 phái** | Sưu tập đủ nhập môn bốn môn thường, đánh boss trấn phái, được học tuyệt học; có thể phát triển tuyến tiểu sử tổ sư và môn phái. |
| **Dị Giáo** | Tìm bí tịch từ nhiều phái, gặp những nhân vật bị cả chính/tà truy sát; không tạo debuff ép người chơi học thuần phái. |
| **Săn đại cấm thuật** | Lần đầu nhìn boss dùng chiêu nghịch thiên, nhiều chương sau mới có thể tìm cơ duyên, rồi mất hàng tuần luyện đủ tốt để sử dụng. |
| **Nhân Hoàng Kiếm Đồ** | Truyền thừa rải qua nhiều boss và di tích; từng thức đã đáng dùng, đủ năm mới có mục tiêu Vấn Thiên bùng nổ bốn ấn. |
| **Thần binh** | Vũ khí hiếm được gợi trước nhiều tháng; sở hữu đổi một đặc tính chiến đấu rõ ràng, không bắt thêm nhiều ô trang bị/cường hóa. |
| **Chiến tích** | Thắng boss không dùng Hộ Mệnh, thắng bằng bộ thuần phái, chiến thắng sau khi hiến tế Cảnh giới; lưu vĩnh viễn và có đối thoại riêng. Không làm thành điều kiện phải đạt hết để phá đảo. |

**Chú ý nhịp độ:** 1–3 năm là hành trình có khả năng kéo dài do người chơi chọn luyện bao nhiêu công pháp và theo đuổi bao nhiêu tuyến. Không ép họ tu luyện đủ 39 công pháp hay đạt 100% tất cả trước khi chạm được trận Diệt Thần. Cốt truyện chính phải tiến được với một số ít công pháp được đầu tư tốt; những chiêu ngoại đạo hoàn mỹ tạo cơ hội khác biệt, không phải chìa khóa độc quyền duy nhất.

## 10.4. Thiết kế boss truyền thừa và bí tịch ẩn

Một boss truyền thừa nên cho thấy **chính trấn phái mà người chơi muốn học**. Ví dụ tổ sư Bất Diệt Sơn tự mình dùng Chiến Thể đỡ được đòn nguy hiểm rồi phản sát; người chơi thấy rõ nó khác Kim Thân/Trấn Sơn trước khi được trao bí tịch.

Cấm thuật cũng nên được **giới thiệu thông qua một trận đáng nhớ** trước khi xuất hiện ở danh mục. Ví dụ lần đầu gặp Tạ Trường Sinh, game cho người chơi chứng kiến ông hạ một đại cảnh giới để sống; sau này mới cho săn bí thuật ấy.

Mở được bí tịch = **có quyền bắt đầu luyện**, không đồng nghĩa sở hữu bản Viên mãn hay 100%. Chiến lợi phẩm cần ưu tiên câu chuyện và quyền tiếp cận năng lực mới, tránh tạo thêm các currency trùng với hệ Tu Vi/gacha đang có.

---
# 11. Trải nghiệm người dùng và các tình huống bắt buộc phải dễ hiểu

## 11.1. Các màn hình/ngữ cảnh nghiệp vụ (không phải bản vẽ UI)

| Ngữ cảnh | Người chơi cần hiểu và thao tác gì |
|---|---|
| **Tu Tiên tổng quan** | Cảnh giới, Tu Vi gốc, đang Tu Luyện hay Xuất Chiến, boss hiện tại hoặc công pháp đang luyện. |
| **Tàng Kinh Các** | Thấy năm phái, công pháp thường, trấn phái, Ngoại Đạo, cấm thuật; công pháp ẩn chỉ hiển thị gợi ý phù hợp khi chưa mở. Hiểu mỗi môn trong **một câu**. |
| **Luyện công pháp** | Chọn một công pháp, xem tầng đang luyện, tiến độ, % habit hôm nay, hệ số tăng tốc, độ tinh thuần hiện tại và rủi ro khuyết điểm. Có thể xem/luyện lại bản cũ. |
| **Chọn boss** | Biết boss là ai, cơ chế đáng chú ý, số ngày giao chiến dự kiến, mức nguy hiểm, chiến lợi phẩm/đường truyện, chọn tối đa năm công pháp. |
| **Giao chiến hôm nay** | Boss dự kiến dùng gì; HP hai bên; trạng thái kéo dài; chọn duy nhất một công pháp; hiệu quả hôm nay dự tính theo những task/habit **đã hoàn thành**; biết rút lui lúc nào. |
| **Kết toán ngày** | Hiện lần lượt: đòn người chơi → boss mất máu/hiệu ứng → nếu boss sống mới ra từng hit → giáp/HP thay đổi → kết quả. Không cần hiệu ứng đồ họa phức tạp. |
| **Sinh tử nhất tuyến** | Biết rõ giá Hộ Mệnh bằng Tu Vi, giá Nghịch Mệnh bằng **một đại cảnh giới** nếu đã chuẩn bị, hoặc chấp nhận tử trận. Không tự ý chọn phương án thay người chơi. |
| **Chiến thắng** | Một đoạn truyện ngắn có cao trào, boss/chiến tích, phần thưởng/quyền mở bí tịch và gợi ý mục tiêu tiếp theo. |

**Nút quyết định chính thường ngày chỉ có một:** chọn công pháp. Những quyết định lớn hơn như mang bộ năm, chuyển trạng thái, dùng quyền cứu mạng xuất hiện theo ngữ cảnh, không bắt người chơi tối ưu hàng chục biến số mỗi sáng.

## 11.2. Nội dung cần được giải thích ngay trên giao diện

- **Giáp ảo** khác với giảm damage chung và khiên thường. Người chơi phải thấy từng hit nào được giảm 40% và vì sao hit sau không còn được giảm.
- **Cương Kình/Hư Ảnh/dấu ấn Nhân Hoàng** được trình bày bằng tối đa vài biểu tượng, có giải thích ngay khi chạm, không thêm một bảng chỉ số khổng lồ.
- **Cấm thuật** phải hiển thị cái giá trước khi chọn, đặc biệt việc tiêu một đại cảnh giới và thời gian phục hồi Cảnh giới.
- **Tấn công trước boss** phải thể hiện được trong log, vì nó ảnh hưởng mạnh đến những chiêu sát thương cao, phản thương và hồi sinh của boss.
- **Boss nhiều hit và sát thương dự kiến** phải đủ rõ để người chơi có thể quyết định rút lui trước khi tự đưa mình vào nguy cơ tụt Cảnh giới.
- **Phần thưởng cốt truyện** là quyền mở bí tịch/chương/truyền thừa, không đồng nghĩa với nhận ngay bản công pháp hoàn mỹ.

## 11.3. Người chơi không có habit, ít habit hoặc nghỉ dài

- Có **một habit** vẫn luyện được mọi môn và chạm tới 100% tinh thuần.
- Có **nhiều habit** được lợi thế tăng tốc phù hợp nhưng nếu hoàn thành kém thì phẩm chất luyện thấp hơn.
- Nếu **chưa có habit**, app không được khóa mất toàn bộ chức năng quản lý task hoặc Tu Vi; vẫn có thể dùng Võ Kỹ Cơ Bản và trải nghiệm nhập môn. Quyền luyện công pháp chỉ bắt đầu khi có habit hợp lệ.
- Nếu hôm nay **không có habit nào đến hạn**, không tính 0% giả làm hỏng phẩm chất; phần chiến đấu từ task/Cảnh giới và chính sách ngày nghỉ phải được xác định rõ.
- Nếu người dùng **nghỉ phép, ốm hoặc không mở app**, chiến đấu không được tự động rút sạch HP rồi trừ Tu Vi không qua quyết định. Có thể cho tạm dừng/rút lui an toàn, dù sẽ mất tiến độ boss.
- Habit ngủ sớm qua đêm phải gắn đúng ngày nghiệp vụ của ứng dụng gốc, không dùng ngày UTC cứng làm sai tỷ lệ.

---

# 12. Rà soát thiết kế: những vấn đề phát hiện và hướng xử lý

Phần này quan trọng nhất khi dùng tài liệu làm đầu vào cho AI agent. **Đây không phải danh sách lỗi code đã tồn tại**, mà là các mâu thuẫn/lỗ hổng của thiết kế ý tưởng cần được giải rõ trước hoặc trong lúc lập kế hoạch. Ưu tiên tính đúng nghiệp vụ hơn việc cố bảo tồn từng chi tiết ở bản nháp trước.

| Mức độ | Vấn đề khi rà soát | Hướng xử lý nghiệp vụ đề xuất |
|---|---|---|
| **Rất cao** | **Cảnh giới suy ra từ Tu Vi**, trong khi Nghịch Mệnh yêu cầu *chỉ hạ Cảnh giới, không trừ Tu Vi*. | Phải tách khái niệm Cảnh giới thực tế đang phát huy và tiến trình Tu Vi gốc ở mức hành vi; xác định tái đột phá rõ ràng và chỉ sau đó mới giao agent chọn cách lưu. Không tự để tụt xong bật lên lại ngay. |
| **Rất cao** | **Quan Thiên Chỉ “xem chiêu ngày mai”** bản cũ gần như vô dụng vì ngày mai ai cũng thấy intent trước khi chọn công pháp. | **Đã sửa bản nghiệp vụ:** cho soi nhịp **hai ngày tiếp theo** để chuẩn bị từ hôm nay. Khi lập plan, cần xác nhận boss có lịch/chu kỳ đủ đáng để chuẩn bị; nếu không, cân nhắc thay công pháp này thay vì làm mù dự báo chung. |
| **Rất cao** | **Rút lui/hồi sinh/kết toán** có thể bị thao túng nếu người chơi được xem kết quả rồi chọn rút miễn phí. | Quyết định rút lui trước kết toán. Sau HP=0 chỉ có cứu mạng hợp lệ hoặc nhận tử trận. Hộ Mệnh và Nghịch Mệnh dùng chung lượt cứu/trận. Làm rõ phần còn lại của một chuỗi hit sau khi hồi sinh. |
| **Cao** | Thói quen có lịch lặp khác nhau; chỉ đếm tổng habit có thể **farm hệ số tăng tốc** bằng habit không đến hạn, vừa tạo, trùng nhau. | Định nghĩa habit đủ điều kiện theo lịch/tần suất/thời gian tồn tại; tính % từ habit đến hạn. Không lấy tổng dòng habit trên tài khoản làm điểm tăng tốc. |
| **Cao** | Phẩm chất theo phép nhân bốn tầng có thể **quá khắc nghiệt**, khiến một vài ngày kém làm người dùng muốn bỏ bản luyện 1–2 tháng. | Giữ khuyết điểm tích lũy, nhưng xem xét đường cong suy giảm, cách hiển thị và quyền luyện lại. Không cam kết công thức nhân là luật bất biến. |
| **Cao** | Trấn phái có thể **thay thế các môn thường** nếu vừa tấn công mạnh vừa phòng thủ mạnh và không có chi phí. | Giữ mỗi trấn phái một tình huống tỏa sáng cụ thể và chi phí cơ hội có thật. Bất Diệt Chiến Thể tiêu Cương Kình, không sinh thêm; Kiếm Vực cần thời gian phát huy; trấn phái khác phụ thuộc thế trận. |
| **Cao** | Hiệu ứng **giáp, né, giảm sát thương, phản thương, HP tối đa** có thể cộng sai thứ tự hoặc tạo bất tử vô hạn. | Định nghĩa rõ nguyên tắc hit/giáp/HP theo trải nghiệm mong muốn; cap những tương tác tăng trưởng, giảm sát thương không cộng tuyến tính thành 100% tùy tiện. |
| **Cao** | **Cấm thuật theo % HP boss**, đặc biệt Thâu Thiên, Táng Nhật và hiệu ứng hạ HP tối đa, có nguy cơ biến boss thần thành trò bấm nút. | Sức mạnh phi thường nhưng giới hạn dựa vào uy lực công pháp/Cảnh giới/pha boss; giá phải trả không thể bị vô hiệu hóa quá dễ bằng combo khác. Tránh một cấm thuật đơn độc vượt mọi giai đoạn boss. |
| **Cao** | **Phong ấn một skill boss cả trận** có thể vô hiệu hóa mọi boss chỉ có một kỹ năng quan trọng. | Boss phải còn cách giao chiến thật sau khi bị phong ấn; có thể chỉ niêm phong một giai đoạn/loại kỹ năng, hoặc boss có phản ứng dự báo được. |
| **Cao** | **Kết toán lúc nào?** Habit ngủ sớm/điểm danh/task muộn không chung thời điểm, đặc biệt qua đêm. | Khảo sát ngày nghiệp vụ, thời điểm khóa đóng góp, cho phép preview và chỉnh chọn công pháp trước chốt; không tính lặp hoặc kết toán khi dữ liệu vẫn chưa đúng. |
| **Cao** | Task được tự sắp lịch và tự tick; thay lịch/tách nhỏ task trong ngày có thể bơm thêm uy lực không tương xứng. | Dựa trên snapshot kế hoạch hợp lệ và trọng số có giới hạn; không thay planner và không đòi tracking thời gian thực tế. |
| **Trung bình** | Dùng lại cùng một công pháp để spam các trạng thái (độc, Kiếm Vực, Hư Ảnh, Cương Kình, Mệnh Ấn, Vạn Cổ echo). | Có ranh giới tồn tại và chồng lớp đơn giản, không cần tạo cooldown vô lý cho mọi chiêu. Mọi kỹ năng vẫn có hành động cơ bản khi hiệu ứng đặc biệt đang tồn tại. |
| **Trung bình** | **Nghịch Thiên Kỳ hoán đổi hôm nay/ngày mai** vào ngày cuối hoặc khi boss không có intent ngày sau có thể thành skill rỗng hoặc né đại chiêu miễn phí. | Không cho đẩy đòn ra ngoài ngày còn hiệu lực; cần tác dụng thông thường khi thiếu cặp hành động hợp lệ; quyết định đây là trấn phái một lần/trận hay luật đặc biệt khác. |
| **Trung bình** | **Vấn Thiên đủ bốn ấn cần ít nhất năm ngày** nên vô dụng dạng bùng nổ ở boss 3–4 ngày. | Cho thức cuối vẫn có hiệu lực cơ bản khi thiếu ấn; giải thích rõ tuyệt chiêu đủ bộ là mục tiêu dành cho boss dài, không phải điều kiện thắng mọi boss. |
| **Trung bình** | **Kiếm Táng Vạn Cổ có echo + buff + hồi phục**, mạnh hơn bình thường và dễ phát sinh vòng cộng hưởng vô hạn. | Echo chỉ tái hiện một lần, không sinh lại chính nó; buff chỉ áp dụng cho nhóm sát thương phù hợp; trị liệu giới hạn; thời hạn được tính theo ngày giao chiến. |
| **Trung bình** | **Thượng Hoàng Kiếp Động** đánh trước boss nhưng dùng sát thương boss trong ngày; nếu dùng raw damage vô hạn, dễ vượt cấp. | Dùng ý định boss đã xác lập trước lượt người chơi; giới hạn phần chuyển hóa và phân biệt damage định gây với damage thực nhận. Boss chết trước vẫn không phản công. |
| **Trung bình** | Một số công pháp thiên thủ chỉ đáng dùng khi boss rất mạnh, nên người chơi **thuần Bất Diệt/Thái Hư** có nguy cơ không đủ damage trước hạn ngày. | Mọi công pháp có công kích cơ bản; phái thủ có đòn chuyển ưu thế phòng thủ thành sát thương thực. Kiểm tra hướng chơi thuần phái qua thiết kế encounter, không tự ép Dị Giáo. |
| **Trung bình** | Người chơi có thể có **nhiều bản cùng công pháp**; cộng dồn các bản làm phá luật tinh thuần. | Lưu thành tựu từng bản nhưng dùng một bản xác định; không cộng chỉ số bản cũ, không copy dấu ấn/hiệu ứng bằng cách đổi bản. |
| **Trung bình** | Hiệu ứng **hồi sinh boss** nếu không được báo trước có thể phá luật “người đánh chết thì boss không ra đòn”. | Hồi sinh boss là năng lực đã được giới thiệu và có giới hạn; xác định khi nào boss thực sự được tính là đã chết và có được phản công ngay ngày hồi sinh không. |
| **Thấp / nội dung** | 15 chương nhưng thiếu các **trận tạo dấu ấn** có thể khiến 1–3 năm chơi thành nhiều boss đổi tên. | Mỗi boss lớn có một điểm nhớ, một quyết định khó và một truyền thừa/chuyển biến; không cần viết trước 75 boss hoàn chỉnh. |
| **Thấp / pháp lý** | Tên Nhân Hoàng/Tô Mạc Già và một số kiếm thức được lấy cảm hứng từ IP bên ngoài. | Đánh giá quyền sử dụng trước khi phát hành công khai, có thể đổi lore/tên bản phát hành nhưng giữ cơ chế và khí chất. |

## 12.1. Những sửa đổi mình khuyên thực hiện ở bước lập kế hoạch, chưa chốt thay owner

1. **Tách “dự báo an toàn cho mọi người” khỏi “nhìn trước để tạo thế” của Thiên Cơ.** Tránh lấy đi thông tin cơ bản của người chơi để phục vụ một công pháp yếu.
2. **Định nghĩa rõ chi phí hồi sinh và tái đột phá** trên hệ Cảnh giới hiện có; đây là rủi ro nghiệp vụ lớn hơn cân bằng vài điểm sát thương.
3. **Chỉ làm chuẩn một hệ hiệu ứng theo ngày** ở mức khái niệm (hôm nay, ngày giao chiến sau, hết trận), không viết mỗi công pháp một kiểu đếm lượt. Các trạng thái được mô tả khác nhau nhưng đi theo cùng cách hiểu thời gian.
4. **Đặt giới hạn nhưng không giết cá tính công pháp:** Không cần cooldown tất cả kỹ năng; để điều kiện mạnh/yếu, HP hiện tại, thời hạn boss và chi phí cơ hội tự tạo lựa chọn.
5. **Đừng tự thêm hệ lương thưởng habit mới ngoài feature.** Gameplay phải thúc đẩy thói quen tốt mà không làm người dùng phải mở app nhiều hơn, tạo habit giả hoặc áp lực chơi cả khi nghỉ.
6. **Công pháp chưa cân bằng là thông tin thiết kế**, không phải một lời hứa rằng 39 môn đều đã sẵn sàng để code và cho ra game hay. Plan cần có giai đoạn lựa chọn vài kỹ năng đại diện để kiểm chứng trải nghiệm, nhưng cách triển khai cụ thể do agent đề xuất sau khi đọc source.

---

# 13. Các quyết định mở cần chủ sản phẩm phê duyệt trước khi chia việc

| Chủ đề | Câu hỏi cần làm rõ | Trọng tâm nghiệp vụ |
|---|---|---|
| **Chuyển Tu Luyện/Xuất Chiến** | Chuyển trong ngày được không? Sau khi tick habit thì phần ngày còn lại thuộc chế độ nào? | Không tính trùng / không thiệt cho người dùng |
| **Nguồn chiến lực** | Task góp bao nhiêu tương đối so với habit, khi 0 habit đến hạn thì sao? | Habit là trọng tâm, task và Tu Vi gốc không bị chiếm chỗ |
| **Ngày nghiệp vụ** | Khóa đóng góp và chọn chiêu lúc nào, nhất là habit ngủ sớm qua đêm? | Dễ hiểu, không mất điểm oan |
| **Tinh thuần tầng** | Cách tính khuyết điểm tích lũy nào đủ nghiêm để khuyến khích luyện lại, nhưng không phá động lực vì một ngày xấu? | Dài hạn, công bằng |
| **Habit hợp lệ để tăng tốc** | Định nghĩa thế nào để vừa thưởng người duy trì nhiều habit vừa hạn chế farm? | Không ép người dùng tạo nhiều habit vô nghĩa |
| **Người mới thiếu habit** | Cho Võ Kỹ Cơ Bản từ task/Cảnh giới tới mức nào; khi nào giới thiệu việc tạo habit? | Không khóa gameplay đầu |
| **Thông tin boss** | Mức độ công khai sát thương, hành động và biến chiêu như thế nào? | Có bất ngờ nhưng quyết định rút lui/cứu mạng có thông tin |
| **Kết quả HP 0** | Xử lý chuỗi hit còn lại thế nào; Hộ Mệnh hồi HP và tiếp tục vào ngày nào? | Không tạo lỗ hổng hoặc phạt 2 lần |
| **Tổn thất Tu Vi** | Giá Hộ Mệnh, phạt tử trận và trần tụt tiểu cảnh giới ra sao? | Có rủi ro thật nhưng không xóa nhiều tháng làm việc |
| **Hạ đại cảnh giới** | Tu Vi vẫn giữ, vậy Cảnh giới bị hạ biểu hiện thế nào, tái đột phá theo luật nào? | Phù hợp tuyệt đối với hệ gốc |
| **Ngày nghỉ/trận bị bỏ dở** | Được nghỉ bao nhiêu, hết hạn tự rút lui hay đóng băng? | Không ép hoàn thành task khi ốm/bận |
| **Trấn phái** | Một lần/trận có phải giới hạn chung hay từng môn có điều kiện riêng? | Tuyệt học đặc biệt nhưng không spam/áp đảo |
| **Quan Thiên/Nghịch Thiên** | Việc nhìn trước hai ngày có thật sự đem lại quyết định chuẩn bị đáng giá, và hoán đổi ở ngày cuối xử lý thế nào? | Tránh chiêu rỗng và stunlock |
| **Ngoại Đạo/Cấm thuật** | Ngoại Đạo ×2 đã rõ; riêng Cấm thuật khó luyện hơn chuẩn không? | Không tự tăng gánh nặng luyện khi chưa thống nhất |
| **Bảo vật & gacha** | Có tích hợp vé quay, phù, inventory gốc vào boss/công pháp không, mức nào? | Không tạo kinh tế mới hoặc làm hỏng hệ hiện tại |
| **Cốt truyện** | Giữ các tên/chương/nội dung bản nháp tới mức nào; có cần tránh trùng IP không? | Nội dung dễ mở rộng và có thể phát hành |

**Quan trọng:** Không cần hỏi lại chủ sản phẩm 16 câu cùng lúc. Agent có thể khảo sát repo trước, gom thành vài quyết định thực sự ảnh hưởng kiến trúc/nghiệp vụ, đề xuất 2–3 phương án dễ so sánh để chủ sản phẩm chọn. Phần lớn các tên, danh mục, số chương là nội dung sáng tác có thể hiệu chỉnh dần.

---

# 14. Hướng dẫn AI agent sử dụng tài liệu này

**Mục tiêu của agent ở bước tiếp theo:** *Hiểu feature và lập kế hoạch phù hợp codebase*, **không phải lập tức code toàn bộ 39 công pháp và 15 chương**.

Agent nên:

1. Đọc cấu trúc ứng dụng, cách task được tự xếp lịch/tick, cách tính Tu Vi, Cảnh giới/đột phá, streak ngủ sớm, habit hiện có hoặc chưa có, inventory/gacha và múi giờ ngày nghiệp vụ.
2. Phân loại những quy tắc trong tài liệu thành **đã chốt**, **giá trị đề xuất**, **quyết định phải xin ý kiến**; nêu rõ bất kỳ điểm nào xung đột với hệ thống thật.
3. Phác thảo **hành trình thực tế của người mới**: chưa công pháp → dùng Võ Kỹ → chọn một công pháp → luyện qua habit → bước vào boss đầu → chiến nhiều ngày → thua/rút/thắng → mở truyền thừa.
4. Xác định năng lực chung để về sau có thể bổ sung boss, phái/cấm thuật/đạo thống ẩn bằng nội dung chứ không phải viết lại toàn bộ gameplay cho mỗi chiêu.
5. Đặc biệt bảo toàn những tương tác **khó sai**: ngày theo habit/sleep, một ngày chỉ một công pháp, đánh trước boss, từng hit vào Giáp Ảo, hiệu ứng qua ngày, Hộ Mệnh một lần, và hạ đại cảnh giới không trừ Tu Vi khi Nghịch Mệnh.
6. Đề xuất phạm vi khởi đầu đủ nhỏ để đánh giá **vui hay không** và **thuần phái có thắng không**, trước khi sản xuất hàng chục boss/công pháp. Quy mô code, thứ tự file, migration, framework, test tự động và kế hoạch chi tiết sẽ do agent **tạo riêng sau**, không bị tài liệu này áp đặt.
7. Khi phải chọn giữa việc trung thành với một con số bản nháp và giữ trải nghiệm đã thống nhất, **ưu tiên trải nghiệm đã thống nhất**, trình chủ sản phẩm điểm thay đổi.

## Tóm tắt một trang cho agent

> **Game mới là một feature bên cạnh app quản lý task đang có.** Task luôn cho Tu Vi gốc; streak ngủ sớm và đột phá chạy độc lập. Người chơi chọn trạng thái **Tu Luyện** (habit luyện một công pháp) hoặc **Xuất Chiến** (habit chủ đạo + task phụ trợ tạo uy lực cho một công pháp/ngày). Một trận khóa tối đa năm công pháp, kéo dài khoảng vài ngày đến hai tuần, người chơi đánh trước boss và boss chỉ đánh nếu còn sống. Công pháp có tầng/tinh thuần, luyện lại từ đầu để tạo bản tốt hơn, giữ bản cũ. Năm phái có phong cách khác nhau và truyền thừa trấn phái, đều phải đánh boss được theo lối riêng. Ngoại Đạo khó luyện gấp đôi; cấm thuật là các công pháp rất mạnh có giá thật. Hộ Mệnh hồi sinh bằng Tu Vi một lần/trận; Nghịch Mệnh chọn trước ngày đánh, khi chết hy sinh **một đại cảnh giới** để hồi sinh và phản sát. Bộ Nhân Hoàng Kiếm Đồ gồm năm thức; Sơn Hà có Giáp Ảo giảm 40% theo từng hit khi giáp còn, Khai Hoàng gây damage theo HP tối đa boss + bleed hai ngày, Kiếp Động dựa vào sát thương boss chuẩn bị gây, Vạn Cổ tái hiện kiếm + buff/hồi các ngày sau, Vấn Thiên bùng nổ khi có đủ bốn dấu ấn riêng. Cốt truyện là hành trình săn boss qua nhiều môn phái, cấm thuật, thần tướng đến **Diệt Thần**, có thể kéo dài 1–3 năm nếu người chơi tự nguyện theo đuổi nhiều truyền thừa. **Không coi bảng damage minh họa, chi phí, số chương, kiến trúc hay cách lưu Cảnh giới là đã chốt.**

**Kết thúc hồ sơ nghiệp vụ mở.**
