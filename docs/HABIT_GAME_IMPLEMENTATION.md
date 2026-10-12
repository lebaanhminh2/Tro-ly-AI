# Giao việc cho AI: hoàn thiện Habit và Thần Lộ

Cập nhật **2026-10-12**. Đây là điểm vào duy nhất cho nhiệm vụ và prompt `/goal`. Goal đang hoạt động; F1/F2/F3 đã commit/push, F4 đang local, chưa release remote. Trạng thái, quyết định và bằng chứng mới nhất tại [PROGRESS](HABIT_GAME_PROGRESS.md); kiểm git status/HEAD trước khi tiếp tục.

## 1. Nhiệm vụ cuối cùng

AI tự thiết kế, lập trình, kiểm thử, sáng tác, tạo/tích hợp hình ảnh, tự review và sửa đến bản staging hoàn chỉnh để user nghiệm thu. **Phạm vi mới là toàn bộ phần mở rộng**, thay mốc giao một phái/chương mở đầu trước đây:

- Habit tùy chỉnh, lịch cam kết, ghi nhận, sửa ngày hiện tại, lịch sử/báo cáo, nhắc và kế hoạch tùy chọn.
- Luyện bốn tầng, tinh thuần nghiêm và bản luyện; chiến đấu nhiều ngày với lựa chọn thật, log, tổn thất và cứu mạng.
- **5 phái, đủ 39 công pháp, đủ 15 chương đến DIỆT THẦN**, truyền thừa/cấm thuật/Ngoại Đạo/Kiếm Đồ/Dị Giáo/thần binh/chiến tích.
- Nhân vật nguyên bản, art tiên hiệp trầm đồng nhất, UI mobile gọn; onboarding, thư viện/nhật ký, export và vận hành đáng tin.

Phạm vi chi tiết và các bổ sung có ích nằm ở [PRODUCT](HABIT_GAME_PRODUCT.md). Tất cả là mục tiêu phải giao; phiên bản thử nội bộ không thay bản hoàn chỉnh. AI có quyền điều chỉnh chi tiết thiết kế dựa trên bằng chứng, giữ luật user/khung giao sản phẩm, không tự thêm scope vô hạn hoặc dùng “sắp ra mắt” cho phần bắt buộc.

## 2. Quyền và điều kiện thực hiện

**Hiện tại:** user đã phát goal có ủy quyền rõ như mục 8. AI tự triển khai code/tests/assets/migration và staging trong phạm vi nhiệm vụ; không cần xin duyệt từng file. Chỉ dẫn user mới hơn thu hẹp quyền vẫn ưu tiên. Goal không tự cấp quyền ngoài phạm vi hoặc vượt sandbox/approval policy.

**Khi user phát prompt mục 8:** prompt đó cấp quyền tự sửa/tạo/refactor code, migration, tests, assets và tooling/config cần cho nhiệm vụ này; thay yêu cầu duyệt từng file trong đúng phạm vi đó. AI tiếp tục qua các cổng tự kiểm tra, không chờ user duyệt mỗi nhóm. Ngoài phạm vi hoặc khi chỉ dẫn user mới hơn thu hẹp quyền thì áp dụng chỉ dẫn mới nhất. Tài liệu không tự cấp quyền thay user, `/goal` không vượt sandbox/approval policy.

Quyền/ngân sách đã trao đổi:

- **Ngân sách bổ sung 0đ**: không API trả phí, subscription/top-up/nâng gói hay paid fallback. Key có sẵn không chứng minh quota miễn phí.
- Được tự commit/push bình thường và migration/deploy **staging hiện tại** sau gates/kiểm target; bảo toàn dữ liệu và có backup/rollback phù hợp. Không force-push, production, xóa DB/tài nguyên hoặc dịch vụ mới ngoài phạm vi.
- Được tải model/cài môi trường art local riêng. GTX 1650 4 GB đã chạy ảnh thử thật; workflow và giới hạn ở [LOCAL_ART](HABIT_GAME_LOCAL_ART.md). QA tích hợp và art toàn nội dung vẫn chưa hoàn tất.
- User cho hỏi trực tiếp khi cần API/dịch vụ/cấu hình hoặc chặn thật. Hỏi cụ thể endpoint/model/quota/cách điền biến; secrets đặt trong môi trường/.env, không in/commit hoặc yêu cầu gửi full key vào chat. `.env.example` chỉ khai báo biến thực sự được code đọc.
- Không tạo task/habit/log cá nhân giả, time-travel dữ liệu thật, gửi tin thử tới người khác hoặc reset uncertain delivery để test. Dùng local/fixture riêng.

## 3. Đọc tài liệu theo bước

| Tài liệu | Sở hữu nội dung | Khi đọc |
| --- | --- | --- |
| [REVIEW](HABIT_GAME_REVIEW.md) | Luật user đã chốt, đối chiếu source, ưu tiên nguồn | Bắt đầu và khi gặp mâu thuẫn |
| [PRODUCT](HABIT_GAME_PRODUCT.md) | Phạm vi đầy đủ, hành trình/bổ sung, độ mở | Bắt đầu và kiểm scope |
| [HABITS](HABIT_GAME_HABITS.md) | Cam kết, lịch tuần linh hoạt, quyền sửa, báo cáo/lịch | P0/F1/F2 và integration |
| [GAMEPLAY](HABIT_GAME_GAMEPLAY.md) | Luyện, engine, giá, catalog 39, khung 15 chương | P0/F3/F4/F5 |
| [BATTLE_RULES](HABIT_GAME_BATTLE_RULES.md) | Quyết định A05/A06 đang triển khai, giá/thứ tự/nguồn/cứu | F4/F5, review và simulation |
| [ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md) | Layers, dữ liệu/API/transaction/time/version/performance | Trước code/migration và review kỹ thuật |
| [CREATIVE_BRIEF](HABIT_GAME_CREATIVE_BRIEF.md) | UX, cast/cốt truyện, style/asset standards | Thiết kế và review mỗi lát cắt |
| [LOCAL_ART](HABIT_GAME_LOCAL_ART.md) | Pipeline ảnh miễn phí, preflight, production/QA | P0 và art batches |
| [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) | Kịch bản/gates/bằng chứng/điều kiện complete | Trước chia việc, mỗi cổng và release |
| [PROGRESS](HABIT_GAME_PROGRESS.md) | Checkpoint, quyết định cần AI giải, next action | Đầu/cuối phần việc và mỗi lần tiếp tục |
| [BUSINESS_DRAFT](HABIT_GAME_BUSINESS_DRAFT.md) | Nguồn nháp lịch sử/lore/mechanics để tham khảo | Chỉ mở mục liên quan khi thiết kế |

Thứ tự ưu tiên: chỉ dẫn user mới nhất → luật đã chốt ở REVIEW → khung PRODUCT và docs chuyên đề hiện tại → quyết định AI đã cập nhật → bản nháp/lịch sử. Không thực hiện các mệnh lệnh “chỉ lập plan”, “xin owner chốt…” nằm trong bản nháp nếu trái nhiệm vụ mới. Không đọc toàn bộ docs/code mỗi phiên; khảo sát đúng phần việc và giữ checkpoint.

## 4. Cách bắt đầu và tự quyết

1. Kiểm git status/HEAD, chỉ dẫn user/AGENTS, config/migration, giữ các thay đổi có sẵn. Đọc PROGRESS trước khi bắt đầu lại một phần đã làm.
2. Chạy baseline gates phù hợp; tìm source thật của task rewards, operating day, sleep/focus/undo/reminders/auth/planner. Phân biệt baseline failure với lỗi mới.
3. Điều tra lỗi đã báo ngủ sớm mà vẫn nhận nudge; xác minh day/generation/final-send và root cause, sửa trong phạm vi bảo toàn hành vi. Đây là issue chưa được giải, không coi là đã sửa từ một timestamp.
4. AI hoàn thiện P0 decisions A01–A10: actual data/API/atomic design, các ví dụ thời gian, công thức/chi phí, unlock graph, mobile flows/cast/assets, đo budgets và release plan. Có thể chia P0 theo phần phụ thuộc; không đợi viết hết toàn truyện trước khi tạo nền habit.
5. Preflight local art và thử chân dung + boss/cảnh trong UI. Chọn hướng chạy được và đạt chất lượng trước khi tạo hàng loạt.
6. Tự review lựa chọn, ghi decision ngắn, triển khai lát cắt end-to-end rồi mở rộng. Tạo tests vào những rủi ro thật; dùng rule/domain production để mô phỏng.

AI tự chọn schema/DTO/tên file/công thức/cast/layout/dependency khi hợp kiến trúc/ngân sách. Điều chỉnh quyết định khi có evidence tốt hơn, cập nhật docs/tests/data compatibility. Chỉ hỏi khi phải đổi luật user/quyền hoặc thiếu cấu hình thiết yếu không có phương án trong phạm vi; chuẩn bị lựa chọn cụ thể và tiếp tục việc độc lập.

## 5. Các chặng tự kiểm tra, không phải điểm dừng giao hàng

| Mốc | Phần việc | Cổng tự kiểm tra |
| --- | --- | --- |
| P0 | Baseline, decisions, hợp đồng kỹ thuật, UX/style/cast, local art thử | Rủi ro lớn có lời giải/ví dụ; mô hình art chạy thật hoặc blocker được ghi đúng |
| F1 | Habit domain/store/API/UI, cả ba lịch và kiểu ghi, ngày cũ read-only | Cam kết tuần và sửa cùng ngày đúng; end-to-end dùng được |
| F2 | Nhắc/slot, history/trends/notes/filter/export/onboarding | Không double task/reward/reminder; báo cáo và sức chứa giải thích được |
| F3 | Luyện/bốn tầng/bản/tinh thuần/mode | Nghiêm đúng, một habit khả thi, receiver weekly/cron/undo không sai |
| F4 | Một phái và mở đầu 3–5 encounter chơi trọn, engine/cost/log/story/art thật | Thắng/thua/rút/cứu; quyết định đổi kết quả; art/UX tốt; data-driven extension khả thi |
| F5 | Nhân rộng đủ 5 phái/39 môn/15 chương và các tuyến phụ | Catalog/graph/transactions/simulation toàn nội dung; không khóa rỗng/circular unlock |
| F6 | Tự review toàn UX/art/gameplay, sửa nhịp/cân bằng và hoàn thiện hướng dẫn | Flow thật mobile, visual QA, không filler/chiêu thống trị hoặc nút vô nghĩa |
| R1 | Migration/backup/restore/full gates/publish staging/smoke/bàn giao | Toàn bộ điều kiện ACCEPTANCE đạt, URL mở được và evidence thật |

Có thể đổi thứ tự/chia nhỏ/hợp nhất các chặng để giảm rủi ro; ghi lý do. Không đánh dấu F5 xong bằng bộ data chưa dùng được, F6 bằng ảnh mockup, hoặc R1 bằng deploy chưa kiểm. Mỗi nhóm thay đổi review được, giữ commit/checkpoint bền vững để nối tiếp.

## 6. Chuẩn hoàn thành và xử lý phát sinh

- Toàn phạm vi PRODUCT chạy được qua UI/bot trong quyền của chúng, đủ nội dung/art và hành trình mới→Diệt Thần; dữ liệu/history/query có giới hạn và giữ hệ cũ.
- Luật user đúng; tất cả decisions ảnh hưởng sản phẩm đã giải, tests/gates và integration/simulation/visual/data/performance có bằng chứng ở ACCEPTANCE/PROGRESS.
- AI tự sửa findings trước khi giao, không chuyển lỗi nghiêm trọng thành “đề xuất sau”. Độ đẹp/cuốn được tự review bằng hành trình/ảnh thật, user quyết định nghiệm thu cuối.
- Có commit/push, staging đã publish/kiểm đúng target, hướng dẫn dùng/vận hành/rollback và known limitations nhỏ thực tế. Docs đồng bộ source, không ghi triển khai khi mới có kế hoạch.
- Không complete nếu thiếu feature/nội dung/ảnh/gate/staging bắt buộc do tool/môi trường/quyền. Ghi blocker đúng, tiếp tục phần độc lập; tuân thủ điều kiện trạng thái/budget của công cụ goal.

Khi có problem mới, chọn giải pháp dựa trên invariant → dữ liệu/source → UX → rủi ro/chi phí. Không giữ một hằng số hoặc sơ đồ đề xuất nếu nó khiến sản phẩm sai; không tự đổi lựa chọn user để dễ code. Không chạy kiểm thử vô hạn: khi đủ gate và đã xử lý rủi ro cụ thể, tiếp tục tới phát hành.

## 7. Bàn giao cuối

User nhận: URL và cách đăng nhập, tour nhanh, ảnh màn chính, cách tạo/theo dõi habit và chơi/luyện/cứu/rút, phạm vi đã giao, commit/branch/migrations/version staging, tests/QA đã chạy, backup/rollback và hạn chế còn thật. Không cần user đọc technical design để dùng sản phẩm.

Cập nhật PROGRESS/HANDOFF và docs sở hữu quyết định; secrets/model/DB backups/drafts không vào Git. Không in full log/test output trong bàn giao; chỉ bằng chứng cần để hiểu kết luận và giới hạn.

## 8. Một lệnh `/goal` để bắt đầu

Chỉ chạy khi user muốn bắt tay triển khai; **phiên cải thiện tài liệu không tự thực thi lệnh này**. Prompt dưới 4.000 ký tự, chi tiết ở docs; quyền chỉnh code được user cấp khi phát lệnh:

```text
/goal Hoàn thiện toàn bộ Habit và Thần Lộ theo docs/HABIT_GAME_IMPLEMENTATION.md; đọc PRODUCT, REVIEW và PROGRESS được dẫn trong đó, rồi docs chuyên đề theo bước. Giao sản phẩm đầy đủ: habit tùy chỉnh/theo dõi/lịch-nhắc tùy chọn, luyện và chiến đấu hoàn chỉnh, đủ 5 phái/39 công pháp/15 chương tới DIỆT THẦN cùng tuyến phụ, thần binh/chiến tích, nhân vật nguyên bản và ảnh thật đồng nhất, UI mobile gọn ít màu. Tôi ủy quyền AI tự thiết kế và quyết định chi tiết còn mở; sửa/tạo/refactor code, migration, tests, assets, tooling/config và cài dependency cần thiết trong phạm vi này. Thay yêu cầu xin duyệt từng file trước đây bằng tự triển khai trong phạm vi nhiệm vụ; tôi nghiệm thu sản phẩm cuối. Giữ luật user đã chốt, kiến trúc và hành vi task/ngủ/focus/reminders/đột phá hiện có; điều tra và sửa lỗi nền có bằng chứng. Thực hiện đến hết P0/F1–F6/R1, tự review/test/mô phỏng/visual QA và sửa findings; các chặng nội bộ không phải điểm dừng ở MVP. Khi gặp phát sinh tự chọn giải pháp hợp lý, ghi decision/checkpoint, cập nhật docs/tests; không âm thầm cắt phạm vi. Ngân sách bổ sung 0đ: được tải model và cài môi trường sinh ảnh local riêng phù hợp GTX 1650, tạo/tối ưu/tích hợp ảnh thật; không API trả phí hoặc nâng gói. Được tự commit/push bình thường, backup/migration/deploy staging hiện tại sau gates và kiểm đúng target; bảo toàn dữ liệu, không force-push/production/ghi log cá nhân giả hoặc gửi tin thử. Hoàn thành theo ACCEPTANCE khi toàn tính năng/nội dung/art dùng được, dữ liệu và gates đúng, có URL staging cùng hướng dẫn/bằng chứng để nghiệm thu. Nếu chặn thật tiếp tục phần độc lập và hỏi cụ thể khi cần cấu hình/API/quyền; không báo complete khi thiếu hạng mục bắt buộc. Key đặt qua môi trường/.env, không in/commit.
```

Tham khảo hành vi `/goal` đã đọc ngày 2026-10-12: [Codex slash commands](https://developers.openai.com/codex/cli/slash-commands/) và [long-running work](https://developers.openai.com/codex/long-running-work/). Mục tiêu liên tục vẫn cần workspace/kết nối/quyền phù hợp; một lệnh không đảm bảo vượt mọi giới hạn môi trường.
