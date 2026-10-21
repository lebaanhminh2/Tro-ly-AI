# Phát hành Linh thú lên staging — hồ sơ 19/10/2026

Ngày 19/10/2026, người dùng xác nhận **“Duyệt bản hiện tại và cho phép phát hành staging”**, bao gồm backup mới, diễn tập restore trên bản sao, áp migration 0041 và deploy Worker. Đã hoàn tất phát hành và kiểm tra sau deploy.

- Ứng dụng: <https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/>
- Worker: `personal-assistant-staging`; DB: `assistant-staging`.
- Version tại lần phát hành này: `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559`, nhận 100% lưu lượng.
- Deployment: `7cd04fc1-52bd-439b-99cb-f35add86e93e`, tạo lúc 17:06:17 UTC+7.
- Migration `0041_linh_thu.sql` đã áp; xác minh đủ chín bảng `beast_*`, không còn migration chờ.

## Backup và diễn tập

Backup toàn DB trước nâng cấp: 1.228.842 byte, SHA256 `3ce8fa16045169f6bc54d560fc034c5ada5397358adf9f5898e6fb70c082d8c6`. Backup và log riêng nằm trong `.wrangler/linh-thu-release-20261019-170354/`, được Git bỏ qua; không chia sẻ nội dung SQL hoặc URL tải có chữ ký.

Đã restore backup vào SQLite tạm rồi áp riêng 0041: integrity OK, không vi phạm khóa ngoại, 102 bảng cũ giữ nguyên dữ liệu và thêm chín bảng mới. Đây là diễn tập trên bản sao, không phục hồi đè DB staging. Dry-run staging đạt trước khi áp migration và deploy; đối chiếu 537 hash file ứng viên giữ nguyên trước phát hành.

## Kiểm tra sau phát hành

- Cả 402 file web trả HTTP 200 và SHA256 khớp bản ứng viên, gồm toàn bộ ảnh runtime.
- Tám API kiểm tra khi chưa đăng nhập trả HTTP 401: bootstrap, habits, reminders, history, linh-thu, collection, tower và receipt.
- Chrome thật ở 390px và 1440px hiển thị màn đăng nhập, không lỗi JavaScript hoặc tràn ngang.
- Listing deployment xác nhận version mới nhận 100% lưu lượng; listing migrations không còn mục chờ.

[Bằng chứng phát hành đã loại dữ liệu riêng tư](../output/linh-thu-review/STAGING_RELEASE.json) · [Hồ sơ kiểm thử](LINH_THU_ACCEPTANCE.md) · [Vận hành và bảo trì](LINH_THU_OPERATIONS.md).

Các luồng có đăng nhập và ghi dữ liệu đã được kiểm local qua API sản phẩm và D1 tạm; không thử ghi trên tài khoản thật ở staging và không gửi tin Telegram thử. Không dùng kiểm tra GET để khẳng định hiệu năng D1 remote hoặc CPU khi tải cao. Schema remote đã thay đổi theo migration được duyệt; kiểm thử không chủ động sửa bản ghi người dùng.

## Mỹ thuật và bảo trì

Bản ngày 19/10 đã được duyệt để phát hành. Các version/migration và kết quả trong tài liệu này là lịch sử, không xác nhận trạng thái remote hiện tại; xem [bàn giao mới hơn](HANDOFF.md). Ảnh 95%/100% tiếp tục dùng tạm theo quyết định trước đó, có thể chỉnh riêng sau; không suy thành duyệt thị giác cuối cho từng ảnh. Đủ 18 loài và 108 ảnh runtime. Quy trình thay ảnh, cân bằng có phiên bản và phục hồi được ghi trong [vận hành Linh thú](LINH_THU_OPERATIONS.md).

Đợt này không commit/push, không reset/clean worktree hoặc sửa migration lịch sử. Nếu cần rollback, phải đối chiếu tương thích Worker/schema và các giao dịch phát sinh; không tự xóa bảng hoặc khôi phục DB đè dữ liệu mới.
