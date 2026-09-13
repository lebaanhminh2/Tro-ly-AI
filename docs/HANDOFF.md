# Tiếp tục từ đây
Cập nhật2026-09-13. User duyệt bảng công việc, biểu đồ/streak/thành tựu và thêm chọn-xóa nhiều/sửa từ bảng. Đã triển khai, chờ user nghiệm thu trải nghiệm.

## Bản hiện tại
- Worker staging version59549382-0a33-4a47-b0ed-d2f113ffdcf6. Migration0001–0012 đã áp cloud; tuyệt đối không sửa lại.
- /tasks hoặc Gemini show_work mở bảng5 việc/trang, lọc và chọn nhiều qua các trang. Review rồi confirm mới soft-delete/hủy reminder/session/clarification liên quan.
- Selection revision/expiry và task version được kiểm; stale thì không xóa, yêu cầu chọn lại. Thoát chọn xóa selection. Không có nút khôi phục thùng rác trong bản này; deleted_at giữ dữ liệu để phục hồi có chủ đích.
- Chi tiết có Sửa bằng chat khi AI bật; focus task rồi đổi tên/hạn qua cùng executor. Tên+hạn cùng một câu được hỗ trợ.
- /progress, show_work progress, nút Tiến bộ mở PNG backend tự vẽ (CompressionStream native, không dependency/API ảnh).
- Biểu đồ7 ngày, ô hoạt động28 ngày, streak và các mốc1/10/30 task,3/7/14/30 ngày. Số liệu bắt đầu từ0012, không bịa lịch sử completed cũ.
- task_completions ghi ngày hoàn thành/deadline snapshot; reopen xóa current completion không cộng trùng task. record_progress chỉ ghi mốc user đã làm, nội dung giống nhau cùng task không cộng thêm.
- Achievements giữ khi streak đứt, mỗi code có outbox key cố định chống thông báo lặp/concurrent.
- Chart refresh đọc DB sau commit; caption lời khen giữ ngắn. Chuyển chart↔achievements sửa ảnh cùng message; chữ↔ảnh tạo card mới và vô hiệu nút cũ.
- Gemini native tools duy nhất + respond; deferred mutations/receipt/history/outbox cùng transaction. Không gọi model khi chuyển trang/lọc.
- User duyệt bỏ trần pilot: production không còn40/24h,4/phút hoặc AI_TRIAL_ENDS_AT. Vẫn tối đa2 model steps/turn, dedupe receipts, không paid fallback. Google429 được báo riêng là giới hạn phía Google; không tự retry.

## Bằng chứng
- Bỏ trần pilot: typecheck,13 targeted tests và staging dry-run đạt; test >45 requests cùng timestamp vẫn chạy, duplicate không gọi lại; Google429 có thông báo riêng. Đã deploy cấu hình không quota/time cutoff; chưa gọi live Gemini trong lượt này.
- Lượt full94 tests chính +25 experiments đạt; typecheck/dry-run đạt. Bổ sung cuối tên+hạn:4 integration progress tests đạt.
- PNG thử trong Node và workerd thật; multipart sendPhoto/editMessageMedia fake đạt. Staging /progress trước gửi message87.
- Tiếp tục lượt này không gọi Gemini. Mở /tasks và /progress thật: done; Telegram sent message106 và107. Không khẳng định push hoặc độ đẹp trên iPhone thay user.
- Ngân sách kiểm thử của agent vẫn tách biệt với quyền user chat: Gemini live của đợt trước2/8 request cho show_work(all) và record_progress+show_work+respond đúng. Còn tối đa6 theo ngân sách đợt này, không tự gia hạn.
- Test xóa chạy DB local: non-destructive selection, stale không xóa, owner scope, soft-delete, thành tích vẫn giữ, concurrent unlock không gửi lặp.
- Live xóa task QA đã bị môi trường chặn lượt trước; không workaround. Read-only xác nhận qa_board_0012_a/b không tồn tại. Lượt này không tạo/xóa dữ liệu thật.
- Backup .wrangler/staging-before-0012.sql ignored; restore SQLite cần foreign_keys=OFF trong import vì export thứ tự bảng, bật ON và foreign_key_check0 sau import; migration giữ task counts.

## Giới hạn
- Chưa có chọn kỳ lịch sử trong chart; cố định7/28 ngày. Không streak freeze/XP, không lịch ngoài/Google, không AI planner nền liên tục.
- Một nhóm confirmation hiện hành cho chat; clarification nhiều mục. Delete nhiều từ bảng có review riêng.
- Dữ liệu thống kê không chứng minh khối lượng/độ khó; thời gian dự kiến không được tính thành tập trung.
- Raw history30 ngày, summary mất mát; không hứa hiểu đúng mọi câu.
- Cần user nghiệm thu nội dung cute, độ đọc ảnh và thao tác trên iPhone; không cần user chạy unit tests.
- Git local lưu checkpoint, không push do quyền xuất bản từng bị từ chối. Không commit secrets/backup.
