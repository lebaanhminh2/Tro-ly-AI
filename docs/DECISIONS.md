# Quyết định và giới hạn đã biết

Cập nhật: 2026-09-11. Phân biệt bằng chứng quan sát, đề xuất kỹ thuật và kiểm chứng thực tế.

## Hướng đang ưu tiên

**Đã chốt với người dùng:** tạm dừng code/API/deploy để lập kiến trúc và kế hoạch triển khai có tiêu chí rõ. Mã hiện tại là prototype, không phải kiến trúc sản phẩm đã được duyệt. Ưu tiên ra sản phẩm nhanh, tiết kiệm token nhưng giữ cấu trúc, tương thích, bảo mật và UX. Duyệt theo mốc thay vì chuỗi thay đổi nhỏ; không tự xóa/viết lại prototype. Xem bước tiếp theo tại [HANDOFF.md](HANDOFF.md).

| Hạng mục | Trạng thái |
| --- | --- |
| Telegram là giao diện chính | Yêu cầu sản phẩm |
| Persona cô bạn gái AI miền Bắc | Đã thống nhất hướng; xem PRODUCT_BRIEF.md |
| Không bật máy cá nhân liên tục, ưu tiên miễn phí | Yêu cầu người dùng |
| TypeScript + Cloudflare Workers + D1 + Cron | Ứng viên có prototype local; chưa chốt kiến trúc sản phẩm/deploy/benchmark production |
| Gemini 3.5 Flash Lite | Ứng viên thử nghiệm sau khi thấy quota 500 RPD trong ảnh |
| AI thay được nhà cung cấp | Hướng kiến trúc để không buộc nghiệp vụ vào một model |
| AI không bắt buộc cho nút, lưu task, kiểm tra giờ | Hướng thiết kế giảm phụ thuộc và chi phí |

## Cloudflare

- Workers Free được tài liệu đã đọc ghi 100.000 request/ngày, 10 ms CPU mỗi HTTP request/Cron invocation. Chờ mạng/database không tính CPU, nhưng vẫn có giới hạn vòng đời tác vụ. Không hiểu nhầm đây là nơi chạy daemon/Docker liên tục.
- D1 Free: 5 triệu dòng đọc/ngày, 100.000 dòng ghi/ngày, 5 GB tổng lưu trữ theo tài liệu đã xem. Đây không phải 5 GB cho từng database; phải kiểm tra giới hạn riêng nếu cần.
- Truy vấn phải có index, xử lý theo lô nhỏ, không quét toàn bộ lịch sử mỗi phút.
- Cron chạy kiểm tra nhắc trên cloud, không cần máy người dùng bật. Không bảo đảm chính xác từng giây hoặc luôn giao thông báo tới iPhone đúng giờ.
- Không cam kết miễn phí vĩnh viễn/không lỗi. Giữ Free plan, không tự nâng cấp trả phí.

Nguồn kiểm tra lại trước triển khai:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Gemini: quota khác quyền riêng tư

### Thiết kế theo năng lực model — nghiên cứu 2026-09-11

Trạng thái: hướng đề xuất, chưa duyệt thay đổi code/live. Free tier là chính sách quota/giá; không có bằng chứng cùng model bị giảm trí tuệ vì dùng miễn phí. Flash-Lite được Google định vị cho tác vụ nhanh, trích xuất đơn giản; không suy ra độ tin cậy planner từ context window lớn.

- Giữ task hẹp, context chọn lọc, owner/nguồn/thời gian rõ. Không đưa toàn bộ docs, backlog hoặc lịch sử chat vào mỗi lượt.
- Không giao model tính lịch, tổng workload, quyền ghi, quota hoặc quyết định nhắc; backend phụ trách các phép tính/quy tắc đó.
- AI đề xuất cách hiểu và lời nói, không phải nguồn chân lý. Schema/evidence substring không chứng minh ý nghĩa đúng.
- Không tăng chuỗi nhiều agent hoặc gọi AI tự chấm mọi câu. Mỗi bước thêm phải đo lợi ích và quota/độ trễ.
- Xét tách prompt hiểu việc khỏi prompt persona theo tác vụ, không mặc định hai lượt gọi cho mọi tin. Khi cần lời nói sau policy, dùng mẫu an toàn hoặc thêm lượt diễn đạt có kiểm soát; chưa chốt triển khai.
- Google khuyên ví dụ few-shot đa dạng. Việc bỏ hết ví dụ sau T07 chưa chứng minh tốt hơn; nên thử ví dụ khác bộ test, giữ tập kiểm tra chưa từng xuất hiện trong prompt.
- Giữ sampling defaults cho Gemini 3.x theo hướng dẫn Google; không tự hạ temperature về 0 để mong bảo đảm đúng. Thinking budget cần nghiên cứu/đo riêng trước khi chỉnh.
- Đánh giá raw model và policy riêng; chặn mọi update không được tính là model hiểu đúng. Sáu ca đơn lẻ chỉ là smoke test, cần cả yêu cầu rõ được chấp nhận và câu mơ hồ bị hỏi lại.
- Gói miễn phí vẫn có ràng buộc dữ liệu bên dưới; kiến trúc tốt hơn không loại bỏ ràng buộc này.

Nguồn: [định vị Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [prompting: examples, decomposition, sampling](https://ai.google.dev/gemini-api/docs/prompting-strategies), [structured output](https://ai.google.dev/gemini-api/docs/structured-output).

### Quota quan sát

Quan sát ảnh người dùng ngày 2026-09-11, chưa gọi API:

| Nhãn model | RPM | TPM đầu vào | RPD |
| --- | --- | --- | --- |
| Gemini 3.5 Flash Lite | khoảng 15 | khoảng 250.000 | 500 |
| Gemini 2.5 Flash Lite | 10 | khoảng 250.000 | 20 |
| Gemini 3.7 Flash | 5 | khoảng 250.000 | 20 |

- Không dùng quota Antigravity/Search grounding thay quota chat. Nhãn biểu đồ chưa chứng minh Free tier, model ID hoặc quyền gọi API.
- RPM, TPM, RPD đều cần đáp ứng. Hạn mức theo project, không theo từng key; không tạo thêm key để né quota.
- Ước tính 65–80 gọi/ngày chỉ là một kịch bản dự toán, chưa đo thói quen thực tế. Model 500 RPD đủ trên giấy cho kịch bản đó; chất lượng tiếng Việt/persona chưa được thử.
- Tài liệu giá có Free tier cho một số model; phải kiểm tra đúng model được chọn, không suy từ model khác.
- Điều khoản Unpaid Services đã đọc: nội dung có thể được dùng cải thiện sản phẩm, có thể có người xem xét; yêu cầu không gửi thông tin cá nhân, nhạy cảm hay bí mật. Đây là giới hạn quan trọng với lịch thật và tâm sự của người dùng, không thể giải quyết bằng một checkbox đồng ý.
- Chỉ thử với dữ liệu giả/không nhạy cảm trước khi giải quyết tính phù hợp dữ liệu. Chưa hứa bản đầy đủ với dữ liệu cá nhân sẽ phù hợp Gemini Free.
- Điều khoản còn có giới hạn tuổi và mục đích sử dụng; cần xem lại khả năng áp dụng với sản phẩm trước khi triển khai thật, không tự đưa ra kết luận pháp lý.

Nguồn:
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/terms
- https://aistudio.google.com/ (quota/billing thực tế cần người dùng kiểm tra)

## Những hướng từng bàn, không phải lựa chọn hiện tại

### Python chạy máy người dùng

Từng đề xuất để thử, nhưng người dùng bác bỏ nhu cầu bật máy liên tục. Không quay lại phương án đó làm yêu cầu vận hành. Máy cá nhân vẫn có thể dùng phát triển/kiểm thử.

### OpenAI API và Cockpit Tools

- Người dùng có nhiều tài khoản trả phí hiển thị PLUS trong Cockpit Tools. Không suy ra có số dư API Platform.
- Ảnh Cockpit hiển thị `http://localhost:58101/v1`, khóa che, phạm vi chỉ cục bộ. Không lưu/thu thập các email hoặc token từ ảnh.
- Cockpit Tools: https://github.com/jlcodes99/cockpit-tools
- README hiện tại cho biết dịch vụ API cục bộ dùng CLIProxyAPI sidecar. Phiên bản cài trên máy người dùng chưa được xác định.
- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI ; có Docker và các lựa chọn remote token storage. Chưa chạy hoặc audit.
- Không thể đưa nguyên bộ Docker này trực tiếp vào Workers; cần host riêng. Tunnel về máy nhà không giải quyết tắt máy.
- Chưa xác minh quyền dùng hạn mức Plus qua proxy cho chatbot Telegram; không khẳng định chắc chắn hợp lệ hay chắc chắn vi phạm. API chính thức và thuê bao là cơ chế khác nhau.
- Không đưa token tài khoản lên host hoặc chia sẻ chúng trong chat/repo.
- Người dùng đã chuyển câu hỏi về Gemini Free; **không tiếp tục vòng qua Cockpit nếu không được yêu cầu lại**.

Nguồn OpenAI đã đọc: https://learn.chatgpt.com/docs/auth

### Host proxy miễn phí đã khảo sát

- Oracle Always Free: có máy ảo/ổ đĩa, nhưng có thể hết capacity hoặc thu hồi máy ít dùng. Chưa có tài khoản/tài nguyên được kiểm tra.
- Render Free: ngủ sau 15 phút idle, thức lại khoảng một phút; thay đổi filesystem không bền qua restart/spin-down. Cần remote storage cho token thay đổi; database Postgres miễn phí của Render có thời hạn, không chọn bừa cho sản phẩm lâu dài.
- Cloud Run: có free allowance nhưng không bảo đảm không phát sinh phí ngoài hạn mức/dịch vụ đi kèm.
- Chưa chọn hay deploy bất kỳ host proxy nào.

Nguồn:
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://render.com/docs/free
- https://cloud.google.com/run/pricing

## Điều kiện trước khi coi bản đầu dùng được

- Chỉ người dùng được phép có thể thao tác bot; kiểm tra webhook/callback và quyền trên từng hành động.
- Không tạo task/session trùng khi Telegram gửi lại hoặc bấm nút lặp.
- Không áp dụng proposal cũ lên dữ liệu mới; không báo đã đồng bộ nếu thao tác thất bại.
- Nhắc có trạng thái lưu bền, giới hạn thử lại, giờ yên lặng và xử lý kết quả gửi không rõ. Không hứa exactly-once khi chưa thiết kế/kiểm thử.
- AI lỗi/hết quota thì nút, dữ liệu và nhắc đã lưu vẫn hoạt động khi hạ tầng còn hoạt động; phải báo hạn chế hội thoại trung thực.
- Google credentials, Telegram token, AI key lưu bí mật, không log/commit.
- Có đường xuất/sao lưu dữ liệu và giải thích cách ngắt kết nối trước khi dùng thật lâu dài.
- Có kiểm thử luồng và thử thật trên iPhone, không chỉ dựa vào code biên dịch thành công.
# Quyết định bổ sung đã chốt — 2026-09-12

Hội thoại tự nhiên là giao diện chính, không phải chatbot slash-command có persona. AI hiểu bối cảnh và đề xuất command; backend tự lưu trong quyền cho phép hoặc hỏi/xác nhận theo quy tắc. Xác nhận bằng lời được hỗ trợ ở sản phẩm cuối, gắn proposal/owner/version/TTL như nút. Card/nút là hỗ trợ, wizard fallback; không buộc người dùng đi lại form khi câu nói đã đủ. Xem PRODUCT_BRIEF. Bật Gemini chưa đủ: intent routing và confirmation bằng lời hiện chưa hoàn thiện. Quyết định này ưu tiên hơn mô tả cũ “chat để nói, nút để thao tác”. Bỏ quiet tự động đã chốt; giữ pause chủ động và 2 lượt/lần hẹn.
