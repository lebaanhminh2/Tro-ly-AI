# Tu luyện — bộ thuộc tính và hiệu ứng chung

Cập nhật 2026-10-14. Tài liệu này sở hữu **tên gọi, phân nhóm và nghĩa của từng thuộc tính**. [PROGRESSION](CULTIVATION_PROGRESSION_PROPOSAL.md) sở hữu phương án nâng cấp/UI mới; [SOURCE REVIEW](CULTIVATION_EFFECTS_REVIEW.md) ghi nhận baseline v1. Domain/API và demo dùng chung source v2 đã có local; UI trận và kiểm chứng toàn bộ chưa hoàn thiện, chưa phát hành vòng mới. Trạng thái thật ở [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md). Chạy tiếp từ [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md), không chạy lại mục tiêu lịch sử.

## 1. Một cấu trúc cho mọi công pháp và chiêu boss

| Nhóm | Các trường | Cách đọc |
| --- | --- | --- |
| **Đòn đánh** | Sát thương mỗi đòn; số đòn; tổng đòn chính | Phần gây sát thương ngay khi thi triển. Tổng là số tính ra, không phải chỉ số tăng riêng. |
| **Đặc tính** | Chí mạng; xuyên phòng thủ; xuyên Giáp Ảo; hút máu | Thay đổi cách đòn được xử lý. Mỗi đòn bổ sung có đặc tính riêng nếu khác đòn chính. |
| **Hiệu ứng** | Chảy máu; khiên; Giáp Ảo; giảm thương; phản thương; tăng sát thương; hồi phục; niêm phong… | Một tác dụng có thời điểm, đối tượng và giới hạn rõ. |
| **Điều kiện** | Ngưỡng HP; tài nguyên cần có; chiêu trước đó; thời điểm kích hoạt | Cho biết khi nào đặc tính/hiệu ứng áp dụng; không phải một loại sát thương. |
| **Cái giá** | Hiến HP; giảm HP tối đa; còn 1 HP; hy sinh cảnh giới | Tách khỏi lợi ích, đọc được trước khi xác nhận. |

Chỉ số của người chơi/boss nằm riêng: **HP, Công, Phòng thủ**. Tầng, Độ thuần khiết và số ngày luyện thuộc phần **Luyện**, không chen vào danh sách hiệu ứng chiến đấu.

**Chủ động / nội tại phân loại cách kích hoạt; chính / phụ phân loại vai trò.** Hai cách phân loại này độc lập. Khiên có thể là tác dụng chính của chiêu chủ động, hoặc là một nội tại có điều kiện.

- **Chủ động:** phải chọn thi triển môn đó trong lượt; gồm đòn đánh và các tác dụng nó tạo.
- **Hiệu ứng sau thi triển:** chảy máu, đòn trễ, buff, phản thương đã tạo tiếp tục được xử lý theo hạn. Đây là hiệu ứng của chiêu chủ động, không phải nội tại độc lập chỉ vì tự chạy ở lượt sau.
- **Chủ động có điều kiện:** phải thi triển môn và đủ điều kiện, ví dụ hút máu thêm khi HP thấp hoặc đánh thêm khi có Hư Ảnh. Điều kiện tự được kiểm tra, người chơi không phải bấm thêm một nút.
- **Nội tại:** có hiệu lực do mang công pháp vào bộ chiêu, không cần chọn chính môn đó ở lượt kích hoạt. Có thể thường trực hoặc tự kích hoạt khi đủ điều kiện. Ví dụ Khiên khi HP ≤35%, một lần/trận. Phải công bố rõ phạm vi, ngưỡng, thời hạn và số lần.
- **Đặc tính riêng của đòn:** xuyên Phòng thủ của Kiếm Ý chỉ áp dụng đòn Kiếm Ý; không gọi là nội tại tăng xuyên cho mọi công pháp.

Trong baseline v1 cả 39 môn đều có chiêu chủ động; chưa có nội tại độc lập do mang môn. Đề xuất v2 đang thử có nội tại Khiên của Huyền Quy. Buff nối chiêu của Kiếm Ý và hút máu thêm của Thôn Thiên vẫn thuộc tác dụng chiêu chủ động, không đặt trong ô Nội tại. Huyền Quy vẫn có chiêu chủ động tạo Khiên riêng; nội tại bổ sung không biến cả môn thành kỹ năng bị động.

**Tác dụng chính** là lý do ưu tiên dùng môn: xuyên Phòng thủ, tạo Khiên, Chảy máu, xem trước hoặc Niêm phong. **Tác dụng phụ** là tác dụng hỗ trợ. Khác với **đòn chính**, nghĩa là nhóm đòn đánh ban đầu khi thi triển. Đây là phân vai trò để giải thích trong chi tiết; không quyết định thêm nhiều ô nổi bật trên màn hình. Theo yêu cầu UI mới nhất, chỉ một số **Sát thương** nổi bật; số đòn, đặc tính và hiệu ứng dùng các dòng thông số phụ khi mở xem. Chính/phụ không thay đổi thứ tự engine hoặc công thức, và không phải hai hệ số sức mạnh mới.

## 2. Chỉ số người chơi và boss

| Tên | Đơn vị | Nghĩa |
| --- | --- | --- |
| HP | Điểm hiện tại / tối đa | Sinh lực thật. Hồi phục không vượt trần hiện tại. |
| Công | Điểm | Nền tính lực chiêu; không phải HP chắc chắn lấy được từ boss. |
| Phòng thủ | Điểm | Trừ ở từng đòn sau bước giảm thương. Source cũ dùng trường armor; sản phẩm dùng tên Phòng thủ. |
| Khiên | Điểm còn lại | Một lớp hấp thụ trước HP. Đây là hiệu ứng, không cộng vào chỉ số Phòng thủ. |
| Giáp Ảo | Điểm còn lại | Lớp bảo vệ riêng, có giảm thương và hấp thụ; không đồng nghĩa Phòng thủ hoặc Khiên. |

## 3. Đòn đánh và đặc tính

| Tên chuẩn | Đơn vị | Nghĩa và ranh giới | Trong engine hiện tại |
| --- | --- | --- | --- |
| Sát thương mỗi đòn | Điểm | Sát thương thô trước phòng ngự của mục tiêu. Trong trận ghi thêm HP dự kiến mất khi tính được. | Có |
| Số đòn | Số nguyên | Mỗi đòn kiểm phòng ngự, né, hấp thụ và hồi sinh riêng. | Có |
| Tổng đòn chính | Điểm | Tổng các đòn chính; loại trừ chảy máu, đòn trễ và phản thương. Không cộng trước rồi mới trừ Phòng thủ một lần. | Số suy ra |
| Chí mạng | Tỷ lệ kích hoạt + hệ số sát thương | Ví dụ 20% và ×1,5 là hai thông số khác nhau. Không dùng tên Chí mạng cho Kết liễu hoặc Đòn khi HP thấp. | **Chưa có**; không tự thêm RNG |
| Xuyên phòng thủ | % | Bỏ qua X% chỉ số Phòng thủ khi xử lý đòn. Không xuyên Giáp Ảo, Khiên hoặc Giảm thương. | Có |
| Xuyên Giáp Ảo | % | Nếu được bổ sung: X% phần sát thương sau Phòng thủ đi qua cả giảm 40% và điểm hấp thụ của riêng Giáp Ảo; phần còn lại xử lý Giáp Ảo bình thường. Phần xuyên vẫn gặp Khiên rồi HP. | **Chưa có**; chỉ là định nghĩa dự phòng |
| Hút máu | % HP thật lấy được | Hồi theo HP thật mục tiêu mất từ các đòn trực tiếp được chỉ định. Không hút từ Khiên/Giáp Ảo, chảy máu hoặc phản thương. | Có |

Kỹ năng không có thuộc tính nào thì không hiện một loạt ô 0%. Mục **Thông số đầy đủ** có thể giải thích “Không có chí mạng”/“Không xuyên Giáp Ảo”; không ám chỉ engine đã hỗ trợ hai cơ chế này.

Đòn chính và đòn bổ sung khác đặc tính phải tách: 80 ×1, xuyên 20% và thêm 130 ×1, xuyên 70%, cần Hư Ảnh. Không gộp thành 210 ×2 hoặc một tỷ lệ xuyên trung bình.

## 4. Hiệu ứng dùng chung

### 4.1. Gây thêm sát thương

| Tên chuẩn | Phải ghi | Quy tắc |
| --- | --- | --- |
| Chảy máu | Điểm mỗi lượt; số lượt tiếp theo | Bắt đầu từ lượt giao chiến kế tiếp; lượng chốt khi đặt. Hiện xuyên 100% Phòng thủ, vẫn gặp các lớp bảo vệ khác. |
| Đòn trễ | Điểm; nổ sau bao nhiêu lượt; xuyên | Một đòn đến hạn, không phải sát thương gây ngay. Lượng chốt khi đặt. |
| Dấu ấn | Điểm khi nổ; thời điểm; khả năng tiêu ấn | Một dạng đòn trễ có thể bị tiêu để dùng tác dụng khác. Ấn đã tiêu không nổ lần nữa. |
| Đòn bổ sung | Điểm mỗi đòn; số đòn; điều kiện; xuyên | Đòn riêng ngoài đòn chính, không tự cộng vào sát thương luôn có. |
| Sát thương theo HP tối đa | % HP tối đa mục tiêu; trần; xuyên | Tính từ HP tối đa mục tiêu, có trần theo lực người dùng; không phải trừ thẳng HP bỏ qua mọi phòng ngự. |
| Kết liễu | Ngưỡng HP mục tiêu; sát thương khi kích hoạt | Tăng đòn khi mục tiêu đủ yếu; không phải tự giết và không phải chí mạng. |
| Đòn khi HP thấp | Ngưỡng hoặc tỷ lệ HP đã mất; sát thương/trần | Tăng lực theo HP người dùng đã mất. Không gán hệ số mạnh nhất cho trạng thái đủ HP. |
| Tái hiện sát thương | % phần được tái hiện; trần; lượt đến hạn | Vạn Cổ tạo một đòn trễ; không sao chép hiệu ứng và không tạo đệ quy. UI không dùng Echo như một thuật ngữ riêng. |

### 4.2. Phòng ngự và hồi phục

| Tên chuẩn | Phải ghi | Quy tắc |
| --- | --- | --- |
| Khiên | Điểm; thời hạn | Tiêu điểm để hấp thụ trước HP, sau Giáp Ảo. |
| Giáp Ảo | Điểm; thời hạn; mức giảm thương | Hiện giảm 40% phần sát thương sau Phòng thủ nếu còn ở đầu đòn, rồi tiêu điểm hấp thụ. Đòn sau khi vỡ không hưởng giảm 40%. |
| Giảm thương | %; thời hạn | Nhân giảm sát thương trước bước trừ Phòng thủ. Trần tổng hiện 70%. |
| Né đòn | Số đòn; lượt áp dụng; điều kiện | Né 1 đòn không né toàn bộ chuỗi nhiều đòn. |
| Phản thương | % HP thật bị mất; thời hạn | Phản HP thật bị mất do đòn boss; không phản phần hấp thụ hoặc cái giá tự trả. Trần tổng hiện 100%. |
| Hồi phục | Điểm hoặc % HP tối đa; thời điểm | Không vượt HP tối đa hiện tại; không phải hút máu nếu không lấy từ sát thương đã gây. |

### 4.3. Tăng/giảm sức mạnh và điều khiển

| Tên chuẩn | Phải ghi | Quy tắc |
| --- | --- | --- |
| Tăng sát thương | %; phạm vi đòn; điều kiện; thời hạn | Trạng thái attack_buff hiện tăng các đòn qua xử lý strike, trần +60%; không tự tăng khiên, hồi phục hoặc chảy máu đã đặt. |
| Tăng sát thương nhận | %; thời hạn | Bất lợi; Vô Hồi hiện làm nhận thêm 25% ở lượt thi triển. Đặt trong Cái giá. |
| Tăng phòng thủ | Điểm thêm; trần; thời hạn | Thay đổi Phòng thủ, không tạo Khiên/Giáp Ảo. |
| Giảm phòng thủ | Điểm giảm; thời hạn | Hạ chỉ số của mục tiêu. Khác với xuyên chỉ áp dụng lúc đòn đó đánh. |
| Giải trừ | Danh sách hiệu ứng bị xóa | Quy Hư hiện xóa Khiên, Tăng sát thương và Giảm thương. Không tự xóa Giáp Ảo, hồi sinh hoặc mọi nội tại. |
| Niêm phong | Loại chiêu bị chặn; số lượt; hồi chiêu | Hiện thay tuyệt kỹ boss bằng đòn thường; boss vẫn hành động. |
| Xem trước | Số hành động boss được xem thêm | Cho thông tin, không hủy hành động. |
| Đổi thứ tự chiêu | Hai hành động nào | Hoán đổi, không xóa đại chiêu khỏi trận. |
| Chuyển lực | % sát thương boss đã báo; trần | Tạo đòn từ lực đã báo, không từ HP thật đã mất. |
| Sao chép sát thương | Hành động nguồn; trần; xuyên | Chép sát thương thô hành động boss trước, không chép trọn kỹ năng. |
| Đọc chiêu lặp | Điều kiện lặp; % giảm; phạm vi | Nội tại boss hiện giảm mọi sát thương người chơi gây trong lượt lặp, kể cả chảy máu/đòn trễ/phản thương. |
| Hồi sinh | Số lần còn lại; % HP khi hồi | Tự kích hoạt khi HP về 0; công bố trước trận. Không gộp với hồi phục cuối lượt. |

### 4.4. Tài nguyên và quyền đặc biệt

| Tên chuẩn | Nghĩa |
| --- | --- |
| Cương Kình | Tối đa 3 điểm; tạo khi thi triển, tiêu để đánh thêm. Không phải buff Công thường trực. |
| Hư Ảnh | Tối đa 1; giữ/tạo hoặc tiêu để đánh thêm/né. Không có thanh phẩm chất riêng. |
| Bốn ấn | Bốn loại trong cùng trận; tiêu đủ bộ để bùng nổ một lần/trận. Dùng lại cùng thức không tạo loại ấn thứ hai. |
| Đổi công pháp | Đổi một ô vào thời điểm cho phép; giữ trạng thái/giá/quyền cứu đã dùng. |
| Cứu mạng | Quyết định có giá sau khi bị hạ. Hộ Mệnh và Nghịch Mệnh dùng chung một quyền/trận. Khác Khiên tự kích hoạt. |

## 5. Hợp đồng mô tả hiệu ứng

Mọi tác dụng có cùng bộ thông tin:

1. **Loại:** ID hiệu ứng chung, nhãn và nhóm ở tài liệu này.
2. **Lượng:** số + đơn vị + nền tính; % Công, % HP tối đa và % HP thật mất không viết chung thành % không giải thích.
3. **Đối tượng:** người dùng hay mục tiêu.
4. **Kích hoạt:** khi thi triển, sau đòn, đầu/cuối lượt, khi có điều kiện, khi mang công pháp.
5. **Điều kiện:** HP, tài nguyên, loại chiêu, chiêu trước đó.
6. **Thời hạn/giới hạn:** lượt bắt đầu/hết hạn, số lần, số nguồn, trần, cộng dồn/làm mới.
7. **Nguồn:** công pháp/boss và phiên bản luật đã tạo tác dụng.

Ví dụ trên UI: **Chảy máu 35/lượt · 3 lượt tiếp theo**. Chạm xem nền tính và phòng ngự. Nội tại: **Khiên 25% HP tối đa · HP ≤35% · 1 lần/trận**.

Tên công pháp có thể tiên hiệp; tên hiệu ứng giữ nghĩa trực tiếp. Lore không thay thông số.

## 6. Tham khảo

Nguồn chính thức War Robots phân biệt [thông số vũ khí, đặc tính chủ động/thụ động và lợi ích MK2/MK3](https://warrobots.com/en/posts/411), cùng [chỉ số nền, hiệu ứng thường trực và module có điều kiện](https://warrobots.com/en/posts/388). App dùng nguyên tắc phân nhóm và công bố lợi ích, tự định nghĩa luật cho chiến đấu theo ngày. Không coi Phòng thủ, Giáp Ảo và Khiên trong app là cùng công thức của War Robots.
