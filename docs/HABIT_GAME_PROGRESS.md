# Habit/Thần Lộ — checkpoint và quyết định triển khai

Cập nhật 2026-10-12. Đây là nơi giữ trạng thái ngắn để goal tiếp tục qua các phiên; không phải nhật ký hội thoại. Nhiệm vụ tại [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md), đặc tả đích tại [PRODUCT](HABIT_GAME_PRODUCT.md).

## 1. Trạng thái thực tế

- **Goal đang active**, đã cấp quyền tự triển khai code/tests/assets/migration và publish staging sau gates; ngân sách bổ sung 0đ. Không cần duyệt từng file trong phạm vi goal.
- HEAD bắt đầu `66da16e`, nhánh `review/p1-p3`, working tree sạch trước triển khai. Đang có domain habit và tests mới; chưa có migration/API/UI/game/art mới được release.
- Baseline `npm.cmd run test:all`: 214/215 bài chính đạt, một bài DOM giả thiếu `firstElementChild` tại `tests/unit/web-assets.test.ts`. Chưa tới lượt experiments vì chuỗi lệnh dừng ở lỗi này. Sửa mock phù hợp DOM thực và chạy lại; không ghi all gates đạt.
- Domain habit: 5 tests đạt, bao gồm 896 mẫu tuần Q1–7; lỗi narrowing đã sửa, typecheck đạt. D1 integration 3 tests đạt: current-day replacement/concurrency/replay, weekly/archive/restore/catchup, revisions/rollback. `npm.cmd run test:all` đã kết thúc exit0 gồm main và experiments; kiểm trước phần báo cáo/lịch mới.
- Web: 30 modules syntax/import gate đạt. Chrome thật test tạo cả ba lịch, tick, log 15/20, XSS note, modal scroll, màn 320/390/1440 đạt. Ảnh `D:\Tro-ly-AI-art\habit-qa-habits-{width}.png` đã xem; sửa heading tránh bó hẹp và dời nút thêm cạnh navigation.
- Môi trường art riêng `D:\Tro-ly-AI-art\venv` (Python 3.12.10); CUDA12.4/GTX1650 4095MiB đã xác minh. DreamShaper8 revision `a7e52b98680b1ba8ff7bce97c7f9f2e2e5337917`, license creativeML-openrail-m, đã tải ngoài Git. Trial FP16 bị NaN/ảnh đen và prompt bị cắt: đã dừng, không duyệt/tích hợp. Script sửa kiểm finite/prompt budget và chạy trial v2 float32; session 43253 còn chạy. Chưa có art đạt QA.
- Source ứng dụng đã khảo sát: `51f5ffd`; HEAD trước đợt cập nhật docs này: `23a1808`, nhánh `review/p1-p3`. Kiểm lại git status/HEAD khi bắt đầu.
- Staging hiện có theo config; trạng thái runtime/cloud mới nhất chưa được audit trong phiên tài liệu. Không lấy các ghi chú release cũ làm bằng chứng hiện tại.
- GPU khảo sát ban đầu: GTX 1650 khoảng 4 GB; Python/nvidia-smi có lệnh. CUDA/disk/khả năng sinh ảnh/chất lượng chưa được xác minh.
- Issue nền ngủ: audit D1 read-only xác nhận báo ngủ 2026-10-07 23:05:39 UTC+7. Hai bedtime nudge trong khoảng kiểm tra đã gửi trước đó (22:45:14, 23:02:01); chưa có bằng chứng nudge sau báo ngủ trong nhóm này. Asset sleep staging khác local; chưa kết luận root cause/chưa sửa. Không gửi tin thử hoặc sửa dữ liệu cá nhân.

| Mốc | Trạng thái | Bằng chứng thực hiện | Tiếp theo |
| --- | --- | --- | --- |
| D0 Bộ tài liệu | Đã soạn và kiểm tra | Relative links/encoding và `git diff --check` đạt; prompt goal dưới4.000 ký tự; không chạy app tests vì chỉ sửa docs | User bắt đầu goal; xem commit tài liệu ở Git |
| P0 Khảo sát/thiết kế/ảnh thử | Đang làm | Baseline/audit D1/art venv; các quyết định bên dưới | Chốt hợp đồng lưu/đóng ngày, thử model local |
| F1 Nền habit | Đạt lát cắt local; chưa release | `0031_habits.sql`, domain/service/port/store/auth API, web CRUD/log/history/export, unit/integration/Chrome QA | Tiếp tục F2, mở rộng cases HTTP/biên thời gian; release chung cuối goal |
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

### Quyết định đang triển khai

- **A01**: Tuần bắt đầu thứ Hai theo ordinal ngày sinh hoạt. Habit daily/chọn thứ mới theo dõi ngay, cam kết từ ngày sau; quota tuần từ thứ Hai sau. Đổi mục tiêu/kiểu/lịch hoặc archive/restore có hiệu lực ngày sau, trừ khi lịch trước/sau là tuần thì từ thứ Hai sau. Không xóa revision/history. Day snapshot dùng cửa sổ schedule hiện có; ngày cũ khóa theo server clock dù cron chậm. Cần kiểm chuyển giờ sinh hoạt và delayed catchup tại integration.
- **A02**: Giá trị lưu integer hundredths, nhập tối đa 2 chữ số thập phân/1.000.000 đơn vị; check chỉ 0/1. Đạt đủ mới đóng góp; trần quota Q; neutral không vào mẫu số. Habit nhiều chỉ tăng tốc có trần 6 (1 + 0,12 mỗi habit thêm), điều kiện trưởng thành còn phải chốt trước F3.
- **A07 (phần habit)**: Definitions/revisions/logs/outcomes tách khỏi tài khoản healthy; không mỗi tick tăng version healthy. Guard/version và receipt riêng theo owner; receipt kiểm trước clock/day để retry đã commit qua ngày trả kết quả cũ. Log dùng version habit + version log + ngày công bố; giá trị là tổng thay thế, không phép cộng dễ lặp.
- Habit store giới hạn 30 habit hoạt động, tracking max100 entries trong list gồm archived; timeline/history có cursor keyset `(day desc, habitId asc)`, max100 trang đọc và tối đa366 ngày truy vấn. Cron xử lý6 habit-days mỗi phase3 (max50 trong lệnh maintenance); không bỏ các ngày vắng mặt như healthy suspension. Archived days giữ lifecycle trong revision, restore từ tương lai không gỡ archive của quá khứ. Current preview dựng tối đa7 ngày log, không phát thưởng trước đóng ngày.

### Checkpoint F1

- Chưa có game receiver/settlement luyện/battle; `habit_outcomes.game_applied=0` để F3 consume atomically. Không gọi dữ liệu habit đã có là game hoàn tất.
- Migration mới chưa áp remote; chưa deploy/push triển khai. Source/art tooling chỉ chạy local. Phần tiếp theo: báo cáo tuần/tháng + nhắc/slot opt-in và API integration, rồi A03/F3 luyện.


Quyết định đáng giữ viết ngắn theo mẫu: `ID — vấn đề — lựa chọn — lý do/alternatives — ảnh hưởng dữ liệu/UX — case kiểm chứng — docs/code liên quan — trạng thái`. Cập nhật đặc tả sở hữu chủ đề khi quyết định đổi; quyết định không được chỉ nằm trong chat/summary.

Checkpoint cuối phần việc/phiên cần:

1. HEAD/branch và git status; các thay đổi user hoặc unfinished files cần giữ.
2. Đã làm, chưa làm, cổng vừa đạt/chưa đạt; command/kết quả/fixture/seed/screenshot paths.
3. DB/migration/feature flags/jobs/content/art version và target deploy nếu có; không secrets.
4. Findings còn cụ thể, blocker thực tế và next action độc lập; việc kế tiếp bắt đầu bằng file/case nào.
5. Dịch vụ local đang chạy/model cache ở đâu và cách dừng/resume, không để công cụ art tiếp tục ngoài ý muốn.

Giữ một bảng trạng thái hiện tại và các quyết định đang hiệu lực; lịch sử nằm trong Git. Chi tiết kiểm thử lặp dài/ảnh/model logs lưu artifact có giới hạn, docs chỉ dẫn vị trí. Lệnh tiếp tục cùng mục tiêu: đọc checkpoint, kiểm source/workspace rồi làm next action, không khởi động lại từ đầu hoặc rút xuống demo.
