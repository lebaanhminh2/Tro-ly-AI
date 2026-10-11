# Tiếp tục từ đây

Cập nhật 2026-10-12. Nhiệm vụ hiện tại: chuẩn bị **toàn bộ tài liệu** để user chạy một `/goal` làm Habit/Thần Lộ đến sản phẩm nghiệm thu cuối.

## Đường vào

- Đọc [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md); prompt `/goal` ở mục 8.
- [PRODUCT](HABIT_GAME_PRODUCT.md) sở hữu full scope; [REVIEW](HABIT_GAME_REVIEW.md) giữ luật user; [PROGRESS](HABIT_GAME_PROGRESS.md) giữ checkpoint/decisions/evidence.
- [README](README.md) chỉ đúng tài liệu chuyên đề; không cần đọc toàn bộ docs mỗi phiên.

## Trạng thái thật

- Baseline source ứng dụng khảo sát: `51f5ffd`; HEAD trước đợt docs này `23a1808`, branch `review/p1-p3`. Luôn kiểm git status/HEAD mới nhất.
- Chỉ thay Markdown trong bước chuẩn bị; chưa code habit/game, migration mới, tải/cài model, tạo ảnh hoặc deploy mới. D0 ghi verification thực tế trong PROGRESS.
- Phạm vi mới: habit/tracking/lịch-nhắc, luyện/chiến đấu, đủ 5 phái/39 môn/15 chương tới DIỆT THẦN, tuyến phụ/thần binh/chiến tích, cast/art/UI và vận hành. Một phái/chương đầu chỉ là cổng nội bộ.
- Source đã có task/planner/sleep 5min undo/focus/checkin/healthy/Chrome auth/reminders; không áp lại các bảng prototype trong docs lịch sử. Migrations source tới 0030 tại thời điểm khảo sát; remote chưa audit trong phiên docs.
- Issue nền: đã báo ngủ sớm bằng web nhưng còn nhận nudge ngủ. Root cause **chưa xác định/chưa sửa**; điều tra và regression trong goal.

## Quyền và giới hạn

- User/AGENTS yêu cầu duyệt trước code; bước hiện tại chỉ sửa docs. Khi user phát prompt goal có ủy quyền rõ tại IMPLEMENTATION, phạm vi đó tự triển khai thay duyệt từng file; chỉ dẫn mới hơn luôn ưu tiên.
- Ngân sách bổ sung 0đ; được thiết lập model ảnh local khi goal bắt đầu, GPU khảo sát GTX 1650 khoảng 4 GB. Khả năng CUDA/art chưa kiểm chứng.
- User đã cho commit/push bình thường, migration/deploy staging hiện tại sau gates/đúng target/backup. Không production, paid fallback, force-push, xóa dữ liệu hoặc log cá nhân/tin nhắn giả.
- Secrets trong môi trường/.env, không in/commit; example config theo code thật. Chi tiết vận hành tại [OPERATIONS](OPERATIONS.md).

## Next action

Bộ docs đã soạn/kiểm liên kết, encoding, độ dài prompt và diff; commit/push tài liệu theo quyền đã có. Khi user bắt đầu goal: đọc checkpoint, khảo sát baseline, tự giải P0 decisions, preflight art rồi đi đến hết F1–F6/R1 theo acceptance; không dừng ở demo.

Các ghi chú phát hành tháng 9 trước đây là lịch sử và còn trong Git tại `23a1808:docs/HANDOFF.md`; không chứng minh trạng thái cloud hiện tại. Kiểm source/schema/config và release evidence mới khi thao tác remote.
