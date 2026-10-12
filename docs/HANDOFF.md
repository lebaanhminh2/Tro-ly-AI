# Bàn giao Habit và Thần Lộ

Cập nhật 2026-10-12. Toàn scope đã triển khai, migrate/deploy staging và kiểm sau publish; sẵn sàng để user nghiệm thu. Các checkpoint cũ là lịch sử, không bắt đầu lại từ đầu.

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
