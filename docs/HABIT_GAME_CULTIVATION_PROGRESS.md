# Tu luyện — checkpoint và audit mục tiêu

Cập nhật 2026-10-13. **Đã tích hợp, kiểm local, commit/push và phát hành staging; sẵn sàng nghiệm thu.** Source `07e9aa0`; Worker `db6b1f93-3532-4aac-972b-598fa48e5488`. [RELEASE](HABIT_GAME_RELEASE.md) lưu bằng chứng và giới hạn.

## Quyền và phạm vi

Mục tiêu `/goal` cho phép tự triển khai app thật, thiết kế lại art/gameplay/UX/hiệu năng có căn cứ, dùng agent phụ, tự review và phát hành staging. Quyền này thay yêu cầu duyệt từng file trong vòng này. Không áp dụng yêu cầu cũ chờ duyệt HTML hoặc hoãn art.

Ngân sách bổ sung 0đ; sinh ảnh local miễn phí. Không production, force-push, dữ liệu cá nhân thử hoặc tin thử. Hai phần có sẵn ở `docs/HABIT_GAME_UX_REVIEW.md` và `docs/prototypes/habits/` được giữ ngoài commit.

## Quyết định đã triển khai

- Bốn mục cố định: **Hiện tại → Công pháp → Vượt tầng → Thành tựu**. Giữ ID panel cũ và mapping ID boss, không tạo lại tiến trình hay quyền.
- Tầng trình bày 22 trận chính; Cơ duyên tách 18 thử thách phụ. Thành tựu đọc chiến thắng đầu tiên của từng boss, không bị giới hạn bốn trận gần đây.
- Discovery do server suy từ quyền và bản luyện. Bí tịch đặc biệt/chương/đối thủ chưa phát hiện được che cả tên, ảnh và trường phụ. Người chơi cũ giữ quyền. Thắng mở quyền học, không tặng bản luyện hoàn chỉnh.
- Catalog cache theo owner/quyền; response mang access của chính snapshot. Khi settlement mở quyền, refresh catalog và chiến tích; guard phiên/generation/revision loại response cũ.
- Sửa bộ chiêu đã chuẩn bị bằng một cập nhật nguyên tử có version. Giữ ID trận, ngày bắt đầu, fighter/intents và lịch luyện trở lại; không hủy rồi tạo trận khác.
- Content trận mới `than-lo-4` bỏ chọn/bonus/thưởng Thần binh. Snapshot, entitlement, receipt và preset cũ còn giữ. Engine vẫn `battle-v1`; không đổi schema 0037.
- Minh họa tiên hiệp với bảng màu than/ngà/đồng, nét mặt và silhouette rõ. Các phái có dấu nhận diện; công pháp dùng 39 SVG nguyên bản. Không trộn ảnh thực với pixel/chibi.

## Phân công đã hoàn tất

| Phần | Trách nhiệm |
| --- | --- |
| UI | Bốn mục, chi tiết/bản luyện, chuẩn bị/chiêu/kết quả/cứu, CSS |
| Backend | Discovery, content mới, sửa chuẩn bị nguyên tử, chiến thắng đầu tiên, tests |
| Art | Trial/workflow 0đ, tạo/review/retry toàn bộ ảnh, seals, provenance |
| Root | Wiring/cache/guide, review ảnh độc lập, browser/performance/ops/release |

## Bằng chứng bản cuối

- Full gate 329 main + 25 experiments, 0 fail/skip, trước sửa loader/fastpath/modal cuối. Sau sửa: typecheck, check:web 45, loader/discovery 9, settlement read-only 1 và 19 practice/battle cases liên quan đạt. Không gọi lượt đầu là full rerun source cuối.
- Browser cuối 35/35, 0 fail/skip; matrix art cuối 1/1. Đã kiểm màn 320/390/1440, theme sáng/tối, chữ 200%, dữ liệu rỗng/nhiều, mạng chậm/mất mạng, retry và version conflict.
- Root xem 40 preparation previews/15 trang truyện, thêm 40 màn phái/cast sáng–tối; xem contact sheets WebP cuối và crop trong UI thật. Trạng thái luyện/active/cứu/thắng/tử trận/hết lượt/rút lui đều được chụp; confirmation 320×460 vẫn giữ X/hành động, dialog đã đóng thật `display:none` và Escape không ghi.
- 61 raster (35 boss, 6 chân dung, 15 cảnh, 5 phái), 122 WebP và 39 SVG. Toàn bộ hash/bytes khớp inventory. WebP 2.663.754 byte, SVG 16.628 byte; full lớn nhất 81.478 byte, thumb 9.198 byte. Bốn asset legacy không dùng nằm ngoài phạm vi thay ảnh. Không còn job GPU.
- 61 `integratedUi` được cập nhật sau root review, không kế thừa QA ảnh cũ. Audit giữ cả trạng thái source-export pending lúc bàn giao và kết quả UI sau đó.
- Staging config 3/3, readiness 4/4 và dry-run đạt; 224 asset files, Worker 670,88 KiB / gzip 155,90 KiB. Backup trước phát hành, listing không pending; không migration.
- Commit/push thường và deploy staging exit 0. 216 file tĩnh/index live khớp source, tám GET 401/Origin 403. Tail 66 events/một cron trên đúng Worker version, outcome ok/0 parse error. Browser isolated không exception, auth 401.

Artifacts `.wrangler/cultivation-qa/`: `final-browser.log`, `final-art-matrix.log`, `final-ui-art/`, `final-matrix/`, `art/ui-*-final-*.png`, `visual-review/`, `current/`, `performance/`, `final-staging-check.log`, `staging/`. Scratch QA ban đầu thiếu thư mục screenshot hoặc đọc cast/port trước khi sẵn sàng đã được sửa và rerun; không coi các lượt lỗi là xanh. Lượt terminal fixture ban đầu thiếu turn=maxTurns bị validator từ chối, đã sửa fixture hợp lệ và rerun, không sửa engine để bỏ kiểm tra.

## Audit yêu cầu mục tiêu

| Yêu cầu | Bằng chứng hiện hành |
| --- | --- |
| App thật/bốn mục/bỏ Thần binh | web views/features mới; browser 35/35; module/CSS live hash match |
| Luyện/tinh thuần/bản/đổi/luyện lại | Production service/D1, integration practice, next-day/immutable-edition browser, ảnh practice/details |
| Chuẩn bị/chiêu/kết quả/cứu | Atomic service/D1, engine thật, prepare/update/stale/choice/rescue browser; visual terminal states/theme/text |
| Bí tịch/cấm thuật/quyền cũ | Player catalog projection, discovery 5/loader 4, HTTP/ownership/prerequisite tests, UI sealed/discovered/access refresh |
| Thành tựu boss | First-win SQL/owner isolation/edition và casts thật; browser chiến thắng cũ/lazy load, victory screens |
| Gameplay từ việc thật | Tests content/profile v4: năm phái, 40 wins/39 môn; weekly/mixed/cứu có trả giá; BALANCE ghi giới hạn fixture |
| Nghiên cứu/thẩm mỹ | REVIEW ghi nguồn đã xem và cách áp dụng; trial/pipeline/rejection history, STYLE_V2/story bible |
| Toàn asset cuối | 61 active/122 WebP/39 SVG, nguồn/final hashes, root xem ảnh và matrix/UI cuối |
| Kiến trúc/dữ liệu/tính năng cũ | Domain/ports/adapters giữ; legacy v2 weapon/receipt/preset/history tests, main/browser regression; schema không đổi |
| Mobile/desktop/mạng/chữ lớn | 320/390/1440, light/dark/200%, empty/large/offline/stale/retry; visual modal 44px/no overflow/no errors |
| Hiệu năng | Lab trước–sau có điều kiện; regression 2 SQL thay 4, lazy/bounded reads/cache; không claim tải đầu nhanh hơn |
| Vận hành/quyền/ngân sách | 0đ, normal commit/push, backup/listing/staging/hash/auth/cron/version; không production/force-push/log cá nhân/tin thử |
| Giao sản phẩm/bàn giao | URL staging, USER_GUIDE walkthrough, RELEASE/OPERATIONS/checkpoint; không còn feature/art/deploy gate đang hứa |

## Giới hạn bằng chứng

User nghiệm thu cảm giác đẹp/cuốn dài ngày và thiết bị thật. Phiên isolated đã hết hạn, vòng này chưa kiểm owner remote API; không suy owner latency từ auth/static. Bootstrap chậm ở mẫu lịch sử chưa được chứng minh đã giải quyết toàn app. Bản giao là app tích hợp thật với dữ liệu cũ bảo toàn; các giới hạn này được ghi rõ, không dùng demo hoặc placeholder thay phạm vi sản phẩm.
