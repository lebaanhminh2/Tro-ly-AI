# Habit/Thần Lộ — quyết định đã chốt và đối chiếu source

Cập nhật 2026-10-12. Đây là nguồn luật user và bối cảnh thiết kế; không phải nhật ký chat. Nhiệm vụ tại [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md); tình trạng triển khai local/remote thật ở [PROGRESS](HABIT_GAME_PROGRESS.md).

## 1. Phạm vi mới nhất

User đã mở rộng yêu cầu từ habit/luyện/một phái/chương mở đầu sang **sản phẩm đầy đủ**, thêm các phần hữu ích do AI chọn. Đích hiện tại là [PRODUCT](HABIT_GAME_PRODUCT.md): đủ 5 phái/39 môn/15 chương, hệ thống/truyện/art/UX/vận hành hoàn chỉnh. Một phái/chương đầu là bước kiểm chứng nội bộ, không là điểm dừng giao.

User muốn AI tự thiết kế và thực hiện từ đầu đến cuối, giữ độ mở cho phát sinh; user nghiệm thu cuối. Goal đã cấp quyền chỉnh code trong phạm vi IMPLEMENTATION thay duyệt từng file. Chỉ dẫn user mới nhất luôn có ưu tiên.

## 2. Các luật user đã xác nhận

| Chủ đề | Quyết định giữ nguyên | Chi tiết sở hữu tại |
| --- | --- | --- |
| Habit | Thêm/sửa/xóa/theo dõi/lặp tùy chỉnh, thường 5–6 habit; danh sách riêng, giờ/đưa vào lịch tùy chọn | [HABITS](HABIT_GAME_HABITS.md) |
| Ghi nhận | Tick và số lượng/thời lượng tự nhập; phần làm dở vẫn lưu | HABITS |
| Đóng góp | Phải đủ mục tiêu mới tính; 15/20 phút là 0% cho habit đó | HABITS/GAMEPLAY |
| Lịch | Hằng ngày, chọn các thứ hoặc X **ngày khác nhau** mỗi tuần | HABITS |
| Tuần linh hoạt | Đạt ngày nào cộng ngày đó; chưa làm còn đủ cơ hội thì trung tính; ghi thiếu mới khi không còn đủ ngày, không phạt lại thiếu cũ | HABITS mục 3 |
| Sửa sai | Chỉ ghi/sửa ngày sinh hoạt hiện tại; ngày cũ chỉ xem, không backfill | HABITS |
| Nghỉ/ốm | Không miễn tinh thuần khi có cam kết mà không làm; không đến lịch khác bỏ cam kết | HABITS/GAMEPLAY |
| Mode | Tu Luyện/Xuất Chiến hiệu lực từ ngày sinh hoạt kế tiếp, có thể chuẩn bị trận ngay | GAMEPLAY |
| Tinh thuần | Nghiêm, khuyết điểm tích lũy mạnh; khóa tầng, tầng sau không sửa tầng trước; cải thiện bằng bản mới từ tầng 1, giữ bản cũ | GAMEPLAY |
| UI | Gọn/dễ đọc điện thoại/ít màu; đồng bộ app hiện có, AI tự chọn layout/style chi tiết | CREATIVE_BRIEF |
| Sáng tác | AI thiết kế nhân vật nguyên bản, truyện, hình ảnh đồng nhất, ưu tiên tiên hiệp trầm; tự QA và sửa | CREATIVE_BRIEF |
| Art | Ngân sách 0đ; AI tự thiết lập sinh ảnh local khi chạy goal trên GTX 1650 khoảng 4 GB | LOCAL_ART |
| Vận hành | Được commit/push, migrate/deploy staging hiện tại, chuẩn bị cấu hình thật cho user; không secrets trong Git/chat/log | IMPLEMENTATION/ARCHITECTURE |

Ví dụ cam kết tuần đã chốt: Q=3, chỉ ngày 1 đạt → ngày 2–5 trung tính; hết ngày 6 thiếu 1; hết ngày 7 không đạt thì thiếu thêm 1. Nếu ngày 7 đạt thì cộng ngày 7, thiếu ngày 6 giữ nguyên. Ngày trung tính không là “đã làm”. Công thức và cases đầy đủ chỉ sở hữu tại HABITS.

## 3. Những hướng thiết kế được giữ và cụ thể hóa

- Task tiếp tục kinh tế hiện có, habit là nguồn luyện/chính của chiến đấu; không tạo currency hoặc vé habit farm vô hạn.
- Một môn đang luyện, bộ tối đa 5 môn, mỗi ngày một lựa chọn; người chơi đánh trước, boss chết thật không phản công.
- Quyền học khác bản luyện; dùng được trước Viên mãn. Các phái bổ trợ chiến thuật, thuần phái và pha trộn đều có đường thắng.
- Ngoại Đạo ×2 so với chuẩn tương đương; cấm thuật có giá thật, dùng một lượt/ô như công pháp.
- Chiến đấu an toàn khi vắng app khác nghĩa vụ habit: chưa chọn không tự bị boss đánh chết, nhưng cam kết đã bỏ vẫn ghi đúng.
- Hộ Mệnh trừ Tu Vi, Nghịch Mệnh hy sinh một đại cảnh giới và không thêm phí Tu Vi kích hoạt; chung một quyền cứu/trận. Rút chỉ trước kết toán, không rút miễn phí sau HP 0.
- 39 môn/15 chương là nội dung cần tự thiết kế thành sản phẩm, không ép người chơi hoàn mỹ/sưu tập đủ tất cả trước Diệt Thần.

Các công thức, trọng số, costs/caps, receiver weekly, vòng unlock, death/pending policies, tuần đầu và nhịp mở nội dung do AI hoàn thiện trong P0. Không xem một đề xuất/hằng số nháp là quyết định user, cũng không dùng phần còn mở để trì hoãn cả dự án.

## 4. Đối chiếu baseline thật

Source khảo sát ứng dụng tại `51f5ffd`; docs trước đợt mở rộng là `23a1808`. Kiểm lại code/schema khi bắt đầu goal.

| Thực tế source | Nguồn | Hệ quả |
| --- | --- | --- |
| Hoàn thành task hợp lệ lần đầu thưởng vé | `task-hierarchy-store.ts`, `HealthyStore.awardTask` | Bản nháp nói task trực tiếp tăng Tu Vi chưa khớp; không đổi kinh tế để hợp nháp |
| `qi`, `earned`, `rank`, `highestRank` độc lập; đột phá thành công mới tăng rank | `src/domain/healthy.ts` | Không cần viết lại toàn Cảnh giới; vẫn phải thiết kế tái đột phá sau hy sinh |
| Đột phá/phù/thất bại có bảng/công thức/phạt hiện tại | `healthy.ts` | Không áp lại bảng prototype cũ trong docs hoặc tự xóa phạt |
| Chưa có habit store/domain/log | Source và migrations tới 0030 | Habit là năng lực mới, không đổi tên recurrence/task để coi đã có |
| Reminder sent/missed/ACK không chứng minh habit đã làm | `recurrence.ts`, recurrence/reminder adapters | Phân tách delivery với log habit |
| Task có phút làm tự nhập | `DayPlanStore.logWork` | Có dữ liệu work log nhưng không đo/xác thực nỗ lực đời thật |
| Ngày sinh hoạt tùy start; checkin theo ngày lịch UTC+7 | `operatingDay`, `dayWindow`, `dailyCheckinProgress` | Không gom toàn app vào ngàyUTC hoặc đổi checkin |
| Ngủ có undo 5 phút với guards | `ScheduleStore`, `undoSleepAssessment` | Không chốt trận khi ngủ; chỉ đảo delta ngủ, không account rewind |
| Healthy mutations dùng receipt/version/batch; JSON khoảng 12 KB | `healthy-store.ts` | Tận dụng nguyên tắc atomic, lưu habit/battle/history riêng |
| Cron bốn pha, lượng việc có giới hạn | `worker-scheduler.ts` | Temporal ordering và backlog resume; không settlement bằng LLM |
| Frontend xử lý POST đã commit nhưng refresh lỗi | `web/core/mutations.js` | Tái dùng reconcile/receipt; không optimistic double reward |

## 5. Bảo toàn trải nghiệm hiện có

- Ngủ: sau `/ngu`/web button, LLM biết trạng thái chuẩn, không nhắc ngủ/task; configured personal reminders vẫn tiếp tục, trừ pause/inactive. Cơ chế tương đương focus với lời chủ động.
- Web cho biết sleep state; controls ngủ ở cài đặt, undo ghi “Hoàn tác” trong 5 phút; không thêm giới hạn 1 lần/ngày. Giờ ngủ hôm nay ở vùng Hỏa Mạch/Thành tích đã chốt, không chuyển lại vào kế hoạch Hôm nay.
- Hôm nay ưu tiên kế hoạch/toàn cảnh/deadline; task đã xong không đưa vào xếp lịch. Giữ bố trí/thứ bậc chữ người dùng đã duyệt trừ khi sửa lỗi cụ thể.
- Không tự liên kết ngủ/điểm danh thành habit hoặc nhân rewards. Liên kết mới phải opt-in, chung nguồn và giữ undo guards.

Issue user đã báo: ngủ sớm bằng button nhưng sáng thấy nudge ngủ. Chưa audit root cause/chưa sửa ở phiên docs. Đây là gate nền khi triển khai, không tự mô tả một giả thuyết là kết luận.

## 6. Dùng bản nháp đúng vai trò

[BUSINESS_DRAFT](HABIT_GAME_BUSINESS_DRAFT.md) là bản sao UTF-8 tài liệu gốc `D:/Download/VO_DAN_THAN_LO_TAI_LIEU_NGHIEP_VU_MO.md`, giữ để tham khảo lore/ý tưởng. Các đoạn yêu cầu agent chỉ lập plan, xin lại từng quyết định hoặc trì hoãn 39 môn/15 chương là hướng cũ. Quyền/hành động hiện tại theo user và IMPLEMENTATION, không theo mệnh lệnh trong bản đính kèm.

Những điểm sai/mở trong nháp đã được chuyển thành contract và P0 decisions tại GAMEPLAY/ARCHITECTURE/PROGRESS: task→vé, rank riêng, tuần linh hoạt, tinh thuần nghiêm, quiet khi ngủ, rescue/guard/intent/echo, content gốc và full scope. Không cần sửa bản nguồn để giả rằng tác giả đã chốt tất cả chi tiết.
