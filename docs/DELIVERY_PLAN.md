# Kế hoạch xây sản phẩm v1 — bản duyệt

Ngày 2026-09-11. Trạng thái: **đề xuất chờ duyệt**. Duyệt kế hoạch không tự cho phép xóa code, gọi API trả phí hay deploy.

## 1. Kết quả phải có

Trợ lý cá nhân một người dùng trên Telegram: trò chuyện theo persona, hiểu bối cảnh đã cung cấp, giúp bắt đầu việc, chủ động nhắc có giới hạn và điều chỉnh kế hoạch khi lệch. Đọc [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) khi cần chi tiết persona.

Vòng sản phẩm hoàn chỉnh: ghi việc → Today → chọn buổi → xác nhận → nhắc → làm/hoãn/nghỉ → ghi nhận kết quả → điều chỉnh.
Không đánh đồng bot trả lời được, số test tăng hoặc deployment thành công với sản phẩm hoàn tất.

| Trong v1 | Sau v1, không tự thêm |
| --- | --- |
| Chat + bộ nhớ ngắn/dài có kiểm soát; ghi/xem/sửa việc | Voice, ảnh/OCR, avatar, XP/coin |
| Today và danh sách task qua card/nút Telegram | Mini App, game, project tree sâu |
| Session, nhắc, snooze, pause reminders, quiet hours | Tự tối ưu cả tuần, tự chẩn đoán năng lượng |
| Đọc Calendar + ghi Assistant Plan có xác nhận | Sửa lịch học/cuộc hẹn ngoài, mời người khác |
| Preferences, trạng thái tạm thời, xuất/xóa/ngắt kết nối | Đa người dùng, thanh toán, chia sẻ nhóm |

## 2. Lựa chọn đề xuất

- TypeScript strict, một ứng dụng chia module, Workers + D1 + Cron; không microservices, ORM/agent framework hoặc vector DB lúc đầu.
- Telegram là toàn bộ UI v1. Không có frontend riêng để tiết kiệm thời gian; Mini App chỉ xét khi thao tác thực tế chứng minh cần.
- Gemini Flash-Lite cho ngôn ngữ; backend quyết định dữ liệu/lịch/quyền. Kiểm chứng chọn model đã kết thúc, xem [MODEL_VERDICT.md](MODEL_VERDICT.md); không mở lại G1 cũ mặc định.
- SQL migrations có version; Node unit tests + Miniflare integration; khóa dependency bằng lockfile; kiểm tra type/lint/test/build trong CI sau khi repo được thiết lập.
- Workers Free có giới hạn CPU; chia bounded jobs, đo khi pilot. Nếu không đạt phải trình trade-off trước khi đổi runtime/gói trả phí. Không giả định local test chứng minh SLA.
- Free là mục tiêu chi phí, không bảo đảm vô hạn. Gemini Free/privacy là quyết định còn mở; không chặn xây nền offline nhưng chặn đưa hội thoại cá nhân thật lên AI.

## 3. Bản thiết kế dùng để triển khai

| Tài liệu | Trả lời |
| --- | --- |
| [DATA_DESIGN.md](DATA_DESIGN.md) | Backend chia phần gì, lưu gì, nhớ gì, giao dịch và lịch xử lý ra sao |
| [UX_FLOWS.md](UX_FLOWS.md) | Người dùng thấy gì, bấm gì, lỗi/thiếu dữ liệu xử lý thế nào |
| [SECURITY_RELEASE.md](SECURITY_RELEASE.md) | Nguy cơ cụ thể, kiểm soát, test và vận hành |
| [VIBE_WORKFLOW.md](VIBE_WORKFLOW.md) | Prompt giao việc, duyệt theo mốc, cách kiểm tra và tiếp tục phiên mới |

Tài liệu này thay lịch mốc/G1 trong ARCHITECTURE_PLAN cũ. Các chi tiết mới chưa duyệt không được hiểu là đã chốt từ chat trước.

## 4. Các mốc: hoàn tất một mốc trước khi mở mốc tiếp

Mọi mốc bắt đầu bằng danh sách file và phạm vi để duyệt. Agent tự sửa lỗi trong phạm vi, không hỏi lại từng chỉnh sửa nhỏ. API/deploy có ngân sách/đích rõ riêng.

| Mốc | Phạm vi và đầu ra | Điều kiện xong | Người dùng cần làm |
| --- | --- | --- | --- |
| P0 — duyệt | Bộ docs này; chốt lựa chọn tại mục 7 | Không còn lựa chọn chặn P1; xác nhận phạm vi | Duyệt/sửa phương án mặc định |
| P1 — nền + việc | Layout sạch, schema, authorization, inbox/outbox, task/proposal, luồng card local | Ghi/sửa/xem hoàn chỉnh qua webhook giả; atomicity/owner/version/replay pass; restart không mất task | Duyệt file; duyệt cách lưu prototype/Git, chưa cấp token |
| P2 — ngày + nhắc | Session, Today, pause/snooze/quiet hours; dispatcher bền vững | Restart, chuyển ngày, nhắc cũ, đồng thời, timeout được test; không tăng progress tự động | Chọn giờ/mức nhắc khi onboarding; có thể dùng defaults ở test |
| P3 — hội thoại + nhớ | Context builder, preferences/facts/expiry, intent/clarification, persona và quota | Nút không gọi AI; chat không tự commit; context không lẫn owner; thiếu quota vẫn dùng task/nhắc | Chốt chính sách dữ liệu AI trước live; live smoke chỉ khi duyệt, không thử model vô hạn |
| P4 — Calendar | OAuth, chọn lịch, incremental sync, slot proposal, Assistant Plan | Lặp/cả ngày/410/revoke/xung đột kiểm chứng; không sửa event ngoài; reconciliation không tạo trùng | Tạo Google project và consent theo hướng dẫn; cấp quyền cho calendar thử |
| P5 — pilot/release | Cloud staging, monitor, backup/restore, vận hành, iPhone | Checklist bảo mật đạt, test máy tính tắt, pilot 3 ngày; không lỗi nghiêm trọng còn mở | Tạo bot riêng/Cloudflare; duyệt deploy; dùng thử ngắn trên iPhone |

Có thể hoàn tất phần local P3 trước khi giải quyết dữ liệu live; không gọi bản không có persona là sản phẩm cuối. Pilot dữ liệu thật chỉ sau quyết định privacy và setup credentials.

## 5. Nghiệm thu và ngân sách

- P1–P4 ưu tiên kiểm thử tự động không API. Mỗi lỗi hồi quy có test, nhưng không đặt mục tiêu tăng số lượng test/coverage bằng mọi giá.
- Trước live trình: số request tối đa, model/endpoint, dữ liệu, quota còn lại và tiêu chí dừng. Ngân sách kiểm chứng cũ đã hết; không có quyền gọi mới trong plan này.
- Live chỉ để kiểm tra kết nối/luồng chưa thể chứng minh offline. Không gửi lại bộ model test đã kết luận nếu không có thay đổi liên quan.
- Đề xuất pilot: 20 thao tác task/session, 10 tình huống Calendar, 10 lần nhắc; không dùng đây làm bảo đảm thống kê.
- Mục tiêu UX: thao tác nút phản hồi cảm nhận trong 2 giây khi hệ thống bình thường; AI nếu chậm phải có trạng thái, không hứa luôn 2 giây.
- Nhắc thử trong khoảng 2 phút so với giờ đặt khi mạng/notification hoạt động; quiet hours và giới hạn nhắc phải đúng tuyệt đối trong tests. Phân biệt API đã nhận với điện thoại đã hiện tin.
- RPO/RTO mục tiêu pilot: mất dữ liệu tối đa 24 giờ nếu phải restore backup, khôi phục trong 1 giờ khi người vận hành sẵn sàng; phải đo, không gọi là SLA.
- Chưa ước lượng lịch ngày cố định vì phụ thuộc tài khoản/consent/pilot. Tiến độ theo đầu ra và cổng đạt, không theo lời hứa “xong trong vài hôm”.

## 6. Xử lý code hiện tại

- Không xóa ngay. Đề xuất snapshot prototype có thể khôi phục bằng Git/tag hoặc archive riêng sau khi xin duyệt đích rõ. Không đưa `.env`, `.dev.vars`, token, DB hoặc lịch sử secrets vào snapshot chia sẻ.
- Phân loại reuse: validation ngày, test case, adapter lỗi, câu SQL/giao dịch đã test. Cần review chứ không copy toàn bộ.
- Refactor: state owner/concurrency, command transaction, policy/clarification, delivery jobs. Loại harness local khỏi bundle sản phẩm.
- P1 quyết định refactor tại chỗ hay khởi tạo layout mới sau snapshot; phương án đề xuất là refactor dần theo ranh giới module, không duy trì hai sản phẩm song song.
- Không xóa test cũ để làm CI xanh; đánh dấu lỗi thời với lý do nếu hành vi sản phẩm đã đổi.

## 7. Các mặc định cần duyệt

| ID | Đề xuất mặc định | Ý nghĩa |
| --- | --- | --- |
| D1 | V1 Telegram-only, Mini App sau | Có card/nút thân thiện ngay; ra sản phẩm nhanh hơn |
| D2 | Capture rõ lưu inbox + hoàn tác; đổi deadline/drop/session cần xác nhận | Giảm thao tác lúc ghi nhanh, giữ kiểm soát thay đổi quan trọng |
| D3 | Một nhắc chính + một nhắc lại sau 15 phút; tối đa 2 nhắc lại/ngày | Có thể đổi trong settings; quiet hours hỏi khi onboarding, không đoán giờ ngủ |
| D4 | Chat thô 7 ngày; facts do người dùng xác nhận giữ tới khi xóa | Có trí nhớ mà không giữ mọi lời mãi; TTL chi tiết ở DATA_DESIGN |
| D5 | Giữ prototype và refactor có kiểm soát, không xóa toàn bộ | Tái sử dụng bằng chứng, tránh viết lại vô ích |
| D6 | Gemini chỉ dữ liệu giả trong phát triển; AI thật cần quyết định dữ liệu phù hợp | Nếu bắt buộc 0 đồng cho cả tâm sự cá nhân, chưa cam kết Gemini Free đáp ứng; không lén bật paid |

D6 là lựa chọn sản phẩm thực sự: bản đầy đủ cần AI nhận một phần lời nói của bạn. Che tên/giữ lịch trong D1 giảm dữ liệu lộ nhưng không chứng minh tuân thủ cho mọi cuộc chat.

## 8. Quyết định phát hành

Release khi hoàn thành P1–P5, không có lỗ hổng access/secrets/mutation nghiêm trọng chưa xử lý; backup restore và ngắt quyền thành công; người dùng chấp nhận UX/persona thực tế.
Nếu model nói sai một câu xã hội: ghi lỗi và cải thiện có ngân sách. Nếu AI làm sai dữ liệu/quyền: chặn phát hành tính năng đó, không bù bằng lời nhắc trong prompt.
