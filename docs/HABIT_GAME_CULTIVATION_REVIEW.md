# Tu luyện — nghiên cứu, review và bằng chứng

Cập nhật 2026-10-13. Redesign và art cuối đã tích hợp, kiểm và phát hành staging từ source `07e9aa0`. [RELEASE](HABIT_GAME_RELEASE.md) và [PROGRESS](HABIT_GAME_CULTIVATION_PROGRESS.md) ghi bằng chứng/giới hạn. Không dùng QA bộ ảnh cũ để duyệt bộ mới.

## Tham khảo đã xem và cách áp dụng

| Nguồn | Điều quan sát | Áp dụng trong app |
| --- | --- | --- |
| [Habitica — How It Works](https://habitica.com/static/features) | Đã mở bằng Chrome trang công khai, xem ảnh giao diện chính: hành động đời thực, tiến bộ nhân vật và phần thưởng có liên hệ rõ; nhóm việc có vị trí ổn định. Không đăng nhập hoặc thử tài khoản Habitica. | Giữ habit là công cụ dùng nhanh, game có tab riêng. Hiện tại nêu mục tiêu gần và dẫn về habit; chiến tích lưu kết quả thật. Không thêm trang bị hoặc chơi nhóm ngoài phạm vi đã chốt. |
| [Habitica — completed quests](https://tools.habitica.com/habitica_user_data_display.html?sectionOpen=questsCompletedSection), [Quest Shop](https://habitica.wordpress.com/2019/10/16/quest-shop/) | Đọc cách trình bày nhiệm vụ đã hoàn thành và đích để tiếp tục. Không gọi đây là trải nghiệm toàn bộ gameplay đăng nhập. | Thành tựu lấy đối thủ đã thắng làm trọng tâm; ngày thắng, bản luyện, chiêu đã dùng và quyền học lấy từ engine/store. |
| [Wuthering Waves 2.2 — PlayStation](https://blog.playstation.com/2025/03/21/wuthering-waves-version-2-2-launches-march-26-tangled-truth-in-inverted-tower/) | Đã tải và xem ảnh hero chính thức: mặt, silhouette và vật liệu có trọng tâm; foreground/background tách bằng độ sáng; bảng màu lạnh có điểm nhấn. | Nhân vật nguyên bản có dấu nhận diện và crop rõ; cảnh có lớp sâu. Không sao chép nhân vật, trang phục, hình ảnh hay giao diện game 3D. |
| [NNGroup — Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) | Phân cấp bằng tương phản, kích thước và khoảng cách; quá nhiều vùng nhấn làm mất điểm bắt đầu. | Bốn mục cố định; một mục tiêu gần; phụ lục/bản cũ/chiến thắng cũ thu gọn. Màu nhấn đồng, phần lớn chữ dùng hierarchy chung. |
| [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Vùng bấm và độ rõ phải kiểm bằng layout/theme thực, không suy từ CSS có một con số. | Mục tiêu vùng bấm game 44px, focus hiển thị, trạng thái có chữ/hình bên cạnh màu. Kiểm 320px và chữ 200%; không tuyên bố đạt mọi tiêu chí WCAG chỉ từ test này. |
| [web.dev — Web Vitals](https://web.dev/articles/vitals), [lazy images](https://web.dev/articles/browser-level-image-lazy-loading) | Đo tài nguyên và lúc có nội dung hữu ích; phân biệt dữ liệu thực địa với lab. | Thumbnail nhỏ, ảnh chương/boss nạp khi mở; catalog cache theo owner/quyền; chiến tích nạp riêng. Đo Chrome/local và Worker/staging riêng. |

Ảnh tham khảo và bản chụp trang Habitica công khai nằm ở `.wrangler/cultivation-qa/references/`, không đưa vào asset sản phẩm. Bản chụp đầu khi trang Habitica còn chạy hiệu ứng xuất hiện đã bị loại; dùng bản sau khi nội dung/ảnh tải xong. API đọc web trả trang SPA rỗng nên không coi kết quả đó là đã xem giao diện.

## Luồng thực đã đổi

1. **Hiện tại:** nhìn chế độ đang có, tiến độ tầng, thay đổi hẹn ngày sau và một bước tiếp theo. Khi đang giao chiến, ưu tiên lượt hôm nay và chi phí thay vì bắt tìm lại trận trong danh sách.
2. **Công pháp:** mặc định những môn đã mở; tìm theo tên/cách dùng và phái. Khám phá cho thấy đường học đã phát hiện, bí tịch chưa lộ diện gom thành dấu vết. Chi tiết giữ bản cũ, tầng/tinh thuần đã khóa và xác nhận luyện lại.
3. **Vượt tầng:** 22 tầng chính, nhóm bốn tầng; mục tiếp theo dễ thấy. 18 cơ duyên phụ tách rõ. Tầng đã vượt mở chiến tích; đánh lại nằm trong chi tiết. Chuẩn bị/đổi bộ chiêu giữ ngày xuất chiến và lịch luyện trở lại.
4. **Thành tựu:** đọc chiến thắng đầu tiên của từng boss, không giới hạn bốn trận gần nhất. Xem bộ khi kết thúc và chiêu thực sự đã dùng riêng; nhật ký/trận cũ/xuất dữ liệu vẫn có.

Thần binh không có trong trải nghiệm mới. Trận mới dùng content `than-lo-4`, không bonus/phần thưởng vũ khí. Snapshot, receipt, entitlement và trận cũ giữ nguyên; luật battle vẫn `battle-v1`.

## Findings đã xử lý

- Thanh progress native xanh lệch hệ màu: đổi về màu đồng theo theme.
- Thẻ công pháp có khoảng trắng thừa: siết khung và khoảng cách tên/mô tả/trạng thái.
- Sửa bộ chiêu bằng hủy rồi tạo lại làm mất ngày/trạng thái: dùng operation nguyên tử, giữ snapshot.
- Catalog đọc song song có thể đi trước settlement: so access do server trả và tải lại khi quyền mới khác snapshot.
- Catalog vẫn lộ tên boss chưa gặp qua danh hiệu: che ở cả trường phụ/tên chương; test kiểm JSON đầy đủ.
- Chiến tích cũ có thể về muộn sau quyền mới: request phân biệt access/generation và không cài dữ liệu cũ.
- Bộ chiêu lỗi tải sau khi gỡ loading không có thông báo: hiện lỗi/thử lại ngay trong bảng đang mở.
- Nút Rút lui và Xem có thể hẹp hơn 44px: sửa vùng bấm trong phạm vi game.
- Selector flex của xác nhận vẫn khớp dialog đã đóng: giới hạn bằng `[open]`, kiểm Escape không ghi/cứu và computed display thật là `none`. Đo vùng tiêu đề/X và xác nhận ở 320×460, chữ 200%.
- Bản chụp nút tối ban đầu lấy đúng lúc background đang transition: chụp lại sau khi theme ổn định và kiểm màu computed thực. Không coi ảnh chuyển tiếp là màu cuối hoặc sửa palette dựa trên ảnh đó.
- Kết toán ngày chưa kết thúc đọc account/boundary trùng ở cuối hàm: trả kết quả ngay, từ 4 xuống 2 SQL khi boundary đã lưu; người chưa có account từ 2 xuống 1. Test giữ nguyên progress/account/outcomes/receipts và hành vi backlog/limit. Không suy con số latency remote từ số SQL.
- Một số guardian giống nhau, Song Nha chỉ có một sói, cảnh lệch sang ảnh thực: loại bản đó và tạo lại có mục tiêu; manifest ghi rõ vùng crop và lỗi đã loại.

## Bằng chứng và giới hạn

- Full gate: **329 main + 25 experiments**, 0 fail/skip; local D1, engine thật và provider fixtures. Không gửi tin thử hoặc giả ghi nhận cá nhân trên staging.
- Full browser: **35/35**, gồm hành vi các tab cũ, đổi/luyện lại, stale/retry, cứu, discovery và chiến tích. Targeted tests bổ sung sau review phải được ghi cùng kết quả release cuối.
- Matrix mở **40 đối thủ, 15 trang truyện, 39 dấu ấn** qua UI thật. Lượt đầu còn trộn ảnh cũ/mới, chỉ chứng minh tích hợp; art cuối cần lượt chụp lại.
- Visual review: bốn mục ở 320/390/1440, sáng/tối; trạng thái luyện, active, cứu và kết quả ở 320 sáng, 390 tối, chữ 200%. Chrome emulation không chứng minh thiết bị thật; test tràn ngang không thay việc xem ảnh.
- Earned engine routes hiện hành: cả năm phái vượt đủ 40 đối thủ, mở/luyện 39 môn; thêm weekly3/daily80/mixed và cứu trả chi phí. Báo cáo 30 profile v3 là lịch sử; không gắn bằng chứng đó cho v4.
- Performance reports và ảnh thực nằm ở `.wrangler/cultivation-qa/`. Chỉ dùng số đo có điều kiện rõ; không diễn giải server Git-cache trong harness là tốc độ app cũ, hoặc localhost là latency D1.

Mỹ thuật cuối đã kiểm: 61 raster/122 WebP và 39 SVG, 40 đối thủ/15 chương trong matrix bản cuối; thêm 40 màn phái/cast sáng–tối. Root xem toàn bộ contact source-final/UI-final và màn luyện/active/cứu/kết quả/chiến tích. Hồi quy browser sau sửa modal **35/35**; typecheck/check:web45, loader/discovery9 và settlement read-only1 đạt. Gate329main+25experiments là lượt trước loader/fastpath/modal cuối; không gán số đó thành full rerun bản cuối. Version/staging được ghi khi phát hành thật. Tính thú vị trong sử dụng dài ngày vẫn cần người dùng nghiệm thu; test không chứng minh cảm xúc chơi nhiều tháng.

## Đo frontend trước–sau

Ba lượt mỗi bản, Chrome 390px, cùng fixture người mới, khi mở game áp latency 150ms và throughput 100KiB/s; không có latency D1/Worker. Baseline static `6e23d9f` được làm nóng cache của server Git trước khi bấm giờ để loại overhead subprocess. Baseline dùng public-catalog shape cũ; bản mới dùng projection cá nhân. Các số chỉ mô tả mẫu lab này:

| Số đo | Baseline | Redesign |
| --- | --- | --- |
| Nội dung chính có thể dùng, median | 574ms | 605ms |
| Ảnh trong viewport sẵn sàng, median | 848ms | 796ms |
| Quay lại tab từ dữ liệu đang giữ, median | 36ms | 44ms |
| Catalog JSON không nén | 28.655 bytes | 26.244 bytes |
| Request khi quay lại | một game GET | một game GET |

**Không đủ căn cứ nói tải đầu nhanh hơn đáng kể.** Cả hai bản đã giữ cache; không gắn cơ chế có sẵn thành một cải thiện mới. Asset SVG mới tăng nhẹ bytes để có hình nguyên bản rõ hơn. Tối ưu có bằng chứng ở vòng này là nạp chiến tích theo nhu cầu, không gửi trận/log đầy đủ để xem danh sách, catalog không nạp lại khi quyền giữ nguyên và bỏ SQL kết toán lặp. Phân biệt điều này với tốc độ mở app chịu bootstrap cũ.

Mẫu staging lịch sử cho thấy game khoảng 1,5–2,3s và bootstrap khoảng 6s; đó là dữ liệu 2026-10-12, không benchmark bản mới. Phiên isolated trước/sau deploy 2026-10-13 không auth (401); không tạo phiên/dữ liệu cá nhân giả. Bản mới: 216 file tĩnh/index hash khớp, tám GET 401/Origin 403, browser không exception; runtime 66 events/một cron đúng version outcome ok. Không có owner API 200 trong mẫu; không suy owner latency từ auth/static. RELEASE ghi version/backup và giới hạn.
