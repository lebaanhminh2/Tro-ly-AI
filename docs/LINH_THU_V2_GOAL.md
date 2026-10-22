# Lệnh goal triển khai Linh thú v2

Ngày lập: **22/10/2026**. Lưu tệp này **chưa khởi chạy goal hoặc triển khai tính năng**.

Đầu vào đã có trong repo, không cần đính kèm chat:

- [Đặc tả 18 loài và mặc định được ủy quyền](LINH_THU_V2_SPEC.md).
- [Kế hoạch và ma trận nghiệm thu](LINH_THU_V2_IMPLEMENTATION.md).

Mở workspace `D:\Tro-ly-AI`, sao chép nguyên khối sau và gửi:

```text
/goal Hoàn tất và kiểm chứng nâng cấp Linh Thú v2 trong D:\Tro-ly-AI theo docs/LINH_THU_V2_SPEC.md và docs/LINH_THU_V2_IMPLEMENTATION.md. Kết quả phải chạy xuyên suốt từ luật kỹ năng, dữ liệu và ghi thưởng đến API/giao diện, sẵn sàng nghiệm thu local.

Đọc hai tài liệu trước khi sửa. Các phần CHỐT là hợp đồng hành vi; MẶC ĐỊNH ĐƯỢC ỦY QUYỀN và đề xuất kiến trúc được cải thiện có căn cứ, ghi quyết định và kiểm chứng, không tự đổi tỷ lệ/phần thưởng đã chốt.

Tôi trao toàn quyền sửa/tạo/tái cấu trúc/di chuyển/loại bỏ code và tệp liên quan, thêm migration/fixture/tài liệu/test, chạy công cụ local/test. Đây là ngoại lệ cho việc hỏi xác nhận từng lần sửa code trong AGENTS.md trong mục tiêu này. Công bố phạm vi rồi làm ngay; phát sinh điểm gọi/tệp liên quan thì cập nhật và tiếp tục, không hỏi hoặc chờ tôi duyệt. Bảo toàn thay đổi sẵn có. Không deploy production, chạy migration database thật, xuất bản hoặc gửi thông báo; đó là ngoài mục tiêu, không phải bước xin quyền làm gián đoạn.

Tự quyết điểm chưa rõ theo thứ tự ưu tiên của đặc tả, mục tiêu skill tự động/dễ hiểu, bảo toàn dữ liệu và chống thưởng trùng. Ghi lý do/ảnh hưởng/test của quyết định bổ sung. Được đổi cấu trúc, thứ tự hoặc giải pháp kỹ thuật khi có căn cứ; không dừng ở kế hoạch, domain chưa tích hợp hoặc UI chưa nối runtime.

Đo baseline cần thiết, truy vết nguồn task/habit/ngủ/ngày hoàn hảo/x10/ghép/đột phá/tháp. Triển khai đủ 18 loài, counter/chuỗi/quota/buff, multiplier đúng loại tài nguyên, undo, đồng thời/retry/backlog, cutover/pending v1, API/UI. Không phát thưởng hồi tố, không reset dữ liệu để né migration, không dùng hard cap chung 5 task/10 draw chặn skill mới.

Duy trì docs/LINH_THU_V2_PROGRESS.md và hồ sơ kiểm chứng/decision log phù hợp: việc đã làm, còn lại, bước tiếp theo, lệnh thực chạy và bằng chứng. Qua lượt mới hoặc rút gọn context, đọc checkpoint và đi tiếp. Có thể dùng agent phụ nếu hỗ trợ; phân quyền ghi file rõ, agent chính tích hợp và kiểm chứng lại.

Kiểm thử theo kỳ vọng độc lập và ma trận nghiệm thu; chạy kiểm tra backend/web, integration/browser, migration, build và benchmark phù hợp. Không đánh dấu PASS khi chưa chạy, không hạ assertion/gate hoặc xóa kiểm thử để che lỗi. Tự review diff, đối chiếu đủ 18 loài và sửa hồi quy trước bàn giao. Không cần deploy thật để hoàn thành goal local.

Tiếp tục tự chủ đến định nghĩa hoàn thành trong tài liệu, không tự pause hoặc chờ tôi quyết định. Tool lỗi thì tìm cách khác và làm phần độc lập. Nếu bị chặn hoàn toàn bởi điều kiện ngoài quyền/công cụ, lưu bằng chứng/trạng thái/phần chưa đạt, không giả hoàn thành hoặc lặp vô ích. Hết context/hạn mức không phải hoàn thành.

Báo cáo cuối: kết quả, quyết định đáng chú ý, test/build/benchmark thực chạy, liên kết hồ sơ, hướng dẫn nghiệm thu local/migration và giới hạn còn lại. Bắt đầu làm ngay sau khi nhận lệnh này.
```

## Cách hiểu

- Hai tài liệu là đầu vào đủ dùng, không yêu cầu đọc tệp attachments.
- Không coi tài liệu hoặc kết quả test v1 là bằng chứng v2 đã chạy.
- Không sửa nguồn CHỐT cho khớp lỗi code; thay mặc định phải có quyết định và lý do.
- Phạm vi dự kiến không khóa agent vào tên lớp/tệp hoặc cấm sửa điểm gọi cần thiết.
- Quyền tự chủ không tự cấp thêm quyền hệ thống/hạn mức; nếu bị giới hạn phải giữ checkpoint trung thực.

Cú pháp/vòng đời tham khảo: [OpenAI — Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
