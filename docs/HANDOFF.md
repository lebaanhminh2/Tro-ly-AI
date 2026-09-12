# Tiếp tục từ đây

Cập nhật 2026-09-12. Đọc file này trước, không nạp cả docs.

## Nhiệm vụ hiện tại

- Đã cơ cấu docs: 5 tài liệu nội dung + 1 link chuyển hướng staging. User duyệt xóa 27 Markdown archive; lịch sử ở Git `7d568f1`. Không sửa source/deploy.
- Tiếp theo: trình/nhận duyệt phạm vi code trong [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md).
- User đã đồng ý hướng tool calling, nhưng lượt gần nhất mới yêu cầu lập kế hoạch và dọn docs; chưa suy thành duyệt sửa toàn bộ protocol.
- Không tiếp tục vá regex `directRequest` hoặc mở rộng wizard. Hội thoại là chính; card hỗ trợ.

## Trạng thái sản phẩm

- Đã có Telegram Worker + D1 + nhắc/session/memory/UI cards; migration 0001–0009 đã áp cloud, không sửa migration đã phát hành.
- Staging đã bật runtime hội thoại cũ, chưa native tool calling. Capture/date/remind/complete có kiểm thử nhưng user gặp lỗi câu nói tự nhiên bị regex chặn.
- UI cards dùng revision/token; pending/receipts lưu D1. Calendar adapter có code, Calendar thật vẫn off.
- Deploy gần nhất đã ghi nhận: `c25e59e0-ee44-48dd-ada2-ef19977c370b`. Kiểm tra thực tế trước thao tác cloud, không suy từ docs.
- Test ghi nhận gần nhất: 72 tests chính +25 experiments/typecheck/dry-run đạt; không phải nghiệm thu chất lượng hội thoại.

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
