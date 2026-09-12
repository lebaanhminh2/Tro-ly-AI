> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# Bảo mật, kiểm thử và vận hành v1

Ngày 2026-09-11. Checklist theo rủi ro, không chứng nhận “không có lỗ hổng”. Thuộc [DELIVERY_PLAN](DELIVERY_PLAN.md).

## 1. Tài sản và ranh giới tin cậy

Tài sản: tài khoản Google/Telegram, lịch và thói quen, nội dung chat/facts, quyền ghi Calendar, ngân sách API, dữ liệu backup.
Biên không tin: request internet, callback data, Calendar descriptions, output LLM, URLs trong chat, dependencies và logs.
Chỉ backend xác định owner/quyền; UI, prompt, ID khó đoán hoặc “chỉ một user” không thay thế authorization.

## 2. Kiểm soát phải có và bằng chứng

| ID / nguy cơ | Kiểm soát | Kiểm thử bắt buộc / mốc |
| --- | --- | --- |
| SEC01 IDOR/BOLA | Deny by default; owner từ phiên đã xác thực; kiểm tra mọi query/mutation/action | User khác đọc/sửa/callback/export đều thất bại; P1 |
| SEC02 Webhook giả/replay | Secret, private chat allowlist, input cap, dedupe và replay policy | Sai secret, group, update lặp/cũ, body malformed/oversized; P1 |
| SEC03 SQL/mass assignment | Bind parameters; schema allowlist; command DTO không nhận owner/status/version tự do | Chuỗi SQL, unknown field, ID sai loại, negative time; P1 |
| SEC04 XSS/markup | Escape output, không render model HTML; CSP nếu có web | Tên task/notes chứa script/markup/URL; P1, web khi có |
| SEC05 OAuth account linking | State một lần có TTL, owner binding, fixed redirect, kiểm tra error/revoke | State reuse/expired/wrong owner/open redirect; P4 |
| SEC06 Secrets | Worker secrets; local ignore; không log token URL/header/prompt; refresh token mã hóa | Secret scan file tracked + lịch sử trước push; logs/errors đã che; P1/P4/P5 |
| SEC07 Prompt injection | External text là data, tool allowlist, backend policy, không execute code/SQL/URL do model đưa | Injection trong Calendar/task/history không bypass confirm; P3/P4 |
| SEC08 SSRF/exfiltration | Endpoint API cố định, không fetch link tùy ý từ chat/model, hạn redirect | localhost/private IP/metadata URL và redirect không được truy cập; P3/P4 |
| SEC09 Race/duplicate | Atomic mutation+command+outbox; owner serialization/fencing, unique IDs | Crash từng điểm, concurrent confirm, lease cũ, reordered input; P1/P2 |
| SEC10 Quota/DoS | Limit theo owner/project, body/token cap, job batch cap, retries bounded | Burst, provider 429, hết budget, hàng đợi dồn; P2/P3 |
| SEC11 Supply chain | Lockfile, CI tối thiểu, kiểm tra dependency, overrides có lý do | Reproducible install, audit; không `audit fix --force` mù quáng; P1/P5 |
| SEC12 Data lifecycle | TTL/scope, delete cascade/ref/summary, export authorized, backup policy | Xóa rồi context không còn nhớ; restore không đưa token lên log; P3/P5 |

Nguồn: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) cho least privilege/kiểm tra mỗi request; [OWASP prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) cho phòng vệ nhiều lớp. Prompt không phải ranh giới bảo mật đủ mạnh.

## 3. Quyền Calendar

Đề xuất đọc calendars được chọn bằng scope đọc phù hợp; `calendar.app.created` cho secondary calendar app tạo thay vì quyền ghi mọi lịch. Chọn scope thực tế tối thiểu tại P4, không giả scope chỉ giới hạn đúng calendar người dùng chọn; app vẫn phải allowlist calendar ID.
Không xin scope rộng chỉ để tránh lỗi 403. Phân biệt lỗi thiếu quyền/revoke/token expiry, không retry vô hạn. [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)
OAuth secret/encryption key riêng từng môi trường. AES-GCM hoặc cơ chế đã được kiểm chứng, nonce mới mỗi lần, key version; không tự thiết kế thuật toán mã hóa.
Refresh token không gửi sang AI, không xuất trong backup người dùng tải. Luân chuyển khóa có quy trình đọc dữ liệu cũ trước khi bỏ khóa cũ.

## 4. Vận hành miễn phí nhưng có kiểm soát

- Local: fake providers + DB local; staging: bot/calendar thử riêng; production: secrets/DB riêng. Không dùng `.env` thật cho tests tự động.
- Feature flags: AI off, Calendar writes off, reminder pause, maintenance; fail closed khi cấu hình sai. Không lén fallback sang model/provider trả phí.
- Observe: correlation ID, action/status, queue age, retry count, provider error class, CPU/requests/tokens; không chứa raw chat/token/query secret.
- Cảnh báo khi hàng đợi trễ, token Google hết quyền, vượt quota, jobs failed/uncertain. Theo dõi dashboard khi Telegram cũng hỏng; không chỉ cảnh báo qua chính kênh lỗi.
- Tiết kiệm: Cron không gọi AI để xem có việc không; không polling mọi Calendar mỗi phút; query indexed, bounded payload/context và output.
- Telegram 429 có retry_after; timeout/5xx có thể không rõ đã gửi, không retry gây spam mặc định. Calendar có stable identity để reconcile trước retry.
- Failure recoverable phải có đường xử lý rõ; không chỉ đẩy mọi lỗi sang người dùng kiểm tra /tasks mãi.

## 5. Release checklist

- [ ] P1–P4 acceptance đạt; không lỗi owner/secrets/mutation nghiêm trọng chưa xử lý.
- [ ] Dependency audit/secret scan/type/lint/unit/integration/build đã chạy; báo chính xác phần chưa kiểm tra.
- [ ] Local schema và cloud migration khớp; backup và restore vào DB tách biệt đã thử.
- [ ] Chọn bot/user/calendar đúng; consent screen, scopes, refresh và revoke đã kiểm tra.
- [ ] Quota/billing flags xác minh; người dùng biết dữ liệu gửi AI và retention. Không dùng free quota để suy ra privacy.
- [ ] Callback ACK, outbox, worker crash/fencing, quiet hours/day boundary được kiểm tra.
- [ ] iPhone pilot hoàn tất, máy cá nhân tắt; riêng tư màn hình khóa thông báo đã được hướng dẫn.
- [ ] Có rollback code/config; schema thay đổi kiểu expand/contract, không rollback mù gây mất dữ liệu.
- [ ] Có hướng dẫn xuất/xóa/ngắt quyền và công tắc dừng tác vụ; người dùng biết cách kiểm tra sức khỏe hệ thống.

Không xem audit=0 là “bảo mật tuyệt đối”. Chấp nhận rủi ro thấp phải có lý do/phạm vi và review lại; rủi ro mất dữ liệu/quyền vượt mức chặn release.

## 6. Khi có sự cố

1. Dừng AI/Calendar writes/reminders liên quan; giữ logs đã che và trạng thái jobs, không xóa để mất dấu.
2. Nếu nghi lộ secret: thu hồi/rotate ở provider, kiểm tra lịch sử Git/log/backups; `.gitignore` không làm secret đã commit biến mất.
3. Xác định command đã commit hay chưa, provider đã ghi/gửi hay chưa; reconcile trước retry.
4. Restore vào môi trường tách biệt trước, đo dữ liệu mất; xin duyệt trước ghi đè production.
5. Báo người dùng phạm vi ảnh hưởng và thao tác cần làm; thêm regression test, cập nhật runbook ngắn.

Runbook lệnh cụ thể và đường dẫn backup chỉ viết/kiểm chứng ở P5 khi tài khoản/đích thật đã có; không đưa lệnh phá hủy giả định vào docs này.
