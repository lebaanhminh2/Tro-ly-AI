# Tiếp tục từ đây

Cập nhật 2026-10-12. Goal Habit/Thần Lộ đang active, AI tự triển khai đến sản phẩm staging để user nghiệm thu cuối. Đọc checkpoint trước khi nối tiếp; không bắt đầu lại từ đầu.

## Đường vào

- Đọc [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md); prompt `/goal` ở mục 8.
- [PRODUCT](HABIT_GAME_PRODUCT.md) sở hữu full scope; [REVIEW](HABIT_GAME_REVIEW.md) giữ luật user; [PROGRESS](HABIT_GAME_PROGRESS.md) giữ checkpoint/decisions/evidence.
- [README](README.md) chỉ đúng tài liệu chuyên đề; không cần đọc toàn bộ docs mỗi phiên.

## Trạng thái thật

- F1 commit/push `5c8d90a`, F2 `656f06d`, F3 `d766e69`, branch `review/p1-p3`; F4 đang local. Luôn kiểm git status/HEAD.
- Habit/luyện và F4 armor/39 effects/battle/economy/absence/content/store/API/UI chạy local; schema0031–0035. Năm encounters mở đầu gồm truyền thừa Thiên Kiếm với art thật, chưa đủ39 môn/15 chương/tuyến phụ/art hoặc release remote. Luật mới tại BATTLE_RULES.
- Full gate và targeted cases mới xem PROGRESS. Chrome mobile screenshot đã xem. Art pipeline local đã tích hợp Tịch Vân/5bosses/cảnh cửa núi và cập nhật QA; toàn inventory còn phải làm.
- Phạm vi mới: habit/tracking/lịch-nhắc, luyện/chiến đấu, đủ 5 phái/39 môn/15 chương tới DIỆT THẦN, tuyến phụ/thần binh/chiến tích, cast/art/UI và vận hành. Một phái/chương đầu chỉ là cổng nội bộ.
- Source đã có task/planner/sleep5min undo/focus/checkin/healthy/Chrome auth/reminders; giữ nguyên. Remote chưa áp migration0031–0035.
- Issue nền: đã báo ngủ sớm bằng web nhưng còn nhận nudge ngủ. Root cause **chưa xác định/chưa sửa**; điều tra và regression trong goal.

## Quyền và giới hạn

- Goal đã cấp ngoại lệ duyệt từng file trong phạm vi IMPLEMENTATION; AI tự triển khai. Chỉ dẫn user mới hơn thu hẹp quyền luôn ưu tiên.
- Ngân sách bổ sung0đ; CUDA/GTX1650 4GB đã tạo ảnh thử thật; venv/models/drafts ở `D:\Tro-ly-AI-art`, script và manifest trong repo. Không paid fallback.
- User đã cho commit/push bình thường, migration/deploy staging hiện tại sau gates/đúng target/backup. Không production, paid fallback, force-push, xóa dữ liệu hoặc log cá nhân/tin nhắn giả.
- Secrets trong môi trường/.env, không in/commit; example config theo code thật. Chi tiết vận hành tại [OPERATIONS](OPERATIONS.md).

## Next action

Kiểm kết quả gate tổng F4 tại PROGRESS/process, commit/push checkpoint bền vững rồi tiếp tục toànF5–F6/R1: graph15chương/5truyền thừa/39unlock paths, weapon/achievement, version registry/paging và art toàn inventory. A03/A04 và A05/A06 có source/policy/tests. Không complete ở nền habit/luyện/mở đầu.

Các ghi chú phát hành tháng 9 trước đây là lịch sử và còn trong Git tại `23a1808:docs/HANDOFF.md`; không chứng minh trạng thái cloud hiện tại. Kiểm source/schema/config và release evidence mới khi thao tác remote.
