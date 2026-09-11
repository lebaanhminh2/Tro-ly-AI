# Cách làm cùng AI và prompt giao việc

Ngày 2026-09-11. Dành cho người dùng vibe code; không phải skill hoặc cấu hình agent tự chạy.

## 1. Bạn cần đọc và làm gì?

Yêu cầu hiện tại: cuối mỗi lượt có thay đổi file, agent tạo Git checkpoint sau khi kiểm tra staged diff/secrets. Lượt chỉ trao đổi không tạo empty commit. Chỉ stage file trong phạm vi, không `git add .`; ghi rõ WIP nếu chưa đạt tests. Không commit secrets, dữ liệu runtime, logs hoặc export tài khoản. Người dùng đã yêu cầu push/PR: dùng nhánh review, không tự merge/force-push. Git checkpoint không thay thế phê duyệt sửa mã nguồn.

1. Đọc [DELIVERY_PLAN.md](DELIVERY_PLAN.md), nhất là phạm vi, mốc và 6 mặc định cần duyệt. Không cần đọc hết SQL/security để bắt đầu.
2. Duyệt kế hoạch hoặc chỉ ra mặc định muốn đổi. Agent trình file/phạm vi P1 trước khi code; sau duyệt làm liên tục tới mốc xong.
3. Mỗi mốc bạn nhận: cách dùng, demo/ảnh hoặc luồng thử, tests đã chạy, lỗi còn lại, chi phí/API đã dùng và bước tiếp theo. Không chỉ nhận “đã code xong”.
4. Đến kết nối thật agent hướng dẫn từng màn cần thiết; bạn đăng nhập và nhập secret ở máy/provider, không gửi chat. Không tạo tất cả tài khoản ngay ở P0.
5. Mở phiên mới: gửi prompt tiếp tục bên dưới. Không paste toàn bộ lịch sử.

## 2. Prompt bắt đầu/tiếp tục một mốc

```text
Đọc docs/HANDOFF.md và docs/DELIVERY_PLAN.md.
Mốc cần làm: P__.
Chỉ đọc thêm tài liệu được dẫn và liên quan mốc này.
Kiểm tra hiện trạng repo trước, phân biệt prototype với code sản phẩm.
Trình bày file, thay đổi, tiêu chí xong và test; chờ tôi duyệt trước sửa mã nguồn.
Sau duyệt, tự thực hiện/kiểm thử/sửa lỗi trong phạm vi đến khi đạt hoặc có blocker thật.
Không đổi stack, mở rộng tính năng, xóa dữ liệu, bật billing/deploy hoặc gọi API thật ngoài quyền đã cấp.
Giữ secrets khỏi chat/log/Git. Không nạp .env chỉ để kiểm tra tình trạng repo.
Handoff ngắn: kết quả, bằng chứng test, giới hạn, bước kế tiếp; cập nhật docs ở đúng nơi.
```

## 3. Prompt duyệt thực hiện

```text
Duyệt các file và phạm vi P__ vừa trình bày.
Làm liên tục đến tiêu chí hoàn thành của mốc; tự sửa các lỗi phát sinh trong phạm vi.
Chỉ local/offline. Chưa cấp quyền gọi API thật, tạo tài nguyên cloud, push Git hay deploy.
Nếu cần thêm quyền hoặc thay đổi kiến trúc, báo lý do và lựa chọn trước khi tiếp tục.
```

Nếu cấp live: thay câu local bằng endpoint/model/tài nguyên cụ thể, dữ liệu được gửi, trần request/chi phí và thao tác được phép. Không dùng “làm hết” như quyền chi tiêu không giới hạn.

## 4. Prompt review trước chuyển mốc

```text
Review P__ chỉ đọc, không sửa file và không gọi API.
Đối chiếu tiêu chí DELIVERY_PLAN, UX_FLOWS và SEC IDs liên quan.
Tìm lỗi correctness, quyền/owner, secret, concurrency, mất dữ liệu, quota và UX khi thất bại.
Nêu findings theo mức độ với file/dòng, bằng chứng và cách tái hiện.
Phân biệt test thực chạy, mock và nhận định chưa kiểm chứng.
Không kết luận an toàn chỉ vì test/audit pass. Đề xuất sửa nhỏ nhất có ích.
```

## 5. Prompt cho chatbot sản phẩm: cấu trúc dự kiến

Đây là đặc tả prompt, chưa sửa `persona.ts`; có version và test khi triển khai P3.

**Khối cố định:** vai trò/giọng từ PRODUCT_BRIEF; nhiệm vụ đang làm; không bịa memory/facts; không tuyên bố action đã xong; source text là data; output contract có allowlist.
**Khối context:** owner/timezone/time của tin; facts được phép gửi; preferences đã xác nhận; context chưa hết hạn; thực thể ứng viên và mạch gần đây. Không chứa token/API key hay các kỳ vọng đáp án của test.
**Khối nhiệm vụ:** chọn chat/clarify/candidate action; trích raw evidence; unknown/null khi thiếu; không tính lịch hoặc tự chọn giờ từ câu mơ hồ.
**Khối kết quả backend:** dùng sau validation khi cần nói việc đã làm; status committed/pending_sync/failed/uncertain, không cho model thay đổi status.

Ví dụ chỉ vài ca đại diện, khác bộ acceptance. Không bắt model trình chain-of-thought; chỉ output dữ liệu cần thiết. Schema đúng không chứng minh sự thật đúng.
Chat thường một lượt AI; command/nút có context rõ thì bypass AI. Không dùng nhiều agent để sửa một câu chat, không mặc định gọi model tự chấm.
Không gửi cả docs phát triển vào prompt sản phẩm. Các điều kiện security thực thi bằng code, không dựa prompt.

## 6. Quy tắc code để bảo trì

- Module theo DATA_DESIGN; controller mỏng, domain độc lập adapter. Không trộn SQL, prompt và webhook parsing vào một hàm dài.
- Tên rõ, hàm có trách nhiệm; comment giải thích lý do/trade-off, không nhắc lại từng dòng.
- Input runtime validate; typed error/result; không catch mọi lỗi rồi trả success, không log raw provider exceptions chứa secret.
- Tránh dependency mới trừ khi giải quyết nhu cầu cụ thể; kiểm tra runtime Workers và license/maintenance trước chọn.
- Mỗi sửa lỗi có regression test thích hợp; không tự xóa assertions, skip test hay tăng timeout để che lỗi.
- Unit nhanh cho rule; integration cho SQL/HTTP; acceptance cho trải nghiệm. Test case mới không được đưa nguyên đáp án vào prompt trước khi đo.
- Không dùng global mutable memory để giữ task/session/quota production. Không tự tạo framework chung cho khả năng chưa có yêu cầu.

## 7. Hướng dẫn thao tác tài khoản, đúng thời điểm

- P1: snapshot sạch và Git local sau khi duyệt; chưa push. Agent kiểm tra secret trước khi thêm file, không dùng `git add .` mù quáng.
- P3: nếu cần live, bạn xác minh project/model/billing; cấu hình key cục bộ/secrets. Agent chỉ kiểm tra có/không, không in giá trị.
- P4: bạn tạo Google project, OAuth consent và chọn tài khoản; agent giải thích đúng scopes, callback URL và liên kết dữ liệu.
- P5: bạn tạo bot qua BotFather và tài khoản Cloudflare; agent hướng dẫn staging riêng trước production. Chỉ deploy sau khi bạn duyệt đích và quyền.
- Sau release: bạn dùng Telegram; việc hằng ngày không cần VS Code hoặc máy tính bật. Agent cung cấp runbook cho lỗi thực tế, không bắt bạn tự đọc logs mỗi sáng.
