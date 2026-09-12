> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# Luồng UX và giao diện v1

Ngày 2026-09-12. Telegram-first. Các mục thiết kế bên dưới không đồng nghĩa đã triển khai hết; trạng thái đợt sửa thực tế ở mục 0.

## 0. Đợt UX đã triển khai local

Cập nhật 2026-09-12: UI cards đã deploy staging. Navigation/wizard sửa cùng card, callback opaque có owner/message/revision, thông báo stale qua ACK; nhập ngày giờ thủ công cũng nối vào card đang mở. /start có menu, capture có hành động tiếp theo, settings có nút nghỉ/mở lại. Gỡ keyboard + send mới ở mô tả cũ dưới đây đã được thay bởi editMessageText cho UI outbox. Card bị xóa có replacement, edit uncertain phục hồi trên card mới khi user tương tác, không execute lại nghiệp vụ. Cần test hiển thị iPhone trước nghiệm thu UI.

- Tasks: danh sách chọn một việc → chi tiết, nút ngắn; không hiện trò chuyện khi AI off. Thành công nói rõ tên việc. Callback xác nhận đã xử lý không tạo tin trả lời lặp.
- Gỡ keyboard cũ qua outbox sau commit, chỉ với message ID của card app đã gửi tới đúng owner. Gỡ thất bại không mất thay đổi đã lưu; không retry mù với uncertain. Đây là gỡ nút + trả card mới, chưa phải sửa nội dung mọi card cũ tại chỗ.
- Ngày hẹn/hạn: hôm nay, ngày mai, ngày kia → chọn giờ → thời lượng 15/25/45 phút cho session → confirm. Giờ khác/phút khác vẫn nhập tay. Nút tối đa 4 ô cho giờ ngắn HH:mm, thao tác chính tối đa 2. Chọn ngày mới vô hiệu lựa chọn cũ; D1 lưu task/expiry, phần lựa chọn trung gian nằm trong callback, không mất khi restart.
- Today chọn được từng buổi trong danh sách hiện có (giới hạn 30); nút theo trạng thái, sau hành động trả nút phiên bản mới. Guard D1 chặn hai buổi running đồng thời.
- Bỏ chặn quiet và khung cứng 08–21 trong Calendar slots; giữ pause chủ động và giới hạn 2 lượt/lần hẹn. Không hồi sinh nhắc đã hủy; /resume giải thích rõ điều này. Cột quiet cũ giữ để không phá schema, không còn quyết định giờ gửi.
- Callback quên mục đã xóa không xóa ngữ cảnh mới; DB cũng guard điều kiện tồn tại.
- Giới hạn: chưa nâng Today thành planner đầy đủ, chưa lifecycle task/đồng bộ PATCH Google; chưa kiểm chứng hiển thị card mới trên iPhone. Wizard chưa picker phút tùy ý bằng nút. Không gọi đợt này là nghiệm thu v1.

## 1. Nguyên tắc giao diện

- Ít thông tin mặc định, đầy đủ khi chủ động mở. Không che mất backlog/nhật ký/cài đặt.
- Một primary action/card; tối đa 2–3 nút một hàng, nhãn tiếng Việt rõ. Nhãn nguy hiểm không sát nút thao tác thường; phải có bước xác nhận.
- Chat không phải form. Nút/menu là lối tắt, không ép người dùng nhớ slash command. Slash commands vẫn làm fallback.
- Lời đời thường ngắn; card nghiệp vụ chính xác. Không dùng emoji/màu làm tín hiệu trạng thái duy nhất, không in UUID/stack trace/ISO dài ra màn hình.
- Hiển thị “Thứ Bảy, 19/09 · 09:00–09:25 (giờ Việt Nam)” cho xác nhận thời gian, không chỉ “mai” dễ đổi nghĩa.
- Không bật animation/game để che trạng thái loading. Không làm người dùng phải “chăm” bot.

## 2. Menu v1

```text
Hôm nay      Công việc
Đang làm     Cài đặt

HÔM NAY
Bây giờ: Xem đề báo cáo · 15 phút
[Bắt đầu] [Đang kẹt] [Nay đuối]
Tiếp theo: 15:00 · Đi học
[Xem cả ngày] [Thêm việc]
```

Today trống: “Chưa có buổi nào được chốt. Chọn một việc hoặc nghỉ nhé.” + [Chọn việc]. Không tự bịa kế hoạch để lấp UI.
All Tasks: active/inbox/someday/done; tìm theo tên, phân trang, mỗi task có chi tiết; không đổ 100 tin một lần.
Chi tiết: tên, deadline có certainty, tiến độ thực, buổi tiếp theo, ghi chú; [Làm] [Sửa] [Lịch sử]. Metadata sâu chỉ hiện khi cần.

## 3. Onboarding ngắn, có thể tiếp tục sau

1. /start từ đúng owner: giới thiệu đây là trợ lý AI, dữ liệu đi đâu; không cho người lạ claim owner đầu tiên.
2. Xác nhận múi giờ; không áp giờ yên lặng tự động. Giữ quyền dừng nhắc chủ động.
3. Kết nối Google hoặc [Để sau]; chọn calendars và giải thích quyền đọc/ghi riêng.
4. Thử một task đơn giản; không bắt nhập backlog, estimate, project, routine đầy đủ.
5. Cài đặt luôn có: nhắc, persona, AI on/off, những điều đã nhớ, Calendar sync, xuất/xóa dữ liệu.

## 4. Luồng thao tác và nhánh lỗi

| Luồng | Thành công | Thiếu/mơ hồ/lỗi |
| --- | --- | --- |
| Capture | “còn bài A” → inbox + [Hoàn tác] nếu D2 được duyệt | Hai việc trùng tên: hỏi có phải việc cũ; không tự merge/delete |
| Đổi hạn | Resolve task → ngày giờ rõ → card trước/sau → confirm | “đổi bài sang mai”: hỏi hạn hay buổi; “8h” hỏi sáng/tối khi chưa rõ |
| Chọn buổi | Duration 15/25/45 phút hoặc tự nhập → 2–3 slot → confirm | Không biết task cần bao lâu: discovery, không estimate toàn task |
| Đang kẹt | Hỏi trở ngại cần thiết; giúp đọc đề/chọn một bước | Không bịa nội dung bài; không checklist bắt buộc dài |
| Start/pause/end | Đổi trạng thái bằng nút; end chọn xong phần/đang dở/kẹt | Timer hết không đánh dấu task done; không trả lời → unknown |
| Snooze | Hiện giờ mới và đổi job cũ | Dời trùng lớp: không lén sửa lớp, đưa lựa chọn khác |
| Nghỉ | [Nghỉ tới…] hoặc [Dừng nhắc hôm nay] có scope rõ | Không thêm “cố thêm tí” sau khi user đã yêu cầu dừng |
| Replan | Chỉ sửa phần bị ảnh hưởng, giải thích ngắn, confirm | Lịch đang stale: nói rõ, không bảo đảm slot còn trống |
| Quay lại | Bắt đầu từ hiện tại, 1 việc nhỏ, cho cập nhật việc đã làm | Không quy im lặng thành lười, không dồn nợ |

Mọi input mode có [Hủy], TTL, và nhắc đang sửa việc gì. User chuyển chủ đề thì thoát hoặc xác nhận tiếp tục; không coi “tớ mệt” là deadline nhập sai cần hỏi đi hỏi lại.
Confirm cũ: “Việc này đã thay đổi, xem bản mới nhé” + [Xem]. Callback hết hạn không phát sinh side effect.

## 5. Nhắc không gây áp lực

- Tin nhắc gắn task/session, có [Bắt đầu] [Nhắc sau] [Hôm nay nghỉ]. “Nhắc sau” không coi là task fail.
- Dừng nhắc áp dụng ngay trong backend; cô ấy chỉ nói đã dừng khi thay đổi được lưu.
- Khi đang làm, gom thông tin không gấp; không dùng pre-reminder + start + end + hydration dồn dập thiếu budget tổng.
- Khi deadline nguy hiểm nói rõ dữ liệu biết/chưa biết, đưa hành động; không giả chắc còn “2h việc” nếu estimate chưa có.
- Persona từ PRODUCT_BRIEF; mood linh hoạt nhưng quyền/dữ liệu không thay đổi theo giọng nói.

## 6. Mọi màn/card cần đủ trạng thái

- Loading: ACK nút sớm; quá lâu có thông báo ngắn, không gửi nhiều tin “đang xử lý”.
- Saved/pending sync/failed/uncertain phải phân biệt; không nói “xong” cho mọi trường hợp.
- Retry có nút chỉ khi an toàn; uncertain yêu cầu kiểm tra kết quả, không mời user bấm lặp vô hạn.
- Offline/quota hết: dùng task/nút/nhắc tiếp, không giả model đang suy nghĩ. Telegram/mạng điện thoại lỗi không thể bảo đảm push.
- Xóa/thu hồi: giải thích phạm vi (task? session? calendar? dữ liệu AI đã gửi?), không tự hứa thu hồi dữ liệu khỏi bên thứ ba.

## 7. Kiểm tra trên thiết bị và hướng Mini App sau

V1 kiểm tra iPhone thật: dark/light, font tăng, chữ Việt dài, keyboard mở, quay lại chat, click liên tiếp, mạng chậm, Focus/notification settings. Chưa cần user tự chạy terminal.
Telegram quyết định kích thước nút native; thiết kế nhãn ngắn và ít nút để dễ chạm. Không hứa điều khiển kích thước/contrast của client.
Nếu làm Mini App: responsive/safe areas, không hover-only, focus/labels, text contrast, reduced motion, target đề xuất ≥44 CSS px; WCAG 2.2 AA có minimum target 24 CSS px và ngoại lệ. Không gọi “đạt WCAG” khi chưa audit. [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
Wireframe Mini App sau: Today/Tasks/Settings; chỉ thêm màn khi bot menu không giải quyết tốt. UI web phải có backend auth Telegram initData, không tin query user_id.
