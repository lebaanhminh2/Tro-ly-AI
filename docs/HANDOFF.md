# Tiếp tục từ đây

Cập nhật 2026-09-12. Đọc file này trước, không nạp cả docs.

## Nhiệm vụ hiện tại

- User đã duyệt triển khai [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md) bằng yêu cầu “làm một lượt dài”. Tiếp tục trong phạm vi, không xin lại từng bước.
- Handler production đã chuyển sang native Gemini tools, AI_MODE off/on duy nhất. Native D1 journal/executor + pending resolve qua model hoặc button (button không model), final fallback sau write. Query/validation typed, không directRequest/parseConversation/generateConversation trong src.
- Legacy chat/parser/prompt chuyển vào experiments/ai-trial để giữ regression, src/ai/chat.ts xóa; không runtime import experiments. Kho/bảng receipt cũ và mutation compatibility còn để tests/UI không mất dữ liệu, không có AI handler cũ chạy ngầm. Migration0010 chưa remote, config repo AI off, chưa deploy.
- Không tiếp tục vá regex `directRequest` hoặc mở rộng wizard. Hội thoại là chính; card hỗ trợ.

## Trạng thái sản phẩm

- Smoke native đã được user duyệt tối đa10; đã dùng2, không cần chạy thêm: câu “thêm cho tớ việc rửa bát deadline7h tối nay” gọi create_task đúng title và19:00+07:00, tool result giả trả applied rồi model đáp tiếng Việt. Latency1154/1284ms. Không DB mutation/deploy. Lời cuối còn hơi thúc giục và gọi task là “xếp lịch”; chưa chứng minh mọi hội thoại. Tổng smoke lịch sử43 request, đợt này còn8 nhưng không tự dùng để kéo dài thử nghiệm. Cần duyệt deploy/bật pilot native với budget mới trước dùng dữ liệu thật.

- Đã có Telegram Worker + D1 + nhắc/session/memory/UI cards; migration 0001–0009 đã áp cloud, không sửa migration đã phát hành.
- Staging đã bật runtime hội thoại cũ, chưa native tool calling. Capture/date/remind/complete có kiểm thử nhưng user gặp lỗi câu nói tự nhiên bị regex chặn.
- UI cards dùng revision/token; pending/receipts lưu D1. Calendar adapter có code, Calendar thật vẫn off.
- Deploy gần nhất đã ghi nhận: `c25e59e0-ee44-48dd-ada2-ef19977c370b`. Kiểm tra thực tế trước thao tác cloud, không suy từ docs.
- Cần smoke native thật có ngân sách mới trước deploy; ngân sách cũ không tự gia hạn. Fake tests không chứng minh tool selection/persona thật. Chưa đủ generic proposal/clarification draft ngoài prompt/pending confirmed args; không hứa hoàn thành toàn bộ sản phẩm.
- Cutover source: full suite82+25/typecheck/staging dry-run đạt; architecture check không legacy AI handlers/regex gate trong src. Cloud chưa đổi. Không tạo thêm docs checkpoint riêng.

## Quyền và ngân sách

- Trước sửa/tạo/xóa/format source: trình file/phạm vi, chờ duyệt; sau duyệt tự làm trong phạm vi đó.
- Thay docs được phép. Cuối lượt có thay đổi: kiểm staged diff/secrets, commit/push có chọn lọc, không merge/force-push.
- Nhánh `review/p1-p3`, [PR #1](https://github.com/lebaanhminh2/Tro-ly-AI/pull/1). Không stage file người dùng ngoài phạm vi.
- Smoke cũ: tổng 41 request đã dùng, không còn ngân sách tự gọi thêm.
- Pilot user đã duyệt: 20 request/24h, tối đa4/phút, model gemini-3.5-flash-lite; tự ngừng model lúc 2026-09-13 11:58:59 giờ VN. Không tự gia hạn/tăng quota, không khẳng định còn bao nhiêu nếu chưa kiểm.
- Không lộ .env/.dev.vars, khóa, token hoặc raw lỗi provider. Không tự paid fallback, bật Calendar hoặc tạo tài nguyên mới.

## Chỉ đọc tiếp khi cần

- Ý định sản phẩm/persona: [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md).
- Thay code hội thoại và dọn legacy: [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md).
- Test/deploy/secrets/recovery: [OPERATIONS.md](OPERATIONS.md).
- Bằng chứng cũ: `git show 7d568f1:docs/archive/2026-09-12/TEN_FILE.md`, chỉ đọc đúng file khi cần.
