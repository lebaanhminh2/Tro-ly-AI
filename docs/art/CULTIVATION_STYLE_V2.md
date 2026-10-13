# Tu luyện — hướng hình ảnh minh họa v2

Ngày thiết kế: 2026-10-13. User yêu cầu thay toàn bộ art game vì bộ ảnh cũ chưa đạt cảm giác chơi. Các kết luận QA cũ chỉ mô tả bản đã phát hành, không chứng minh mỹ thuật đáp ứng yêu cầu mới.

## Hướng đã thử

Minh họa tiên hiệp 2D: nét mực rõ, mảng màu có cạnh và chuyển nhẹ, khuôn mặt biểu cảm, kim loại đồng có ánh viền. Nền núi xanh trầm tạo chiều sâu; ngà, than và đồng giữ liên hệ với UI. Mỗi nhân vật/phái có một màu phụ để người dùng nhận ra hình ở kích thước nhỏ. Không trộn chân dung giả ảnh chụp với pixel art hoặc chibi.

Tham khảo Habitica ở cách nối hành động hằng ngày với mục tiêu trận và chiến tích; Wuthering Waves ở nhận diện nhân vật, tương phản silhouette và trình bày đối thủ. Đây là hướng vận dụng, không dùng hình/costume/nhân vật của hai game làm đầu vào sinh ảnh. Không tuyên bố đã chơi hoặc kiểm toàn bộ hai game từ tài liệu tham khảo.

### Các mẫu đại diện

- `ky-hanh-v2`: gương mặt rõ, tóc buộc cao, giáp vai đồng, áo choàng xanh trên cổ áo ngà; vùng tay dưới bị loại khỏi crop xuất bản.
- `khoi-loi-v2`: tượng hộ vệ kim loại có gương mặt chạm khắc và mắt đỏ, silhouette cứng; không mô tả là mặt nạ sứ khi output không có.
- `chapter01-v2`: dãy núi xanh theo lớp, mái đền đỏ sẫm và vầng trăng nhạt; không mô tả cầu/sông khi output không có.

Ba ảnh đã xem bản gốc. Việc duyệt tích hợp vào UI và sản xuất toàn bộ bộ ảnh được ghi riêng trong inventory; không coi prompt hoặc bước export là bằng chứng đã xem màn hình thật.

## Nhân vật và ảnh thẻ

Thiết kế nhận diện gồm tuổi/vóc dáng, tóc, cổ áo/vai, màu phụ và vật liệu. Nhân vật tái ngộ dùng cùng asset danh tính ở các lần gặp nếu diễn biến không đòi đổi tạo hình. Không thay mặt giữa các phase chỉ để có nhiều hình.

Chân dung ưu tiên đầu/vai, không ép đạo cụ/tay nhỏ vào thumbnail. Khi bản gốc có lỗi vùng ngoài trọng tâm, crop chỉ được dùng nếu bảo toàn danh tính và mục đích ảnh; vùng lỗi không được mô tả là đã sửa. Nếu lỗi nằm trên mặt/silhouette chính phải tạo lại có mục tiêu.

Ảnh boss không phải người cần đọc được là thú/khôi lỗi/cổ thư, có trọng tâm khác chân dung người. Gương mặt không giống nhau chỉ vì cùng model. Kỷ Hành giữ một gương mặt xuyên ba lần gặp; Tịch Vân, A Lạc, Mộc An, Tạ Trường Sinh và La Sát có vai trò/silhouette riêng.

## Phái và công pháp

| Phái | Màu phụ | Nhận diện |
| --- | --- | --- |
| Thiên Kiếm | Xanh ngọc trầm | Mũi kiếm, đường chéo sắc |
| Bất Diệt | Đồng hổ phách | Khiên, đường bao vững |
| U Minh | Đỏ nâu | Huyết ấn, đường cong sinh lực |
| Thái Hư | Tím lam xám | Trăng, vòng hở/hư ảnh |
| Thiên Cơ | Xanh xám | Thiên bàn, mắt/ấn dự báo |

39 biểu tượng SVG là hình vẽ nguyên bản của dự án. Cùng khung 64px và độ dày nét, trung tâm khác theo identity chiến thuật, nền nhạt theo phái. Trấn phái có vòng và dấu đỉnh; cấm thuật/ngoại đạo có khung khác. Không dựa chỉ vào màu để phân loại. Chữ/tầng/tinh thuần do UI render.

## Sản xuất và tiếp tục

- Model miễn phí local: DreamShaper8, revision đã pin trong manifest, CreativeML Open RAIL-M. Không tải model vào Git hoặc gọi dịch vụ trả phí.
- Float32, DPM++ Karras, CPU offload/sliced attention và VAE; GTX1650 4GB. Các mẫu 448×640/640×448, 32 steps, peak4053MiB, khoảng111–120giây/ảnh. Batch dùng28steps để tiết kiệm thời gian sau khi kiểm mẫu.
- `cultivation-v2-trials.json` sở hữu3 mẫu, `cultivation-v2-production.json` sở hữu58 mục còn lại. Tổng61 raster sử dụng:41 chân dung/boss,15cảnh,5phái. Không sản xuất lại3vũ khí đã bỏ khỏi trải nghiệm; `tram-nui` là ảnh dự phòng không dùng.
- Draft PNG và metadata ở `D:\Tro-ly-AI-art\cultivation-v2-*`; WebP/thumbnail cuối và provenance được đưa vào repo. Script kiểm SHA/model/revision/seed/prompt khi tiếp tục để không vô tình dùng lại draft khác workflow.
- `--contact-sheet <path>` dựng ảnh kiểm bằng Pillow, không load model. Chia thành các nhóm nhỏ để có thể xem mặt, silhouette và sự khác biệt.
- Publisher yêu cầu `conceptApproved`, crop hợp lệ và hash source đúng. Thumbnail chân dung/boss được crop theo focal point để đọc được mặt; scenes giữ tỷ lệ cảnh. Các QA UI vẫn để pending đến khi thực sự kiểm trong app.

Lệnh mẫu:

```powershell
& 'D:\Tro-ly-AI-art\venv\Scripts\python.exe' scripts/art-local.py --manifest docs/art/cultivation-v2-production.json --output 'D:\Tro-ly-AI-art\cultivation-v2-production'
```

Xuất bản chỉ sau khi xem và sửa mục cụ thể. Giữ ảnh gốc của các bộ cũ ở thư mục art ngoài repo để so sánh; app chỉ tải derivative được chọn. Manifest lưu alt đúng hình đã xem, không sao chép mọi chi tiết chưa đạt trong prompt vào alt.

### Kiểm soát sản xuất và các lần loại ảnh

- Mỗi biến thể có ID riêng; seed/prompt/negative/kích thước/steps/guidance được đối chiếu với metadata khi tiếp tục và publish. Không dùng một PNG cũ sau khi đổi prompt. SHA nguồn và SHA/dung lượng/kích thước từng WebP cuối được kiểm riêng.
- PNG, metadata, WebP và inventory ghi vào file `.pending` rồi thay nguyên tử. Việc Chrome tải đúng lúc export không được đọc file dở.
- Các lần tạo đã dùng: ba mẫu minh họa, 58 bản sản xuất và một nhóm retry nhỏ ở `cultivation-v2-revisions.json`. Không khởi động lại batch còn chạy hoặc nạp hai pipeline lên GPU 4GB cùng lúc.
- Song Nha v2 chỉ có một sói; v3 thành người tai sói; v4 thành thú mang giáp/thân người: đều loại. V5 đổi hẳn sang prompt wildlife/bestiary không có trang phục, cho hai sói bốn chân với hai đầu và bốn bàn chân trước rõ. Coat xám đen thực tế thay mô tả đen tuyệt đối từ prompt; ảnh vuông giữ cả hai đầu ở thumbnail.
- Thần Thể v2 là nét phác gần đơn sắc, chưa phải asset hoàn thiện. V3 có mặt sứ xanh ngà, tóc xanh ngọc, mắt vàng và giáp đồng; mô tả theo hình này, không gán mặt nạ vô diện/mắt xanh khi output không có.
- Thần Sổ v2 giống sách trên bàn; v3 là cổ thư đen đồng có vòng mắt sáng, đủ nhận diện đối tượng chiến đấu. Không gán trang sách mở/khói khi hình không có.
- Thư Lệnh v2 giống giấy bút, v3 thành chân dung người: loại cả hai. V4 dùng style artifact, cho ấn lệnh đen đỏ với vòng đồng và nét mực uốn quanh, tách khỏi prompt người tiên hiệp. Crop dưới 7% bỏ dấu giống chữ ký. Không mô tả là cuộn giấy trắng đang bay khi output không có.
- Cảnh02/cảnh11 v2 quá gần ảnh thực. V3 là cảnh núi/đền và thành ngục trên vách núi được vẽ, thống nhất với các cảnh còn lại. Không buộc lời mô tả phải có số lượng chín tháp hoặc cổng song sắt nếu ảnh chỉ diễn đạt thành ngục.
- Crop đầu/vai trên Kỷ Hành, Tịch Vân, A Lạc, Mộc An, Huyết Hà, La Sát, Trụ Thủy và một số keeper được ghi trong manifest. Crop bỏ vùng tay/đạo cụ ngoài mục đích chân dung; không tuyên bố đã sửa giải phẫu của bản gốc. Cảnh07 bỏ khung mép trang trí để hòa vào UI.
- Publish luôn đặt `qa.integratedUi=pending` cho source mới. QA bộ cũ 2026-10-12 không được kế thừa cho minh họa hiện tại; chỉ cập nhật sau matrix màn hình thật và ảnh đã xem.

### Kết quả xuất nguồn 2026-10-13

Đã xuất đủ **61 raster / 122 WebP** thuộc `direction=cultivation-illustrated-v2`: 35 boss, sáu portrait, 15 cảnh, năm phái; 39 SVG có glyph/hash riêng. Bốn ảnh lịch sử `tram-nui` và ba weapon không được tính vào phạm vi này. Source cuối giữ tên ổn định để các trận/truyện/quyền cũ không cần đổi ID.

Tổng WebP 2.663.754 byte; 39 SVG 16.628 byte. Full lớn nhất 81.478 byte, thumbnail lớn nhất 9.198 byte. SHA nguồn/final, kích thước và dung lượng đã đối chiếu; snapshot kiểm tra tại `cultivation-v2-audit.json`. Đây là dung lượng toàn bộ bộ ảnh, không phải lượng tải của một màn hình.

Contact sheet xuất từ **WebP cuối** nằm ở `.wrangler/cultivation-qa/art/cast-final-published.png`, `scenes-final-published.png`, `schools-final-published.png` và đã được xem. Job local cuối đã kết thúc thành công; không còn model chạy nền. Các bản thử bị loại nằm ngoài repo để tái tạo/so sánh.

Các số liệu trên xác nhận xuất nguồn, không thay bằng chứng crop/tương phản/tải của app thật. Khi bàn giao nguồn, cả 61 record đều có `qa.integratedUi=pending`; bước kiểm UI/staging do vòng tích hợp cập nhật bằng màn hình mới, không kế thừa QA bộ cũ.

## Điều kiện nghiệm thu

Mặt/mắt/cổ/vai đúng hình thể; đạo cụ và vật liệu rõ; crop không cắt mặt và không để chi tiết nhỏ làm rối; phản diện/cấm thuật có nhận diện riêng; cảnh có lớp sâu và không quá bẩn/nhạt. Kiểm ở thumbnail và ảnh lớn, sáng/tối, điện thoại/desktop; dùng cache/request measurement để bảo đảm bộ ảnh không làm tab chậm. Asset tồn tại hoặc có hash đúng không tự chứng minh chất lượng hay tích hợp đạt.

## Kết quả tích hợp cuối 2026-10-13

Root đã xem full originals/contact WebP cuối, matrix màn thật40đối thủ/15chương, thêm40mànphái/cast sáng–tối, bốn mục và trạng thái luyện/giao chiến/cứu/kết quả. Không tràn ngang/runtime error, zero writes ở các lượt art local.61record được cập nhật approved-local-actual-app sau review; nguồn-export QA pending tại thời điểm bàn giao được giữ trong audit. Hồi quy browser35/35và hash122WebP đều đạt. Kiểm trên Chrome emulation, không tuyên bố người dùng đã nghiệm thu trên điện thoại thật. RELEASE lưu staging/version và giới hạn remote owner-read.
