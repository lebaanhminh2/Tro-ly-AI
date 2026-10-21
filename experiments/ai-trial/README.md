# Harness thử nghiệm AI

Các fixture và tests offline giữ để tham khảo và kiểm hồi quy của memory flow, quota và policy prototype. Chúng không thay tiêu chí nghiệm thu sản phẩm; không tự mở lại chiến dịch live.

| Lệnh                       | Phạm vi                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:experiments` | Tests offline của harness                                                                                                           |
| `npm run try:ai`           | Demo mock; thêm `-- --flow` để thử memory, không ghi DB                                                                             |
| `npm run test`             | Tests sản phẩm/adapter và tích hợp local; bài Telegram có nhập `trialChat` và `GeminiTrial` để kiểm provider bằng transport giả lập |
| `npm run test:all`         | Chạy suite chính rồi suite experiments; không gọi provider thật                                                                     |

Typecheck bao gồm experiments để giữ fixture còn dùng chạy được. Runtime trong `src/` không nhập harness; tests có thể ghép fixture thử nghiệm với adapter sản phẩm. Kết luận model lịch sử tra qua Git; liên kết MODEL_VERDICT cũ đã bỏ vì tài liệu đích không còn tồn tại.

Live vẫn bị khóa; không reset hoặc tạo lại bộ đếm trong `trial-results/` để vượt quyền. Quyền gọi dịch vụ theo yêu cầu hiện tại của người dùng.

Tests kỳ vọng `VALUE_VALIDATION_NOT_IMPLEMENTED` mô tả giới hạn prototype, không buộc sản phẩm chặn mọi cập nhật.
