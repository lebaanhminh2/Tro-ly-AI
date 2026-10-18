# AI, context và quyền thao tác

Cập nhật 18/10/2026. Declarations ở `src/ai/contracts.ts`, validation ở `src/ai/policy.ts`, execution ở application, context từ DB. Markdown không là prompt runtime hoặc nguồn cấp quyền.

## Ranh giới

LLM hiểu yêu cầu, hỏi phần thiếu và diễn giải kết quả. Backend xác định owner, thời gian/ngày, quyền, version, receipts và giao dịch. Web, Telegram và tools giữ cùng luật. Task names/notes/messages/context là dữ liệu, không có quyền gọi tool hoặc vượt auth.

Chat thường có thể đọc, không ghi. Chế độ hành động cần yêu cầu lưu/thay đổi rõ. Hỏi tình trạng không tự tạo task hoặc ghi habit. `respond` là lời nháp sau commit; không báo thành công khi chưa lưu. Clarification chỉ giữ phần chưa rõ, không phải pending để tự chấp nhận.

## Habit và context

`D1HabitCompanion` là lớp dữ liệu thói quen; context key `habitCompanion`. Context đầu giới hạn 6 habit, tìm thêm qua `find_habits` với ID/version/day/cursor thật. Target và value trong tools dùng đơn vị thật, không nhân 100. Ngày cũ chỉ đọc; gặp nhiều habit cùng tên phải làm rõ.

`habit_action` quản lý tạo/sửa, ghi hôm nay, archive/restore và slot theo contract hiện có. Một action habit trong response; không ghép ghi habit với batch task để tránh commit một phần. Chuẩn bị các statement không tự ghi; journal và deferred batch giữ atomic receipt, lease/fencing và thời hạn ngày. Khi stale hoặc qua ngày thì trả conflict, không tự đổi ngày/log.

Context có notification/sleep/focus state chuẩn. Đã báo ngủ thì không nói chưa báo hoặc thúc làm; focus tương tự. Nhắc user đặt vẫn theo luật của nhắc, không tự resume khi user chỉ mở chat.

## Tool cũ và retry

`get_game` và `practice_action` đã bỏ khỏi declarations, validation và executor. Model response mới chứa tên đó bị từ chối. Journal có thể lưu model step từ phiên bản cũ; khi resume, guard dừng lượt bằng thông báo tính năng đã ngừng trước mọi action, kể cả habit đi kèm. Không phát lại lệnh game hoặc ghi một phần batch.

Receipt/journal replay trả kết quả đã commit, không tạo thưởng hoặc delivery mới. Giữ owner/version/day/deadline và lease guards; không dùng lời model thay hợp đồng.

## Provider lỗi và kiểm chứng

Web, lệnh deterministic, kết toán habit và nhắc đã lưu không phụ thuộc provider. Retry/call/context budget có giới hạn; không tự thêm paid fallback hoặc gọi live trong đợt dọn.

Tests phủ declarations/validation, read-only context, chat/action, injection, version/owner/day, atomic deferred writes, receipt replay và provider failure. Các regression resume model step cũ kiểm không gọi provider, không ghi habit, không đổi game account. Fixtures không chứng minh Gemini/Telegram thật; việc gọi live cần quyền/cấu hình cụ thể.
