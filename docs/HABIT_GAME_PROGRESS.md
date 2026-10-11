# Habit/Thần Lộ — checkpoint và quyết định triển khai

Cập nhật 2026-10-12. Đây là nơi giữ trạng thái ngắn để goal tiếp tục qua các phiên; không phải nhật ký hội thoại. Nhiệm vụ tại [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md), đặc tả đích tại [PRODUCT](HABIT_GAME_PRODUCT.md).

## 1. Trạng thái thực tế

- Chỉ chuẩn bị bộ tài liệu; **chưa bắt đầu `/goal`, chưa code/migration/art/model setup/deploy mới**.
- Source ứng dụng đã khảo sát: `51f5ffd`; HEAD trước đợt cập nhật docs này: `23a1808`, nhánh `review/p1-p3`. Kiểm lại git status/HEAD khi bắt đầu.
- Staging hiện có theo config; trạng thái runtime/cloud mới nhất chưa được audit trong phiên tài liệu. Không lấy các ghi chú release cũ làm bằng chứng hiện tại.
- GPU khảo sát ban đầu: GTX 1650 khoảng 4 GB; Python/nvidia-smi có lệnh. CUDA/disk/khả năng sinh ảnh/chất lượng chưa được xác minh.
- Issue nền: đã báo ngủ sớm bằng web nhưng còn nhận nudge; **chưa xác định root cause/chưa sửa**.

| Mốc | Trạng thái | Bằng chứng thực hiện | Tiếp theo |
| --- | --- | --- | --- |
| D0 Bộ tài liệu | Đã soạn và kiểm tra | Relative links/encoding và `git diff --check` đạt; prompt goal dưới4.000 ký tự; không chạy app tests vì chỉ sửa docs | User bắt đầu goal; xem commit tài liệu ở Git |
| P0 Khảo sát/thiết kế/ảnh thử | Chưa bắt đầu | Chưa có | Kiểm baseline, quyết định rủi ro, local art preflight |
| F1 Nền habit | Chưa bắt đầu | Chưa có | Domain → persistence/API → UI/history |
| F2 Lịch/nhắc/theo dõi | Chưa bắt đầu | Chưa có | Tích hợp nguồn và báo cáo/export |
| F3 Luyện | Chưa bắt đầu | Chưa có | Phẩm chất, phiên bản và mode |
| F4 Lát cắt chơi hoàn chỉnh | Chưa bắt đầu | Chưa có | Một phái/chương đầu, engine/cost/art dùng thật |
| F5 Toàn bộ game/nội dung | Chưa bắt đầu | Chưa có | Đủ 39 môn/15 chương/tuyến phụ/thần binh |
| F6 Hoàn thiện trải nghiệm | Chưa bắt đầu | Chưa có | Review UX/art/nhịp chơi toàn sản phẩm |
| R1 Release/nghiệm thu | Chưa bắt đầu | Chưa có | Đủ gates, data/backup, staging và hướng dẫn |

Agent thay dòng bằng trạng thái thật/HEAD/bằng chứng sau mỗi phần việc bền vững. Không đổi “đã test” nếu chỉ có file test hoặc một tool command chưa đọc output. F4 là bước nội bộ, không phải điểm dừng của goal.

## 2. Quyết định cần AI hoàn thiện trong P0

| ID | Chủ đề | Cần ghi trước khi triển khai phần phụ thuộc |
| --- | --- | --- |
| A01 | Ngày/tuần và revisions | Week start, tuần đầu, đổi target/lịch/giờ sinh hoạt, archive/delete/restore; timeline biên |
| A02 | Đóng góp/anti-farm | Trần Q, trọng số/tăng tốc/habit mới, nguồn task ổn định, phần vượt target |
| A03 | Tinh thuần/receiver | Công thức nghiêm, khóa tầng, thiếu weekly qua môn/tầng/mode/idle, không né nghĩa vụ |
| A04 | Chế độ và settlement | Start/cancel/end, cutoff, delayed cron, unselected/safe absence, batch/resume |
| A05 | Engine effects | Thứ tự hit/status/rounding, caps, recursion, intent/phase, đồng quy |
| A06 | Giá và account | Death/Hộ Mệnh/Nghịch Mệnh, multi-hit/rescue pending, rank/protection/re-breakthrough/undo |
| A07 | Hợp đồng persistence/API | Actual DTO/schema/index/guards/receipt/job/atomic boundaries và lỗi |
| A08 | Content và versioning | Stable IDs, unlock graph/rule versions, map đủ 39/15/tuyến phụ, replay rewards |
| A09 | UX/cast/art | Điều hướng, flow chính, character/style sheets, asset inventory, pipeline miễn phí |
| A10 | Data/runtime/release | Export/restore, performance budgets đo được, feature off, migration/rollback staging |

Các quyết định này do AI tự làm trong phạm vi goal đã được user cấp, không gửi lại cả bảng để user tự thiết kế. Nếu cần thay luật user hoặc quyền/ngân sách, chỉ hỏi đúng phần vượt quyền, kèm phương án đã chuẩn bị.

## 3. Mẫu quyết định và checkpoint

Quyết định đáng giữ viết ngắn theo mẫu: `ID — vấn đề — lựa chọn — lý do/alternatives — ảnh hưởng dữ liệu/UX — case kiểm chứng — docs/code liên quan — trạng thái`. Cập nhật đặc tả sở hữu chủ đề khi quyết định đổi; quyết định không được chỉ nằm trong chat/summary.

Checkpoint cuối phần việc/phiên cần:

1. HEAD/branch và git status; các thay đổi user hoặc unfinished files cần giữ.
2. Đã làm, chưa làm, cổng vừa đạt/chưa đạt; command/kết quả/fixture/seed/screenshot paths.
3. DB/migration/feature flags/jobs/content/art version và target deploy nếu có; không secrets.
4. Findings còn cụ thể, blocker thực tế và next action độc lập; việc kế tiếp bắt đầu bằng file/case nào.
5. Dịch vụ local đang chạy/model cache ở đâu và cách dừng/resume, không để công cụ art tiếp tục ngoài ý muốn.

Giữ một bảng trạng thái hiện tại và các quyết định đang hiệu lực; lịch sử nằm trong Git. Chi tiết kiểm thử lặp dài/ảnh/model logs lưu artifact có giới hạn, docs chỉ dẫn vị trí. Lệnh tiếp tục cùng mục tiêu: đọc checkpoint, kiểm source/workspace rồi làm next action, không khởi động lại từ đầu hoặc rút xuống demo.
