# Nguồn mỹ thuật Linh thú

`MANIFEST.json` đang đăng ký bộ **artVersion 3**, nguồn ở `v3/`; đủ **108 nguồn: 72 thường, 18 Thức tỉnh, 18 Hoàn mỹ**. Trạng thái duyệt ở [quyết định mỹ thuật](../../../LINH_THU_ART_APPROVALS.md). Stormlion T4 thường/95%/100% đã được duyệt và bảo quản trong [approved-v2/zappur](approved-v2/zappur/README.md). Các ảnh 95%/100% khác được phép dùng tạm và sửa riêng sau; quyền sản xuất không đồng nghĩa người dùng đã nghiệm thu từng ảnh. 72 ảnh tham chiếu ở thư mục bên cạnh được giữ nguyên.

Lưu bản nguồn có phiên bản, rồi thêm entry đúng loài/dạng/biến thể và nguồn tạo thật. Ví dụ cấu trúc:

```json
{
  "schemaVersion": 1,
  "artVersion": 3,
  "entries": [
    {
      "speciesId": "frostnip",
      "form": 4,
      "variant": "perfect",
      "source": "v3/frostnip/t4-perfect.png",
      "generator": "imagegen_cli_cockpit",
      "model": "gpt-image-2.5",
      "prompt": "Ghi nguyên văn prompt thực tế đã dùng, gồm vai trò của các ảnh tham chiếu."
    }
  ]
}
```

Chỉ ghi `image_gen` cho ảnh thực sự được tạo bằng công cụ đó. Luồng CLI chính thức qua Cockpit ghi `imagegen_cli_cockpit` và model thực tế; không lưu credential trong repo. Không điền entry từ ảnh mẫu, ảnh thử hình học hoặc ảnh chưa được tạo. `normal` dùng T1–T4; `awakened` và `perfect` chỉ dùng T4. Giữ đủ 18 species ID đã chốt, không thêm T5.

Ảnh nguồn cần một khung hình, canvas vuông tối thiểu 1024px, alpha và khoảng trống trong suốt tối thiểu 1/128 cạnh canvas ở cả bốn phía. Cả chuỗi phải dùng cùng góc nhìn và điểm neo; yêu cầu này phải xem trực tiếp, không suy từ kích thước file. Bản hoàn mỹ phải có thiết kế riêng, không dùng lại nguyên ảnh thường hoặc chỉ tăng glow.

- `node scripts/build-linh-thu-assets.ts --write`: dựng full 512px và thumbnail 128px, giữ alpha. Bản nguồn không bị sửa. Tên đầu ra có phiên bản và hash để tránh dùng lại ảnh cache cũ.
- `node scripts/build-linh-thu-assets.ts`: kiểm hash, nguồn, registry và đầu ra hiện có; không ghi, không gọi dịch vụ tạo ảnh.
- `node scripts/build-linh-thu-assets.ts --require-complete`: kiểm thêm đủ **72 bản thường +18 thức tỉnh +18 hoàn mỹ**. Khi còn thiếu phải báo lỗi; CI chạy cùng cổng đủ ảnh.

Bộ dựng từ chối ảnh tham chiếu trùng byte, các dạng dùng cùng ảnh sau chuẩn hóa pixel, metadata sai, đường dẫn thoát thư mục, ảnh quá nhỏ, thiếu alpha, rỗng hoặc sát mép canvas. Các kiểm tra này **không chứng minh chất lượng vẽ lại** hoặc phát hiện được mọi cách phóng lớn/đổi màu ảnh cũ. Vẫn phải xem trực tiếp mẫu UR/SSR, đối chiếu nguồn, hình thể, chi tiết, mức độ khỏe, độ rõ 64/128px và tính nhất quán trước khi sản xuất cả bộ.

Đầu ra `web/assets/linh-thu/ART.json` lưu prompt, generator/model, hash nguồn/pixel/đầu ra và phiên bản encoder. `web/assets/linh-thu/art.js` là registry sinh tự động cho UI; không sửa tay. Dạng chưa có bản mới dùng ảnh tham chiếu đã ghi rõ nguồn. UI ưu tiên ảnh hoàn mỹ khi luyện đầy chính xác 100%, rồi thức tỉnh khi luyện đầy từ 95%, rồi thường. Preview T1–T3, banner và triệu hồi T1 luôn dùng thường. Việc có file trong registry không đồng nghĩa người dùng đã nghiệm thu mỹ thuật.

## Sản xuất và chỉnh riêng sau

Raw/prompt/kết quả CLI ở `output/imagegen/catalog-v3`: `JOBS.json` cho T1–T4, `PURITY_JOBS.json` cho 95%/100%, `REUSED.json` cho mẫu đã có. Mỗi request có kết quả riêng; `IMPORT_CHECKS.json` lưu hash và lỗi cần xử lý. Mẫu tái sử dụng giữ hồ sơ gốc.

Nguồn v3 crop theo alpha, fit860px, đặt trên canvas1024px với neo đáy y=942 để không nhảy chân giữa các dạng. Raw giữ nguyên. Alpha dưới8 chuyển0, từ250 chuyển255, giữ mức trung gian; không tẩy nền theo màu giả định. Raw chạm mép hoặc không có alpha phải kiểm/tạo lại.

Để sửa riêng một ảnh: lưu nguồn mới có phiên bản, cập nhật đúng entry/prompt/provenance, tăng artVersion rồi dựng/kiểm lại. Không đổi species ID, cá thể, điểm luyện, xám, kỹ năng hoặc receipts. Có thể thay riêng 95%/100% mà không ảnh hưởng dữ liệu người dùng.
