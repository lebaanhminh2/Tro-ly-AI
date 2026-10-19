# Tiến độ mỹ thuật Linh thú

Cập nhật 19/10/2026, Asia/Saigon. Người dùng đã duyệt bản hiện tại và cho phép phát hành staging; [đã phát hành](LINH_THU_RELEASE.md). Ưu tiên T1–T4 chắc, đúng loài và rõ hình. 95%/100% được dùng tạm và có thể sửa từng con sau; không suy thành duyệt thị giác cuối từng ảnh.

Stormlion T4 thường/95%/100% đã được duyệt cụ thể và tiếp tục là chuẩn nét vẽ. Pyrodaemon v5 dùng tạm. Bộ SSR v1 và các bản độ thuần UR v2/v3/v4 cũ đã bị loại, không đưa lại vào sản phẩm.

## Bộ đã tích hợp

- Nguồn đã chuẩn hóa: **72/72 thường, 18/18 thức tỉnh, 18/18 hoàn mỹ**.
- Runtime tại lần dựng gần nhất: 72/72 thường, 18/18 thức tỉnh, 18/18 hoàn mỹ.
- Nguồn: docs/assets/linh-thu/art/v3. Raw và prompt: output/imagegen/catalog-v3; các mẫu tái sử dụng giữ hồ sơ gốc.
- Kiểm alpha/hash: output/imagegen/catalog-v3/IMPORT_CHECKS.json; jobs và kết quả ghi riêng, không giả ảnh khi dịch vụ lỗi.
- Mọi bản mới ngoài Stormlion ghi dùng tạm/đã cho phép sản xuất; không tự ghi người dùng đã duyệt thị giác từng ảnh.
- T1–T4 theo thứ tự UR → SSR → SR → R. Rockwu T3 → Rockong T4; Flameow T4 là Cinderclaw.
- Nguồn CLI ghi imagegen_cli_cockpit cùng model thực tế; không gắn nhãn image_gen.

## Từng loài

| Rank | Loài | T1–T4 | 95% | 100% |
| --- | --- | --- | --- | --- |
| UR | Pyropup | 4/4 | Có ảnh | Có ảnh |
| UR | Rubblet | 4/4 | Có ảnh | Có ảnh |
| SSR | Frostnip | 4/4 | Có ảnh | Có ảnh |
| SSR | Zappur | 4/4 | Có ảnh | Có ảnh |
| SSR | Skinklet | 4/4 | Có ảnh | Có ảnh |
| SSR | Punchimp | 4/4 | Có ảnh | Có ảnh |
| SR | Shardsnail | 4/4 | Có ảnh | Có ảnh |
| SR | Flameow | 4/4 | Có ảnh | Có ảnh |
| SR | Manteeny | 4/4 | Có ảnh | Có ảnh |
| SR | Fluffle | 4/4 | Có ảnh | Có ảnh |
| SR | Maskfry | 4/4 | Có ảnh | Có ảnh |
| SR | Goonbug | 4/4 | Có ảnh | Có ảnh |
| R | Humbug | 4/4 | Có ảnh | Có ảnh |
| R | Hootlet | 4/4 | Có ảnh | Có ảnh |
| R | Gibber | 4/4 | Có ảnh | Có ảnh |
| R | Voltfawn | 4/4 | Có ảnh | Có ảnh |
| R | Cheerling | 4/4 | Có ảnh | Có ảnh |
| R | Funglet | 4/4 | Có ảnh | Có ảnh |

## Kiểm tra và bàn giao

1. Đã xem các chuỗi T1–T4, đối chiếu hình thể và dạng với nguồn; giữ đúng Rockwu T3 → Rockong T4.
2. Đã xem bảng 64/128px trên nền sáng/tối; 95% khác nhẹ, một số 100% còn gần T4 như Rockong, giữ dùng tạm theo yêu cầu.
3. Đã dựng WebP 512/128px. `node scripts/build-linh-thu-assets.ts --require-complete` đạt 72 +18 +18; import kiểm 108 ảnh không có lỗi alpha/hash/lề.
4. Browser catalog tải 108 ảnh thật qua phân trang và chi tiết; ảnh chụp review ở `trial-results/linh-thu/art-v3`. Kết quả hồi quy cuối nằm trong [hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md).
5. [Xem toàn bộ ảnh](../output/imagegen/catalog-v3/index.html). Có thể thay riêng mỗi ảnh sau, không đổi cá thể/điểm/xám/kỹ năng. Bản hiện tại đã phát hành staging và áp migration 0041 sau xác nhận riêng; [bằng chứng](LINH_THU_RELEASE.md).

[Quyết định và lịch sử](LINH_THU_ART_APPROVALS.md) · [Hồ sơ kiểm tra](LINH_THU_ACCEPTANCE.md) · [Tiến độ toàn hệ thống](LINH_THU_IMPLEMENTATION.md)
