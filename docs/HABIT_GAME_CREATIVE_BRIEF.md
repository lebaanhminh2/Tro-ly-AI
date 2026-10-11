# Thần Lộ: trải nghiệm, nhân vật và hình ảnh

Ngày: 2026-10-12. Trạng thái: hướng thiết kế cho AI triển khai; chưa tạo ảnh, chưa tích hợp vào sản phẩm. Đã chốt một phái đầy đủ, chương mở đầu 3–5 boss, AI tự thiết kế phong cách tiên hiệp trầm/nguyên bản/đồng nhất. Ngân sách bổ sung 0đ; nguồn ảnh là model chạy cục bộ theo [LOCAL_ART](HABIT_GAME_LOCAL_ART.md).

## 1. Cảm giác cần tạo

Người dùng thấy những việc nhỏ ngoài đời tạo ra hành trình tu luyện có câu chuyện và lựa chọn. Habit vẫn dễ dùng; phần game có nơi riêng để khám phá, luyện và giao chiến. Giao diện trầm, đọc nhanh trên điện thoại; hình ảnh có cá tính và điểm nhấn ở cảnh/nhân vật.

“Cuốn” cần được chứng minh bằng nhịp chơi: mở mục tiêu mới → thấy tiến bộ → chuẩn bị một lựa chọn → hiểu kết quả → muốn thử chiến thuật hoặc mở phần truyện tiếp. Mỗi boss có cơ chế khác nhau và phần thưởng thay đổi cách chơi, không chỉ đổi tên/HP/màu.
Giữ độ nghiêm user đã chọn; diễn giải khuyết điểm như phẩm chất bản luyện. Hội thoại không trách móc con người vì một ngày chưa làm.

## 2. AI sở hữu các việc thiết kế

- Đặc tả gameplay, nhịp mở nội dung, cân bằng, onboarding và lời giải thích luật trên UI.
- Bộ nhân vật có ngoại hình, vai trò, động cơ, giọng nói và diễn biến; nhất quán xuyên hình/lore/màn chơi.
- Cảnh nền, chân dung nhân vật, boss và ảnh phần thưởng phù hợp phạm vi đã chọn; không chỉ vẽ một ảnh cover rồi coi art đã xong.
- Thiết kế và lập trình màn habit/luyện/trận; cơ chế loading/error/empty; chuyển động nhẹ giúp hiểu kết quả.
- Tự kiểm tra hình ảnh trong app thật, sửa phối màu/crop/chữ, cân bằng và lỗi luồng trước khi giao sản phẩm.

Chủ sản phẩm nghiệm thu cuối. AI tự review từng bản thử và chọn phương án trong phạm vi đã được giao; không phải gửi từng tên nhân vật/prompt ảnh để user chọn.

## 3. Hướng nghệ thuật ban đầu để phát triển

User đã giao AI tự chọn, ưu tiên tiên hiệp trầm. Hướng ban đầu: tranh bán hiện thực có chất mực và ánh sáng tiết chế. Nhân vật có silhouette, trang phục và vật dụng riêng; mặt rõ ở kích thước thẻ. Cảnh có chiều sâu, không phủ chi tiết vào vùng chữ.
AI tự hoàn thiện phong cách qua ảnh thử trong UI, giữ đồng nhất toàn bộ; không cần user chọn từng phương án.

- Giữ tông UI hiện tại; phần game dùng ít màu nhấn, đảm bảo tương phản cả dark/light. Trầm không có nghĩa mọi ảnh đều tối và khó nhận ra.
- Text, số liệu, tên chiêu và nút do app render; không đặt chữ cần đọc vào ảnh tạo.
- Dùng art lớn ở màn truyện/boss và thumbnail nhỏ ở danh sách; không làm thẻ task hoặc habit chìm dưới trang trí.
- Chuyển động ngắn, có chế độ reduced motion; không cần một canvas/game engine để có trải nghiệm tốt.

## 4. Bộ nhân vật mở đầu đề xuất

AI có thể đổi tên/chi tiết để phục vụ cốt truyện sau khi tự review; không phải nội dung user đã chốt.

| Nhân vật | Thiết kế và vai trò | Cách thể hiện trong gameplay |
| --- | --- | --- |
| Người tu hành vô danh | Nhân vật người chơi, trang phục đơn giản, một món đồ chưa rõ nguồn gốc; có hình đại diện rõ, không cần thêm hệ tạo avatar vào bản đầu | Người khám phá hệ thống; lựa chọn luyện và đánh thuộc người chơi |
| Tịch Vân — người giữ thư các | Điềm tĩnh, áo màu tro, sợi chỉ đồng và quyển sách đã vá; biết lịch sử các bí tịch nhưng không nói hết ngay | Dẫn nhập ngắn, mở quyền học và giải thích bản luyện; thoại thay đổi theo các mốc thật |
| Mộc An — người đồng hành | Nhanh nhẹn, túi thuốc và mảnh bản đồ, có mục tiêu riêng thay vì chỉ khen người chơi | Cho bối cảnh trước boss, kể hậu quả chiến tích; không làm thêm nghĩa vụ habit |
| Thạch Vệ — người giữ cửa cũ | Tượng giáp đá nứt, ánh sáng từ lõi, một chi tiết liên hệ món đồ của người chơi | Boss nhập môn: intent rõ, nhịp công/thủ có thể đọc; chiến thắng mở một bí tịch và manh mối |

Phạm vi đã chốt là 3–5 boss: thiết kế thêm đối thủ có cách đánh và động cơ đối lập như đánh nhiều hit, nuôi phòng thủ, hồi sức/pha chuyển. Các đối thủ cần lựa chọn thắng khác nhau và quan hệ truyện; không ghép nhiều hiệu ứng hiếm vào mọi boss. Chương mở đầu có kết thúc trọn vẹn và hướng mở rộng, không cần viết đủ 15 chương ở đợt này.

## 5. Nhịp chơi và onboarding

1. Habit đầu tiên tạo được nhanh, giải thích mục tiêu/ngày đạt và cam kết tuần bằng ví dụ; không bắt nhập cả bộ 5–6 habit để xem app.
2. Một cảnh truyện ngắn mở lý do tu luyện; thấy ngay mục tiêu gần nhất và đường đến chiêu dùng được.
3. Khi ghi đủ habit, hiện dự báo đóng góp rõ và phản hồi nhẹ. Chưa đủ hiển thị phần đã thực hiện; không giả cộng công lực.
4. Trước trận, thấy intent/nguy cơ và tác dụng chọn công/thủ; màn xem nhanh không yêu cầu đọc hết lore.
5. Sau kết toán, log ngắn giải thích vì sao thắng/thua, có thể mở chi tiết từng hit; truyện/phần thưởng dựa vào kết quả đã commit.
6. Sau boss, có lý do thử bí tịch hoặc chiến thuật mới; nhiệm vụ đời thật vẫn do người dùng tự chọn, không ép thêm habit để mở mọi môn.

Lựa chọn trong truyện chỉ thêm khi có hệ quả thật và giải thích được; không làm nhiều nút lựa chọn dẫn đến cùng một đoạn. Lore quan trọng nên viết trước và lưu trong nội dung versioned; không phụ thuộc một lần gọi LLM để chơi hoặc lấy thưởng.

## 6. Quy trình tạo ảnh thật

1. Thực hiện nguồn ảnh cục bộ đã được user chọn tại LOCAL_ART: preflight, môi trường riêng, model phù hợp khoảng 4 GB VRAM và thử chất lượng trước khi tạo cả bộ. Không dùng CLI OpenAI hoặc API ảnh trả phí; không coi key Gemini hiện có là nguồn ảnh miễn phí đã xác minh.
2. Lập danh mục asset gồm ID, nhân vật/boss, mục đích/màn dùng, kích thước/tỷ lệ/crop, prompt, reference, phiên bản, chi phí nếu có và trạng thái QA. Lưu manifest vào repo dưới dạng tài liệu hoặc dữ liệu phù hợp kiến trúc.
3. Tạo một ảnh nhân vật và một ảnh boss/cảnh để tự kiểm chứng hướng nghệ thuật trong bố cục thật. Chốt bản tốt rồi dùng làm reference cho các ảnh tiếp theo.
4. Dùng ảnh reference cho cùng nhân vật qua các tư thế/cảnh; giữ dấu nhận diện và thiết kế trang phục. Không coi cùng tên trong prompt là đã bảo đảm mặt nhất quán.
5. Kiểm tra lỗi giải phẫu/khuôn mặt/vật dụng, alpha nếu cần, bố cục/crop, độ sáng và tính nhất quán. Tạo lại có mục tiêu khi thấy lỗi; giới hạn trong ngân sách.
6. Lưu bản cuối trong workspace, tối ưu format/kích thước cho web; có bản nhỏ khi cần và lazy loading. Source ảnh nếu giữ phải có vị trí rõ, không bundle toàn bộ bản nháp lên web.
7. Tích hợp vào màn tương ứng, kiểm tra 360/390 px, dark/light, loading/error, asset URL và tổng tải mạng. Ảnh không phải nguồn duy nhất thể hiện trạng thái; có alt text phù hợp.
8. Báo đường dẫn bản cuối và manifest. Ảnh ở thư mục mặc định của tool nhưng chưa vào repo, hoặc screenshot mockup chưa làm UI thật, không được tính là xong.

Ảnh minh họa nhân vật/boss/cảnh phải là ảnh được tạo thật. SVG/CSS phù hợp cho icon, hình đơn giản và hiệu ứng UI; không thay cả chân dung/cảnh bắt buộc bằng hình vẽ tạm rồi báo hoàn thành.
Phiên chuẩn bị chưa cài model hoặc tạo ảnh. Pipeline local thuộc phần thực thi goal; không cần API key để bắt đầu thiết lập nó. Nếu cần API khác cho phần được giao, user cho phép hỏi trực tiếp tên dịch vụ/cấu hình; điền key qua môi trường/.env, không in/commit giá trị. Chặn art thật phải được báo đúng trong checkpoint, không che bằng placeholder.

## 7. Tự nghiệm thu và bàn giao

- Chụp và xem screenshot của UI đã chạy trên các kích thước mục tiêu, sửa lỗi rõ thấy; test DOM đạt không chứng minh hình ảnh đẹp hoặc chữ dễ đọc.
- Mô phỏng nhiều ngày qua clock/fixture local riêng: không chờ nhiều tuần ngoài đời, không chỉnh giờ/ghi nhận giả trong dữ liệu cá nhân thật.
- Chơi từ tài khoản mới tới trận đầu hoàn chỉnh, và đủ toàn bộ phạm vi nếu user chọn nhiều chương; kiểm tra đường quay lại, lời giải thích và phần thưởng.
- Mô phỏng mức hoàn thành thấp/vừa/cao để sửa nhịp và cân bằng; mỗi chiến thuật/công pháp được giao có ít nhất tình huống hữu dụng. Một habit vẫn có đường tiến triển.
- Kiểm tra mọi art/màn/nút của phạm vi phải giao, tránh nội dung rỗng ở giữa; lời thoại có giọng nhất quán và không dài dòng trên mobile.
- Bàn giao bản chạy, tour ngắn, ảnh màn chính, điều đã kiểm chứng và hạn chế. Không cam kết người dùng chắc chắn thích; dùng các tiêu chí trên để AI tự cải thiện trước nghiệm thu của user.
