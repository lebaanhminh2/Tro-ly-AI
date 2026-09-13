# Tiếp tục từ đây
2026-09-13. Mini App đã phát hành staging để user nghiệm thu trên Telegram. Không coi server tests là user đã chấp nhận UI/UX.

## Sửa UX/vé2026-09-14
- Đã deploy f8195a22-a9e5-420a-a232-bb0f0814b7d2: SVG settings/close, focus tiêu đề modal, ô time có diễn giải24h, nhiều giờ chọn riêng, kho chia3 nhóm badge số lượng, theme auto/light/dark localStorage, nút Đột phá.
- Rest không hiện card giao việc. Draw0 vé disabled; API NO_TICKETS khác ACCOUNT_SUSPENDED. Test sau /ngu complete task mới vẫn cấp vé và draw/replay đúng.
- /lich setup đã lưu nhưng ensureDay null trả NO_ACTIVE_DAY, không yêu cầu cài lại. Không mở rộng /lich tạo reminder.
- Cloud DB initial7403, sau deploy read lại thành công: tickets0,suspended0; task#1–5 awards created1789317920000 trùng migration0015 (2026-09-13 16:45:20 UTC), không task-ticket receipt. Có4 task:complete receipts sau đó. Không bù vé vì task lịch sử đã đánh dấu không hồi tố.
- Settings thật start270,sleep630=10:30 sáng; không tự đổi22:30. Cần user sửa nếu ý định10h30 tối.
- Full131+25 đạt; targeted mini-app7 đạt (thêm invalid time server); typecheck/dry-run đạt. Edge414 kiểm SVG/theme/time input invalid/kho7 badges3groups; screenshot ignored settings-fix/inventory-fix. Chưa xác nhận iPhone sau fix.
- Không Gemini call, không đổi balances hoặc game odds. Remote /app/app.js xác nhận assets mới200.

## Bản đang chạy
- Worker f8195a22-a9e5-420a-a232-bb0f0814b7d2; migrations0001–0015 đã áp cloud. KHÔNG sửa lại migrations.
- ASSETS web/ trên Worker hiện tại, /app/ live, /api authenticated initData HMAC + owner +15min TTL. Không giới hạn pilot ngày/phút.
- /kiemtra thiết lập menu “Mở ứng dụng”; /start/tasks/today/progress/settings chuyển về entry này khi ASSETS bật.
- Menu và reply cho update800003001 đều sent. Trang /app và JS200, API thiếu auth401, Telegram thiếu secret403.
- Task codes cha/con; edit_task_step chat cùng mutation API; task completion child guard; vé first completion chống lặp.
- /lich prompt riêng2tools, phiên15phút, morning reply đúng owner/day; replan giữ deadline, overdue xếp tiếp, omitted estimates hiển thị unplanned.
- Healthy/sleep accounts/recurrence enabled khi setup; không sleep records hồi tố. /ngu trước setup vẫn pause, không phạt. Config sau target không tạo ngày đầu đã lỡ.
- Giờ mới áp dụng ngày sau không shorten rest; healthy message quá khung giờ không gửi bù.3 ngày inactive ngưng, chat resume không truy thu.
- Reward odds/protection/fusion/demotion theo PRODUCT_BRIEF; browser không tự chọn kết quả; request retry giữ receipt qua lỗi refresh.
- Today live lọc ngàyVN, chart không dummy, themeTelegram, user-controlled PNG sharing. Mốc tu luyện là data server.

## Bằng chứng/phát hành
- Full129 tests chính +25 experiments đạt trước2 thay đổi routing/text cuối; typecheck và dry-run assets đạt. Không gọi Gemini trong lượt release.
- UI Edge414px với Telegram credential giả owner123 trên Worker local4174: setup giờ, tạo Local UI QA report, dashboard thật đạt; không dữ liệu giả trên cloud.
- Backup user duyệt đầy đủ: .wrangler/staging-before-miniapp.sql ignored. RestoreSQLite +0013–15 giữ task/reminder counts, codes đầy đủ, FK0, không sleep history giả.
- Cloud verify codes missing0, sleep_records0 trước setup, menu sent. Cần user mở từ Telegram để chứng minh initData thật + iPhone rendering.
- Local dev4174 đang chạy AI off, token giả, DB local; tránh gọi endpoint scheduled với config thật. Source web root4173 vẫn demo nếu server còn chạy.

## User cần làm ở nghiệm thu
- Trong @Minh_Anh_cua_Minh_bot gõ /kiemtra hoặc nhấn Mở ứng dụng; không mở URL ngoài Telegram để tránh thiếu initData.
- Lần đầu chọn giờ bắt đầu/nghỉ (04:30 là gợi ý). Giờ mới có hiệu lực ngày sau nếu hôm nay đã có snapshot.
- Kiểm tạo/tick bước, định kỳ, /lich, /ngu, dashboard; browser errors thì báo screenshot không token/initData.
- User activity/setup khởi động chu kỳ healthy thật. Báo ngủ muộn/không báo phạt theo luật; không bí mật khởi động khi chưa setup.

## Giới hạn cần tiếp tục nếu user gặp
- Task selection chat có thể vẫn sai ngữ nghĩa dù typed; live Gemini đã thử /lich riêng, chưa mọi câu task con.
- Lịch lặp tạo/sửa trong Mini App; chat các lệnh nhắc cũ vẫn tạo appointment một lần, chưa tool chat tạo recurrence mới. Appointment cũ giữ scheduler, chưa merge tất cả vào tab rules.
- Một tầng task con; chat child tool không mix nhiều mutations trong batch; confirmation group chỉ một hiện hành.
- Rule next exception API có skip/move; UI next label hiện rule, chưa lịch sử các occurrence. Kỷ lục high rank có, không bảng kho bộ sưu tập đa hình.
- InitData15 phút: mở lại Telegram khi hết hạn. Hành động chưa chắc thành công giữ id, không đổi id retry.
- Chưa tuyên bố mọi plan ban đầu hoàn chỉnh; user nghiệm thu có thể cần thêm polish/logic.
- Git local commits; không push vì môi trường từ chối xuất bản trước đó. Không force-push/merge.
