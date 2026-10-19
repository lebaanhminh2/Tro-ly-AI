# Bộ ảnh tham chiếu linh thú

Đã lưu **72 ảnh WebP**, gồm **18 loài × 4 dạng** theo phân hạng của dự án: **2 UR, 4 SSR, 6 SR, 6 R**. Đây là ảnh từ nguồn cộng đồng để đối chiếu và nghiên cứu, chưa phải ảnh được vẽ lại.

## Xem nhanh

| Nhóm | Bảng ảnh | Số loài | Số ảnh nguồn |
| --- | --- | ---: | ---: |
| UR | [ur-evolutions.png](ur-evolutions.png) | 2 | 8 |
| SSR | [ssr-evolutions.png](ssr-evolutions.png) | 4 | 16 |
| SR | [sr-evolutions.png](sr-evolutions.png) | 6 | 24 |
| R | [r-evolutions.png](r-evolutions.png) | 6 | 24 |

## Nguồn và kiểm tra

- Kho: [kenzkunz/tatari-companion — MilkRoad · Clash of Critters companion](https://github.com/kenzkunz/tatari-companion).
- Commit cố định: [`771b7c760d7cf47e19c355aa865ed6a1d2beaebf`](https://github.com/kenzkunz/tatari-companion/tree/771b7c760d7cf47e19c355aa865ed6a1d2beaebf).
- Dữ liệu tên và dạng: [`dist/tatari-data/roster.json`](https://github.com/kenzkunz/tatari-companion/blob/771b7c760d7cf47e19c355aa865ed6a1d2beaebf/dist/tatari-data/roster.json), phiên bản `0.49.1`.
- Danh mục biến thể: [`dist/tatari-data/portrait-index.json`](https://github.com/kenzkunz/tatari-companion/blob/771b7c760d7cf47e19c355aa865ed6a1d2beaebf/dist/tatari-data/portrait-index.json).
- Ngày tải: **2026-10-19**.
- Tất cả 72 ảnh nguồn có kích thước **512 × 512**, kênh alpha trong suốt, một khung hình.
- [SOURCES.csv](SOURCES.csv): tên loài, rank dự án, dạng, URL nguồn, đường dẫn cục bộ, dung lượng, SHA-256 và commit nguồn cho từng ảnh.
- [REFERENCE_CATALOG.json](REFERENCE_CATALOG.json): tên, mã loài, thứ tự tiến hóa và mô tả từ nguồn; ghi rõ loài do người dùng chọn hoặc do trợ lý bổ sung.
- [IMAGE_CHECKS.json](IMAGE_CHECKS.json): kết quả đọc định dạng, kích thước, alpha và số khung hình của từng ảnh.

Các rank R/SR/SSR/UR ở đây là **phân hạng của dự án này**, không suy ra từ độ hiếm của game nguồn. Kho tải ảnh là kho cộng đồng, không gắn nhãn là kênh phát hành asset chính thức của nhà phát hành.

## Bốn R được bổ sung

| Loài | T1 → T4 | Căn cứ chọn |
| --- | --- | --- |
| Rùa đá | Gibber → Turtuff → Rockshell → Terraton | Có đủ bốn dạng, tạo nhóm hình thể thấp và nặng. |
| Hươu từ trường | Voltfawn → Sparkdoe → Zapantler → Magnedart | Có đủ bốn dạng, sừng nam châm đỏ–xanh tạo nhận diện riêng. |
| Thỏ tinh tú | Cheerling → Cheerlet → Cheerspring → Cheerstella | Có đủ bốn dạng, tai dài và ngôi sao bổ sung nhóm linh hoạt, sáng màu. |
| Nấm mộng | Funglet → Trippet → Hyphoria → Ecstamira | Có đủ bốn dạng, mũ nấm và tua tạo nhóm hình thể khác hẳn các thú hiện có. |

Humbug và Hootlet vẫn giữ hai suất R do người dùng đã chọn.

## Các đối chiếu cần giữ

- **Khỉ:** ảnh chụp người dùng ghi Rockong ở T3 và Rockwu ở T4, người dùng yêu cầu đảo lại. Nguồn mới đã có đúng Rockwu T3, Rockong T4; giữ thứ tự đã tải, không đảo thêm.
- **Mèo lửa:** ảnh chụp chỉ có ba dạng nhưng nguồn mới có T4 **Cinderclaw**. Ảnh T4 đã được lưu; có thể dùng làm cơ sở nâng cấp mỹ thuật. Blazereign là tên ý tưởng trước đó, chưa thay tên nguồn.
- **Dagondeep:** nguồn mới phân biệt `appearance-default` và `appearance-color_1`; bộ này lưu `appearance-default`. Chú thích “glitch” trên ảnh chụp được giữ trong hồ sơ tham chiếu, không tự biến thành tên biến thể hoàn mỹ của dự án.
- Bốn bảng PNG là ảnh ghép để duyệt: cắt phần trong suốt thừa và thay đổi kích thước hiển thị, giữ nguyên nội dung nhân vật. 72 WebP nguồn được lưu nguyên byte.

Xem [hồ sơ loài](../../../LINH_THU_REFERENCES.md) và [định hướng vẽ lại](../../../LINH_THU_ART_DIRECTION.md).
