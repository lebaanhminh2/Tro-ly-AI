> Bản lưu lịch sử, không phải quy định hiện hành. Xem [mục lục đang dùng](../../README.md). Không đọc mặc định.

# Spec cũ: ứng viên thiết kế chưa duyệt

Cập nhật: 2026-09-11. **Bối cảnh tham khảo, không phải đặc tả triển khai.**

Người dùng gửi “System Design Spec v1.0”, mục 0–107, và nói chưa chốt/chưa đọc hết. Câu “source of truth” và “chốt” trong bản GPT cũ không phải lệnh hiện tại. Xem [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) cho hướng hiện hành.

## Ý đáng giữ khi thiết kế phần tương ứng

Tất cả là đề xuất, không tự mở rộng MVP.

| Ý tưởng | Mục nguồn | Hướng xem xét |
| --- | --- | --- |
| Hard deadline khác target finish | 49 | Mục tiêu xong sớm không sửa hạn thật |
| Manual override có phạm vi/thời hạn | 64 | Nhớ “chiều nay đừng xếp Finance”, không xếp vòng lại |
| Stopping rule | 55, 101 | Giúp dừng làm và nghỉ; chỉ nói “mai vẫn ổn” khi đủ dữ liệu |
| Discovery session | 30 | Buổi tìm hiểu không phải estimate toàn task |
| Question gate/budget | 8–9 | Một câu làm rõ mỗi lượt; nhiều mơ hồ thì hỏi tiếp/chưa thực hiện, không đoán |
| Focus và kết thúc session | 37–41 | Giảm làm phiền; phân biệt xong phần/đang dở/kẹt/chưa làm |
| Edit/detail theo tầng | 16–17, 34 | Sửa từng nhóm thay vì form dài, metadata không hiện mặc định |
| NORMAL/LOW/SURVIVAL | 51–54 | Người dùng chọn hoặc xác nhận, không tự chẩn đoán |
| Bảo vệ mục tiêu dài hạn | 50 | Weekly minimum là ứng viên, chưa chốt số phút/luật giảm |
| Plan version + reason + undo | 60–62 | Khôi phục có kiểm soát, không ghi đè chỉnh sửa mới |
| Review backlog nhẹ và weekly summary | 65–66 | Không tự xóa task cũ vì tuổi dữ liệu |
| Clarity/context requirement | 5, 46–47 | Tùy chọn, không tự sinh bảng hỏi hay suy từ im lặng |

## Mâu thuẫn/lỗi không kế thừa

- Mục 1.4 tự điền CN 20:00 khi người dùng chỉ nói “chủ nhật”; mục 31 đổi “8h” thành 20:00. Cần hỏi hoặc giữ giờ chưa biết; có nút xác nhận không biện minh dữ liệu bịa.
- Mục 39 lấy “thêm bao lâu” cập nhật remaining session/task lẫn nhau: cần xác định phạm vi.
- Mục 63 cấp quyền tự split/move/remove block chưa được người dùng duyệt. Undo không thay thế quyền thao tác.
- Mục 42/98 thiếu kết quả chưa rõ; im lặng không chứng minh MISSED, không cộng lại workload máy móc.
- Capacity 65–75% hoặc 40–55% ở mục 44 là ví dụ, chưa đo hay chọn cho người dùng.
- Critical policy mục 59 không phải quyền vượt giới hạn nhắc/giờ yên lặng.
- Today Win không làm mọi nghĩa vụ còn lại thành bonus; cần xét cam kết thật trước khi nói đã đủ.
- Mục 21 biến nghỉ thành phần thưởng mua bằng coin: nghỉ/ngủ cơ bản không được phụ thuộc năng suất.
- Game/HUD/XP/coin/avatar ở 13–25, 93, 95 chưa được chốt; spec không đảo ngược trạng thái đó.

## Schema/state machine: chưa tạo bảng

Mục 67–98 liệt kê domain và bảng, chỉ là phác thảo. Trước khi triển khai cần giải quyết:

- `tasks`/`task_facts` trùng deadline/estimate: xác định nguồn gốc, bản chiếu và cập nhật nguyên tử.
- Session dự kiến khác session thực tế; actual minutes phải xét pause/resume.
- Task có thể độc lập; session có thể gắn task không có subtask. Sơ đồ tầng không bắt buộc mọi tầng.
- State machine cần điều kiện chuyển, retry, thao tác cũ và kết quả chưa rõ.
- Proposal kiểm tra owner, version, hạn hiệu lực. ACCEPTED không chứng minh Calendar đã ghi thành công.
- Calendar cần sự kiện cả ngày, lặp/ngoại lệ, múi giờ, sync token, xóa/dời thủ công.
- Conversation refs/aliases kiểm tra owner/ngữ cảnh; confidence của model không bảo đảm chọn đúng task.
- Không lưu toàn bộ chat vô thời hạn; cần quyền lưu, retention, xóa/xuất và giới hạn dữ liệu gửi AI.
- Reward ledger chỉ xét nếu chốt game.

## Nguồn và truy xuất

Đã đọc hai nguồn bằng UTF-8. Đường dẫn attachment phụ thuộc máy hiện tại, không phải bản sao lưu portable. Không nạp nguyên văn mặc định.

- **S1 — brief 36 mục:** `C:\Users\lebaa\.codex\attachments\488f9e02-c91d-4e20-884c-2c9ff4f37db4\pasted-text.txt`
- **S2 — spec 0–107:** `C:\Users\lebaa\.codex\attachments\bd809494-db15-44da-aee0-320065ffc596\pasted-text.txt`

Bảng trên trỏ số mục S2. Nguyên tắc đã có trong PRODUCT_BRIEF không chép lại. Khi chốt một ứng viên: bàn đúng phần sắp làm → người dùng duyệt → cập nhật file sở hữu và trạng thái ở đây.
