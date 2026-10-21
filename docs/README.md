# Tài liệu Minh Anh

Cập nhật 21/10/2026. Mục lục cho mã nguồn hiện hành của trợ lý cá nhân Telegram/web.

| Tài liệu                                      | Khi cần đọc                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| [Sản phẩm](PRODUCT_BRIEF.md)                  | Chức năng, năm mục điều hướng và nguyên tắc trải nghiệm                 |
| [Vận hành](OPERATIONS.md)                     | Cấu trúc source, chạy local, kiểm thử, migrations và phục hồi           |
| [Thói quen](HABITS.md)                        | Ghi nhận, lịch cam kết, ngày hiệu lực, lịch sử và prototype             |
| [AI và tools](AI_TOOLS.md)                    | Context, quyền ghi, lỗi và replay                                       |
| [Đặc tả Linh thú](LINH_THU_SPEC.md)           | Luyện/đồng hành, triệu hồi, đan, tháp và công thức                      |
| [Kỹ năng Linh thú](LINH_THU_SKILLS.md)        | Tên, điều kiện, con số và tương tác từng loài                           |
| [Vận hành Linh thú](LINH_THU_OPERATIONS.md)   | Đọc/ghi dữ liệu, hiệu ứng, bảo trì, phân trang và cân bằng có phiên bản |
| [Kiểm chứng Linh thú](LINH_THU_ACCEPTANCE.md) | Phủ kiểm thử, cách tái chạy, số đo và giới hạn                          |
| [Bàn giao](HANDOFF.md)                        | Thay đổi gần nhất, trạng thái local và ghi nhận phát hành               |

## Mỹ thuật và tư liệu

- [Quyết định mỹ thuật](LINH_THU_ART_APPROVALS.md): hướng vẽ và trạng thái duyệt còn hiệu lực.
- [Nguồn ảnh và cách dựng](assets/linh-thu/art/README.md): manifest 108 ảnh, provenance và kiểm hash/alpha.
- [Nhận diện loài](LINH_THU_REFERENCES.md), [hướng thiết kế](LINH_THU_ART_DIRECTION.md), [72 ảnh tham chiếu](assets/linh-thu/reference/README.md): tư liệu đối chiếu; quyết định mới hơn trong ART_APPROVALS được ưu tiên.
- [Gallery hiện hành](../output/imagegen/catalog-v3/index.html) và [hồ sơ phát hành 19/10](LINH_THU_RELEASE.md): ảnh nguồn hiện dùng và bằng chứng lịch sử, không xác nhận mọi sửa đổi local đã được deploy.
- [Prototype habit](prototypes/habits/index.html) vẫn là mẫu riêng; khác biệt với ứng dụng được ghi trong HABITS. Prototype/playground Linh thú và các checkpoint trùng lặp đã gỡ, tra lịch sử Git khi cần.

Tu luyện/Thần Lộ, luyện công pháp và chiến đấu cũ đã gỡ khỏi runtime. Linh thú hiện tại hỗ trợ task/habit/ngủ và tài nguyên nền; không khôi phục các hệ chiến đấu cũ. Tên `healthy`/`cultivation` còn phục vụ điểm, ngủ, check-in và thành tích; không suy từ tên để xóa.

Source và tests xác định hợp đồng thực thi. Gemini nhận prompt/context từ code và DB, không tự đọc các Markdown này. Tài liệu không cấp quyền sửa code, gọi dịch vụ hoặc deploy; tuân theo chỉ dẫn hiện hành của người dùng. Lịch sử đã commit đọc bằng `git show COMMIT:PATH`, không cần thêm một thư mục archive.
