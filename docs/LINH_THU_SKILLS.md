# Bộ kỹ năng linh thú — bản ban đầu

> **Bộ cân bằng v2 ngày 22/10/2026:** đọc [bảng kỹ năng và câu chữ hiện hành](LINH_THU_V2_PLAYER_COPY.md), [đặc tả v2](LINH_THU_V2_SPEC.md), [hồ sơ phát hành staging](LINH_THU_V2_RELEASE.md) và [vận hành/migration](LINH_THU_V2_OPERATIONS.md). Bảng bên dưới là baseline v1 phục vụ lịch sử và tương thích.

Viết cho đúng **18 loài: 2 UR, 4 SSR, 6 SR, 6 R** trong [hồ sơ tham chiếu](LINH_THU_REFERENCES.md). Tên dưới đây dùng tên nguồn để đối chiếu ảnh; tên Việt hóa có thể duyệt riêng. Hình thức hoàn mỹ đi cùng [định hướng mỹ thuật](LINH_THU_ART_DIRECTION.md).

**Trạng thái:** bộ kỹ năng và giới hạn dưới đây là bản ban đầu đã duyệt, đã nối vào runtime và kiểm thử theo goal. Bản hiện tại đã được người dùng duyệt và phát hành staging ngày19/10/2026; xem [hồ sơ phát hành](LINH_THU_RELEASE.md), [vận hành](LINH_THU_OPERATIONS.md), [phạm vi kiểm tra từng nhóm hook](LINH_THU_ACCEPTANCE.md) và [đặc tả toàn hệ thống](LINH_THU_SPEC.md). Đây là kỹ năng cho ứng dụng quản lý công việc/thói quen, không phải chỉ số chiến đấu của game nguồn.

## 1. Cơ sở từ hệ thống hiện tại

| Dữ liệu/cơ chế đã có | Cách dùng trong thiết kế |
| --- | --- |
| Task công việc có lần hoàn thành hợp lệ đầu tiên; đã có ghi nhận chống nhận lại vé cho cùng task. | Kích hoạt thiên phú task. Bước nhỏ và nhật ký tiến độ không được tính thành task hoàn chỉnh. |
| Habit có kết quả `achieved`, `missed`, `neutral`, lịch và chỉ tiêu tuần. | Kích hoạt thưởng ngày đủ habit; chỉ habit ảnh hưởng luyện thú. |
| Báo cáo ngủ có kết quả đúng giờ, chuỗi ngủ và tu vi. | Kích hoạt kỹ năng ngủ. Đây là dữ liệu người dùng báo cáo, không phải đo giấc ngủ thực tế. |
| Quay thường tốn 1 vé, nhận tu vi hoặc vật phẩm. | Kỹ năng lựa chọn kết quả quay thường. |
| Ghép phù và đột phá có kết quả thành công/thất bại, mức trừ thực tế. | Thưởng ghép phù, hoàn phần tu vi thực sự đã mất. |
| Hộ Tâm Phù giữ chuỗi ngủ; An Tâm Phù bảo vệ tu vi khi vi phạm giờ ngủ. | Kỹ năng bảo hộ có tác dụng được mô tả riêng cho hai phần này. |

Đối chiếu: [healthy.ts](../src/domain/healthy.ts), [habits.ts](../src/domain/habits.ts), [task-hierarchy-store.ts](../src/adapters/d1/task-hierarchy-store.ts), [habit-store.ts](../src/adapters/d1/habit-store.ts).

Linh thú, độ thuần, đồng hành, vé triệu hồi, tháp và các bộ đếm kỹ năng là phần thiết kế cần bổ sung. Không coi chúng là dữ liệu đang có sẵn trong ứng dụng.

## 2. Luật chung của bản ban đầu

### Ba lớp kỹ năng

- **Thiên phú:** cố định theo loài. R/SR có một thiên phú; SSR/UR có hai. Đây là các buff hỗ trợ, không gọi là chỉ số Công.
- **Thức tỉnh:** mở khi hoàn thành luyện đến T4 với độ thuần **từ 95%**. Bổ sung hiệu ứng trong cột/mục 95%, giữ thiên phú nền.
- **Tuyệt kỹ hoàn mỹ:** mở khi hoàn thành T4 với độ thuần **chính xác 100%**. Nhận thêm tuyệt kỹ đặc trưng và biến thể hình ảnh riêng. Thú hoàn mỹ vẫn giữ hiệu ứng Thức tỉnh.

T4 ở đây là dạng cuối **đã luyện đầy thanh**, không chỉ vừa chuyển hình sang T4. Thú bị khóa khi đang luyện, dù tạm có 100% độ thuần, chưa đủ điều kiện mở tuyệt kỹ. So sánh bằng điểm gốc, không lấy phần trăm làm tròn trên giao diện.

Không nhân giảm toàn bộ thiên phú theo độ thuần trong bản này. Khác biệt lớn của độ thuần nằm ở việc mở Thức tỉnh và tuyệt kỹ.

### Bốn dạng tiến hóa

**Cập nhật 21/10/2026:** tăng T bằng nút tiến hóa sau khi đủ điểm thực; tạp chất không góp vào mốc. Sức mạnh dùng dạng đã tiến hóa thực tế, không dùng dạng suy ra từ tổng điểm. Mốc 95%/100% yêu cầu đã lên T4 và đã luyện đầy. Giao diện so sánh xác suất trước/sau mỗi lần tiến hóa; ngoại hình chưa khám phá được giữ bí mật. Xem [luật tiến hóa](LINH_THU_SPEC.md#tiến-hóa-chủ-động-và-khám-phá-ngoại-hình--duyệt-21102026).

Các số ở mục từng loài là sức mạnh đầy đủ tại T4. Trước đó giữ nguyên lượng thưởng nguyên, tăng dần **xác suất kích hoạt**:

| Dạng | Thiên phú thứ nhất | Thiên phú thứ hai của SSR/UR |
| --- | --- | --- |
| T1 | 25% xác suất gốc | Chưa mở |
| T2 | 50% xác suất gốc | Chưa mở |
| T3 | 75% xác suất gốc | 50% xác suất gốc |
| T4 | 100% xác suất gốc | 100% xác suất gốc |

Hiệu ứng ghi “+1” mà không nêu xác suất có xác suất gốc 100%. Ví dụ thiên phú +1 vé của ốc tinh thể có xác suất 25% ở T1, 50% ở T2, 75% ở T3, chắc chắn ở T4. Hiệu ứng gốc 40% lần lượt thành 10%, 20%, 30%, 40%. **Không có 0,25 vé hay 0,5 tu vi.** Mốc 95%/100% không áp dụng bảng xác suất này.

Cho dùng đồng hành từ T1; không phải chờ luyện xong mới có ích. Trạng thái trứng, nếu có, chưa có kỹ năng.

### Đồng hành và hạn mức

- Mỗi tài khoản có **một linh thú đồng hành hiệu lực trong ngày**. Đổi đồng hành có hiệu lực ngày kế tiếp; ngày hiện tại vẫn dùng bộ kỹ năng cũ. Có thể đổi lại lựa chọn đang chờ trước khi sang ngày.
- **Đồng hành và luyện thú là hai lựa chọn độc lập.** Đổi đồng hành không khóa lượt luyện. Nếu đổi con đang được luyện thì áp dụng luật khóa lượt luyện đã bàn riêng.
- Hiệu ứng task chỉ xét **5 task hoàn thành hợp lệ đầu tiên của tài khoản trong ngày**. Task đã từng nhận thưởng hoàn thành không được dùng lại. Các mốc “task thứ ba” dùng cùng bộ đếm này.
- Hiệu ứng quay thường xét tối đa **10 lượt quay có trả vé đầu tiên/ngày**. Một lượt có nhiều lựa chọn vẫn chỉ tính một lượt cho bộ đếm và thiên phú.
- **Toàn tài khoản được kích hoạt một tuyệt kỹ mỗi tuần lịch**, thứ Hai đến Chủ nhật, UTC+7. Đây là hạn mức chung cho mọi loài, kể cả thú trùng. Thức tỉnh và thiên phú không dùng hạn mức này.
- Tuyệt kỹ không tốn vé khi bấm kích hoạt; hành động được tăng cường vẫn trả chi phí bình thường. Ví dụ tuyệt kỹ triệu hồi vẫn cần 1 vé triệu hồi.
- Hầu hết tuyệt kỹ hết hạn cuối tuần; riêng Hỏa Liên Trảm hết hạn cuối ngày kích hoạt. Hạn mức tuần đã dùng không hoàn lại nếu bỏ dở. Hiển thị điều kiện, tiến độ và thời hạn trước khi kích hoạt.
- Tuyệt kỹ đã kích hoạt tiếp tục đến hết hạn khi đổi đồng hành; thiên phú cũ dừng khi việc đổi có hiệu lực. Không được kích hoạt tuyệt kỹ thứ hai trong cùng tuần.
- Các mốc ghi **tích lũy** không cần liên tiếp, giữ phần dư qua tuần và qua lần đổi đồng hành; chỉ tăng khi chính cá thể đó đồng hành và đã mở kỹ năng. Các mốc ghi **trong tuần** bắt đầu lại mỗi tuần.
- Luyện lại bằng Tịnh Linh Đan xóa bộ đếm riêng và hiệu ứng đang chạy của cá thể đó, đóng các kỹ năng chưa đủ điều kiện. Không khôi phục hạn mức tuyệt kỹ tuần đã dùng, không cho nhận lại phần thưởng cũ.

### Ngày đủ habit và giới hạn phần thưởng

- **Ngày đủ habit:** sau quyết toán có ít nhất một habit `achieved` và không có habit `missed`; `neutral` không vào mẫu số. Ngày nghỉ không có habit đạt: không thưởng và không tăng bộ đếm. Dùng kết quả lịch/chỉ tiêu tuần của hệ thống, không tự đếm thêm một lượt thất bại cho từng ngày linh hoạt chưa tập.
- Kỹ năng thưởng ngày habit được tính khi chốt ngày. Không yêu cầu hoàn thành task để nhận thưởng habit hoặc luyện thú.
- Với kỹ năng kết hợp habit và ngủ, ghép hai kết quả theo **cùng ngày được hệ thống gán**, kể cả báo cáo ngủ diễn ra sau nửa đêm. Không ghép tùy tiện báo cáo hôm sau với habit hôm nay.
- Vé, tu vi, phù và vé triệu hồi luôn trả **số nguyên**. Xác suất không tạo ví phần lẻ hay nợ thưởng lẻ.
- Chỉ sự kiện hợp lệ mới kích hoạt; không thưởng hồi tố lịch sử trước khi mở kỹ năng. Bỏ đánh dấu rồi hoàn thành lại không tạo lượt mới. Sửa báo cáo dùng cùng ghi nhận quyết toán, không bốc lại phần thưởng ngẫu nhiên.
- Phần thưởng kỹ năng không kích hoạt thêm kỹ năng khác. Các kỹ năng độc lập có thể cùng trả thưởng từ một sự kiện gốc nếu thỏa điều kiện.
- **Không kỹ năng nào tăng điểm luyện, giảm máu xám, nâng độ thuần, bỏ qua ngày thiếu habit hoặc tăng xác suất tạo Tịnh Linh Đan.** Task có thể đem thưởng tài nguyên nhưng không tác động việc luyện thú.

## 3. UR — 2 loài

### UR-01 · Pyrodaemon — Khuyển Tam Diệm

**Pyropup → Pyrohound → Hellhound → Pyrodaemon.** Vai trò: thưởng task, tích lũy lượt triệu hồi, lựa chọn khi gacha. Ba đầu tương ứng ba cơ hội nhìn vào cùng một lần triệu hồi.

- **Thiên phú 1 — Liệp Hỏa:** mỗi task hợp lệ +1 tu vi.
- **Thiên phú 2 — Truy Tài:** mỗi task hợp lệ có **80%** nhận thêm 1 vé thường.
- **95% — Tam Diệm Tụ Hồn:** cứ **20 task hợp lệ tích lũy** nhận 1 vé triệu hồi. Ví dụ đang 19, hoàn thành thêm một task hợp lệ nhận vé rồi bộ đếm về 0.
- **100% — Tam Thủ Chiêu Hồn:** lần triệu hồi tiếp theo trong tuần cho xem **3 ứng viên, chọn 1**, vẫn chỉ tốn 1 vé triệu hồi. Cả ba lấy theo trạng thái bảo hiểm trước lượt quay; bộ đếm bảo hiểm chỉ cập nhật **một lần theo con được chọn**. Khi đủ bảo hiểm UR, có thể chọn giữa hai loài UR. Chi tiết ở mục 7.

### UR-02 · Meteorax — Tinh Vẫn Cự Thú

**Rubblet → Cobbledon → Rockzilla → Meteorax.** Vai trò: thưởng sinh hoạt đều đặn và bảo vệ thành quả tu vi. Giáp đá và tinh thể trở thành một kết giới có số lượt bảo hộ rõ ràng.

- **Thiên phú 1 — Địa Mạch:** ngày đủ habit +4 tu vi.
- **Thiên phú 2 — Tinh Tức:** báo cáo ngủ đúng giờ +3 tu vi.
- **95% — Nhật Nguyệt Đồng Tu:** cứ **5 ngày tích lũy vừa đủ habit vừa báo cáo ngủ đúng giờ** nhận 1 vé triệu hồi. Không bắt buộc liên tiếp.
- **100% — Tinh Vẫn Kết Giới:** từ lúc kích hoạt đến hết tuần, nhận **2 lượt bảo hộ ngủ**, mỗi lượt giữ cả chuỗi và phần tu vi có nguy cơ mất; thêm **1 lượt hoàn toàn bộ tu vi thực trừ khi đột phá thất bại**. Chỉ tiêu hao khi có thiệt hại chưa được vật phẩm bảo vệ. Cuối tuần, mỗi lượt còn dư đổi thành **5 tu vi**, tối đa 15. Không giữ độ thuần hoặc chuỗi habit.

## 4. SSR — 4 loài

### SSR-01 · Frostluna — Băng Nguyệt Linh Miêu

**Frostnip → Frostpaw → Frostique → Frostluna.** Vai trò: giữ nhịp ngủ và kết hợp sinh hoạt với habit.

- **Thiên phú 1 — Nguyệt Tức:** báo cáo ngủ đúng giờ +3 tu vi.
- **Thiên phú 2 — Tuyết Ấn:** ngày đủ habit có **10%** nhận 1 An Tâm Phù.
- **95% — Băng Nguyệt Giao Hòa:** ngày vừa đủ habit vừa báo cáo ngủ đúng giờ +1 vé thường.
- **100% — Băng Nguyệt Phong Ấn:** bảo hộ **3 lần đánh giá ngủ tiếp theo** có ngày được ghi nhận trong tuần kích hoạt. Nếu vi phạm: giữ chuỗi và tránh mất tu vi. Nếu đúng giờ: nhận thêm **5 tu vi** cho lượt đó. Mỗi lần đánh giá dùng một lượt, dù đúng hay trễ; lượt dư hết hạn cuối tuần.

### SSR-02 · Stormlion — Lôi Vương

**Zappur → Electroar → Blitzmane → Stormlion.** Vai trò: phần thưởng đều từ công việc và một mốc thu hoạch lớn.

- **Thiên phú 1 — Lôi Tài:** mỗi task hợp lệ có **50%** nhận thêm 1 vé thường.
- **Thiên phú 2 — Lôi Tức:** mỗi task hợp lệ có **50%** nhận thêm 1 tu vi. Hai phép thử độc lập, có thể cùng trúng.
- **95% — Tam Lôi:** task hợp lệ thứ ba trong ngày nhận thêm **2 vé thường**, tối đa một lần/ngày.
- **100% — Lôi Vương Bảo Khố:** sau khi kích hoạt, hoàn thành **5 task hợp lệ trong tuần**, chọn **2 vé triệu hồi hoặc 40 tu vi**. Không cần làm cả năm trong một ngày; nhận một lần.

### SSR-03 · Hychroma — Huyễn Sắc Nhẫn Giả

**Skinklet → Skinkoon → Ninjaguana → Hychroma.** Vai trò: tạo lựa chọn khi quay thường, giảm tổn thất khi đột phá.

- **Thiên phú 1 — Huyễn Tức:** lượt quay thường có phần thưởng tu vi có **60%** nhận thêm 1 tu vi. Kiểm tra một lần/lượt, kể cả có hai kết quả tu vi được chọn.
- **Thiên phú 2 — Thế Thân:** đột phá thất bại hoàn tối đa **3 tu vi thực trừ**.
- **95% — Tam Ảnh Tụ Khí:** cứ **3 lượt quay thường có thưởng tu vi tích lũy** nhận thêm 3 tu vi. Phần thưởng thêm không tính thành lượt thứ tư.
- **100% — Ảo Ảnh Tam Phân:** **3 lượt quay thường có trả vé tiếp theo** trong tuần, mỗi lượt hiện **3 kết quả, chọn 2**; mỗi lượt vẫn tốn 1 vé thường. Dùng đúng bảng phần thưởng quay thường, có thể trùng vật phẩm. Không áp dụng cho triệu hồi linh thú.

### SSR-04 · Rockong — Đấu Chiến Linh Hầu

**Punchimp → Rockfu → Rockwu → Rockong.** Giữ Rockwu T3, Rockong T4 theo bộ ảnh đã đối chiếu. Vai trò: kiên trì habit và phân thân vượt tháp.

- **Thiên phú 1 — Hầu Vương Tụ Khí:** ngày đủ habit +3 tu vi.
- **Thiên phú 2 — Kiên Tâm:** ngày đủ habit +1 vé thường.
- **95% — Ngũ Nhật Chiêu Linh:** cứ **5 ngày đủ habit tích lũy** nhận 1 vé triệu hồi.
- **100% — Phân Thân Thế Mệnh:** kích hoạt trước khi bắt đầu một lượt tháp. Trong phần tuần còn lại, **mỗi lượt tháp hợp lệ có một lần cứu bẫy tại tầng 1–3**: xáo lại số lá của đúng tầng đó rồi chọn lại; vẫn có một bẫy. Bẫy lần hai mất quà như thường. **Không cứu tầng 4.** Không tăng số lượt chơi/ngày. Đây là ngoại lệ của bản kỹ năng ban đầu so với luật tháp nền; xác suất ở mục 7 và có thể cân chỉnh sau.

## 5. SR — 6 loài

### SR-01 · Crystalsnail — Tinh Thạch Linh Ốc

**Shardsnail → Gemsnail → Jewelsnail → Crystalsnail.** Vai trò: góp tài nguyên đều, kho báu lớn nhờ kiên trì.

- **Thiên phú — Tinh Thạch Tích Lũy:** ngày đủ habit +1 vé thường.
- **95% — Ngũ Sắc Kết Tinh:** cứ **5 ngày đủ habit tích lũy** nhận thêm 3 vé thường.
- **100% — Tinh Hốc Bí Tàng:** sau kích hoạt, có **3 ngày đủ habit trong tuần** sẽ mở kho tinh thể, nhận **1 vé triệu hồi**. Không cần liên tiếp.

### SR-02 · Cinderclaw — Hỏa Miêu

**Flameow → Nekoflare → Silversear → Cinderclaw.** Vai trò: tập trung hoàn thành công việc, chuỗi combo trong một ngày.

- **Thiên phú — Dư Hỏa:** mỗi task hợp lệ có **50%** nhận thêm 1 tu vi.
- **95% — Tam Trảo:** task hợp lệ thứ ba trong ngày nhận thêm **3 tu vi**.
- **100% — Hỏa Liên Trảm:** **3 task hợp lệ tiếp theo sau kích hoạt trong ngày đó** lần lượt thưởng thêm **3 → 5 → 10 tu vi**, tổng 18. Qua ngày thì combo hết hạn. Vẫn chịu hạn mức 5 task/ngày, vì vậy cần kích hoạt đủ sớm; giao diện phải báo số task còn đủ điều kiện.

### SR-03 · Orchitoria — Lan Liêm

**Manteeny → Stalkerix → Serrabloom → Orchitoria.** Vai trò: săn thưởng task, hai mục tiêu rõ ràng như cặp liềm.

- **Thiên phú — Lan Liêm Truy Tài:** mỗi task hợp lệ có **40%** nhận thêm 1 vé thường.
- **95% — Tam Hoa:** task hợp lệ thứ ba trong ngày nhận thêm **1 vé thường**.
- **100% — Song Liêm Khế:** lúc kích hoạt chọn **2 task khác nhau, chưa hoàn thành**. Mỗi task hoàn thành hợp lệ trước hết tuần nhận thêm **5 vé thường**; hoàn thành cả hai nhận thêm **5 tu vi**. Không cho đổi mục tiêu sau kích hoạt. Tổng thưởng tối đa: 10 vé thường và 5 tu vi.

### SR-04 · Cosmoram — Thiên Vân Dương

**Fluffle → Nimbuzzy → Galewether → Cosmoram.** Vai trò: sinh hoạt đúng giờ, gom năng lượng trên mây.

- **Thiên phú — Vân Tức:** báo cáo ngủ đúng giờ +2 tu vi.
- **95% — Tam Vân Tụ Khí:** cứ **3 báo cáo ngủ đúng giờ tích lũy** nhận thêm 5 tu vi. Không cần liên tiếp.
- **100% — Thiên Cung Mộng Du:** sau kích hoạt, có **3 báo cáo ngủ đúng giờ trong tuần** nhận **1 vé triệu hồi**. Không sửa kết quả của một đêm đã vi phạm.

### SR-05 · Dagondeep — Vực Hải Giáp Linh

**Maskfry → Ospisces → Armorjaw → Dagondeep.** Vai trò: quản trị rủi ro đột phá, chọn phần thưởng hoặc an toàn trước khi thử.

- **Thiên phú — Hải Giáp:** đột phá thất bại hoàn tối đa **3 tu vi thực trừ**.
- **95% — Triều Sinh:** ngày đủ habit +2 tu vi.
- **100% — Giao Ước Vực Sâu:** trước lần đột phá tiếp theo trong tuần, chọn một giao ước: **Truy Thưởng** — thành công nhận thêm 1 vé triệu hồi, thất bại chỉ được hoàn theo thiên phú; hoặc **Hộ Thân** — thất bại hoàn toàn bộ tu vi thực trừ, thành công không có thưởng riêng. Lựa chọn khóa trước khi có kết quả, dùng một lần. Không bỏ qua điều kiện hay hạn mức đột phá.

### SR-06 · Beetleknight — Giáp Dực Kỵ Sĩ

**Goonbug → Capobeetle → Donscarab → Beetleknight.** Vai trò: tạo vật phẩm bảo hộ và canh gác một đêm.

- **Thiên phú — Giáp Dực:** ngày đủ habit có **7%** nhận 1 An Tâm Phù.
- **95% — Thất Nhật Hộ Ấn:** nếu **6 ngày đủ habit tích lũy** chưa trúng An Tâm Phù từ thiên phú này, ngày đủ habit thứ bảy chắc chắn nhận 1. Nhận được phù thì bộ đếm về 0; một ngày tối đa một phù từ cặp hiệu ứng này.
- **100% — Hiệp Sĩ Hộ Vệ:** bảo hộ lần đánh giá ngủ tiếp theo trong tuần: nếu vi phạm, giữ cả chuỗi và phần tu vi có nguy cơ mất; nếu đúng giờ, nhận **1 Hộ Tâm Phù + 1 An Tâm Phù** vào kho. Cần kích hoạt trước mốc giờ ngủ được bảo vệ.

## 6. R — 6 loài

### R-01 · Hierotyrus — Nghi Lễ Kim Trùng

**Humbug → Humbleetle → Zenscarab → Hierotyrus.** Vai trò: ghép phù sơ cấp, lấy ít tài nguyên tạo giá trị lớn hơn.

- **Thiên phú — Phù Ấn:** ngày đủ habit có **10%** nhận 1 Phá Cảnh Phù sơ cấp.
- **95% — Tam Nhật Kết Ấn:** cứ **3 ngày đủ habit tích lũy** nhận thêm 1 Phá Cảnh Phù sơ cấp.
- **100% — Luyện Phù Song Sinh:** lần ghép **sơ cấp → trung cấp** tiếp theo trong tuần: thành công nhận **2 phù trung cấp** thay vì 1; thất bại hoàn lại **1 phù sơ cấp thực mất**. Vẫn cần đủ 3 phù đầu vào, tỷ lệ thành công vẫn **80%**. Một lần thử tiêu hao tuyệt kỹ dù kết quả nào; không áp dụng ghép cấp cao hơn.

### R-02 · Hypnostrix — Thời Mộng Linh Cú

**Hootlet → Tikowl → Chronerva → Hypnostrix.** Vai trò: giữ chuỗi ngủ và tích lũy vật phẩm bảo hộ.

- **Thiên phú — Dạ Tức:** báo cáo ngủ đúng giờ +1 tu vi.
- **95% — Tam Dạ Hộ Tâm:** đủ **3 báo cáo ngủ đúng giờ trong tuần** nhận 1 Hộ Tâm Phù, tối đa một lần/tuần. Không bắt buộc liên tiếp.
- **100% — Đêm Đứng Yên:** bảo hộ lần đánh giá ngủ tiếp theo trong tuần: nếu vi phạm, giữ **chuỗi ngủ**, tu vi vẫn xử lý theo luật thường; nếu đúng giờ, chọn nhận **5 vé thường hoặc 12 tu vi**. Kích hoạt trước mốc giờ ngủ, không cứu một đêm đã trễ.

### R-03 · Terraton — Cổ Thạch Linh Quy

**Gibber → Turtuff → Rockshell → Terraton.** Vai trò: giảm tổn thất khi đột phá, phần thưởng habit nhỏ và chắc chắn.

- **Thiên phú — Thạch Giáp:** đột phá thất bại hoàn tối đa **1 tu vi thực trừ**.
- **95% — Quy Tức:** ngày đủ habit +1 tu vi.
- **100% — Mai Đá Hộ Thể:** lần đột phá tiếp theo trong tuần: nếu thất bại, tổng hoàn trả tối đa **10 tu vi thực trừ**; nếu thành công, nhận thêm **5 tu vi**. Mức hoàn 10 đã bao gồm thiên phú, không cộng thành 11.

### R-04 · Magnedart — Từ Giác Linh Lộc

**Voltfawn → Sparkdoe → Zapantler → Magnedart.** Vai trò: công việc tạo tu vi, lựa chọn tài nguyên như đổi hai cực từ trường.

- **Thiên phú — Tụ Từ:** mỗi task hợp lệ có **25%** nhận thêm 1 tu vi.
- **95% — Tam Cực:** task hợp lệ thứ ba trong ngày nhận thêm **1 tu vi**.
- **100% — Cực Từ Đảo Chiều:** lúc kích hoạt đánh dấu tối đa **3 task khác nhau, chưa hoàn thành**. Mỗi task hoàn thành hợp lệ trong tuần được chọn thêm **1 vé thường hoặc 3 tu vi**. Không đổi mục tiêu sau kích hoạt; mỗi task nhận một lần.

### R-05 · Cheerstella — Tinh Tú Linh Thỏ

**Cheerling → Cheerlet → Cheerspring → Cheerstella.** Vai trò: thêm vé từ task, một lần tự chọn vận may.

- **Thiên phú — Tinh Tài:** mỗi task hợp lệ có **20%** nhận thêm 1 vé thường.
- **95% — Tam Tinh:** task hợp lệ thứ ba trong ngày nhận thêm **1 vé thường**.
- **100% — Tinh Tú Dẫn Lối:** lượt quay thường tiếp theo trong tuần cho xem **2 kết quả, chọn 1**; vẫn tốn 1 vé thường. Dùng bảng quay thường hiện tại, không bảo đảm vật phẩm hiếm và không ảnh hưởng triệu hồi.

### R-06 · Ecstamira — Mộng Nấm Linh

**Funglet → Trippet → Hyphoria → Ecstamira.** Vai trò: duy trì habit và nhịp sinh hoạt nhẹ nhàng, chọn quà cuối hành trình ngắn.

- **Thiên phú — Mộng Tức:** ngày đủ habit +1 tu vi.
- **95% — An Mộng:** ngày vừa đủ habit vừa báo cáo ngủ đúng giờ nhận thêm **1 tu vi**.
- **100% — Mộng Cảnh:** sau kích hoạt có **3 ngày đủ habit trong tuần**, chọn nhận **6 vé thường hoặc 15 tu vi**. Không bắt buộc liên tiếp; không tăng điểm luyện hay bù phần habit đã thiếu.

## 7. Các tương tác cần quy định chính xác

### Tháp và Phân Thân Thế Mệnh

Giữ thiết kế nền đã bàn: ở tab Habit, chơi ngay khi đủ full habit và ít nhất một task công việc hợp lệ; miễn phí một lần/ngày. Số lá **4 → 4 → 3 → 2**, mỗi tầng luôn có một bẫy.

| Dừng sau tầng | Tổng quà mang về |
| --- | --- |
| 1 | 2 vé thường |
| 2 | 3 vé thường |
| 3 | 1 vé triệu hồi |
| 4 | 2 vé triệu hồi |

Quà không cộng dồn giữa các tầng. Trúng bẫy làm mất quà chưa chốt của lượt đó, không trừ ví. Rockong đề xuất cho một lần chọn lại mỗi lượt tại tầng 1–3, không làm lộ vị trí bẫy và không cho chọn lại tầng 4.

| Xác suất từ đầu lượt | Tháp thường | Có phân thân của Rockong |
| --- | --- | --- |
| Qua tầng 3 | 37,5% | 68,75% |
| Qua tầng 4 | 18,75% | 34,375% |
| Qua tầng 4 nếu đã qua tầng 3 | 50% | 50% |

Kỳ vọng vé triệu hồi/lượt nếu luôn tiến đến tầng 3 rồi dừng là **0,375** thường và **0,6875** có phân thân. Nếu luôn đánh tiếp tầng 4 thì kỳ vọng vé triệu hồi vẫn bằng các mức đó. Đây là trung bình thống kê, không phải số vé trả vào ví. Nếu đủ điều kiện chơi bảy ngày, phân thân tăng kỳ vọng khoảng **2,19 vé triệu hồi/tuần**. Đây là hiệu ứng mạnh, cần duyệt cùng ngân sách thưởng.

### Tam Thủ Chiêu Hồn và bảo hiểm

Thiết kế nền: **20 vé thường đổi 1 vé triệu hồi; 1 vé triệu hồi quay một lần**. Tỷ lệ thường R/SR/SSR/UR: **70% / 25% / 4,5% / 0,5%**. Lượt bảo hiểm SSR+ sau 19 lượt không có SSR+ dùng **90% SSR / 10% UR**. Lượt bảo hiểm UR sau 79 lượt không có UR chắc chắn UR; ưu tiên nếu trùng hai bảo hiểm.

Với tuyệt kỹ của Pyrodaemon:

1. Chụp trạng thái hai bộ đếm trước khi quay; lấy một bảng tỷ lệ tương ứng.
2. Bốc rank của ba ứng viên độc lập theo bảng đó. Trong mỗi rank, chọn đều loài chưa xuất hiện trong ba ô nếu còn; hết loài mới thì được trùng. Không bốc lại rank để tránh trùng.
3. Cho xem tên, rank và hình của ứng viên rồi chọn một. Chỉ nhận con được chọn; hai con còn lại không vào kho, không cho nguyên liệu trùng.
4. Cập nhật bảo hiểm đúng một lần: chọn UR đặt lại cả hai; chọn SSR đặt lại SSR+ và tăng UR; chọn R/SR tăng cả hai. Xem thêm hai ứng viên không tính là hai lượt quay.

| Loại lượt quay | Xác suất có ít nhất một UR trong 3 ứng viên |
| --- | --- |
| Thường | `1 − 0,995³` = **1,4925125%** |
| Bảo hiểm SSR+ | `1 − 0,9³` = **27,1%** |
| Bảo hiểm UR | **100%**; đủ hiện cả hai loài UR để chọn |

Đây là ưu thế công khai của tuyệt kỹ, không sửa âm thầm tỷ lệ nền. Đổi mới nổi bật là **quyền lựa chọn**, không nhận ba con từ một vé.

### Quay thường, ghép phù và hoàn tu vi

- Quay thường giữ bảng hiện tại: +1 tu vi 40%; +2 tu vi 15%; phù sơ cấp 35%; tín vật 6%; Hộ Tâm Phù 2%; An Tâm Phù 2%.
- Các ứng viên quay thường được bốc độc lập. Hychroma chọn hai ô khác nhau nhưng được nhận hai vật phẩm trùng loại; Cheerstella chọn một ô. Không cộng thêm quà của một lượt quay gốc ngoài các ô đã chọn.
- Ghép phù hiện cần 3 đầu vào; thành công mất 3, thất bại mất 1. Luyện Phù Song Sinh chỉ thay đầu ra/hoàn trả của đúng một lần ghép sơ cấp, không cho ghép khi thiếu đầu vào.
- Tu vi hoàn lại do đột phá không vượt phần thực trừ sau khi chặn ở 0. Ví dụ mất 2, thiên phú hoàn tối đa 3 vẫn chỉ trả 2. Nếu có tuyệt kỹ hoàn toàn bộ thì tổng hoàn gồm thiên phú cũng chỉ bằng thiệt hại, không cộng hai lần.
- Hoàn trả khôi phục số dư; không ghi thành tu vi kiếm mới để kích hoạt thành tích hay thưởng khác. Không tăng tỷ lệ thành công, giảm yêu cầu chuỗi ngủ hoặc vượt giới hạn đột phá một lần/ngày.

### Bảo hộ ngủ và thời hạn

- Phải kích hoạt trước mốc giờ ngủ cần bảo vệ. Không dùng sau khi đã quá giờ hoặc sau quyết toán để đảo kết quả xấu.
- Hộ Tâm Phù/An Tâm Phù đã dùng được xét trước. Kết giới dùng khi còn phần chuỗi hoặc tu vi chưa được bảo vệ; hai nguồn không trả trùng phần tổn thất. Vật phẩm đã dùng vẫn xử lý theo luật tiêu hao hiện tại.
- Kết giới bảo vệ tu vi ngay khi xử lý vi phạm, trước khi có thể bị tụt cảnh giới. Không trừ trước rồi hoàn sau để người dùng bị tụt cảnh giới oan.
- Meteorax chỉ mất lượt ngủ khi còn thiệt hại cần che chắn; Frostluna, Hypnostrix, Beetleknight dùng lượt ở lần đánh giá ngủ kế tiếp theo mô tả, kể cả đêm đúng giờ.
- Hạn tuần dùng ngày mà hệ thống gán cho kỳ đánh giá ngủ. Kỳ Chủ nhật xử lý sau nửa đêm vẫn thuộc Chủ nhật; không cho kỳ thứ Hai dùng dư kết giới tuần trước. Quà đổi lượt dư của Meteorax chỉ chốt sau khi các kỳ thuộc tuần đã quyết toán.
- Bảo hộ không đổi báo cáo trễ thành đúng giờ, không cộng chuỗi hay thưởng đúng giờ cho một lần vi phạm. Không che quy tắc tài khoản ngừng hoạt động. Không ảnh hưởng chuỗi habit, tạp chất hay độ thuần.

## 8. Kiểm tra sơ bộ lượng thưởng

Ví dụ dưới đây xét thú T4 đã mở 95%, **chưa dùng tuyệt kỹ**, đồng hành liên tục. Thưởng cộng thêm ngoài hệ thống gốc. Các số thập phân là kỳ vọng dài hạn, không phải khoản thanh toán lẻ.

| Nhịp sử dụng | Thú | Thưởng cộng thêm trung bình/tuần |
| --- | --- | --- |
| 5 task/ngày, 7 ngày | Cheerstella R | 14 vé thường |
| Như trên | Orchitoria SR | 21 vé thường |
| Như trên | Stormlion SSR | 31,5 vé thường + 17,5 tu vi |
| Như trên | Pyrodaemon UR | 28 vé thường + 35 tu vi + 1,75 vé triệu hồi từ bộ đếm tích lũy |
| 7 ngày đủ habit | Crystalsnail SR | 11,2 vé thường |
| Như trên | Rockong SSR | 7 vé thường + 21 tu vi + 1,4 vé triệu hồi từ bộ đếm tích lũy |
| 7 ngày đủ habit và báo cáo ngủ đúng giờ | Meteorax UR | 49 tu vi + 1,4 vé triệu hồi từ bộ đếm tích lũy |

Không cộng các hàng với nhau: mỗi ngày chỉ một đồng hành. Bảng không ngụ ý phải làm đủ năm task/ngày mới luyện được thú. Thú rank cao có lợi thế tài nguyên; R/SR vẫn có vai trò chuyên biệt như ghép phù, chọn quà hoặc bảo hộ.

Chưa có mô phỏng đầy đủ toàn bộ nguồn vé, nhịp sử dụng thực và thời gian thu thập, chưa thể khẳng định kinh tế đã cân bằng. Giữ các mức này làm **bản ban đầu đã thống nhất**, hoàn thiện vòng chơi rồi cân chỉnh. Ba tham số cần theo dõi sát là hạn mức 5 task/ngày, một tuyệt kỹ toàn tài khoản/tuần và ngoại lệ cứu bẫy của Rockong. Quyền code trong phạm vi goal đã được cấp; phát hành và dữ liệu thật cần xác nhận riêng.
