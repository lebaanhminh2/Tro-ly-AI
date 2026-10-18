# Tài liệu Minh Anh

Cập nhật 18/10/2026. Đây là mục lục của sản phẩm trong working tree hiện tại.

| Tài liệu | Nội dung |
| --- | --- |
| [Sản phẩm](PRODUCT_BRIEF.md) | Chức năng đang giữ và trải nghiệm nền |
| [Thói quen](HABITS.md) | Ghi nhận, lịch cam kết, ngày hiệu lực, lịch sử và prototype |
| [AI và tools](AI_TOOLS.md) | Context, quyền ghi, lỗi và replay |
| [Vận hành](OPERATIONS.md) | Kiểm tra local, môi trường, dữ liệu và phục hồi |
| [Bàn giao](HANDOFF.md) | Trạng thái đợt dọn, bằng chứng và việc còn lại |

Tu luyện/Thần Lộ, luyện công pháp và chiến đấu đã được gỡ khỏi runtime. Các tên `healthy`, `cultivation` còn trong code/schema phục vụ điểm, ngủ, check-in và thành tích dùng chung; không suy từ tên để xóa.

Bản [prototype habit](prototypes/habits/index.html) được giữ nguyên để tham khảo bằng dữ liệu mẫu. Trạng thái và khác biệt với app xem [HABITS](HABITS.md). Không coi prototype hoặc tài liệu cũ là lệnh triển khai.

Source và tests quyết định hợp đồng thực thi. Gemini nhận prompt/context từ code và DB, không tự đọc các Markdown này. Lịch sử đã commit tra bằng `git show COMMIT:PATH`; bản trước đợt dọn ở `956b03c`. Không cần tạo thêm archive tài liệu hoặc khôi phục cả kho để đọc lịch sử. Quyền triển khai, gọi dịch vụ và sửa file theo chỉ dẫn hiện tại của người dùng; quyền trong goal cũ không được kế thừa.
