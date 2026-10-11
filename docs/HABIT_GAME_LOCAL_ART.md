# Tạo hình ảnh cục bộ cho Thần Lộ

Ngày: 2026-10-12. User đã chọn AI tự thiết lập sinh ảnh cục bộ khi chạy /goal; ngân sách bổ sung 0đ. Đây là kế hoạch thực hiện, chưa cài model hoặc tạo ảnh.

## 1. Phạm vi và cách dùng

- Ảnh cuối cho nhân vật, 3–5 boss và cảnh/chương mở đầu theo [CREATIVE_BRIEF](HABIT_GAME_CREATIVE_BRIEF.md).
- Tạo ảnh trên máy phát triển; Worker chỉ phục vụ asset tối ưu đã được tích hợp. App không cần chạy model hoặc gọi API ảnh lúc người dùng mở màn.
- User cho phép tải model và cài công cụ cần thiết, AI tự chọn cách triển khai trong phạm vi local; không cần hỏi từng dependency. Không dùng API sinh ảnh trả phí, top-up, subscription hoặc nâng gói.
- Workflow cục bộ này được user chọn trực tiếp vì tool sinh ảnh tích hợp không có trong phiên chuẩn bị và ngân sách API bằng 0. Đây không phải CLI OpenAI của skill imagegen; không yêu cầu OPENAI_API_KEY hoặc sửa script của skill.

## 2. Preflight bắt buộc trước khi tải lớn

Quan sát ban đầu: Windows, GPU NVIDIA GeForce GTX 1650 khoảng 4 GB VRAM, có lệnh python và nvidia-smi. Chưa xác minh Python chạy được, CUDA/PyTorch, dung lượng trống, tốc độ hoặc chất lượng model.

AI cần kiểm tra và ghi kết quả:

- Driver/GPU/VRAM thật qua nvidia-smi; bộ nhớ trống và RAM/disk đủ cho model, cache, môi trường và ảnh.
- Python là interpreter dùng được, không chỉ Windows app alias; chọn phiên bản tương thích công cụ.
- Môi trường riêng cho art, không sửa Python hệ thống hoặc đưa dependency model vào runtime Workers/npm.
- Khả năng GPU của backend thực tế; không báo đã dùng CUDA chỉ vì máy có card NVIDIA.
- Thử một ảnh để đo thời gian, VRAM, lỗi và tính phù hợp trước khi tạo cả bộ. Mọi tải/setup đều sau khi user thực sự bắt đầu goal, không tự cài trong phiên chuẩn bị.

## 3. Chọn backend và model

AI tự chọn backend cục bộ có workflow lưu được, ví dụ ComfyUI hoặc pipeline diffusion chuẩn. Ưu tiên model mở tải được từ nguồn chính thức, phục vụ phong cách tiên hiệp bán hiện thực/trầm và chạy được trong giới hạn máy.

- Với 4 GB VRAM, bắt đầu từ model nhẹ thuộc họ SD 1.5 hoặc lựa chọn tương đương đã kiểm chứng; không mặc định model nặng cần nhiều VRAM hơn.
- Chọn chế độ tiết kiệm VRAM/offload/tiled processing khi cần; bắt đầu ở độ phân giải vừa phải, tối ưu/crop/upscale sau khi đã kiểm tra ảnh gốc.
- Lưu model ID/version, nguồn tải, hash nếu có, seed, thông số, prompt/reference và workflow. Seed không đủ để đảm bảo cùng khuôn mặt; kiểm tra bằng mắt các dấu nhận diện.
- Nếu backend đầu không chạy hoặc art chưa đạt, sửa cấu hình/thử model khác miễn phí phù hợp; không chuyển sang trả phí hoặc báo hoàn thành bằng ảnh tạm.
- Không mở dịch vụ art ra internet. Nếu dùng server local, bind loopback, chạy background ẩn theo hướng dẫn Windows và lưu log; không mở cửa sổ không cần user thao tác.
- Nếu cần token tải model miễn phí hoặc thiếu môi trường, ưu tiên nguồn không cần token hoặc hỏi đúng thông tin cấu hình cần thiết. Không đưa key/token vào prompt, log hoặc Git.

## 4. Sản xuất và tích hợp

1. Đọc hướng nghệ thuật và tự hoàn thiện character sheet: mặt/trang phục/vật dụng, silhouette, bảng màu và vai trò. Thiết kế một phái đủ bốn môn thường/một trấn phái và chương 3–5 boss trước khi sinh cả bộ.
2. Thử một chân dung + một boss/cảnh trong bố cục app để kiểm tra style/crop/độ sáng. Tự sửa rồi mới sản xuất tiếp, không chờ user duyệt từng ảnh.
3. Tạo ảnh thật nguyên bản, reference cho cùng nhân vật, lặp có mục tiêu để sửa mặt/tay/vật dụng/crop. Kiểm tra độ thống nhất cả bộ.
4. Lưu manifest/workflow để tái tạo. Model/venv/cache và ảnh nháp nằm ngoài Git; ảnh cuối cùng, manifest và script/config tái tạo phù hợp được đưa vào repo.
5. Export kích thước web phù hợp, bản thumbnail khi cần; kiểm tra alpha nếu cần, alt text, dark/light, mạng chậm và lazy loading.
6. Tích hợp vào màn chạy thật, chụp/xem screenshot mobile. Không giữ asset chỉ ở thư mục tool rồi tính đã giao.

Khi cần script/config local, AI viết example tương ứng với code thật, có tên biến và hướng dẫn điền rõ; không thêm biến chưa được đọc hoặc yêu cầu API key không phục vụ workflow. Giữ .env hiện có và không commit secrets. Chưa cần thay .env.example chỉ để tạo cảm giác đã cấu hình ảnh.

## 5. Hoàn thành hạng mục art

- Local pipeline đã chạy tạo được ảnh, có log đo cơ bản và workflow/manifest.
- Tất cả nhân vật/boss/cảnh cần giao trong chương mở đầu có ảnh cuối nhất quán, không có placeholder hoặc lỗi rõ thấy.
- Ảnh đã tích hợp vào UI mobile, URL asset hoạt động trên staging và kích thước tải phù hợp.
- Có thể tái tạo/chỉnh tiếp từ workflow đã lưu mà không phụ thuộc API trả phí.
- Nếu chưa đạt chất lượng hoặc máy không chạy được sau các điều chỉnh hợp lý, ghi đúng chặn, tiếp tục phần độc lập; không đánh dấu goal complete khi art bắt buộc còn thiếu.
