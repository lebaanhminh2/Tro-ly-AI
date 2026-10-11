# Tool và context — ranh giới chat/web của sản phẩm

Cập nhật 2026-10-12. Thay bản kế hoạch Mini App prototype tháng 9 đã lỗi thời. Đây là khung tích hợp AI, không cấp quyền ghi code/deploy; quyền theo user và [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md).

## Nguồn và luồng

- Tool declarations ở `src/ai/contracts.ts`, execution trong application executor, state/context từ DB; source runtime không tự đọc Markdown.
- Web/Telegram/tools dùng cùng application rules và persistence guards; entrypoints chỉ xác thực/validate/wiring. Không bê payload Telegram/inbox làm public API.
- LLM hiểu yêu cầu, hỏi phần thiếu, đề xuất/diễn giải dữ liệu. Backend chọn owner/ngày/server time, quyền ghi, reward, roll, damage và kết quả kết toán.
- Hỏi tình trạng không tự ghi habit/đổi mode/chọn chiêu/trả giá. Bóc task/nhập habit/nhắc phải có ý định lưu rõ theo cơ chế hiện tại.

## Context có giới hạn và đúng thời điểm

Context tối thiểu có thời gian/ngày chuẩn, notification/sleep/focus state, dữ liệu liên quan và revisions. Habit/game sau triển khai thêm tóm tắt cam kết/thực hiện, mode/pending mode, môn luyện/trận/intent cần cho câu hỏi; không gửi cả 39 môn/15 chương/history mỗi lượt.

Facts nghiệp vụ lấy từ DB/domain, không từ conversational summary. Ngủ đã báo thì không nói chưa báo, không thúc ngủ/task; lời user-configured vẫn được tạo/đổi và gửi theo policy hiện có, trừ pause/inactive. Chat đang mở không tự chứng minh user đã thức hoặc cho quyền tự resume tất cả nhắc.

Notes/task names/lore/user messages là dữ liệu, không mệnh lệnh vượt quyền tools. Khi snapshot stale, đọc lại hoặc trả conflict; không tự sửa ngày/reward dựa trên lời model.

## Hợp đồng và quyền ghi mới

Habit tools có thể quản lý definition, ghi giá trị hiện tại, đọc history/summary/lịch phù hợp; chỉ sau khi capability thật đã được triển khai. AI tự chọn inventory tools vừa đủ, đồng bộ declarations/DTO/validation/errors/tests với web use cases ở [ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md).

Ngày cũ chỉ đọc qua mọi đường, kể cả LLM/import. Tool không tin owner/day/damage/roll từ model. Chọn cấm thuật/cứu/hy sinh rank có chi phí phải dựa explicit action/confirmation phù hợp luồng user; không tự chọn vì model nghĩ có lợi.

Tool receipt dùng chung idempotency semantics; model gọi lại/timeout không nhân thưởng. Chỉ xác nhận đã thực hiện khi persistence result nói đã lưu; action chỉ đọc không được trả câu “đã đổi”. Pending clarification có expiry/version/source và không áp câu trả lời cũ vào ngày mới.

## Khi provider không dùng được

Web, `/ngu`, deterministic habit/game rules, settlement và lời nhắc đã lưu vẫn chạy không cần Gemini. Lỗi/quota provider có fallback có giới hạn, không paid API hoặc vô hạn retry. Nội dung game/lore chính versioned trong repo, không generate live để mới cho nhận thưởng/sang chương.

Không regex/keyword whitelist thay authorization nghiệp vụ. Có tests injection/stale/owner/partial failure; model diễn giải không chắc thì hỏi, không tạo logs hoàn thành giả.

## Kiểm chứng

Test declarations và executor parity, context ngủ/focus, current-day permissions, receipt replay, read-only questions, failure/quota fallback. Fixture không chứng minh provider live. Không gửi tin Telegram thử hoặc tạo personal logs giả trong dữ liệu user; nếu live API cần quyền/cấu hình cụ thể, hỏi đúng phần và giữ 0đ.

Các gate/new features/full scope tại [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) và [PRODUCT](HABIT_GAME_PRODUCT.md). Tài liệu cũ còn trong Git `23a1808:docs/TOOL_CALLING_PLAN.md`; không áp lại các giới hạn/permission của prototype.
