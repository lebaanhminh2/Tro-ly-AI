# Thử nghiệm AI cũ

Đây là harness/prototype được giữ để tham khảo và kiểm tra hồi quy, không phải tiêu chí nghiệm thu sản phẩm.
Kết luận chọn model nằm ở [MODEL_VERDICT](../../docs/MODEL_VERDICT.md); không tự mở lại chiến dịch live.

- `npm run test:experiments`: offline, giữ tests về memory flow, fixtures, quota và policy bảo thủ cũ.
- `npm run try:ai`: demo mock; `-- --flow`: demo memory, không ghi DB.
- `npm run test`: chỉ tests sản phẩm/adapter và tích hợp local, không import thư mục này.
- Typecheck vẫn bao gồm experiments để tránh code lưu trữ bị hỏng đường dẫn.
- Live vẫn bị khóa; bộ đếm cũ vẫn ở `trial-results/`, không được reset hoặc tạo lại để vượt quyền.
- Fixture/harness có thể import code sản phẩm; chiều ngược lại bị cấm.

Tests kỳ vọng `VALUE_VALIDATION_NOT_IMPLEMENTED` mô tả giới hạn prototype, không khẳng định sản phẩm phải chặn mọi cập nhật.
