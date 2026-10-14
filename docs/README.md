# Tài liệu dự án

Cập nhật 2026-10-14. Docs tách **source đang có**, **sản phẩm đích** và **bằng chứng đã chạy**; có tài liệu trên ổ đĩa không có nghĩa feature đã triển khai.

## Bắt đầu đúng nhiệm vụ

- Tiếp tục công việc chung: [HANDOFF](HANDOFF.md), kiểm git status/HEAD rồi đọc phần liên quan.
- Vòng Tu luyện v2 hiện tại: [bản chốt](CULTIVATION_FINAL_BRIEF.md) → [PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md) → [PROGRESS §5.9/§6](CULTIVATION_IMPLEMENTATION_PROGRESS.md). [GOAL](CULTIVATION_GOAL.md) có prompt cho thread mới và cách tiếp tục goal đã có; [demo HTML](prototypes/cultivation/kiem-y-demo.html) dùng dữ liệu riêng. V2 đã giao staging; [RELEASE](HABIT_GAME_RELEASE.md) ghi source/Worker0038/gates/latency. Không lấy release lịch sử thay bằng chứng nguồn hiện hành.
- Triển khai toàn Habit/Thần Lộ: [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md), prompt `/goal` ở mục 8. Sau đó REVIEW/PRODUCT/PROGRESS và docs chuyên đề theo bước.
- Phạm vi mới đã phát hành staging: habit/theo dõi, luyện/chiến đấu, **5 phái/39 môn/15 chương**, truyện/nhân vật/ảnh thật, UX và vận hành. Ngân sách bổ sung0đ, ảnh local; xem [USER_GUIDE](HABIT_GAME_USER_GUIDE.md) để dùng và [RELEASE](HABIT_GAME_RELEASE.md) để nghiệm thu/bằng chứng.

## Nguồn sở hữu từng chủ đề

| Tài liệu | Vai trò |
| --- | --- |
| [HANDOFF](HANDOFF.md) | Trạng thái hiện tại, quyền, next action, issue nền |
| [CULTIVATION_FINAL_BRIEF](CULTIVATION_FINAL_BRIEF.md) | Tổng hợp sản phẩm Tu luyện v2 dành cho người dùng |
| [CULTIVATION_IMPLEMENTATION_PLAN](CULTIVATION_IMPLEMENTATION_PLAN.md) | Luật cố định, kiến trúc, inventory và cổng bàn giao v2 |
| [CULTIVATION_IMPLEMENTATION_PROGRESS](CULTIVATION_IMPLEMENTATION_PROGRESS.md) | Source, evidence và next action hiện hành của v2 |
| [CULTIVATION_PROGRESSION_PROPOSAL](CULTIVATION_PROGRESSION_PROPOSAL.md) | Tầng, sát thương, thuần khiết và lộ trình39môn |
| [CULTIVATION_EFFECT_GLOSSARY](CULTIVATION_EFFECT_GLOSSARY.md) | Một bộ tên, đơn vị và nghĩa hiệu ứng cho công pháp/boss |
| [CULTIVATION_GOAL](CULTIVATION_GOAL.md) | Prompt và quyền chạy xuyên suốt v2 |
| [PRODUCT_BRIEF](PRODUCT_BRIEF.md) | Minh Anh và trải nghiệm nền cần giữ, ranh giới mở rộng |
| [OPERATIONS](OPERATIONS.md) | Stack, commands, config/secrets, staging/data recovery |
| [TOOL_CALLING_PLAN](TOOL_CALLING_PLAN.md) | Tool/context boundaries, luồng chat/web và kiểm chứng AI |
| [HABIT_GAME_IMPLEMENTATION](HABIT_GAME_IMPLEMENTATION.md) | Nhiệm vụ đầy đủ, quyền goal, các chặng và một prompt khởi động |
| [HABIT_GAME_REVIEW](HABIT_GAME_REVIEW.md) | Luật user đã chốt, facts source và vai trò bản nháp |
| [HABIT_GAME_PRODUCT](HABIT_GAME_PRODUCT.md) | Full scope, bổ sung có ích, hành trình/UI và độ mở |
| [HABIT_GAME_HABITS](HABIT_GAME_HABITS.md) | Ghi nhận, tuần linh hoạt, quyền sửa, lifecycle/tracking/lịch |
| [HABIT_GAME_GAMEPLAY](HABIT_GAME_GAMEPLAY.md) | Luyện, battle/cost/effects, catalog 39 và truyện 15 chương |
| [HABIT_GAME_BALANCE](HABIT_GAME_BALANCE.md) | Mô phỏng earned imperfect/weekly/mixed, chiến thuật lặp và findings F6 |
| [HABIT_GAME_ARCHITECTURE](HABIT_GAME_ARCHITECTURE.md) | Layers, persistence/API/time/replay/version/performance |
| [HABIT_GAME_CREATIVE_BRIEF](HABIT_GAME_CREATIVE_BRIEF.md) | Trải nghiệm/cast/lore/style và asset inventory standards |
| [HABIT_GAME_LOCAL_ART](HABIT_GAME_LOCAL_ART.md) | Preflight, model/backend local miễn phí, production/manifest/QA |
| [HABIT_GAME_ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md) | Test/simulation/visual/data/release gates và điều kiện complete |
| [HABIT_GAME_RELEASE](HABIT_GAME_RELEASE.md) | Đối chiếu yêu cầu/bằng chứng, bản staging, tour nghiệm thu và giới hạn |
| [HABIT_GAME_USER_GUIDE](HABIT_GAME_USER_GUIDE.md) | Hướng dẫn thao tác habit/luyện/trận/cứu và lỗi mạng cho người dùng |
| [HABIT_GAME_PROGRESS](HABIT_GAME_PROGRESS.md) | Checkpoint, quyết định AI, evidence và cách resume |
| [HABIT_GAME_BUSINESS_DRAFT](HABIT_GAME_BUSINESS_DRAFT.md) | Nháp nguồn lịch sử, tham khảo có chọn lọc; không là lệnh cấp quyền |

[STAGING_SETUP](STAGING_SETUP.md) là redirect cho công cụ cũ, không phải một nguồn config khác.

## Cách cập nhật để agent đọc hiệu quả

- Một thông tin có một nơi sở hữu; nơi khác chỉ tóm tắt/link. Không chép toàn schema/source/log/transcript vào docs.
- Luật user, default AI, đề xuất, quyết định AI đã chọn và bằng chứng triển khai phải phân biệt. Nếu thay quyết định, cập nhật đúng doc chủ đề/tests thay vì để ở chat.
- HANDOFF/PROGRESS giữ trạng thái hiện tại; lịch sử ở Git. Không tạo một file cho mỗi lượt/lỗi.
- Đọc theo use case/mốc, không nạp cả kho mỗi phiên. Docs chuyên đề có thể dài khi nội dung cần; ưu tiên headings/tables/examples tra được, không rút gọn bằng bỏ quyền/rủi ro quan trọng.
- Không secrets hoặc dữ liệu cá nhân thật. Artifact/test/model/ảnh nháp ở nơi có giới hạn và phù hợp Git ignore; docs chỉ dẫn vị trí evidence.

## Docs khác prompt runtime

Gemini lấy prompt/context từ code và DB (`src/ai`, application context builder), không tự đọc Markdown. Coding agent dùng docs khi đọc/đính kèm; file trên đĩa không tự tăng token cho mọi request người dùng.

Lịch sử tài liệu có trong Git, gồm bộ archive ở `7d568f1` và bản trước đợt cải thiện này tại `23a1808`. Dùng `git show COMMIT:PATH` để xem mục cần, không tự khôi phục cả kho hoặc áp quyền/luật cũ.
