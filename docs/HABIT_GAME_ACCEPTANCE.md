# Habit/Thần Lộ — kiểm chứng và nghiệm thu

Cập nhật 2026-10-12. Đây là các gate của goal; toàn scope đã triển khai, full gates và staging smoke đạt tại [RELEASE](HABIT_GAME_RELEASE.md), checkpoint tại [PROGRESS](HABIT_GAME_PROGRESS.md). User nghiệm thu trải nghiệm cuối. Không đánh dấu đạt chỉ vì đã viết tài liệu/test.

## 1. Chất lượng cần chứng minh

| Lớp | Bằng chứng cần có | Không đủ để kết luận |
| --- | --- | --- |
| Luật thuần | Test qua hàm production, cases biên và invariants | Công thức thứ hai giống implementation chỉ tự test chính nó |
| Giao dịch | D1/local integration với concurrency, failure, receipt | Mock trả kết quả như mong muốn |
| Nội dung | Validator, graph mở khóa, mô phỏng toàn catalog/15 chương | 39 tên/15 tiêu đề hiện trong một màn demo |
| UX | Flow thật bằng browser, screenshot được xem, sửa lỗi rõ thấy | DOM test xanh hoặc một mockup đẹp |
| Art | Ảnh thật cuối, manifest/workflow, kiểm hình và crop trong app | Prompt ảnh, hình mẫu, URL của tool chưa lưu vào repo |
| Data/release | DB cũ → mới, backup restore riêng, gates và staging smoke | Chỉ deploy command exit 0 |
| AI/provider | Test tool/context/fallback bằng fixture; live chỉ khi được phép | Fixture không chứng minh Gemini/Telegram live thật |

Các test phải có mục đích nghiệp vụ/rủi ro cụ thể, không thêm test để khóa padding, lời văn tạm hay chi tiết private không cần thiết. Không xóa hoặc làm yếu test hồi quy chỉ để suite xanh; sửa nguyên nhân hoặc cập nhật expectation có quyết định nghiệp vụ đúng.

## 2. Habit và thời gian

| ID | Kịch bản | Kết quả bắt buộc |
| --- | --- | --- |
| H01 | Tạo/sửa/lưu trữ/xóa/khôi phục habit | Mốc hiệu lực rõ; history/cam kết đã phát sinh còn nguyên |
| H02 | Tick; số lượng/thời lượng; 15→20→15 với mục tiêu 20 | Tracking đúng; preview 0→đạt→0; final từ giá trị cuối, không nhân thưởng |
| H03 | Hằng ngày/chọn thứ; không đến lịch | Thiếu khi bỏ nghĩa vụ; ngày không đến lịch trung tính |
| H04 | Q=3, chỉ ngày 1 đạt | Ngày 2–5 trung tính; ngày 6/7 mỗi ngày thiếu mới một |
| H05 | Q=3, ngày 1 và ngày 7 đạt | Thiếu ngày 6 giữ nguyên; ngày 7 đạt và không thiếu thêm |
| H06 | Q1..7, mọi mẫu 7 ngày | Thiếu lũy kế không giảm, thiếu mới 0/1; counted đạt + thiếu cuối kỳ = Q |
| H07 | Đủ Q sớm, nhiều phiên trong ngày, chia/tạo/xóa habit | Không biến thành thêm ngày đạt hoặc hệ số vô hạn |
| H08 | Qua nửa đêm/start, đổi settings, tuần đầu/đổi lịch/hủy | Snapshot nhất quán; không phạt trước hiệu lực hoặc mở lại ngày khóa |
| H09 | Ngày đóng, cron chưa chạy; ghi bằng web/tools/API | Chỉ đọc ngày cũ, không có cửa sổ ghi bù |
| H10 | Timeout rồi retry qua mốc ngày | Có receipt thì replay cũ; chưa commit thì stale, không áp sang ngày mới |
| H11 | Trend/notes/filter/history/export | Cùng nguồn chuẩn, trung tính không fake success; dữ liệu cũ read-only |

## 3. Luyện, chế độ và game

| ID | Kịch bản | Kết quả bắt buộc |
| --- | --- | --- |
| G01 | Một habit, 6 habit, ngày không đến lịch | Mọi môn học được; 100% khả thi; không failure giả/người nhiều habit tăng tốc vô hạn |
| G02 | Qua bốn tầng, khuyết điểm sớm rồi tầng sau hoàn hảo | Phẩm chất nghiêm/khuyết điểm tích lũy; tầng khóa không đổi |
| G03 | Luyện lại/bản cũ/đổi bản/môn/tầng giữa tuần | Bản mới từ tầng 1, bản cũ còn dùng; không cộng dồn/né nghĩa vụ weekly |
| G04 | Đặt Xuất Chiến D; xử lý D vào D+1 | D theo mode D; D+1 theo mode mới; một nguồn không vừa luyện vừa đánh |
| G05 | Thắng/rút giữa kỳ; delayed/repeated/concurrent cron | Đúng một turn/reward, không tái dùng contribution, temporal ordering đúng |
| G06 | Giết boss trước phản công; boss hồi sinh đã báo; đồng quy | Thứ tự/cơ chế đã đặc tả, log và HP không mâu thuẫn |
| G07 | Giáp Sơn Hà 20 với 100/100; 110 với 100/100/100 | HP mất 40/100 và 0/10/100 khi bỏ qua hiệu ứng khác |
| G08 | Echo/reflect/bleed/summon/stack/copy/seal/intent | Bounded, đúng thời hạn, không recursion/immortality/stunlock |
| G09 | Bốn ấn khác nhau; lặp một thức; Vấn Thiên ở boss 3 ngày | Không nhân ấn; bùng nổ chỉ đủ điều kiện; boss ngắn vẫn có đường thắng |
| G10 | Chưa chọn/vắng app/đến hạn/rút trước chốt/HP 0 sau chốt | Chính sách chờ/rút an toàn đúng; không rút miễn phí sau chết |
| G11 | Hộ Mệnh/Nghịch Mệnh/lần chết thứ hai/multi-hit | Một quyền cứu chung; đúng giá và chuỗi hit; không tự trả giá thay user |
| G12 | Nghịch Mệnh + đột phá/sleep penalty/protection/undo | Rank/qi/earned/kỷ lục theo rule; không bật rank lại miễn phí hoặc hoàn nguyên tài khoản |
| G13 | Reward/chiến tích/DIỆT THẦN; retry/replay boss | Chỉ từ kết quả đã commit; entitlement/dedupe đúng; không farm |
| G14 | Publish balance/content khi đang luyện/đánh | Version/snapshot giữ nghĩa log/trận cũ; không đổi boss âm thầm |

## 4. Catalog, cốt truyện và cân bằng

AI tự viết harness/test data bằng engine production, thời gian giả và DB local riêng, không chờ nhiều tháng ngoài đời hoặc dùng dữ liệu user thật. Fixture phải ghi rõ điều được cấp sẵn; kiểm đường mở từ trạng thái mới bằng một lượt riêng, không lấy một fixture sở hữu mọi thứ để chứng minh unlock.

- Đếm đủ 25 môn năm phái +8 cấm thuật +6 Ngoại Đạo. Tất cả có effect/cost/tier/purity/unlock/art mapping và ít nhất một tình huống dùng được; mỗi trấn phái không làm bốn môn thường vô nghĩa.
- Validator kiểm references/IDs/values, điều kiện không thể đạt, vòng unlock, orphan reward/asset và giới hạn effects. Chạy cả data của **15 chương**, không chỉ chương mẫu.
- Traversal tuyến chính từ tài khoản mới qua điều kiện thật tới boss cuối/DIỆT THẦN. Đường thắng dùng một số môn đầu tư tốt, không cần đủ 39/100% toàn bộ; không unlock bằng grant admin trong lượt kiểm này.
- Chạy các tuyến truyền thừa, cấm thuật, Kiếm Đồ, Dị Giáo/thần binh/chiến tích. Kiểm truyện sau thắng/rút/thua/tái ngộ và đọc lại không phát thưởng.
- Các mức sống thực: 1 và 5–6 habit; đạt khoảng 60–80%, cả mẫu ngắt quãng; lịch chọn thứ/Q tuần; có ngày không đến lịch, có ngày vắng app. Kiểm bản phẩm chất thấp/vừa/cao.
- Với nền sức mạnh phù hợp, các build thuần **từng phái** và build pha trộn có đường tiến triển; boss không đòi duy nhất một chiêu hiếm để sống. Chọn thứ tự công/thủ khác nhau phải tạo khác biệt kết quả/HP/khả năng sống.
- Thử các chiến thuật đơn giản lặp chiêu để phát hiện chiêu thống trị, camp, infinite defense và %HP one-shot endgame. Sửa và chạy lại case liên quan, lưu seed/config/kết quả trước–sau.
- Nhịp mở nội dung có mục tiêu gần, không wait/grind vô nghĩa. Tinh thuần vẫn nghiêm; cân bằng sức mạnh/encounter và cách giải thích thay vì tự hạ độ nghiêm user đã chọn.

Không cần chứng minh toán học mọi combo 39 môn. Agent chọn độ phủ dựa trên nhóm hiệu ứng/rủi ro, công bố phần đã kiểm và sửa concrete failures; ghi seed và phiên bản để tái tạo. Mô phỏng không thay đánh giá UI/hành trình của người thật; user nghiệm thu cảm giác chơi cuối.

## 5. Kiểm tra UI, art và accessibility

- Viewports 360/390/414 px và desktop, dark/light, chữ lớn/zoom, safe-area, keyboard. Không tràn ngang, nút chạm khoảng ≥44 px, sheet header/nút đóng và hành động chính luôn dùng được.
- Nội dung trống/ít/nhiều, tên dài, 6 habit, nhiều bản luyện, full catalog. Thứ tự chữ và dãn dòng gắn nhóm thông tin; bold dùng để có thứ bậc, không làm mọi con số cùng nổi.
- Tab Hôm nay giữ toàn cảnh công việc, thời gian đến deadline và nhóm habit đọc nhanh; task xong không vào hàng xếp việc. Giờ ngủ và miễn hạ bậc giữ bố trí đã chốt.
- Form có labels/errors/focus; không dựa màu/hover. Reduced motion không mất thông tin; log có bản text, art có alt hoặc được đánh dấu decorative phù hợp.
- Loading, mạng chậm/offline, POST chưa rõ/đã commit nhưng refresh lỗi, conflict hai tab, hết auth: không mất nháp hoặc báo success giả, retry không double reward.
- Xem ảnh thật và screenshots tích hợp để sửa mặt/tay/đồ vật, style, độ sáng/crop, overlay text, contrast, asset lỗi. Không kết luận “đẹp” từ file tồn tại hoặc snapshot test.
- Không preload toàn bộ art/story. Đo transferred bytes, thời gian mở các màn chính và request count trên fixture/network profile được ghi; điều chỉnh budget dựa trên platform hiện tại.

Lưu screenshot cuối đã xem và ghi màn/viewport/theme. Ảnh QA/art nháp có thể nằm thư mục ignored; ảnh sản phẩm cuối/manifest phải trong repo. Nếu không có máy iPhone thật thì ghi đã kiểm bằng emulation, không tuyên bố nghiệm thu thiết bị thật.

## 6. Hồi quy, bảo mật, dữ liệu và hiệu năng

- Tasks cha/con, estimate/work log/deadline, replan, completion reward/tickets, gacha/fusion/inventory, breakthrough, checkin và sleep streak/undo 5 phút vẫn đúng.
- Báo ngủ sớm bằng web/bot chặn lời thúc ngủ/task; focus tương đương; user-configured reminders tiếp tục; pause/inactive đúng. Regression cho lỗi đã báo ngủ mà còn nudge phải đi từ root cause đã xác minh.
- Owner giả, initData/cookie/Origin sai/hết hạn, input cap, số biên/ID khác owner, tool injection, stale version và replay conflict bị chặn. Không raw HTML từ tên/notes/LLM.
- Hai tab, song song cron/API, crash giữa writes/receipt/outbox, uncertain delivery, retry day boundary được thử với persistence thật.
- Migration DB cũ → mới giữ counts/invariants và khả năng dùng feature cũ. Backup → restore vào DB riêng, không dispatch reminder/test message; kiểm schema/data và run flows trên bản restore.
- CPU/query/payload/history/backlog được đo với fixture đại diện và lớn; backlog nhiều ngày xử lý có giới hạn và resume. Không gọi LLM trong settlement hoặc art khi runtime dùng app.
- Config/key thật chỉ ở secrets/.env; `.env.example` khớp code đọc; model/cache/backup/drafts không staged. Không paid fallback/ngân sách bổ sung.

## 7. Gate trước phát hành

Khảo sát `package.json` lại; các lệnh hiện có:

```powershell
npm.cmd run typecheck
npm.cmd run check:web
npm.cmd run test:all
npm.cmd run test:browser
npm.cmd run build:check
npm.cmd run staging:check
```

Chạy targeted gates khi đang làm phần đó; trước release chạy đầy đủ, inspect every result. Test/browser scripts phải thực sự phủ features/migrations/content mới, không chỉ giữ bộ cũ. Ghi pass/fail/skipped/environment failure riêng, phiên bản source và command; không gọi skip là pass. Chỉ mở rộng/repeat test để giải quyết rủi ro còn cụ thể hoặc gate bắt buộc.

## 8. Điều kiện hoàn thành toàn goal

1. Tất cả dòng phạm vi trong PRODUCT dùng được trên hành trình thật, đủ 39 môn/15 chương/tuyến phụ và ảnh cuối. Không có nút rỗng, placeholder hoặc cảnh chỉ dùng bằng debug.
2. Luật user được bảo toàn; từng nhóm rủi ro bên trên có bằng chứng, findings nghiêm trọng đã sửa; P0 decisions không còn mục chưa quyết định ảnh hưởng sản phẩm.
3. Các gate phù hợp đạt, data upgrade/restore/concurrency/performance/UI/art được kiểm chứng. Không giả kết quả live/provider/thiết bị.
4. Commit/push bình thường, migrate/deploy đúng staging đã được phép, kiểm asset/API/auth và smoke read-only sau publish. Không làm giả log/habit/task của user hoặc gửi tin giả để thử.
5. Có URL/cách đăng nhập, tour ngắn, hướng dẫn habit/luyện/trận/cứu mạng, danh sách migration, bằng chứng, backup/rollback, known limitations nhỏ và checkpoint tiếp tục.

Nếu tool/máy/quyền/cấu hình chặn một hạng mục bắt buộc, ghi đúng chặn và tiếp tục phần độc lập; không complete goal bằng cách bỏ hạng mục. `/goal` không vượt giới hạn môi trường hoặc đảm bảo chạy vô hạn. Chỉ dùng trạng thái goal theo quy tắc của công cụ thực tế.
