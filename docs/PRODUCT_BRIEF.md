# Minh Anh — trợ lý cá nhân

Cập nhật 21/10/2026. Phạm vi hiện tại: task, thói quen, kế hoạch/lịch, focus, nhắc việc, ngủ/thức, tiến trình nền và Linh thú hỗ trợ các hoạt động đó. Tu luyện/Thần Lộ, công pháp và chiến đấu cũ đã ngừng hoạt động; Linh thú không khôi phục các hệ này.

## Trải nghiệm

Trợ lý tiếng Việt giúp bắt đầu sớm và quản lý sức tải thực tế. Telegram dành cho trò chuyện và nhận nhắc; web dành cho quản lý/thao tác rõ, không cần model cho form và tick. Persona Minh Anh là nhân vật trưởng thành, tớ–cậu, giọng Bắc tự nhiên, động viên nhẹ; không dùng tình cảm gây áp lực. Múi giờ sinh hoạt UTC+7, ưu tiên điện thoại, vẫn dùng được trên desktop.

## Công việc, lịch và nhắc

- Task có ID/mã ổn định, bước nhỏ, deadline, estimate, ghi chú và work log. Xếp lại giữ task/deadline; hoàn thành một buổi hoặc bước không tự hoàn thành cả task.
- Thao tác ảnh hưởng nhóm có xác nhận theo luồng hiện có. Thưởng task hợp lệ lần đầu giữ nguyên; mở lại không nhân thưởng.
- Hôm nay có kế hoạch, timeline và focus. Planner giữ free/busy/fixed/capacity/buffer, không coi mọi khoảng trống là sức tải đầy đủ. Chat “bận” không tự dời toàn bộ task.
- Nhắc riêng do user đặt khác lời thúc tự động. Nhắc định kỳ có occurrence/version; bỏ một lần khác sửa chuỗi. ACK không tự hoàn thành task hoặc habit. Outage không gửi bù dồn.
- Thói quen tự khai báo có tick/thời lượng/số lượng, ba lịch cam kết, nhắc tùy chọn, xếp thời gian, lịch sử và báo cáo/xuất. Quy tắc tại [HABITS](HABITS.md).

## Ngủ và điểm dùng chung

- Báo ngủ là trạng thái tự khai, không đo giấc ngủ. Ngủ/focus ngừng lời thúc phù hợp; nhắc user đã cấu hình vẫn theo cơ chế hiện có, trừ pause/inactive.
- Ngủ không đóng ngày sinh hoạt. Hoàn tác ngủ trong 5 phút giữ guards và đảo delta ngủ, không rewind toàn tài khoản, đột phá hoặc inventory.
- Giữ nguyên healthy, streak ngủ, điểm/vé, check-in, rút/ghép/vật phẩm, rank, đột phá và thành tích nền. Hằng số và luật nằm trong `src/domain/healthy.ts`, không lấy bảng prototype cũ làm luật mới.
- Ngày sinh hoạt do server chốt từ lịch cài đặt; check-in theo ngày lịch Việt Nam. Đổi giờ không mở lại kỳ đã đóng.
- Khóa rank/trận đang dở của game cũ không chặn đột phá hoặc chức năng nền. Dữ liệu game lịch sử được giữ nguyên trong DB, không hoàn tiền, phân phối lại thưởng hay kết toán tiếp.

## Linh thú gắn với hoạt động hằng ngày

- 18 loài, mỗi loài bốn dạng; các cá thể trùng loài và lượt luyện có ID riêng. Điểm thực/tạp chất từ kết quả habit theo ngày, không từ task hoặc giấc ngủ. Đủ điểm thực mới tiến hóa chủ động; luyện đầy mới xét Thức tỉnh từ 95% và Hoàn mỹ đúng 100%.
- Đang luyện và Đồng hành là hai vai trò độc lập. Lựa chọn mới có thể hiển thị với nhãn ngày mai, nhưng server quyết định cá thể có hiệu lực hôm nay. Kỹ năng tác động vào task, habit/ngủ, quay/ghép/đột phá theo điều kiện và giới hạn.
- Bộ sưu tập mở theo loài, số lượng/đại diện lấy toàn kho; danh sách cá thể có phân trang theo yêu cầu. Triệu hồi dùng vé và bảo hiểm; Lò đan dùng chuỗi habit để luyện đan và xác nhận luyện lại đúng cá thể.
- Tháp giao ước nằm trong Thói quen, snapshot điều kiện habit +task và giữ phiên ở server. Chi phí, phần thưởng và receipts commit trước hiệu ứng; skip/replay/đóng không tạo giao dịch mới.
- Tài khoản mới bắt đầu trống, không lấy dữ liệu demo để cấp thú/vé. Nguồn hiện có 108 ảnh; trạng thái dùng tạm không thay duyệt thị giác từng ảnh.

Luật, công thức và các điều kiện chi tiết ở [đặc tả Linh thú](LINH_THU_SPEC.md), [kỹ năng](LINH_THU_SKILLS.md); bằng chứng và giới hạn ở [kiểm chứng](LINH_THU_ACCEPTANCE.md).

## Yêu cầu giao diện và AI

Năm mục điều hướng chính theo thứ tự: Hôm nay, Thói quen, Lời nhắc, Linh thú, Thành tích. Linh thú có bốn tab con Đang luyện / Đồng hành / Bộ sưu tập / Triệu hồi; Lò đan là nút tiêu đề. Giữ sáng/tối, giảm chuyển động, safe-area, touch target, keyboard, label và sheet có nút đóng/lưu tiếp cận được. Danh sách/tên dài/chữ lớn không tràn ngang.

Loading, lỗi, hết phiên, read-only, đang lưu và conflict có cách xử lý. Chỉ báo thành công sau commit; POST đã lưu nhưng tải lại lỗi phải đối chiếu trạng thái trước thao tác tiếp, không tạo request mới để nhân tác dụng.

Model đề xuất/diễn giải; backend quyết định owner, ngày, quyền và kết quả. Chat thường không âm thầm ghi. Provider lỗi không làm tắt web, luật nền hay nhắc đã lưu. Không thêm paid fallback hoặc quyền gọi live trong đợt dọn. Chi tiết tại [AI_TOOLS](AI_TOOLS.md).
