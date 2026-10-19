# Review giao diện Linh thú

Mở [index.html](index.html) trực tiếp trong trình duyệt. Đây là trang chọn **ảnh chụp UI đã chạy**, không phải ứng dụng tương tác hoặc công cụ cấp thú/vé. Có tám màn để xem nhanh; thư mục giữ thêm ảnh nhận quà tháp từ bài production API/D1.

- [108 ảnh linh thú](../imagegen/catalog-v3/index.html): đủ T1–T4, 95% và100%, lọc rank/nền.
- [Hồ sơ nghiệm thu](../../docs/LINH_THU_ACCEPTANCE.md): cách chạy ứng dụng, các kiểm tra, scope và giới hạn.
- [Đối chiếu goal](../../docs/LINH_THU_GOAL_AUDIT.md): bằng chứng theo từng nhóm yêu cầu và kết luận nghiệm thu.
- [Ứng dụng staging](https://personal-assistant-staging.telegram-assistant-ai-trial.workers.dev/app/) · [Hồ sơ phát hành](../../docs/LINH_THU_RELEASE.md) · [STAGING_RELEASE.json](STAGING_RELEASE.json).
- [PROVENANCE.json](PROVENANCE.json): nguồn và hash chín screenshot.

Ảnh Đang luyện/Đồng hành/Bộ sưu tập/Triệu hồi/Lò đan lấy từ `node scripts/benchmark-linh-thu-web.mjs --capture`: web modules và art runtime thật, API fixture, kho2.400cá thể, không ghi dữ liệu sản phẩm. Ảnh `live-*` lấy từ `LINH_THU_CAPTURE=1` cùng bài `tests/browser/linh-thu-live.test.mjs`, đi qua production API và D1 tạm. Ảnh tháp đang chọn dùng UI thật với `beastFixture`, không lộ vị trí bẫy từ API.

Ảnh tuyệt kỹ chụp trước khi báo ngủ, còn3lượt; bài test sau đó xác nhận còn2lượt. Không ghép screenshot thành bằng chứng cho backend hoặc gọi trạng thái fixture là tiến trình tài khoản thật.

Đã kiểm trang review trong Chrome ở390/1440px, các nút chọn, giải mã tám ảnh, không tràn ngang mobile hoặc lỗi JS; đã xem render thực. Người dùng đã duyệt bản hiện tại và phát hành staging ngày19/10/2026; 0041 đã áp,402 file web khớp hash, tám API chưa đăng nhập trả401. QA trên staging không ghi tài khoản thật. 95%/100% vẫn dùng tạm theo quyết định đã chốt.
