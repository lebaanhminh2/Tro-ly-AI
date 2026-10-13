# Tu luyện — trải nghiệm, cốt truyện và chuẩn mỹ thuật

**Vòng hiện tại 2026-10-13:** [CULTIVATION_UX](HABIT_GAME_CULTIVATION_UX.md) và [STYLE_V2](art/CULTIVATION_STYLE_V2.md) sở hữu hướng mới: Hiện tại/Công pháp/Vượt tầng/Thành tựu, minh họa 2D có nét mực và nhận diện nhân vật rõ, không Thần binh trong trải nghiệm mới. Nội dung/stable IDs/quyền cũ vẫn được bảo toàn. Các đoạn mô tả weapon và QA art đã phát hành bên dưới là lịch sử; không dùng để mở lại phạm vi đã bỏ hoặc coi bộ ảnh mới hoàn tất.

Cập nhật 2026-10-12. Chuẩn sáng tạo cho **toàn sản phẩm**; nhân vật/truyện/art đã tích hợp và QA, phát hành staging, bằng chứng ở [RELEASE](HABIT_GAME_RELEASE.md). AI sở hữu thiết kế chi tiết và tự QA; user nghiệm thu cuối. Phạm vi tại [PRODUCT](HABIT_GAME_PRODUCT.md), catalog/truyện tại [GAMEPLAY](HABIT_GAME_GAMEPLAY.md), sản xuất ảnh tại [LOCAL_ART](HABIT_GAME_LOCAL_ART.md).

## 1. Cảm giác cần tạo

Việc nhỏ ngoài đời tạo ra hành trình tu luyện có câu chuyện và lựa chọn. Habit dùng nhanh, có giá trị kể cả không chơi; game có nơi riêng để khám phá. UI trầm, ít màu, rõ trên điện thoại; nhân vật/cảnh có dấu nhận diện và ánh sáng vừa đủ, không nhạt đến mức mọi thẻ giống nhau.

“Cuốn” cần thể hiện qua một vòng cụ thể: mục tiêu gần → tiến bộ nhìn thấy → lựa chọn chiến thuật → kết quả hiểu được → mở điều mới đáng theo đuổi. Boss/nội dung mới phải thay cách nghĩ/chơi hoặc quan hệ truyện; không chỉ đổi tên/HP/màu. Giữ tinh thuần nghiêm, giải thích khuyết điểm của bản luyện; lời văn không trách móc con người vì một ngày chưa làm.

## 2. Việc AI phải thiết kế

- Hành trình mới/cũ/quay lại, onboarding, điều hướng, mỗi màn một hành động chính và cách đọc tiến độ/cam kết.
- Cốt truyện đầy đủ 15 chương, các tuyến truyền thừa/cấm thuật/Kiếm Đồ/thần binh, nhịp hé lộ và hậu quả chiến tích.
- Nhân vật có động cơ, giọng nói, ngoại hình và diễn biến; quan hệ thay đổi sau các mốc thật, không tất cả chỉ khen nhân vật chính.
- Art direction, character sheets, nhận diện 5 phái, portraits/boss/scenes/technique và weapon presentation; assets cuối đồng bộ.
- UI code/loading/error/empty/read-only/network/conflict, feedback nhẹ và reduced motion, self review trong app thật.

Tên/cast/palette/thông số sau đây là hướng khởi đầu, AI có thể sửa có lý do. Luật user/full scope/ngân sách thuộc tài liệu sở hữu của chúng, không đổi qua một quyết định mỹ thuật.

## 3. Art direction và UI

Hướng ban đầu: tranh bán hiện thực có chất mực, tiên hiệp trầm, chất liệu vải/đá/kim loại rõ; ánh sáng tạo điểm nhận diện. Tránh chi tiết siêu nhỏ không đọc được ở thumbnail. Chọn style qua ảnh thử tích hợp, không chỉ qua prompt hoặc moodboard.

- Giữ typography/spacing/theme của app và cải thiện có hệ thống. Mỗi nhóm thông tin có khoảng cách trong/ngoài rõ, hierarchy ít cấp; số quan trọng có nhấn vừa đủ, không toàn bộ bold.
- Nhân vật có silhouette, face marks, trang phục/vật dụng và palette riêng. Cùng nhân vật qua nhiều chương giữ identity; thay trang phục/biến đổi phải có lý do trong truyện.
- UI dùng ít màu nhấn; từng phái phân biệt bằng cả hình/chữ/icon. Art có màu riêng nhưng không biến mọi card thành nền nhiều màu.
- Text, tên/nút/HP/số/tỷ lệ do app render, không ghi chữ cần đọc vào raster. Art crop có vùng an toàn cho portrait/focal point, không phủ mặt bằng label.
- Hero art ở truyện/boss, thumbnail ở library; habit/task giữ tốc độ đọc. Không ép người dùng cuộn qua poster lớn mỗi lần ghi habit.
- Motion ngắn để chỉ ra thay đổi/turn order; không cần canvas/game engine hoặc màn cinematic dài. Luôn có bản text log và skip/read lại.

## 4. Hồ sơ cast mở

Khung nhân vật đề xuất để AI thống nhất, có thể thay tên/chi tiết; phải có story bible/version cuối trước khi sản xuất ảnh hàng loạt.

| Vai trò | Hướng thiết kế | Điều cần phát triển |
| --- | --- | --- |
| Người tu hành vô danh | Xuất phát giản dị, vật dụng có lịch sử; silhouette đọc được | Không cần hệ avatar phức tạp; đường sức mạnh/ngoại hình phù hợp tiến trình |
| A Lạc — người thân bị bắt | Có tính cách và mục tiêu riêng | Chủ động giữ trận cứu người, không chỉ đợi được cứu; scene/portrait theo bước ngoặt |
| Kỷ Hành — đối thủ tái ngộ | Dấu nhận diện xuyên ba lần gặp | Kiếm pháp/trang phục đổi theo vai trò; động cơ cứu người và nguy cơ kế vị |
| Người giữ thư các, Tịch Vân | Điềm tĩnh, tóc búi/trâm đồng, áo xám/cổ ngà | Hướng dẫn ngắn, biết lịch sử nhưng tiết lộ theo quyền mở thật; portrait đã tạo, không bắt buộc sách trong crop |
| Đồng minh, gợi ý Mộc An | Túi thuốc/bản đồ, hành động có mục đích | Câu chuyện/giá trị riêng, không làm một bộ nhắc habit mới |
| Tạ Trường Sinh | Dấu tích của nhiều lần hiến cảnh giới | Cho thấy cái giá Nghịch Mệnh trước khi người chơi dùng |
| La Sát Nữ Đế | Có khí chất và logic đánh đổi sinh mạng | Khác biệt giữa lực mạnh và lựa chọn đạo đức; không chỉ đổi màu “tà” |
| Thần Chủ và các đối thủ | Dấu nhận diện gắn mechanics/nguồn thần lực | Sự đe dọa được hé lộ sớm; payoff ở chương 15 |

Những boss/nhân vật còn lại do AI thiết kế theo GAMEPLAY. Không mặc định mọi boss là cùng một nam nhân đổi áo hoặc cô gái đẹp; tuổi/vóc dáng/vật liệu/silhouette thể hiện tính cách. Có thể dùng lại danh tính trong các lần tái ngộ với pose/trang phục/pha mới có chủ đích.

## 5. Viết truyện cho ứng dụng hằng ngày

- Mỗi chương có mở, diễn biến qua encounter, hậu quả thắng/thua hoặc lựa chọn thật, và một mục tiêu tiếp. Truyện đầy đủ nhưng mỗi scene mobile đọc được trong lượt ngắn.
- Nhân vật quan trọng được giới thiệu trước payoff. Boss có lý do chặn đường; truyền thừa được thấy đáng khao khát trước khi trao quyền học.
- Lựa chọn chỉ xuất hiện nếu có hệ quả hiểu được; không thêm nhiều nút dẫn tới cùng đoạn. Không dùng chọn truyện để ngầm hy sinh rank/chi phí mà chưa nói.
- Lore dài ở nhật ký/thư viện, không chắn nút ghi habit hoặc chọn chiêu. Spoiler theo quyền mở, có đọc lại và xem nhân vật tái ngộ.
- Nội dung versioned, do AI sáng tác trước và lưu trong repo; không cần Gemini online để sang chương/nhận thưởng hoặc kể lại kết quả cũ.
- Đổi những tên/mỹ thuật vay IP thành bản gốc cho bản phát hành; giữ bản sắc mechanics. Không sao chép likeness/hình ảnh từ tác phẩm bên ngoài.

## 6. Danh mục art toàn sản phẩm

AI tạo asset inventory ở P0, liên kết stable content IDs và màn dùng. Không bắt một tranh lớn cho mỗi tầng/phiên bản; chọn lượng art đủ để mọi nội dung đã giao có trình bày cuối có chủ đích.

| Nhóm | Mức đầy đủ cần có |
| --- | --- |
| Cast chính | Portrait/character reference cho các nhân vật thực sự xuất hiện; variants khi story cần |
| Boss | Art cuối cho từng danh tính boss chơi được; tái ngộ/pha có biến thể khi cần, không dùng placeholder chung |
| Chương/cảnh | Mỗi chương trong 15 chương có cảnh đại diện phù hợp và scene cho bước ngoặt cần hình; tái dùng địa điểm chỉ khi có lý do và crop/ánh sáng phù hợp |
| Phái | Nhận diện 5 phái đồng nhất, phân biệt ở thumbnail/card |
| Công pháp | Đủ 39 mục có icon/biểu tượng và trình bày tier/purity. Có thể dùng vector/code cho biểu tượng đơn giản; không thay portrait/cảnh bắt buộc bằng hình tạm |
| Thần binh/thưởng | Art/icon cho các món/chiến tích giao thật; hiển thị rõ tác dụng/điều kiện, không thêm hệ trang bị phức tạp |
| UI nền | Các thành phần hệ thống cần thiết, empty/loading/locked/preview/final có thiết kế thật |

Mục đích mỗi asset, ratio/crop/focal point, style reference, prompt/seed/backend/model/version/license/hash, file cuối/derivatives và QA state nằm trong manifest. Những mục chưa có ảnh cuối không được tự đổi trạng thái sang complete vì nội dung text đã có.

## 7. Sản xuất và review

1. Lập style/character/content bible + inventory; thử một portrait và boss/cảnh trên local pipeline đã chọn.
2. Kiểm style/crop/contrast trong UI 360/390/414 px dark/light; chỉnh bản thử đến đủ tốt rồi lock hướng reference.
3. Sản xuất theo chapter/school batches, giữ identity/reference, review thumbnails cả batch trước export. Tạo lại có mục tiêu khi mặt/tay/đồ vật/identity chưa đạt.
4. Optimize web assets, derivatives/alt/dimensions/loading, tích hợp ở màn thật. Model/cache/venv/drafts ngoài Git; finals/manifest/workflow trong repo.
5. Chụp/xem screens khi app chạy với dữ liệu ít/nhiều, sửa spacing/palette/legibility/crop; test DOM không thay visual QA.
6. Sau mỗi batch, chơi đoạn truyện/boss tương ứng và kiểm gallery/library/history. Đủ 15 chương cuối mới tính art/nội dung xong.

Hình nhân vật/boss/cảnh phải được tạo và lưu thật. Prompt, moodboard, screenshot mockup hoặc ảnh nằm ngoài repo chưa tích hợp không phải bàn giao. Khi local quality/tool chặn, báo đúng trong checkpoint và tiếp tục việc độc lập; không âm thầm dùng placeholder rồi gọi full.

## 8. Chuẩn tự nghiệm thu cảm giác chơi

Mở habit đầu dễ, tuần linh hoạt hiểu nhanh, một ngày thấp năng lượng vẫn thấy phần đã làm. Luyện đọc được tiến độ/phẩm chất/rủi ro; trận đọc được intent và một quyết định chính; sau kết toán thấy thứ tự và vì sao kết quả khác. Mỗi chương có payoff và mục tiêu gần mới, từng tuyệt học có ít nhất một tình huống đáng chọn.

AI tự trải nghiệm/mô phỏng, sửa phần dài dòng/nhạt/lặp hoặc buộc user mở app nhiều hơn. Không cam kết người dùng chắc chắn thấy hay; bàn giao evidence/ảnh/tour để user đánh giá. Các gate kỹ thuật/visual/gameplay tại [ACCEPTANCE](HABIT_GAME_ACCEPTANCE.md).
