# Minh Anh — sản phẩm đã chốt
Thiết kế đích2026-09-13; trạng thái triển khai xem HANDOFF. Mini App/healthy/lịch lặp/task con chưa có trong bản đang chạy.

## Mục tiêu và tương tác
- Một người dùng nam, tiếng Việt, iPhone XS Max/iOS18.3.2. Múi giờ Asia/Ho_Chi_Minh.
- Tăng năng suất trong sức tải thực tế, giảm quyết định, bắt đầu sớm; không giới hạn số task/ngày tùy tiện.
- Telegram dành cho trò chuyện và nhận nhắc; Mini App dành cho quản lý, không gọi Gemini khi lọc/tick/sửa form.
- Minh Anh là bạn gái-trợ lý hư cấu trưởng thành, tớ–cậu, Bắc tự nhiên, cute, biết trêu/nài nỉ nhẹ. Không đe dọa hay dùng tình cảm gây tội lỗi.
- Gemini free duy nhất, không paid fallback. Không máy cá nhân chạy liên tục, không Google integration.
- Một lượt model có thể vừa làm nhiều phần rõ vừa hỏi phần thiếu; backend kiểm dữ liệu, owner, version, transaction và chống lặp. Không regex whitelist ý định.

## Mini App: ba tab
- **Hôm nay:** việc nên làm tiếp; hai chế độ Lịch/Danh sách cho cùng dữ liệu; task chưa xếp và lý do; thêm/sửa/tick/xóa nhiều; thời gian có thể làm việc.
- **Lời nhắc:** chỉ lời user đặt (một lần hoặc định kỳ), lần tiếp theo, sửa lần này/cả chuỗi; không lặp lại các lời thúc task tự động. Nhắc ngủ do giờ nghỉ trong cài đặt quản lý.
- **Thành tích:** dashboard hiệu suất và báo ngủ, không “vừa làm được”; thành tựu chỉ mở một lần. Không ảnh biểu đồ trống hoặc chuỗi số0/0.
- Cài đặt chỉ giờ bắt đầu ngày (mặc định04:30) và giờ nghỉ (user chọn khi thiết lập, không tự coi22:30 đã chốt).
- Sáng/tối theo Telegram; tím–xanh chủ đạo, vàng cho thành tựu, nút≥44px, safe-area, số liệu lớn, hạn giờ địa phương. Không bảng nhiều cột ép ngang điện thoại.
- Trạng thái loading/rỗng/lỗi/đang lưu/đã lưu/phiên hết hạn rõ; không báo thành công trước commit. Hiệu ứng ngắn, tôn trọng giảm chuyển động.

## Task cha–con
- Mã task cố định #24, con #24.1; cấp server-side, không đổi do sắp xếp, không tái sử dụng mã đã xóa.
- Bản đầu một tầng con. Con kế thừa hạn cha; có trạng thái và ID riêng. “Xong dàn ý” không phải “xong cả task”.
- Hoàn thành tất cả con → hỏi đóng cha. Đóng cha còn con mở → xác nhận đóng cả nhóm. Mở lại con của cha đã xong → xác nhận mở lại cha.
- Chat dùng mã để giảm nhầm; Mini App luôn có thao tác tay tương đương. Bóc bước do LLM đề xuất phải được user yêu cầu/đồng ý trước lưu.
- Xong hôm nay vẫn thấy kết quả; ngày mới ẩn khỏi danh sách hoạt động, không xóa lịch sử.
- Việc dở giữ ID/deadline, planner xếp phần còn lại; không sao chép task hay tự đổi deadline.

## Lịch và nhắc
- /lich bắt đầu phiên riêng: lịch DB hiện tại + lời mới + thời điểm → thay đổi cụ thể → validate/commit → đổi nhắc chưa gửi.
- Câu trả lời trực tiếp câu hỏi đầu ngày dùng cùng phiên; có ngày/expiry, không áp lời trả lời cũ vào ngày mới.
- Khung hoạt động bắt đầu04:30 đến giờ nghỉ; trừ lịch cố định và khoảng bận; “chưa biết” tạm coi có thể xếp, không coi rảnh24h.
- Nói “bận” trong chat thường không tự dời kế hoạch. Cô ấy động viên; /lich hoặc sửa Mini App mới đổi lịch. Yêu cầu ngừng nhắc rõ phải được tôn trọng.
- Lịch lặp một lần/hằng ngày/các thứ, một hoặc nhiều giờ; có ngày bắt đầu/kết thúc tùy chọn, next occurrence rõ. Không cần setup lại mỗi ngày.
- Mỗi occurrence có ID duy nhất; dời/bỏ lần này không sửa chuỗi; sửa chuỗi vô hiệu job cũ theo revision. Không gửi bù dồn sau nghỉ/outage.
- Task đã xong/xóa không vào planner; kiểm lại khi gửi. Buổi làm sinh nhắc riêng, không tạo thêm reminder trùng.
- Task: một nhắc chính + một follow-up sau15 phút từ gửi thành công nếu chưa phản hồi; reply chỉ tác động đúng item.

## Healthy và thành tích ngủ
- Giờ nghỉ là mục tiêu: đến giờ chuyển sang khuyến khích ngủ, không tự nhận user đã ngủ; không lập thêm buổi vượt giờ nghỉ.
- /ngu bật nghỉ bằng backend ngay cả khi model lỗi; lời kèm vẫn được xử lý, chat/form vẫn mở, chỉ ngừng outbound chủ động.
- Ngày bắt đầu mới tự kết thúc nghỉ, hỏi lịch. Dừng nhắc ngủ ngay khi /ngu; khi im lặng tối đa3 tin cách khoảng20 phút, không loop vô hạn.
- Một ngày sinh hoạt có start/target_sleep/wake_next đã snapshot, hỗ trợ giờ ngủ sau00h. Thay cài đặt không sửa lịch sử/không bật dậy giữa kỳ nghỉ.
- Chuỗi tính báo /ngu không muộn hơn mục tiêu, không tuyên bố đo giấc ngủ. Không đóng băng chuỗi, không “ngày hoàn hảo”.
- 3 ngày **Luyện Khí**,7 **Trúc Cơ**,14 **Kết Đan**,30 **Nguyên Anh**. Đã mở giữ nguyên; chỉ mốc kế tiếp hiện x/y.
- Thẻ chia sẻ chỉ có huy hiệu/chuỗi/ngày đạt, user chủ động lưu/chia sẻ; không task cá nhân. Không đếm số lần mở huy hiệu.
- Chuỗi công việc cũ không chuyển thành chuỗi ngủ; lịch sử cũ giữ riêng, không bịa dữ liệu ngủ.

## Lệnh và trí nhớ
- /kiemtra mở Mini App; /lich thiết lập lịch; /ngu báo nghỉ; /huongdan hướng dẫn ngắn; /huy thoát phiên nhập.
- Context là snapshot từ DB, summary + history gần + phiên đang dở + dữ liệu liên quan; facts nghiệp vụ không lấy từ summary.
- Ngân sách agent thử API tách khỏi quyền user chat. Không tái áp trần pilot đã bị user yêu cầu bỏ.
