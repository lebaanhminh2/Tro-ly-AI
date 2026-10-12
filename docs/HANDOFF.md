# Tiếp tục từ đây

Cập nhật 2026-10-12. Goal Habit/Thần Lộ đang active, AI tự triển khai đến sản phẩm staging để user nghiệm thu cuối. Đọc checkpoint trước khi nối tiếp; không bắt đầu lại từ đầu.

## Đường vào

- Đọc [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md); prompt `/goal` ở mục 8.
- [PRODUCT](HABIT_GAME_PRODUCT.md) sở hữu full scope; [REVIEW](HABIT_GAME_REVIEW.md) giữ luật user; [PROGRESS](HABIT_GAME_PROGRESS.md) giữ checkpoint/decisions/evidence.
- [README](README.md) chỉ đúng tài liệu chuyên đề; không cần đọc toàn bộ docs mỗi phiên.

## Trạng thái thật

- F1 commit/push `5c8d90a`, F2 commit/push `656f06d`, branch `review/p1-p3`; F3local mới chưa commit ở checkpoint này. Luôn kiểm git status/HEAD.
- Habit domain/D1/auth API/web và luyện bốn tầng/tinh thuần/bản luyện/selection/mode/weekly audit/API/UI chạy local; schema0031–0034. Chưa battle engine/nội dung đầy đủ hoặc release remote. Catalog 39 mới có identities/description/factor, chưa phải công pháp chơi hoàn chỉnh.
- Full gate F2 trước tối ưu đọc nhóm/slot version:225main+25experiments đạt; targeted gate/code mới xem PROGRESS. Chrome mobile screenshot đã xem. Art pipeline local tạo hai concept thật, chưa tích hợp game/toàn inventory.
- Phạm vi mới: habit/tracking/lịch-nhắc, luyện/chiến đấu, đủ 5 phái/39 môn/15 chương tới DIỆT THẦN, tuyến phụ/thần binh/chiến tích, cast/art/UI và vận hành. Một phái/chương đầu chỉ là cổng nội bộ.
- Source đã có task/planner/sleep5min undo/focus/checkin/healthy/Chrome auth/reminders; giữ nguyên. Remote chưa áp migration0031–0033.
- Issue nền: đã báo ngủ sớm bằng web nhưng còn nhận nudge ngủ. Root cause **chưa xác định/chưa sửa**; điều tra và regression trong goal.

## Quyền và giới hạn

- Goal đã cấp ngoại lệ duyệt từng file trong phạm vi IMPLEMENTATION; AI tự triển khai. Chỉ dẫn user mới hơn thu hẹp quyền luôn ưu tiên.
- Ngân sách bổ sung0đ; CUDA/GTX1650 4GB đã tạo ảnh thử thật; venv/models/drafts ở `D:\Tro-ly-AI-art`, script và manifest trong repo. Không paid fallback.
- User đã cho commit/push bình thường, migration/deploy staging hiện tại sau gates/đúng target/backup. Không production, paid fallback, force-push, xóa dữ liệu hoặc log cá nhân/tin nhắn giả.
- Secrets trong môi trường/.env, không in/commit; example config theo code thật. Chi tiết vận hành tại [OPERATIONS](OPERATIONS.md).

## Next action

Chốt verification/commit lát cắt F3 local, rồi F4 engine/boss/chương 01/cost/rescue; tiếp tục F5–F6/R1 toàn scope. A03/A04 luyện đã có policy/tests; battle vẫn chưa. Trạng thái process/gates/next action tại PROGRESS và summary phiên; không complete ở nền habit/luyện/demo.

Các ghi chú phát hành tháng 9 trước đây là lịch sử và còn trong Git tại `23a1808:docs/HANDOFF.md`; không chứng minh trạng thái cloud hiện tại. Kiểm source/schema/config và release evidence mới khi thao tác remote.
