# Bàn giao Habit và Tu luyện

## Mục tiêu Tu luyện hiện tại

**Đang triển khai redesign trong app thật và bộ art mới theo `/goal` đã duyệt.** Theo [checkpoint hiện tại](HABIT_GAME_CULTIVATION_PROGRESS.md), không áp dụng các yêu cầu chờ duyệt HTML/hoãn art/xin duyệt từng file ở các mục lịch sử dưới đây cho vòng này. Các version staging bên dưới vẫn là bản trước redesign, không phải bằng chứng phát hành mục tiêu mới.

## Cập nhật 13/10/2026: icon và bản thử Tu luyện

User duyệt `web/index.html`, `web/styles.css` để sửa icon Thói quen thành SVG ô tick và tạo duy nhất `docs/prototypes/cultivation/index.html` để chốt lại UX Tu luyện. Commit **`b419934`** đã push trên `review/p1-p3`. Icon đã lên staging, version **`d4990393-e797-4e8c-ba9d-fcd822af51aa`**; HTML/CSS live HTTP200 và SHA256 khớp local. Deploy readiness4/4, dry-run và check:web45 đạt. Không có migration.

Bản HTML có **Hiện tại → Công pháp → Vượt tầng → Thành tựu**; 39 công pháp/40 boss lấy từ catalog dự án, 22 trận chính thành tầng và 18 cơ duyên. Thử chọn/luyện lại bản, chuẩn bị tối đa5môn, chiêu theo ngày, mở bí tịch, cứu/tử trận và chiến tích. Bỏ Thần binh khỏi phương án; dùng dấu ấn thay chỗ, chưa làm lại art. [Thiết kế và cách thử](HABIT_GAME_CULTIVATION_UX.md) ghi đầy đủ thay đổi, phần discovery mới và tương thích vũ khí cần xử lý sau.

Chrome kiểm các luồng chính, màn hình320–1440, chữ200%, keyboard/dark/short sheet và icon app thật; HTML không tải tài nguyên ngoài. Đây là emulation/dữ liệu mẫu. **Tab Tu luyện thật chưa được thay theo HTML.** Việc tiếp theo là user mở bản thử, góp ý/duyệt luồng; lập inventory và xin duyệt code riêng trước khi áp dụng. Không chạy lại triển khai toàn game hoặc sinh art ở bước này.

`docs/HABIT_GAME_UX_REVIEW.md` và `docs/prototypes/habits/` có thay đổi từ vòng trước, vẫn nằm ngoài hai commit của vòng icon/HTML này.

## Cập nhật ngày 13/10/2026: áp dụng demo đã duyệt vào app

User đã duyệt 10 file cho phần Thói quen, push/deploy staging; sau đó duyệt thêm 4 file để đổi thứ tự thanh tab và tên Tu luyện. Runtime commit **`6c2da9d`** đã push trên `review/p1-p3` và deploy Worker `personal-assistant-staging`, version **`09ee5a4c-aba8-44f8-b85d-6d7b3de1f86f`**. URL nghiệm thu: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/ . Không cần migration trong vòng này.

- Thanh tab: **Hôm nay → Thói quen → Lời nhắc → Tu luyện → Thành tích**. Tên Tu luyện đã đồng bộ ở tiêu đề, quay lại, cài đặt và hướng dẫn; ID/API của game giữ nguyên.
- Mỗi habit có tick đầu dòng. Tick đặt đúng mục tiêu của metric, bỏ tick về 0. Nút tiến độ của thời lượng/số lượng cùng kiểu chữ, nền, viền; chỉ số đã làm nhấn nhẹ.
- Dưới tên có đúng một dòng phụ, ưu tiên nghĩa vụ cần đạt hôm nay, chưa bắt đầu/ngoài lịch, rồi giờ xếp và tiến độ tuần/lịch lặp. Dòng dài dùng dấu ba chấm; `+N` luôn còn chỗ, mở các thông tin còn lại trong chi tiết.
- Slider/bộ đếm nằm trong bảng ghi nhận, giữ ô nhập chính xác. Các thay đổi là nháp đến khi Lưu, thay tổng hôm nay; hỗ trợ số lẻ và vượt mục tiêu. Thêm/sửa dùng lựa chọn gọn, giữ nháp khi đổi loại và có header/footer cố định.
- Toast **Hoàn tác** ghi nhận tồn tại 6 giây, phục hồi đúng tổng và ghi chú trước thao tác, kể cả partial/vượt mục tiêu. Kiểm tra ngày sinh hoạt, phiên đăng nhập/revision, version habit/log và refresh chưa hoàn tất trước khi gửi; backend tiếp tục xác thực ngày/version. Đây là Hoàn tác habit, độc lập với cơ chế Hoàn tác ngủ 5 phút.
- Tiến bộ 7 ngày là một bảng chung; 30 ngày là tỷ lệ và số ngày đạt/cam kết từng habit. Chỉ lấy ngày đã kết thúc; trung tính loại khỏi mẫu số, chưa có kết quả dùng dấu `—`. Lịch sử/bộ lọc/xuất dữ liệu vẫn truy cập được.
- Report bổ sung `byHabit` trong API chung, hai truy vấn D1 cho toàn bộ danh sách. Chỉ tải khi mở Tiến bộ, gộp yêu cầu đang chờ, cache tối đa 60 giây, bỏ response lỗi thời và vô hiệu hóa sau ghi. Không dùng số đo fixture làm bằng chứng tốc độ trên điện thoại thật.

**Kiểm chứng vòng này:** `check:web` 45 modules, typecheck, **318 main tests + 37 browser tests, 0 fail/skip**, staging dry run và readiness/deploy đạt. Kiểm riêng sau đổi tab/tên: 3 browser flows đạt. Đã xem ảnh app với dữ liệu mẫu ở `D:/Tro-ly-AI-art/habit-production/`, gồm sáng/tối, danh sách, ghi thời lượng/số lượng, thêm habit và tiến bộ. Browser kiểm mạng chậm/mất mạng, chữ lớn, version và đổi ngày; đây là Chrome emulation/local fixtures, chưa phải nghiệm thu trên máy user.

**Sau deploy:** trang `/app/` và 8 asset sửa đều HTTP 200, SHA256 khớp bản local; thanh tab/tên mới đúng. API report khi chưa đăng nhập trả 401. Chưa kiểm owner report bằng phiên đăng nhập staging trong vòng này và không tạo dữ liệu cá nhân thử. Bản prototype và phần UX_REVIEW đã sửa từ trước vẫn ở working tree riêng, không gộp vào commit runtime này.

## Bàn giao trước vòng 13/10

Cập nhật trước: 2026-10-12. Toàn scope đã triển khai, migrate/deploy staging và kiểm sau publish. Các checkpoint dưới đây là lịch sử, không bắt đầu lại từ đầu.

**Vòng sửa sau phản hồi nghiệm thu:** user đánh giá UI/UX/luồng và tốc độ của **hai tab Thói quen/Thần Lộ** chưa đạt, rồi cho phép agent tự chụp, đánh giá và sửa sau khi trình inventory. [UX_REVIEW](HABIT_GAME_UX_REVIEW.md) ghi findings, luồng, inventory và bằng chứng. Bản sửa đã qua **317 main +25 experiments +37 browser,0fail/skip**, typecheck/check:web45modules/staging:check; đã push/deploy staging. Các gates kỹ thuật không thay nghiệm thu trải nghiệm của user.

## Bản đã phát hành

- App: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/
- Runtime commit `59517aa`, đã push trên `review/p1-p3`. Các cập nhật bàn giao tiếp theo chỉ đổi tài liệu; kiểm `git status`/HEAD trước vòng mới.
- Worker `personal-assistant-staging`, version `662c9da0-304c-4141-9f90-2ff32a5ae985`. Vòng UX không có migration; deploy exit0 (`ux-staging-deploy.log` ngoài Git).
- D1 `assistant-staging`, ID `5457c401-45d9-4b19-b76e-0eceec67a223`;0031–0037 áp thành công, listing không còn pending. Cron/webhook/secrets giữ cấu hình hiện có.
- User đã xác nhận **mở app và đăng nhập được** trên bản trước `bcd22bb`; owner APIs200 cũng thuộc bản đó. Vòng UX mới dùng browser fixtures để kiểm chức năng; không có phiên đăng nhập staging mới để xác nhận owner APIs/timing. Kiểm public assets/auth và natural tail được ghi trong UX_REVIEW.

## Phạm vi và bằng chứng

Habit tùy chỉnh/theo dõi/lịch-nhắc/đặt chỗ, luyện bốn tầng/tinh thuần nghiêm, trận nhiều ngày/chiêu/rút/tử trận/cứu, đủ5phái/39côngpháp/15chương tới DIỆT THẦN/40encounters/tuyến phụ/3thần binh/11chiến tích. Có truyện/nhân vật/ảnh cuối, onboarding/thư viện/nhật ký/presets/export/settings/bot. Task/ngủ5phúthoàntác/focus/checkin/reminders/đột phá được giữ bằng regressions.

- Gates phát hành nội dung trước vòng UX: **317main+25experiments+33browser,0fail/0skip**, typecheck/check:web45modules/build:check/staging:check đạt. Gates bản UX hiện tại nằm ở đầu tài liệu và UX_REVIEW.
- QA: actualChrome360/390/414/1440/light-dark/large text/keyboard/slow-offline; fullcampaign80previews/30chapters/30endings/lower-fold đã xem. Localpipeline tạo130WebP/39SVG; finals/workflow/manifest ởGit, không cần model chạy khi dùng app.
- Balance:3200repeatcases không một chiêu spam vượt toàntruyện;30earnedimperfect/weekly và5mixedroutes tới40wins, earnedrescue thành công; unionearnedprofiles phủ11achievementIDs.
- Actualbackup1.559.408bytes ngoàiGit đã restore/rehearse:72legacytables/1011rows count/hash giữ,27newtables/integrityok/FK0; productionreadflows trên copy khôngwrite/dispatch. Localruntime365daydrain và actualD1scale3nămlogs đã kiểm.
- Sau deploy:215staticfiles+indexroute khớp SHA256, liveownerAPIs200; ba naturalcronoutcomeokCPU5–8ms. Không tạo habit/log cá nhân giả hoặc gửi tin thử.

[RELEASE](HABIT_GAME_RELEASE.md) sở hữu evidence map/version/giới hạn; [PROGRESS](HABIT_GAME_PROGRESS.md) giữ decisions/checkpoints lịch sử; [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) là tiêu chí kiểm chứng.

## Hướng dẫn và phục hồi

- [USER_GUIDE](HABIT_GAME_USER_GUIDE.md): bắt đầu, ngày/quota tuần, sửa cùng ngày, luyện/bản/tinh thuần, trận/rút/cứu, export và lỗi mạng. Người dùng không cần đọc thiết kế kỹ thuật để chơi.
- [OPERATIONS](OPERATIONS.md): commands, backup/restore riêng và compatible code recovery. Không deploy Worker pre-habit khi đã có game data; không import backup cũ đè ghi nhận sau release.
- [IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md): nhiệm vụ/quyền đã dùng. Prompt `/goal` giữ để tham khảo, không cần chạy lại nhiệm vụ đã giao.

## Giới hạn thực tế và vòng tiếp theo

- Bootstrap live sample bản trước mất6,2–6,6giây/CPU23–35ms; habit1,2–1,4giây/game1,5–2,3giây. Bản UX bỏ bootstrap/history trên đường tải/ghi thông thường của hai tab, gộp GET và giảm vòng đọc D1. Fixture cùng dữ liệu:5request→1, cached render6,5ms; đây không phải độ trễ điện thoại/owner API mới. Không khẳng định mọi invocation<10ms hoặc mọi kết nối<1giây.
- Chrome emulation chưa là máy thật; providerfixtures chưa chứng minh Gemini/Telegramlive. Campaign/earned simulations chưa là người thật chơi nhiều tháng; user nghiệm thu cảm giác chơi/art cuối.
- Nudge ngủ lịch sử chưa có rootcause đã chứng minh. Hai finalsendrace thực tế đã reproduceD1/fix/regression và deploy; configuredpersonalreminders vẫn gửi. Tin đã dispatch không thu hồi bởi báo ngủ.
- Model/venv/sourcePNG/QA/artifacts/backups ở `D:/Tro-ly-AI-art`, ngoàiGit; không còn art/test/tail process của đợt này cần giữ chạy.

Việc tiếp theo là user nghiệm thu và nêu findings cụ thể. Giữ luật đã chốt ở REVIEW và phạm vi của yêu cầu mới; không chạy lại toàncampaign hoặc mở thêm scope khi chưa có rủi ro cụ thể. Secrets ở môi trường/.env, không in/commit; ngân sách bổ sung0đ. Không production/forcepush/phá dữ liệu/tin thử.
