# Ghép phù và Hộ Đạo Tiên Phù

Ghép ngay trong Túi vật phẩm, chọn 1, 10 hoặc 100 lượt, tương ứng tiêu hao 3, 30 hoặc 300 phù đầu vào. Riêng Hộ Đạo Tiên Phù cần thêm cùng số lượng tín vật Minh Anh. Thiếu nguyên liệu thì không bắt đầu, không ghép lẻ. Mỗi lượt có xác suất độc lập; thất bại mất toàn bộ nguyên liệu của lượt đó. Túi giữ mở và cập nhật số lượng sau khi ghép. Nếu mất phản hồi, bấm **Kiểm tra lại** để nhận kết quả đã lưu, không tiêu hao thêm nguyên liệu.

| Ghép ra         | Nguyên liệu mỗi lượt                | Thành công | Khi thất bại                   |
| --------------- | ----------------------------------- | ---------- | ------------------------------ |
| Phù trung cấp   | 3 phù sơ cấp                        | 80%        | Mất 3 phù sơ cấp               |
| Phù cao cấp     | 3 phù trung cấp                     | 60%        | Mất 3 phù trung cấp            |
| Phù cực phẩm    | 3 phù cao cấp                       | 40%        | Mất 3 phù cao cấp              |
| Hộ Đạo Tiên Phù | 3 phù cực phẩm + 3 tín vật Minh Anh | 20%        | Mất toàn bộ 3 phù và 3 tín vật |

Hộ Đạo Tiên Phù và công thức ghép nằm trong **Tín vật & vật phẩm đặc biệt**, cùng Tín vật Minh Anh.

Kỹ năng linh thú giữ luật riêng: Luyện Phù Song Sinh có thể hoàn 1 phù sơ cấp khi ghép thất bại theo hạn mức kỹ năng; đây không phải hoàn nguyên liệu của công thức ghép thông thường.

## Dùng Hộ Đạo Tiên Phù

Chọn phù khi đột phá nhân vật. Mỗi lần dùng:

- Tăng 25 điểm phần trăm tỷ lệ đột phá thành công; tổng tỷ lệ tối đa 100%.
- Mức phạt thất bại cơ bản là 1 tu vi, áp dụng các hiệu ứng phạt và bảo hộ hiện hành.
- Khi sử dụng, nhận **1 Hộ Tâm Phù và 1 An Tâm Phù**.

Thất bại khi dùng phù sẽ bỏ qua tích lũy thất bại để hưởng hỗ trợ **+5 điểm phần trăm từ lần thử sau**. Hỗ trợ không cộng dồn và đặt lại cùng chuỗi thất bại khi đột phá thành công hoặc hạ cảnh giới.

Hỗ trợ thông thường theo chuỗi thất bại hiện hành: 0–1 lần chưa cộng; 2/3/4 lần liên tiếp cộng 5/10/15 điểm phần trăm cho lần sau, tối đa +15. Thành công đặt lại chuỗi thất bại. Khi có Hộ Đạo, chọn **mức cao hơn** giữa hỗ trợ chuỗi thất bại và +5; không cộng hai mức với nhau. Ví dụ: trước đó chưa được hỗ trợ thì từ lần sau có +5; nếu đã được +10 thì giữ +10.

**Mai Đá Hộ Thể của Cổ Thạch Linh Quy là cơ chế riêng:** vẫn phải tích đủ 3 lần đột phá thất bại theo kỹ năng, lần thử sau mới có +5 điểm phần trăm và bảo hộ; dùng xong đếm lại. Hộ Đạo Tiên Phù không nạp sẵn hoặc thay đổi bộ đếm này.

Trạng thái hỗ trợ Hộ Đạo được lưu riêng (`immortalPity`), không sửa số lần thất bại thành 4 vì theo luật hiện hành 4 lần tương ứng +15. Ví cũ mặc định chưa có hỗ trợ Hộ Đạo. Ghép, dùng phù, thưởng kèm và trạng thái được ghi cùng giao dịch và receipt; gửi lại yêu cầu cũ không phát thưởng hoặc tiêu hao lần hai. Không cần migration schema.

## Trung bình phù sơ cấp để ghép cực phẩm

Không tính kỹ năng linh thú: ở mỗi bậc có xác suất thành công `p`, mỗi phù đầu ra cần trung bình `3/p` phù đầu vào. Do đó một phù cực phẩm cần trung bình **(3/0,8) × (3/0,6) × (3/0,4) = 140,625 phù sơ cấp**, khoảng **141 phù**. Đây là kỳ vọng tiêu hao dài hạn; số lượng thực tế mỗi đợt thay đổi.
