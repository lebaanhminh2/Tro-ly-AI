> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# P5 — nối AI vào runtime (local)

Ngày 2026-09-12. Phạm vi được duyệt: worker, cấu hình, integration test và docs. Không deploy, gọi provider thật, thêm SDK hay đổi model đã kiểm chứng.

## Đã nối

- Entry point tạo contextualChat từ adapter Gemini hiện có; context vẫn qua bộ nhớ/history/focus và kiểm tra quyền hiện tại.
- Hai tầng bật/tắt: `AI_MODE=enabled` của hệ thống và `/ai on|off` của owner. Mặc định runtime vẫn off; chỉ `/ai on` không đủ bật provider.
- Khi enabled cần `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_LIMIT` nguyên 1–500. Không có model/budget ngầm định. Không đọc `.env` tự động; khi staging dùng secret binding cho key, tuyệt đối không ghi key vào Git/chat.
- Quota D1 dùng scope cố định `runtime:gemini`: tối đa 4 lượt/60 giây và giới hạn cấu hình trên 24 giờ trượt. Đổi model/restart không reset quota. Đây là ngân sách nội bộ, không phải cam kết hạn mức free của Google; ứng dụng khác dùng cùng project không được bộ đếm này theo dõi.
- Giữ reservation kể cả provider lỗi; không tự retry. Update trùng không gọi lại. Lệnh task/nút không cần Gemini.
- Mỗi lần đã reserve tạo một adapter dùng một request, timeout 5 giây; chặn redirect để không chuyển header chứa key sang đích khác. Timeout cần đo lại khi staging; chưa chứng minh độ trễ thực tế.
- Cả webhook và scheduled recovery dùng cùng runtime. Lỗi chat có fallback, không tự thay đổi task.

## Bằng chứng

Kết quả local: 43/43 tests mặc định + 25/25 experiments đạt; typecheck và Workers dry-run đạt (105.85 KiB, gzip 27.63 KiB). Build vẫn AI/Calendar off. Không gọi API thật.

`tests/integration/ai-runtime.test.ts`: config, runtime off, owner off, sai owner/secret, context/history, replay, quota qua worker mới/đổi model, lỗi 429 không lộ key, scheduled recovery và không tự ghi task. Toàn bộ dùng transport giả và D1 local.

## Còn lại trước release

Cloud staging + secrets/cron/webhook, Google consent và smoke test thật có ngân sách riêng; đo CPU/độ trễ; kiểm tra iPhone; backup/restore, giám sát và vận hành; pilot 3 ngày. Các giới hạn Calendar tại P4_ACCEPTANCE vẫn còn, đặc biệt snooze local chưa tự PATCH Google. Đợt này không phải nghiệm thu toàn bộ P5.
