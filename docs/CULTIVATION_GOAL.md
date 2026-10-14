# Prompt triển khai toàn bộ vòng Tu luyện

Cập nhật **14/10/2026**. Đích và luật ở [bản tổng hợp](CULTIVATION_FINAL_BRIEF.md) và [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md); source/bằng chứng ở [PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md). Prompt tập trung vào đầu ra, quyền và cách kiểm; chi tiết triển khai được AI lựa chọn trong khung.

## 1. Chọn đúng cách chạy

- **Thread mới chưa có goal:** gửi khối `/goal` ở mục 2.
- **Thread hiện tại có goal cùng phạm vi đang active:** gửi khối Tiếp tục ở mục 3. Kiểm trạng thái bằng `/goal` khi cần.
- **Goal paused:** gửi nội dung ủy quyền phù hợp rồi dùng `/goal resume`.
- **Chưa muốn triển khai:** chỉ đọc/duyệt tài liệu. Tài liệu không tự cấp quyền sửa code; nếu muốn tạm dừng goal active, người dùng dùng `/goal pause`.

Trạng thái active được đối chiếu trong lần tổng hợp này, không thay trạng thái thật ở lần chạy sau. Không tạo goal thứ hai khi cùng mục tiêu còn active.

## 2. Lệnh dùng trong thread mới

~~~text
/goal Hoàn thiện và bàn giao toàn bộ vòng Tu luyện theo docs/CULTIVATION_FINAL_BRIEF.md, docs/CULTIVATION_IMPLEMENTATION_PLAN.md và hợp đồng triển khai mục 4 của docs/CULTIVATION_GOAL.md. Tôi duyệt inventory PLAN mục 11 cùng các phụ thuộc trực tiếp trong phạm vi; cho phép tự sửa/tạo/refactor code, tests, migration và tooling liên quan. Trong phạm vi này, thay yêu cầu duyệt từng file của AGENTS bằng quyền tự triển khai; ghi quyết định và inventory vào checkpoint trước mỗi nhóm. Đọc docs/CULTIVATION_IMPLEMENTATION_PROGRESS.md và git diff để nối tiếp phần dở. Tự hoàn thiện demo HTML, engine/D1/API, 39 công pháp/40 encounter, UI/UX, cân bằng, hiệu năng và staging đến khi đạt PLAN mục 12. Được tự commit/push thường, backup/migration/deploy staging sau gates và rehearsal; ngân sách bổ sung 0đ. Giữ luật cố định và dữ liệu cũ; tự quyết phần còn mở có bằng chứng. Tôi nghiệm thu sản phẩm cuối.
~~~

## 3. Tiếp tục goal đã có trong thread hiện tại

~~~text
Tiếp tục goal hiện tại theo docs/CULTIVATION_FINAL_BRIEF.md, docs/CULTIVATION_IMPLEMENTATION_PLAN.md và hợp đồng triển khai mục 4 của docs/CULTIVATION_GOAL.md. Tôi duyệt inventory PLAN mục 11 và các phụ thuộc trực tiếp trong phạm vi; thay yêu cầu duyệt từng file của AGENTS bằng quyền tự triển khai code/tests/migration/tooling liên quan. Được tự commit/push thường, backup/migration/deploy staging sau gates và rehearsal; ngân sách bổ sung 0đ. Đọc checkpoint mới nhất và git diff để nối tiếp phần dở. Giữ luật cố định, tự quyết layout/trị số/chi tiết kỹ thuật còn mở bằng bằng chứng; làm xuyên suốt demo, app thật, đủ 39 công pháp/40 encounter, kiểm chứng và bàn giao staging theo PLAN mục 12. Tôi nghiệm thu sản phẩm cuối.
~~~

## 4. Hợp đồng triển khai cho agent

### Đầu ra và cách đọc nguồn

1. Đọc BRIEF → PLAN mục 0/3/10–12 → PROGRESS mục 5.9/6 và diff. Sau đó đọc PROGRESSION/GLOSSARY/ARCHITECTURE theo phần đang làm. Người dùng mới nhất ưu tiên; PLAN sở hữu luật cố định, PROGRESS sở hữu trạng thái. Không lấy tài liệu phát hành lịch sử chứng minh v2 đã giao.
2. Hoàn thiện **cả demo và app thật**, đủ 39 môn/40 encounter, từ luyện/học/đổi môn/luyện lại đến chuẩn bị/chọn chiêu/thắng–thua/cứu/log/Thành tựu. Kiếm Ý là lát cắt, không là điểm dừng.
3. Tiếp tục domain/projection/API/views/actions/builder đã có. Demo dùng dữ liệu riêng và hàm production; session ở `scripts/lib/cultivation-demo.ts`, HTML sinh bằng `scripts/build-cultivation-demo.mjs`. Không viết lại công thức trong HTML hoặc thay dữ liệu tài khoản thật bằng fixture.

### Luật cố định và UI

- Giữ F01–F18: tầng theo số ngày luyện; habit quyết định riêng phần sát thương tăng thêm của kỳ. Kỳ trước 50%, kỳ sau 100% nhận đủ phần tăng kỳ sau; khuyết điểm giữ riêng trong thuần khiết. Hiệu ứng/tỷ lệ mở/tăng đủ theo tầng, tối đa hai bản maintained, không ghép tầng.
- Một số **Sát thương** nổi bật = tổng đòn chính chắc chắn ban đầu trước phòng ngự. Số đòn và đặc tính/hiệu ứng/điều kiện/cái giá mở xem bằng cùng nhóm và đơn vị. HP dự kiến mất trong trận có nhãn khác. Giá và rủi ro quyết định hành động phải đọc được trước xác nhận.
- Hiện tại thể hiện đúng trạng thái, một hành động chính. Công pháp đi Phái → Môn → Tác dụng/Nâng cấp; nâng cấp cho biết hiện tại → tầng kế thêm gì, phần theo habit và phần tăng đủ theo tầng. Thuần khiết tách đã đạt/trần khả thi/phần mất chắc chắn; forecast/pending có nhãn.
- Chuẩn bị tối đa 5 môn khác nhau, mỗi môn đúng một bản; preset lỗi giữ draft. Trận một lựa chọn/ngày, sửa trước hạn; preview read-only đúng snapshot và không lộ ý định boss chưa được xem. Header/footer thao tác cố định trên màn nhỏ.
- Giữ bộ ảnh hiện có cho vòng này; không avatar người chơi hoặc hoạt ảnh RPG trên thẻ luyện. Batch tạo lại art thuộc vòng riêng, chất lượng art chưa được người dùng nghiệm thu.

### Quyền tự quyết và ranh giới

- Tự giải A01–A08; được chọn layout, câu chữ, nhãn mục boss, số ngày luyện, hệ số/trị số còn mở, schema/DTO/cache và thứ tự làm. Chọn bằng ví dụ/tests/simulation/ảnh/số đo; cập nhật nguồn sở hữu quyết định. Không khóa cứng số thử hoặc thêm tính năng không phục vụ luồng.
- Giữ architecture domain thuần → application/ports → D1 → entrypoint auth/DTO → web. Server sở hữu ngày, sức mạnh, quyền, version và receipts; UI/LLM không tính game hoặc cấp quyền.
- Giữ task/habit/ngủ/focus/lời nhắc/đột phá, lịch sử, snapshots và kinh tế đã có. Không suy R từ q legacy; không sửa lịch tầng đã lưu hoặc đổi rule trận đang đánh. Luyện lại tạo bản mới đúng luật.
- Bảo toàn dirty worktree; scoped commit và push thường. Được backup, rehearsal, migration và deploy đúng staging sau gates. Không production, force-push, reset DB, ghi dữ liệu cá nhân giả, gửi tin thử hoặc in/commit secrets/backups.
- Quyền áp dụng inventory PLAN §11 và phụ thuộc trực tiếp cần thiết; ghi phạm vi trước nhóm sửa. Chỉ hỏi khi thiếu input thiết yếu không có cách tiếp tục hoặc cần đổi luật/quyền; vẫn làm phần độc lập. Ngân sách bổ sung 0đ, không tự chuyển dịch vụ trả phí.

### Nối tiếp và chính sách lặp

- Đọc checkpoint hiện hành§5.9/§6 trước khi chọn việc tiếp. Footer chữ lớn, history race, preview/log/support, crop ảnh và builder đã được xử lý; không làm lại findings đã đạt. Nối tiếp gates/release còn thiếu ở checkpoint; nếu release đã xong, chỉ xử lý phản hồi mới của user.
- Baseline120/candidate120/mastery2/mixed5/repetition12.800 đã có report/giới hạn và dẫn tới factory bản mới3/4/6/8. D1 có proof lịch cũ giữ nguyên; không áp lịch lần nữa, gắn report cũ cho source mới hoặc khởi động lại probes vì checkpoint cũ ghi thiếu.
- Tiếp tục rủi ro forecast/audit/revision/paused/legacy, lợi ích tác dụng/combo còn rủi ro, UX kết quả/nhật ký, visual và latency live. Giữ breakdown từ resolver, kết quả combat/log legacy và coverage guards; không dựng lại engine/demo.
- Demo đã sinh lại từ source chung; matrix đã chụp và agent mở xem. Giữ kết quả trên đúng source, chụp lại phần chịu ảnh hưởng khi sửa tiếp. Kiểm demo cùng contracts/luồng app thật; không sửa công thức trong HTML đầu ra.
- Backup staging và restore+0038 trên bản sao đã có evidence; kiểm độ mới và rollback bằng binary hiểu dữ liệu v1/v2 trước remote release. Không restore backup cũ đè writes mới. Các handles đã kết thúc tại checkpoint không cần poll/restart.
- Sau thay đổi, kiểm gate bị ảnh hưởng; trước release chạy full gates trên nguồn cuối. Không mở rộng test/benchmark để tăng số lượt nếu rủi ro đã được giải. Ghi checkpoint ngắn: thay gì, vì sao, evidence/giới hạn, việc còn lại và next action; tiếp tục qua các chặng đến đích.

### Điều kiện kết thúc

- PLAN §12 đạt với bằng chứng đúng source: typecheck, check:web, main tests, browser, build/staging checks; migration/restore/compatibility rehearsal; validation và simulation v2; visual review và số đo tải.
- Tự chụp **và mở xem** mobile/desktop, sáng/tối/chữ lớn và trạng thái bắt buộc; sửa findings. Đo cold/warm, D1/API/payload/ảnh/render có fixture/throttle/mẫu rõ; không dùng local thay latency staging hoặc cấp sẵn max thay earned progression.
- Giao URL staging, HTML/hướng dẫn thử, luật và trị số cuối, commit/Worker/migration cùng hồ sơ PLAN §10.3. Không báo hoàn thành khi còn đầu ra bắt buộc chưa xử lý; người dùng nghiệm thu thẩm mỹ và trải nghiệm dài ngày.
- Khi thực sự không có đường tiếp tục hợp lệ, ghi phần đã làm, các cách đã thử, bằng chứng, nguyên nhân và input cần. Trạng thái goal tuân theo công cụ/system; không tự pause hoặc đánh complete để kết thúc sớm.

## 5. Căn cứ cho cách viết lệnh

Prompt nêu đích, bằng chứng, ràng buộc, phạm vi và cách lặp để agent tự chọn bước tiếp theo. Lệnh quản lý goal và cách đặt điều kiện hoàn thành đã tìm và mở kiểm lại bằng **OpenAI Docs**, [tài liệu chính thức OpenAI — Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex), ngày14/10/2026. Goal vẫn chịu quyền, tài khoản và giới hạn của môi trường; prompt không bảo đảm chạy vượt các giới hạn đó.
