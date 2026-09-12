# Tài liệu dự án

## Đọc có chọn lọc

Bắt đầu bằng [HANDOFF.md](HANDOFF.md). Chỉ mở tài liệu liên quan nhiệm vụ, không đọc toàn bộ docs/archive.

| Tài liệu | Nguồn chính cho |
| --- | --- |
| [HANDOFF.md](HANDOFF.md) | Trạng thái hiện tại, quyền, việc tiếp theo |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | Mục tiêu và trải nghiệm đã chốt |
| [TOOL_CALLING_PLAN.md](TOOL_CALLING_PLAN.md) | Phạm vi thay thế runtime hội thoại, chờ duyệt code |
| [OPERATIONS.md](OPERATIONS.md) | Stack, kiểm thử, bảo mật và vận hành |

STAGING_SETUP.md chỉ là link chuyển hướng cho công cụ cũ, không cần đọc thêm.

## Quy tắc cập nhật

- Mỗi thông tin có một nơi sở hữu; nơi khác dẫn link, không sao chép.
- HANDOFF thay trạng thái cũ, không nối nhật ký. Lịch sử thay đổi ở Git.
- Phân biệt: đã chốt / đang chạy / đề xuất / đã kiểm thử. Test giả không chứng minh model hoặc cloud thật.
- Mục tiêu biên tập: HANDOFF dưới 50 dòng, mỗi tài liệu chủ đề khoảng 40–100 dòng. Đây không phải chuẩn token.
- Ưu tiên tiêu đề dễ tìm, đoạn ngắn, ví dụ có mục đích. Không tạo file cho mỗi lượt hay mỗi lỗi.
- Không đưa secrets, transcript, log dài, toàn schema hoặc toàn source vào docs.
- Ngân sách đọc mặc định: HANDOFF; sau đó một tài liệu liên quan nếu cần. Không cố rút gọn bằng cách bỏ quyền hoặc rủi ro quan trọng.

## Docs khác prompt sản phẩm

Gemini runtime nhận prompt trong `src/ai/gemini.ts` / `persona.ts` và context từ database qua `context-builder.ts`. Source hiện tại không tự đọc các file Markdown.
Tài liệu chỉ tốn context của coding agent khi được đọc/đính kèm; có file trên ổ đĩa không đồng nghĩa gửi file đó vào mọi request.

## Lịch sử

[Kho lịch sử](archive/README.md) giữ bản cũ để điều tra quyết định/test, không có hiệu lực thay yêu cầu hiện tại.
Không tự mở lại milestone, hạn mức API hoặc kế hoạch cũ từ archive.

Prompt tiếp tục ngắn: “Đọc docs/HANDOFF.md, kiểm tra git status và tiếp tục nhiệm vụ hiện tại trong phạm vi đã duyệt. Chỉ đọc thêm tài liệu cần thiết.”
