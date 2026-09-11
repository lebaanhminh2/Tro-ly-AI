# Rà soát UX trước khi bật AI

2026-09-12. Đã duyệt rà soát; **phạm vi code dưới đây chờ duyệt**. Không thay dữ liệu cloud. Nguồn: ảnh iPhone, đọc application/domain/D1/Telegram, thử trực tiếp hàm với dữ liệu giả. Không gọi đây là kiểm thử end-to-end toàn bộ sản phẩm.

## Kết quả

| Vấn đề đã xác nhận | Bằng chứng | Sửa / tiêu chí đạt |
| --- | --- | --- |
| Card xác nhận giữ nút cũ, bấm lại sinh tin lỗi | Input không giữ message_id; commit luôn sendMessage; ảnh thực tế | Giữ ID card tin cậy, sửa card sau commit, bấm lại không mutation và không thêm tin lỗi dài |
| Nút bị cắt, thành công nói chung chung, danh sách trống không hướng dẫn | plan-command và ảnh | Danh sách chọn việc → chi tiết; nhãn ngắn; kết quả ghi đúng tên và bước tiếp theo |
| Lên buổi/đặt hạn ép nhập cú pháp | session-command, plan-command | Chọn ngày/giờ/thời lượng; nhập tay fallback có ví dụ thật, nút quay lại/hủy, xác nhận ngày giờ tuyệt đối |
| Nút buổi không khớp trạng thái | Thử sessionButtons/canAct: planned có pause/finish sai, running có start/snooze sai, paused có pause sai | Mọi nút hiển thị phải hợp lệ tại trạng thái đó; sau thay đổi hiển thị card mới |
| Today liệt kê nhiều buổi nhưng chỉ điều khiển buổi đầu | Mock hai sessions: callback chỉ có ID s1 | Chọn được từng buổi, không chỉ current; hiển thị trạng thái và giờ rõ |
| Chưa chặn bắt đầu hai buổi đồng thời | canAct kiểm tra từng session, SQL không kiểm tra running khác | Xử lý rõ buổi đang chạy trước khi bắt đầu buổi khác, không âm thầm tính hai timer |
| Input cũ có thể giữ người dùng trong form sau /tasks hoặc /today | Hai lệnh không clear session_input/selection | Quy tắc chuyển màn/input nhất quán; chat không bị hiểu là ngày giờ cũ; TTL vẫn áp dụng |
| Bấm xóa memory không tồn tại vẫn xóa history/focus | memory-command không đọc mục; memoryStatements xóa history/focus không phụ thuộc DELETE có trúng | Xác minh mục còn tồn tại trước khi xác nhận xóa; callback cũ không side effect |
| Nút trò chuyện hiện khi runtime AI off | focus luôn nhận và mời nói tiếp | Ẩn hoặc giải thích chưa bật, không giả đã có AI; phân biệt runtime và tùy chọn owner |
| /rest rồi /resume không khôi phục job đã cancel | preferences hủy reminders; resume chỉ reset pause_until | Hiển thị đúng phạm vi: resume không bù tin cũ, muốn nhắc lại phải hẹn mới rõ ràng |
| Giờ yên lặng nằm nhiều lớp | domain/session, reminders, settings, Calendar service; slots còn hard-code 08–21 | Bỏ chặn quiet theo yêu cầu mới, giữ pause chủ động; không để giới hạn 08–21 trở thành quiet ngầm |

## Khoảng trống chức năng, không che bằng đổi câu chữ

- Task mới có tên/hạn/version; chưa có trạng thái hoàn thành task, đổi tên hoặc lưu trữ. Kết thúc session không phải xong task. Chưa được gọi vòng đời task hoàn chỉnh.
- Snooze session đã gắn Google chưa PATCH event tương ứng. Trước live Calendar phải chọn hỗ trợ đồng bộ hoặc chặn thao tác đó và giải thích; không tuyên bố đã dời Google.
- Chưa có bằng chứng nhắc thật trên iPhone, vận hành khi tắt máy, backup/restore hoặc pilot. Test local xanh không thay thế các bước đó.
- Rà soát này không chứng minh đã tìm mọi lỗi. Cần test hành trình và các nhánh lỗi sau sửa, đặc biệt xử lý callback và external delivery không rõ kết quả.

## Đợt sửa nền UX đề xuất

Giữ Telegram-only, không thêm framework/model. Không thay cấu trúc dữ liệu cũ bằng xóa/tạo lại. Không bật Gemini/Calendar trong đợt này.

1. **Card và callback:** task list/detail, nhãn ngắn, cập nhật card sau commit; thông báo nhỏ cho callback cũ. Đích edit chỉ lấy từ callback đã xác thực và đối chiếu card app khi cần; không tin message ID do AI đưa. ACK nhanh độc lập, lỗi edit không rollback công việc đã lưu. Xử lý trường hợp card bị xóa/không sửa được bằng fallback có giới hạn.
2. **Lên lịch và thao tác buổi:** wizard lưu bước/draft/expiry/version trong D1, ngày giờ Việt Nam; nút theo trạng thái; chọn mọi buổi trong Today; guard một buổi đang chạy; hủy/chuyển màn dứt khoát.
3. **Nhắc:** loại quiet mặc định và cấu hình cũ khỏi quyết định gửi; giữ pause và 1 nhắc chính + 1 follow-up/15 phút mỗi lần hẹn, không cap ngày. Không hồi sinh reminder đã cancelled/uncertain. Bỏ hoặc tách khung 08–21 trong Calendar slot search, không đưa ra giờ bịa như thói quen user.
4. **Bộ nhớ và AI off:** nút cũ không xóa ngữ cảnh; trạng thái tính năng trung thực. Không mở rộng memory tự động.

**Chưa gộp vào đợt này:** vòng đời task hoàn thành/đổi tên/lưu trữ, PATCH Google hai chiều và live Gemini. Cần chốt phạm vi riêng để tránh đợt UX biến thành viết lại toàn sản phẩm; các khoảng trống này vẫn phải được xử lý hoặc công bố trước nghiệm thu v1.

### File dự kiến

- `src/application/{plan-command,session-command,memory-command,process-inbox}.ts`: điều hướng/callback, phân biệt capabilities, trạng thái input và các luồng trên.
- `src/domain/{work,session,calendar}.ts`, `src/ports/work-store.ts`: hợp đồng UI, wizard, hành động hợp lệ, bỏ quiet.
- `src/adapters/d1/{work-store,session-store,reminders,memory,outbox}.ts`: transaction UI+data, wizard bền vững, guard memory/session, nhắc không quiet.
- `src/adapters/telegram/api.ts`, `src/entrypoints/worker.ts`: message ID, edit card/keyboard, ACK; vẫn chặn redirect và sanitize lỗi.
- `src/adapters/google-calendar/service.ts`: không dùng quiet cũ; giữ Calendar off, không PATCH ngoài phạm vi.
- `migrations/0008_ux_flow.sql` mới: state wizard/card nếu cần; migration tiến tới, không drop dữ liệu.
- `tests/integration/ux-flow.test.ts` mới; cập nhật tests sessions/memory/review-fixes/telegram/calendar/workers-fetch và unit policy/time nếu hợp đồng đổi.
- Docs UX_FLOWS, DATA_DESIGN, HANDOFF cập nhật theo kết quả; không tạo thêm spec dài.

## Cách nghiệm thu

- Tự chạy hành trình qua Worker + D1 với Telegram giả: add → confirm → click lần hai → chọn việc → wizard → confirm → nhắc → start/pause/resume/finish.
- Nhánh bắt buộc: callback stale/expired, 2 buổi, start đồng thời, chuyển màn khi nhập dở, xóa memory lặp, restart wizard, edit thất bại, AI off/quota, hẹn lúc 05:00, pause/resume, không spam bù tin.
- Chạy adapter trong workerd thật để tránh lặp lỗi Node-only; typecheck/build, scan secrets, commit/push có chọn lọc.
- Sau duyệt deploy, thử ngắn trên iPhone: tên dài đọc được, nút không bị cắt, xác nhận không spam, lên lịch không cần cú pháp, nhắc đúng hẹn. Không tự tuyên bố trải nghiệm đạt chỉ từ tests.
