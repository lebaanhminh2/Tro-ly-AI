# P3 — hội thoại và bộ nhớ local

Ngày 2026-09-11. Phạm vi local/offline, không gọi thêm Gemini/Telegram hoặc deploy.

## Đã triển khai

- `/remember nội dung`: user ra lệnh rõ lưu preference có source; `/mood nội dung`: context hết hạn cuối ngày Việt Nam.
- `/memory`: xem bộ nhớ, 8 mục/trang và nút trước/tiếp; giới hạn UI riêng với context model. `/forgetall` có xác nhận owner-bound dùng một lần, TTL 5 phút, có hủy; nút legacy không còn thực thi. Xóa memory đồng thời bỏ history/focus để không đưa thông tin đã quên vào model lần nữa.
- `/ai off` và `/ai on` kiểm soát tùy chọn; runtime mặc định vẫn off và không tự lấy key.
- Nút “Nói về việc này” trong /tasks giữ focus task 15 phút; context builder lấy task đúng owner, memory còn hạn và 4 cặp trao đổi gần nhất.
- History lưu cùng command transaction, tối đa 7 ngày trong truy vấn; scheduled cleanup xóa history/temporary/focus hết hạn và làm rỗng payload/result inbox đã hoàn tất quá 7 ngày.
- Context chọn lọc không chứa credentials; giới hạn theo độ dài ký tự, cắt cặp history cũ trước. Chưa có tokenizer nên không tuyên bố đã bảo đảm 4.000 tokens.
- `contextualChat` dùng dependency injection: candidate capture trở thành proposal cần xác nhận; update task yêu cầu nút chọn field, không tự sửa dữ liệu.
- Quota reservation D1 nguyên tử: 4 request/phút và trần rolling 24h cấu hình (default nội bộ 100); scope server chọn project/model; command retry không gọi model lần hai. Khác reset quota provider.
- Nếu quota hết hoặc provider lỗi, backend trả thông báo; task/nút/nhắc không phụ thuộc model.

## Bằng chứng và giới hạn

Kết quả: 35/35 tests mặc định + 25/25 experiments pass; typecheck, migration 0005 local và Workers dry-run pass. Không gọi AI thật trong P3.

Integration memory test dùng fake model; kiểm tra continuity, focus, forget, expiry, owner, capture không commit trước confirm, AI off và quota race. Không dùng response mẫu để tuyên bố persona Gemini thật đạt chất lượng.
Live model selection vẫn kết thúc tại MODEL_VERDICT; prompt p3-context-0.1 chưa live thử. Không nối provider mặc định, không tự cấp ngân sách.
Chưa có AI tự học preferences hoặc summary; chỉ user chủ động lưu. Các câu “nay mệt” qua chat được giữ trong history ngắn, không tự lưu thành preference lâu dài.
Clarification nâng cao/ngày tự nhiên vẫn chưa có: focus là task được chọn, thao tác quan trọng tiếp tục đi qua UI ngày rõ. Context lỗi/quá dài thì fail closed.
Forget xóa memory/history/focus và kết quả inbox cũ của owner, không xóa tasks. Bản sao outbox/audit/backups hoặc Telegram/provider không bị thu hồi tự động; retention hoàn chỉnh là cổng release P5.
Không thể bảo đảm hủy request đang bay nếu user xóa sau lúc request đã được gửi. Pipeline owner tuần tự và thao tác mới không dùng lại history đã xóa.
Reservations giữ tombstone command IDs để không reset quyền gọi khi dọn TTL; chưa có cleanup ledger toàn hệ thống.

## Dùng thử offline

`npm.cmd test`, `npm.cmd run test:experiments`, `npm.cmd run typecheck`; migration 0005 qua `npm.cmd run db:local`; bundle qua `npm.cmd run build:check`.
Không truyền `.env` cho tests. Muốn bật AI thật cần duyệt cách nối quota, model và dữ liệu, không chỉ đổi cờ /ai on.
