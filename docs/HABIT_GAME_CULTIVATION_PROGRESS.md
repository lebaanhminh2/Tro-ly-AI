# Tu luyện — triển khai theo mục tiêu hiện tại

Cập nhật: 2026-10-13. Trạng thái: **bản triển khai cuối đã kiểm local, đang chuẩn bị phát hành staging**. Phiên bản phát hành thực tế sẽ ghi tại RELEASE sau deploy.

## Quyền và phạm vi

Mục tiêu `/goal` hiện tại cho phép triển khai app thật, thay toàn bộ art game, sửa gameplay/UX/hiệu năng có căn cứ, tự review và phát hành staging. Quyền này thay việc xin duyệt từng file trong vòng này. Chỉ dẫn cũ về chờ duyệt HTML hoặc hoãn art là lịch sử; không áp dụng cho công việc hiện tại.

Ngân sách bổ sung 0đ. Dùng môi trường sinh ảnh cục bộ, không dịch vụ trả phí. Không production, force-push, dữ liệu cá nhân thử hay tin thử. Thay đổi riêng từ vòng trước ở `docs/HABIT_GAME_UX_REVIEW.md` và `docs/prototypes/habits/` được giữ riêng.

## Khung trải nghiệm và quyết định

- Bốn mục cố định: **Hiện tại → Công pháp → Vượt tầng → Thành tựu**. Giữ các ID panel cũ để không phá state đang dùng; tên hiển thị thay theo thiết kế mới.
- Tầng là cách trình bày chuỗi boss chính hiện có. Cơ duyên chứa thử thách phụ. Không thay ID boss, không tạo lại quyền chiến thắng.
- Thành tựu lấy boss đã thắng làm trọng tâm. Nạp bản ghi chiến thắng khi mở mục này; không giới hạn bằng bốn trận gần đây trong tổng quan.
- Discovery do server suy ra từ tiến trình, quyền học và bản luyện. Chưa phát hiện thì không gửi tên/mô tả/ảnh của bí tịch đặc biệt hoặc đối thủ. Có quyền cũ thì giữ quyền. Thắng mở quyền học, không tạo bản luyện đạt Nhập môn.
- Catalog giờ phụ thuộc tiến trình người chơi; cache phải vô hiệu khi quyền/chiến thắng thay đổi, và khi thay phiên đăng nhập.
- Đổi bộ chiêu đã chuẩn bị là một cập nhật nguyên tử có version, giữ ID trận/ngày bắt đầu và lựa chọn quay lại luyện. Không hủy rồi tạo trận thay thế.
- Bỏ chọn Thần binh và bonus khỏi trận mới; snapshot nội dung/trạng thái và tài sản cũ vẫn được bảo toàn. Dùng content version mới cho luật trận mới.
- Art dùng minh họa tiên hiệp với đường nét rõ, bảng màu than/ngà và điểm nhấn từng phái. Không trộn portrait ảnh thực với icon pixel. Kiểm mẫu nhân vật, boss và cảnh trong UI trước khi sản xuất cả bộ.

## Phân công

| Phần | Trách nhiệm |
| --- | --- |
| Giao diện | Bốn mục, chi tiết công pháp, chuẩn bị/giao chiến/kết quả, CSS |
| Backend | Discovery, phiên bản trận không vũ khí, đổi bộ chiêu nguyên tử, bản ghi chiến thắng, tests |
| Mỹ thuật | Mẫu, pipeline 0đ, bộ ảnh cuối, dấu ấn công pháp, provenance/manifest |
| Tích hợp | Wiring/cache phiên, hướng dẫn, QA độc lập, hiệu năng, kiểm thử browser, release/docs |

## Bằng chứng đã có ở vòng này

- Đọc mục tiêu đầy đủ bằng UTF-8, trạng thái goal/worktree và tài liệu bàn giao; không xem bản staging icon cũ là bản redesign đã xong.
- Mẫu Kỳ Hành mới đã xem ở kích thước lớn. Nét mặt/giáp/silhouette rõ hơn ảnh thực màu be cũ. Phần tay không đạt phải bị loại khỏi crop cuối; còn cần kiểm crop nhỏ trong UI.
- Hướng dẫn và gợi ý bước tiếp theo đã đổi sang tầng/thành tựu; test model 4/4 đạt, gồm trường hợp không gợi ý đối thủ chưa phát hiện.
- Đã nối action/API chiến thắng và reset catalog/chiến tích khi rời phiên đăng nhập. Chưa tuyên bố kiểm API owner staging.
- App thật đã được chụp bốn mục ở 390px và bảng chuẩn bị Kỳ Hành; crop mặt/giáp rõ, không lộ tay lỗi. Native progress xanh được thay thành đồng để thống nhất. Ảnh ở `.wrangler/cultivation-qa/current/`, ngoài Git.
- Browser mới kiểm luyện ngày sau/luyện lại giữ tầng khóa, chuẩn bị/đổi bộ chiêu nguyên tử, bản sửa lỗi thời, chiêu chưa chốt và Hộ Mệnh, chiến tích ngoài bốn trận gần đây, discovery/cập nhật catalog và bộ chiêu có retry/xung đột. Các flow này đã chạy đạt; đang chạy toàn bộ hồi quy.
- Matrix đã mở **40 đối thủ, 15 trang truyện, 39 dấu ấn** qua màn hình thật, kiểm URL ảnh/nút đóng/tràn ngang và không ghi dữ liệu. Đây là kiểm tích hợp; các ảnh chưa thay xong vẫn là ảnh cũ nên chưa phải kiểm mỹ thuật cuối.
- 17 model/loader/web-module tests đạt, gồm race đọc catalog trước khi settlement ghi chiến thắng. Catalog mang access của chính snapshot đã dùng; không gắn nhầm access mới vào catalog cũ.
- Browser harness được tách thành `tests/browser/app-harness.mjs`. Các test riêng cho bố cục Hành trình/Sưu tập/vũ khí cũ được thay bằng `cultivation-flows.test.mjs`; hành vi legacy vũ khí vẫn cần chứng minh trong backend, không giữ UI chọn vũ khí vì đó là trải nghiệm đã bị bỏ.

## Audit bản cuối trước phát hành

- Đủ bốn mục trong app thật; engine production và D1 services xử lý lựa chọn/luyện lại/chuẩn bị/chiêu/cứu/chiến tích, không dùng số mô phỏng HTML.
- 61/61 raster mới (35 boss, 6 chân dung, 15 cảnh, 5 phái), 122 WebP và 39 SVG; toàn bộ SHA/bytes khớp inventory. Bốn asset legacy không sử dụng được giữ riêng. Tổng WebP 2.663.754 byte, SVG 16.628 byte; full lớn nhất 81.478 byte, thumbnail lớn nhất 9.198 byte.
- Root xem bộ contact cuối và các ảnh chụp màn thật: 40 preparation previews/15 trang truyện, thêm 40 màn phái/cast sáng–tối; xem từng nhóm crop thật và các màn Hiện tại/Vượt tầng/Thành tựu. 61 `integratedUi` được cập nhật sau lần xem này, không kế thừa QA bộ cũ.
- Gate main/experiments trước các sửa cuối: 329 + 25, 0 fail/skip. Sau sửa cuối: typecheck, check:web45, loader/discovery9, integration `read-only settlement`1 đều đạt. Main/experiments không chạy lại nguyên bộ sau fastpath; 19 practice/battle cases liên quan đã được kiểm riêng.
- Hồi quy browser bản cuối **35/35, 0 fail/skip**; matrix asset cuối1/1. Đã kiểm dialog `[open]`, Escape không ghi, đóng thực `display:none`, nút/X còn thấy ở320×460/chữ200%. Visual review không tràn ngang/không vùng bấm dưới44px/không runtime error.
- Gate staging cấu hình3/3 và dry-run đạt, 224 asset files; Worker670,88KiB/gzip155,90KiB. Không thay schema0037, không cần migration.
- Frontend lab trước–sau có đầy đủ điều kiện trong REVIEW. Không chứng minh tải đầu nhanh hơn đáng kể; đã loại hai SQL kết toán thừa, giới hạn dữ liệu và nạp chiến tích theo nhu cầu.
- Local artifacts `.wrangler/cultivation-qa/`: `final-browser.log`, `final-art-matrix.log`, `final-ui-art/`, `final-matrix/`, `art/ui-*-final-*.png`, `visual-review/`, `current/`, `performance/`, `final-staging-check.log`. Các lỗi ở lần chạy scratch trước đã được sửa và rerun: thiếu thư mục screenshot; truy cập cast trước khi trang truyện nạp. Không coi hai lần đó là xanh.

## Việc phát hành còn lại

Commit/push source đã kiểm; deploy staging; xác minh hashes/static/auth và runtime đúng version; ghi commit/version/hướng dẫn nghiệm thu. Phiên browser isolated hiện đã hết auth; không giả owner session hoặc ghi dữ liệu thử để thay bằng chứng. Giới hạn remote owner-read sẽ ghi rõ nếu không có traffic thực trong mẫu tail.

## Danh sách yêu cầu dùng khi audit

1. App thật dùng đầy đủ luồng mới, mọi hành động đọc/ghi tương thích engine và phiên bản.
2. Art cuối đồng nhất, đã kiểm trong UI; manifest/hash/nguồn không thay việc xem ảnh.
3. Browser kiểm người mới/luyện/công pháp/tầng/chuẩn bị/chiêu/kết quả/cứu/chiến tích, chữ lớn/sáng tối/mạng lỗi.
4. Integration chứng minh ghi nguyên tử, idempotency, chủ sở hữu, ngày sinh hoạt, snapshot cũ và quyền cũ.
5. Cân bằng mới kiểm bằng hành trình có luyện và đóng góp thật trong engine riêng; không dùng mô phỏng HTML làm bằng chứng.
6. Đo tải/request/ảnh trước–sau, phân biệt lab fixtures với staging thực tế.
7. Commit/push, staging deploy và verify; hướng dẫn nghiệm thu/bàn giao cập nhật với giới hạn thực tế.

Không mục nào ở trên được coi hoàn thành chỉ vì tồn tại file hoặc test khác đã xanh. Checkpoint này sẽ được cập nhật bằng kết quả thực tế.
