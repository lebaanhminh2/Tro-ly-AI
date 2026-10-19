# Bàn giao đợt dọn dự án

> Cập nhật19/10/2026: người dùng đã duyệt bản hiện tại và cho phép phát hành staging. Linh thú gồm luyện/đồng hành, triệu hồi, lò đan,18bộ kỹ năng, tháp bốn tầng trong Habit và108ảnh runtime đã phát hành;0041 đã áp. Version `ff342cb0-4a7c-4b6b-b43c-bc3297a7a559` nhận100% lưu lượng, kiểm sau deploy đạt. [Mở staging](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/), [hồ sơ phát hành](LINH_THU_RELEASE.md), [ảnh](../output/imagegen/catalog-v3/index.html), [kiểm tra](LINH_THU_ACCEPTANCE.md) và [vận hành](LINH_THU_OPERATIONS.md). 95%/100% dùng tạm, sửa riêng sau. Phần dưới giữ lịch sử cleanup 18/10, không phải trạng thái Linh thú hiện hành.

Cập nhật 18/10/2026. Phạm vi được người dùng duyệt: bỏ Tu luyện/Thần Lộ, công pháp, luyện và chiến đấu; giữ sản phẩm nền. Bản cleanup đã được deploy lên staging theo yêu cầu tiếp theo của người dùng; người dùng cũng yêu cầu commit/push lên nhánh `review/p1-p3`.

## Trạng thái

Runtime đã bỏ routes/jobs/tools, stores/domain/game UI và assets riêng. Habit companion đổi tên, chỉ phục vụ habit. API game cũ trả 404 sau auth; model step cũ dừng an toàn trước action. Game account, battle, rank lock và receipts lịch sử vẫn trong DB nhưng không còn được dùng để chặn hoặc kết toán chức năng nền.

Giữ task/bước nhỏ, habits/history/report/export, lịch/kế hoạch/focus/nhắc, ngủ/thức, điểm/check-in/vật phẩm/đột phá/thành tích, Telegram/AI/auth và guards giao dịch. 38 migrations và dữ liệu local được bảo vệ. Không đổi luật điểm hoặc xây game thay thế.

Tài liệu còn 6 Markdown chính và prototype habit. Thông tin UX habit còn giá trị đã gộp vào [HABITS](HABITS.md); prototype giữ nguyên, không áp redesign mới. Các proposal/review/goal/game art hết hiệu lực được bỏ; lịch sử đã commit vẫn tra Git.

## Checkpoint và phạm vi

- Branch ban đầu: `review/p1-p3`, HEAD `956b03c34838a06a13e98f0362601d9f3fe2649c`.
- Backup: `.wrangler/cleanup-checkpoint-20261018-956b03c.zip` (418 file, 11.676.506 bytes).
- Manifest: `.wrangler/cleanup-checkpoint-20261018-956b03c.json`, chứa đường dẫn đã duyệt, hashes, Git status ban đầu và dữ liệu kiểm kê.
- ZIP SHA256: `2f32d91eb50a1d6134d8fb0fb90af1e5eadb4abdccb431999ddd0072b54c1cf8`.
- Đã bảo toàn bản sửa sẵn `docs/HABIT_GAME_UX_REVIEW.md` và toàn bộ 41 file untracked trong ZIP trước khi dọn; prototype habit tiếp tục được giữ trong working tree.

Khôi phục theo từng file từ ZIP vào thư mục riêng, kiểm hash rồi review diff trước thay thế. Không reset/clean hoặc giải nén đè cả kho. Backup là checkpoint local, không phải snapshot DB hoặc bản deploy. Hướng dẫn dữ liệu tại [OPERATIONS](OPERATIONS.md).

## Kiểm chứng

Baseline trước sửa: typecheck, check:web (47 modules), build dry-run, 378 main +25 experiments +44 browser đạt, không fail/skip. Browser baseline cần chạy ngoài sandbox Windows do lỗi GPU/CDP của Chrome trong sandbox.

Sau sửa: **246 main +25 experiments +25 browser đạt, 0 fail/skip**. Các tests game đã duyệt gỡ được loại theo tính năng; tests nền vẫn giữ. Có regression cho 13 endpoint game cũ (GET/POST), auth/Origin, rank lock cũ không chặn check-in/đột phá, journal replay hai tool đã nghỉ và đủ 12 tổ hợp cron không đọc/ghi bảng game.

Typecheck, check:web (33 modules), build dry-run local/staging và diff whitespace đạt. Worker 719,90→446,05 KiB (gzip 166,71→103,67 KiB). Bốn fixture benchmark habit 6/30×1095 ngày, backlog 7/365 ngày đạt; migration/restore trên DB tạm giữ legacy data và không dispatch. Đã xem ảnh habit, Hôm nay, Thành tích và cài đặt sau sửa; browser kiểm mobile/desktop, chữ lớn, sáng/tối, mất mạng và nháp.

Đối chiếu checkpoint: 183 file cần giữ +22 file state local khớp SHA256; 38 migrations và prototype habit nguyên vẹn. ZIP 418 mục khớp hash, chứa toàn bộ 41 file untracked ban đầu. Git diff chỉ nằm trong danh sách được duyệt, link tài liệu hợp lệ.

| Phần | File trước → sau |
| --- | --- |
| Toàn dự án, không tính ignored/dependencies/Git | 586 →225 |
| src | 106 →73 |
| web | 222 →35 |
| tests | 71 →46 |
| scripts | 16 →5 |
| docs | 112 →7 |
| experiments / migrations | 13 /38, giữ nguyên |

Đã bỏ 361 file dự án và 14 output simulation, tổng 83.139.123 bytes (79,29 MiB); simulation chiếm 69,11 MiB. Dung lượng file dự án từ 12.464.221 bytes xuống khoảng 1,68 MB. Checkpoint ZIP 11,14 MiB và artifact kiểm tra khoảng 20,7 MiB được giữ; không coi tổng tệp đã xóa là mức giải phóng ròng. .wrangler từ khoảng 1,614 GB còn 1,572 GB tại lần đo cuối; các browser profiles lớn vẫn còn.

Logs/build/ảnh ở `.wrangler/cleanup-validation-20261018-956b03c/`. Kết quả chỉ chứng minh local bằng fixtures, không thay nghiệm thu thiết bị thật hoặc owner API staging.

## Staging và giới hạn

Đã deploy `personal-assistant-staging` ngày 18/10/2026, version `4469dfad-7311-486c-b856-7c68e0fc12ad`, phục vụ 100% traffic. URL: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ . Version trước cleanup là `ef677def-9126-4af5-857b-39c3bcf6f103`.

Trước deploy, typecheck/check:web/staging dry-run và readiness gate đạt; remote không có migration chờ áp dụng. Không áp migration hoặc reset DB. Sau deploy, 35 assets khớp SHA256 local, 149 file đầu vào không đổi, 4 tab đúng, API thiếu auth trả 401 và assets game đã gỡ trả 404. Chưa kiểm mutation bằng phiên đăng nhập người dùng trên staging. Bằng chứng ở `.wrangler/cleanup-validation-20261018-956b03c/deploy-source.json`, `staging-deploy-verification.json` trong cùng thư mục và `logs/staging-deploy.log`.

Browser profiles/cache lớn trong .wrangler được giữ vì chưa đủ bằng chứng nguồn gốc/tình trạng đang dùng. Không dọn node_modules, secrets, state, SQL/SQLite backups hoặc thư mục ngoài workspace. Chỉ các simulation output đã kiểm kê và duyệt mới bị xóa.

Yêu cầu deploy và push của người dùng áp dụng cho bản cleanup này. Các thay đổi schema/dữ liệu hoặc phát hành tiếp theo tuân theo chỉ dẫn mới; không chạy lại goal game hoặc kế thừa quyền trong tài liệu cũ.
