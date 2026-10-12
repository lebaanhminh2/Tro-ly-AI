# Bàn giao Habit và Thần Lộ

Cập nhật 2026-10-12. Toàn scope đã triển khai, migrate/deploy staging và kiểm sau publish; sẵn sàng để user nghiệm thu. Các checkpoint cũ là lịch sử, không bắt đầu lại từ đầu.

## Bản đã phát hành

- App: https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/
- Runtime commit `bcd22bb`, đã push trên `review/p1-p3`. Các cập nhật bàn giao tiếp theo chỉ đổi tài liệu; kiểm `git status`/HEAD trước vòng mới.
- Worker `personal-assistant-staging`, version `d3923c51-3959-474d-8e9a-6d4bfbaf7415`.
- D1 `assistant-staging`, ID `5457c401-45d9-4b19-b76e-0eceec67a223`;0031–0037 áp thành công, listing không còn pending. Cron/webhook/secrets giữ cấu hình hiện có.
- User đã xác nhận **mở app và đăng nhập được**. Owner APIs mới/cũ được quan sát200 trên đúng version; auth401/Origin403 và static assets SHA256 khớp.

## Phạm vi và bằng chứng

Habit tùy chỉnh/theo dõi/lịch-nhắc/đặt chỗ, luyện bốn tầng/tinh thuần nghiêm, trận nhiều ngày/chiêu/rút/tử trận/cứu, đủ5phái/39côngpháp/15chương tới DIỆT THẦN/40encounters/tuyến phụ/3thần binh/11chiến tích. Có truyện/nhân vật/ảnh cuối, onboarding/thư viện/nhật ký/presets/export/settings/bot. Task/ngủ5phúthoàntác/focus/checkin/reminders/đột phá được giữ bằng regressions.

- Gates cuối: **317main+25experiments+33browser,0fail/0skip**, typecheck/check:web45modules/build:check/staging:check đạt.
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

- Bootstrap live sample mất6,2–6,6giây/CPU23–35ms; habit1,2–1,4giây/game1,5–2,3giây. Không khẳng định mọi invocation<10ms, không suy localbenchmark là remoteWorkload30habit. Tối ưu bootstrap là mục tiêu tiếp nếu user thấy chậm; không tự đổi logic cũ/nâng gói0đ.
- Chrome emulation chưa là máy thật; providerfixtures chưa chứng minh Gemini/Telegramlive. Campaign/earned simulations chưa là người thật chơi nhiều tháng; user nghiệm thu cảm giác chơi/art cuối.
- Nudge ngủ lịch sử chưa có rootcause đã chứng minh. Hai finalsendrace thực tế đã reproduceD1/fix/regression và deploy; configuredpersonalreminders vẫn gửi. Tin đã dispatch không thu hồi bởi báo ngủ.
- Model/venv/sourcePNG/QA/artifacts/backups ở `D:/Tro-ly-AI-art`, ngoàiGit; không còn art/test/tail process của đợt này cần giữ chạy.

Việc tiếp theo là user nghiệm thu và nêu findings cụ thể. Giữ luật đã chốt ở REVIEW và phạm vi của yêu cầu mới; không chạy lại toàncampaign hoặc mở thêm scope khi chưa có rủi ro cụ thể. Secrets ở môi trường/.env, không in/commit; ngân sách bổ sung0đ. Không production/forcepush/phá dữ liệu/tin thử.
