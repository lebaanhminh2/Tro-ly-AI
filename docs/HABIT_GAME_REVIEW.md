# Habit và Vô Danh — Thần Lộ: rà soát và bàn giao lập kế hoạch

Ngày: 2026-10-12. Source khảo sát: commit `51f5ffd`, nhánh `review/p1-p3`.
Trạng thái: luật đã trao đổi và rà soát sản phẩm; AI hoàn thiện đặc tả trong phiên /goal theo cách làm mới ở IMPLEMENTATION. Chưa triển khai habit/game.
Nguồn nghiệp vụ: [HABIT_GAME_BUSINESS_DRAFT.md](HABIT_GAME_BUSINESS_DRAFT.md), bản sao UTF-8 giữ nguyên nội dung file `D:/Download/VO_DAN_THAN_LO_TAI_LIEU_NGHIEP_VU_MO.md`.
Giao việc cho coding agent từ [HABIT_GAME_IMPLEMENTATION.md](HABIT_GAME_IMPLEMENTATION.md); bản nguồn là nháp, ưu tiên quyết định mới nhất của chủ sản phẩm.
Không thực hiện thay đổi code, migration hoặc triển khai cloud trong lượt rà soát này.

## 1. Điều chủ sản phẩm vừa xác nhận

- Habit có thêm/sửa/xóa, theo dõi lịch sử, lịch lặp tùy chỉnh; dự kiến dùng khoảng 5–6 habit.
- Habit có danh sách riêng; tùy chọn đặt giờ hoặc đưa vào kế hoạch ngày khi cần.
- Bản đầu gồm habit + luyện công pháp + một phái đầy đủ (bốn môn thường/một trấn phái) + chương mở đầu 3–5 boss, nhân vật nguyên bản và hình ảnh hoàn thiện.
- Habit hỗ trợ cả tick và số lượng/thời lượng tự nhập.
- Lịch lặp bản đầu gồm hằng ngày, chọn các thứ trong tuần, hoặc X lần mỗi tuần. Cách kỳ tuần đóng góp vào game theo ngày còn cần chốt.
- Habit định lượng chỉ có đóng góp luyện/chiến khi đạt đủ mục tiêu: 15/20 phút đóng góp 0%, không quy đổi thành 75%. Phần đã làm vẫn được lưu để theo dõi.
- Chỉ ghi và sửa bản ghi trong ngày sinh hoạt hiện tại; ngày cũ chỉ xem, không ghi bù hoặc sửa. Quy tắc này áp dụng nhất quán trên web/bot/LLM.
- Không miễn trừ tinh thuần do ốm/nghỉ phép: có cam kết đến hạn mà không làm vẫn ảnh hưởng chất lượng. Ngày vốn không đến lịch khác với ngày có cam kết nhưng bỏ lỡ.
- Với X ngày/tuần, thống nhất hướng linh hoạt: đạt ngày nào tính đóng góp ngày đó; ngày chưa làm còn đủ cơ hội là trung tính; chỉ ghi thiếu mới khi số ngày còn lại không đủ để hoàn thành cam kết. Không phạt lại phần thiếu cũ. Các chi tiết còn mở nêu tại mục 11.
- Đổi Tu Luyện/Xuất Chiến có hiệu lực từ ngày sinh hoạt kế tiếp; được chuẩn bị trận ngay.
- Giữ cơ chế tinh thuần nghiêm của tài liệu, kể cả khuyết điểm tích lũy mạnh: khóa chất lượng từng tầng, tầng sau không xóa lỗi tầng trước, muốn cải thiện phải luyện lại từ tầng 1 và giữ bản cũ.
- UI gọn, dễ đọc trên điện thoại, ít màu mè. Không đổi các thẻ hiện tại khi không cần.
- Yêu cầu mới nhất: AI tự thiết kế, tạo nhân vật/hình ảnh, triển khai và tự kiểm tra đến bản nghiệm thu cuối. Quy trình ủy quyền /goal thay duyệt từng file được mô tả ở mục 0 và 10 của IMPLEMENTATION.
- Đã chốt ngân sách bổ sung 0đ, được tự commit/push/migration/deploy staging. Hình ảnh do AI tự thiết kế theo phong cách tiên hiệp trầm/đồng nhất và thiết lập model sinh ảnh cục bộ khi chạy goal; chưa thiết lập/chưa sinh ảnh ở phiên chuẩn bị.

## 2. Đối chiếu với hệ thống thật

| Nội dung | Bằng chứng source | Hệ quả cho thiết kế |
| --- | --- | --- |
| Task thưởng vé quay khi hoàn thành hợp lệ lần đầu | `src/adapters/d1/task-hierarchy-store.ts`, `HealthyStore.awardTask` | Tài liệu nói task trực tiếp sinh Tu Vi chưa khớp. Giữ kinh tế hiện có; thưởng Tu Vi trực tiếp phải duyệt riêng. |
| `qi`, `earned`, `rank`, `highestRank` là các trường riêng | `src/domain/healthy.ts` | Không cần viết lại Cảnh giới để hỗ trợ hạ bậc mà giữ Tu Vi; vẫn phải chốt luật tái đột phá. |
| Đột phá tăng `rank` khi thành công, không tự tăng theo `qi` | `breakthrough` trong `healthy.ts` | Nghịch Mệnh không tự gây bật lại bậc ngay; khả năng đột phá lại quá sớm là vấn đề nghiệp vụ cần quyết định. |
| Chưa có habit domain/store/log | `src/domain`, `src/adapters/d1`, migrations hiện tại | Habit là năng lực mới; không đổi tên reminder/task rồi coi đã có habit. |
| Recurrence lưu trạng thái gửi lời nhắc | `src/domain/recurrence.ts`, `src/adapters/d1/recurrence-store.ts` | `sent`, `missed`, `skipped_rest` không chứng minh habit đã làm hoặc bỏ lỡ. |
| Có phút làm task do người dùng tự nhập | `DayPlanStore.logWork` trong `day-plan-store.ts` | Sửa mô tả “chỉ có tick”: có work log, nhưng không phải dữ liệu thời gian được đo xác thực. |
| Ngày sinh hoạt có mốc bắt đầu tùy chỉnh; điểm danh theo ngày lịch Việt Nam | `operatingDay`, `dayWindow`, `dailyCheckinProgress` | Habit/game cần chỉ rõ kỳ ghi nhận. Không ép toàn hệ hiện có về một ngày UTC hoặc đổi ngày điểm danh. |
| Ngủ có hoàn tác 5 phút và kiểm tra trạng thái trước/sau | `ScheduleStore.reportSleep/undoSleep`, `undoSleepAssessment` | Không kết toán trận ngay khi báo ngủ; phải xem ảnh hưởng nếu habit liên kết ngủ và người dùng hoàn tác. |
| Healthy mutation có receipt/version guard, state JSON giới hạn 12 KB | `src/adapters/d1/healthy-store.ts` | Tận dụng nguyên tắc chống lặp, không nhét toàn bộ bản luyện, lịch sử và trận vào account JSON. |
| Cron chia 4 pha, giới hạn lượng việc mỗi lượt | `src/entrypoints/worker-scheduler.ts` | Kết toán game cần xử lý có giới hạn và chịu được chạy muộn/lặp; không thêm mọi boss/log vào bootstrap hoặc cron. |

Một số docs hiện tại mô tả luật/phát hành cũ. Agent phải đối chiếu source và migration trước khi dùng làm baseline.

## 3. Nên giữ trong ý tưởng

- Habit luyện công pháp; task tiếp tục giữ phần thưởng gốc. Đây là hai động lực khác nhau.
- Một môn đang luyện; bộ tối đa năm môn trong trận; mỗi ngày một lựa chọn chiến đấu.
- Người đánh trước; boss đã chết không phản công, trừ hồi sinh đã được giới thiệu rõ.
- Trận kéo dài vài ngày; sưu tập và luyện tạo mục tiêu dài hạn. Không kéo dài bằng HP khổng lồ.
- Quyền sở hữu bí tịch khác với đã luyện thành công pháp. Boss nên thể hiện tuyệt học trước khi trao quyền học.
- Công pháp thường có giá trị độc lập; bộ thuần phái và bộ pha trộn đều cần đường thắng.
- Nghỉ hợp lệ không làm nhân vật tự chết; rút lui và thất bại hết thời hạn khác tử trận.

## 4. Luật đã chốt và đề xuất cần hoàn thiện

### Habit có giá trị kể cả khi không chơi

- Mỗi habit có mục tiêu, lịch lặp, kỳ ghi nhận và lịch sử. Tách mục tiêu “20 phút” khỏi giờ nhắc “21:00”.
- Hoàn thành, làm một phần, chưa làm, nghỉ theo lịch, tạm nghỉ và chưa có dữ liệu phải phân biệt được.
- Chủ sản phẩm không chọn cơ chế tạm nghỉ miễn trừ tinh thuần khi ốm/nghỉ phép. Không tự thêm miễn trừ này; khả năng quản lý vòng đời habit không được xóa cam kết đã phát sinh.
- Báo cáo chính: thực hiện/đã cam kết, xu hướng tuần, quay lại sau gián đoạn; streak là thông tin phụ.
- Ngày không đến lịch không vào mẫu số. “3 lần/tuần” cần kỳ tuần riêng; không tự biến thành bảy nghĩa vụ mỗi ngày.
- Đã chốt chỉ ghi/sửa trong ngày sinh hoạt hiện tại; không mở ngoại lệ sửa ngày cũ nếu cron kết toán muộn. Server xác định ngày, không tin ngày tùy ý do client gửi.
- Quy tắc chỉ đọc ngày cũ áp dụng cho bản ghi habit; không tự thay đổi quyền sửa task hoặc các cơ chế hoàn tác hiện có.
- Đã chốt ngưỡng đóng góp: chưa đủ mục tiêu thì 0%; vẫn hiển thị phần thực hiện như 15/20 để theo dõi. Mức đóng góp khi đạt hoặc vượt mục tiêu, số lần được tính mỗi ngày/tuần và trọng số giữa các habit cần đặc tả riêng.
- Đổi lịch/target chủ yếu có hiệu lực kỳ sau; xóa habit không xóa các đóng góp và thành tựu đã chốt.
- Habit vừa tạo không nên lập tức nâng hệ số tốc độ. Không dùng LLM để phán xét habit thật/giả.
- Có nhiều habit không mặc định nghĩa là nỗ lực nhiều hơn: tăng tốc có trần và lợi ích giảm dần; mốc chưa chốt.
- Tách lịch cam kết, giờ nhắc và chỗ trong kế hoạch: đổi giờ nhắc không tự đổi mục tiêu hoặc tạo bản ghi hoàn thành.

### Tinh thuần nghiêm — quyết định mới nhất của chủ sản phẩm

- Chủ sản phẩm đã chọn giữ mức nghiêm trong tài liệu. Rút đề xuất tổng hợp nhẹ hơn bằng trung bình và tầng thấp nhất; agent không tự làm mềm cơ chế này.
- Tiến độ và chất lượng là hai chỉ số riêng. Hoàn thành một tầng khóa chất lượng của tầng đó; tầng sau hoàn hảo không sửa khuyết điểm tầng trước.
- Muốn cải thiện phẩm chất phải luyện lại từ tầng 1 thành một bản mới; bảo toàn bản cũ, không sửa tầng lẻ, không cộng dồn chỉ số các bản.
- Công thức lan truyền cụ thể vẫn chưa chốt: tài liệu cho phép phép nhân hoặc cách suy giảm khác. Giữ cơ chế nghiêm không đồng nghĩa chủ sản phẩm đã duyệt một công thức cụ thể.
- Đã chốt làm một phần không có đóng góp game: 15/20 phút tính 0% cho habit đó. Đây không phải mức đóng góp của toàn ngày và không xóa sức mạnh nền của công pháp/Cảnh giới. AI cụ thể hóa trọng số habit và cách tổng hợp trong đặc tả P0.
- Đề xuất UI: xem trước tinh thuần, giải thích ngày nào ảnh hưởng, phân biệt chưa chốt/đã khóa; bản luyện cũ vẫn dùng được. AI chọn và kiểm chứng cách chọn bản mặc định.

### Thời gian và trạng thái game

- Đã chốt đổi Tu Luyện/Xuất Chiến từ ngày sinh hoạt kế tiếp; có thể chuẩn bị boss và bộ chiêu ngay.
- Chế độ của mỗi ngày sinh hoạt được giữ cố định. Ví dụ đặt Xuất Chiến giữa ngày D: habit của D vẫn đóng góp vào Tu Luyện; ngày D+1 mới đóng góp vào chiến đấu. Đổi ngược áp dụng cùng nguyên tắc.
- Kết toán ngày D dùng chế độ và dữ liệu của D, kể cả cron chạy sau khi D+1 đã bắt đầu. Thắng/rút/kết thúc trận không cho tái sử dụng đóng góp của D để luyện.
- `/ngu` thay trạng thái nghỉ hiện có, không tự chốt toàn bộ habit hoặc ra đòn boss; ngày sinh hoạt vẫn kết thúc ở mốc đã định.
- Kết toán dựa trên kỳ đã đóng, không dựa trên lần cron vừa chạy. Lưu intent, lựa chọn, đóng góp và kết quả của kỳ đó.
- Nếu trong ngày sửa số lượng từ đủ xuống chưa đủ, kết toán phải dùng bản ghi cuối hợp lệ; không giữ tiến độ/damage từ lần đạt mục tiêu trước. Phản hồi ngay trên UI là dự báo có thể đổi, không thưởng đã khóa.
- Habit không đến lịch là trung tính cho luyện; trong trận phải có mức uy lực nền, tránh ngày nghỉ định sẵn thành ngày bị đánh oan.
- Chưa chọn chiêu hoặc vắng app không được tự chọn một cấm thuật có giá. Đề xuất tạm chờ, rồi tự rút an toàn sau giới hạn sẽ chốt.
- Hộ Mệnh và Nghịch Mệnh dùng chung quyền cứu mạng. Chốt tiếp chuỗi hit hay kết thúc lượt trước khi implement hồi sinh.
- Phân biệt ngày vốn không có lịch với ngày có cam kết nhưng bỏ lỡ; ốm/nghỉ phép không miễn trừ tinh thuần theo quyết định mới nhất. Việc tạm dừng luyện khi Xuất Chiến và an toàn khi vắng app trong trận là các luật riêng, không tự sửa chúng bằng quyết định này.

### Tương tác với tiến trình hiện có

- Đề xuất giữ task → vé quay. Trong trận, task có đóng góp phụ với trần; habit là nguồn chính.
- Không trả chiến lực theo mỗi lần tick/untick hoặc mỗi task con. Cần nguồn đóng góp có định danh và quy tắc sửa trước chốt.
- Không lấy số phút dự kiến tự nhập làm bằng chứng nỗ lực thực. Snapshot giúp ổn định cam kết, không xác thực đời thực.
- Cảnh giới tăng/giảm giữa trận: đề xuất chốt chỉ số nền khi bắt đầu trận; chỉ đổi giữa trận qua cơ chế đã công bố. Cần chốt quan hệ với đột phá và phạt ngủ.
- Nghịch Mệnh giữ `qi`/`earned`/kỷ lục; hạ `rank` thật hay chỉ sức mạnh trong trận, luật tái đột phá và miễn hạ bậc 72 giờ còn phải quyết định.
- Không tự cho Hộ Tâm Phù/An Tâm Phù thành vật phẩm cứu mạng boss. Không thêm currency hay thưởng vé habit vô hạn.
- Lỗi người dùng báo: đã bấm ngủ mà vẫn nhận nhắc ngủ chưa được điều tra nguyên nhân ở lượt này. Đưa vào kiểm tra nền trước phát hành game.

## 5. UI đề xuất

- Màn habit riêng quản lý mục tiêu/lịch và xem lịch sử; Hôm nay chỉ hiện nhóm nhỏ các habit đến lịch.
- Giờ nhắc là tùy chọn. Habit được đưa vào lịch phải chiếm thời gian thật trong capacity; không tạo task bản sao và thưởng hai lần.
- Đặt giờ cố định có thể tích hợp qua nguyên tắc khoảng bận hiện có. Tự động xếp habit chưa chốt; không tự hứa chỉ cần đổi UI là có.
- Tu Tiên là màn riêng, có đường vào từ Thành tích; không nhồi Tàng Kinh Các, boss và mọi chỉ số vào trang task.
- Khi luyện, ưu tiên một công pháp và tiến độ hiện tại. Khi chiến, ưu tiên ý định boss, HP và một quyết định chọn chiêu.
- Ghi nhận habit có phản hồi tiến độ ngay; kết quả chiến đấu chính thức theo kỳ đã khóa. UI phân biệt rõ dự báo với kết quả, tránh phải chờ sang hôm sau mới thấy việc vừa làm có giá trị.
- Với habit định lượng, hiển thị phần thực hiện và nhãn chưa đạt/đã đạt. Chưa đạt không làm tăng dự báo đóng góp game; không đổi 15/20 thành đã hoàn thành bằng nút tick.
- Lịch sử ngày cũ hiển thị để xem, không có nút sửa/ghi bù; ngày sinh hoạt được giải thích bằng mốc bắt đầu/kết thúc hiện tại khi cần.
- Chưa có habit vẫn dùng task, Tu Vi và nhập môn qua Võ Kỹ Cơ Bản; không ép người dùng thiết lập mọi habit trước khi xem tính năng.
- Nội dung lore/công pháp dài mở theo nhu cầu. Làm bản xem thử màn hình nhỏ trước khi thay điều hướng.

## 6. Lộ trình cho coding agent

| Bước | Kết quả phải có | Điều kiện để tiếp tục |
| --- | --- | --- |
| 0. Chốt nền | Baseline source/schema, quyết định kinh tế/ngày nghiệp vụ, kiểm tra lỗi ngủ được báo; sơ đồ UI | AI hoàn thiện đặc tả và tự review trong phạm vi /goal được user giao. Không áp tài liệu nháp thành luật đã chốt. |
| 1. Habit | CRUD, lịch lặp, bản ghi, tạm nghỉ/lưu trữ, sửa sai, lịch sử; danh sách hôm nay và nhắc tùy chọn | Người dùng dùng được khoảng 5–6 habit; ngày nghỉ/qua đêm/đổi lịch không tính sai. |
| 2. Luyện | Một bí tịch khởi đầu, một bản đang luyện, tiến độ/tinh thuần, dùng được ở Nhập môn; giữ lịch sử bản cũ | Một habit vẫn tiến được và đạt 100%; ngày bỏ lỡ và ngày không đến lịch được xử lý đúng. |
| 3. Trận mẫu | Võ Kỹ Cơ Bản, một boss nhiều ngày, ít nhất vài lựa chọn công/thủ khác nhau; thắng/thua/rút, log và thưởng mở bí tịch | Lựa chọn thật sự đổi kết quả, không chỉ tăng một thanh HP. Có preview, không ra đòn trùng. |
| 4. Kiểm chứng | Chơi thử với nhịp đời sống thấp/vừa/cao; dữ liệu ít habit, 60–80% cam kết, vài ngày nghỉ | Thắng được bằng lối chơi hợp lý, không đòi hoàn thành 100% mọi ngày hoặc mở app liên tục. |
| 5. Mở nội dung | Hoàn thiện một phái với bốn môn/trấn phái và thêm boss đối lập; sau đó nhân rộng | Chứng minh thuần phái và pha trộn đều có đường thắng; không có chiêu thống trị mọi trận. |
| 6. Hệ nâng cao | Hộ Mệnh có giá thật, Nghịch Mệnh, Ngoại Đạo, cấm thuật, thần binh và chương tiếp | AI chốt quy tắc tổn thất/tái đột phá trong phạm vi được giao; giao dịch tài khoản và hiệu ứng qua ngày có kiểm chứng. |

Phạm vi thử nghiệm của bước 3 có thể là tỷ thí không mất Tu Vi, rồi bổ sung trận nguy hiểm sau. AI tự chọn nhịp onboarding phù hợp, không hủy cơ chế tử trận dài hạn thuộc phạm vi phải giao.
AI tự chia các bước; lượng nội dung cuối phải đúng phạm vi user chốt trong IMPLEMENTATION. Bản thử nhỏ không được coi là đã hoàn thành toàn bộ game nếu user chọn đủ 39 công pháp/15 chương.

## 7. Ranh giới kỹ thuật nên giao agent

- Giữ TypeScript/Workers/D1 hiện tại; tách quy tắc habit, luyện và chiến đấu vào domain riêng.
- Lưu habit, kỳ cam kết, bản ghi, bản luyện, trận/lượt và receipt riêng; không mở rộng vô hạn JSON tài khoản.
- Một nguồn đóng góp chỉ có một nơi hưởng trong một kỳ; retry, hai tab và cron đồng thời không nhân tiến độ/damage/thưởng.
- Phần thưởng/tổn thất liên quan tài khoản phải commit nguyên tử cùng kết quả trận, có version guard và receipt phù hợp.
- Log game có rule/content version để giải thích kết quả cũ khi cân bằng mới được phát hành.
- Nội dung công pháp/boss khai báo bằng dữ liệu với nhóm hiệu ứng hữu hạn. Không làm engine script tùy ý cho 39 môn ngay.
- LLM hỗ trợ diễn giải/lore và trợ lý; không chọn damage, quyết định hoàn thành habit, roll thưởng hoặc trả giá cứu mạng.
- Bootstrap trả tổng quan giới hạn; catalog/lịch sử tải khi mở. Kết toán không phụ thuộc LLM đang sẵn sàng.
- Habit nhắc chủ động phải có phạm vi nghỉ được chốt; không làm sai luật `/ngu`, focus và lời nhắc riêng hiện tại.
- Migration bổ sung, không sửa migration lịch sử; feature có thể tắt mà task/ngủ/đột phá hiện tại vẫn dùng được.

## 8. Trường hợp nghiệm thu quan trọng

- Habit mới/đổi lịch/xóa giữa kỳ; qua đêm; đổi giờ sinh hoạt; nghỉ đúng lịch; mục tiêu tuần.
- Sửa số lượng và tick lại không nhân thưởng; không đồng nhất gửi/đọc nhắc với đã làm.
- 15/20 chưa đóng góp; đạt mục tiêu mới đóng góp; sửa từ đạt xuống chưa đạt trong cùng ngày rút dự báo tương ứng. Lặp thao tác đạt mục tiêu không nhân tiến độ.
- Ngày đã đóng không cho ghi/sửa qua API, web, bot hoặc LLM; cron chưa chạy không tạo cửa sổ ghi bù. Thay giờ sinh hoạt không được tự mở lại kỳ đã khóa.
- Một nguồn không vừa luyện vừa đánh; kết toán muộn/lặp vẫn đúng kỳ; ngày không habit không bị trừ tinh thuần.
- Chưa chọn chiêu, nghỉ, hết thời hạn, rút trước chốt và HP 0 sau chốt là các kết quả khác nhau.
- Giết boss trước phản công; giáp xử lý từng hit; echo không sinh echo; dấu ấn không nhân khi lặp chiêu.
- Thuần phái thủ vẫn đủ công để thắng; cấm thuật không vượt mọi boss; không cân trên giả định 100% cam kết.
- Ngủ sớm bằng web/bot, hoàn tác, đột phá và trận cùng kỳ không làm sai ledger; nhắc riêng vẫn theo lịch.
- Dữ liệu người dùng cũ giữ nguyên; owner/auth đúng; refresh lỗi không làm game tự chạy thêm lượt.
- Chạy các gate hiện có: typecheck, check:web, test:all; browser cho flow mới; staging:check trước phát hành.

## 9. Quyết định còn mở

- Đã trả lời: hỗ trợ tick và số lượng/thời lượng; đổi chế độ từ ngày sinh hoạt kế tiếp; giữ tinh thuần nghiêm, khuyết điểm tích lũy và luyện lại từ tầng 1.
- Đã trả lời thêm: lịch hằng ngày/chọn thứ/X lần mỗi tuần; phải đủ mục tiêu mới đóng góp; chỉ ghi/sửa ngày sinh hoạt hiện tại, ngày cũ chỉ xem.
- Đã trả lời thêm: không miễn trừ tinh thuần do ốm/nghỉ phép nếu có cam kết mà không làm. Chủ sản phẩm đề xuất lịch tuần linh hoạt và ghi thiếu dần khi không còn đủ ngày để hoàn thành; không cần chờ cuối tuần mới ghi mọi phần thiếu.
- Cần chốt trước luật tính tinh thuần: công thức lan truyền, trọng số habit, kỳ tuần đóng góp vào ngày game và khóa tầng thế nào.
- Trước bước 3: lúc khóa lựa chọn/đóng góp, quyền nghỉ, xử lý ngày không có habit, chiến lực nền và trần task.
- Trước trận nguy hiểm: giá tử trận/Hộ Mệnh, chuỗi hit sau hồi sinh, hạ bậc/tái đột phá, quan hệ với miễn hạ 72 giờ.
- Khi mở rộng nội dung: hệ số tăng tốc, thời gian mỗi tầng, giới hạn trấn phái/cấm thuật và lịch mở truyện.
- Tài liệu có cả mốc khoảng hai tuần và 14–17 ngày cho boss cao: chọn một giới hạn rõ trước khi viết nội dung loại boss này.

### Vùng code dự kiến để agent khảo sát và lập kế hoạch

Đây là chỉ dẫn khảo sát. Phạm vi tự sửa code khi user phát /goal được xác định trong IMPLEMENTATION và chỉ dẫn user mới nhất:

- Domain mới cho habit, luyện và kết toán trận; giữ quy tắc thuần để mô phỏng nhịp sống và combo trước khi thêm nhiều nội dung.
- Store D1 và migration bổ sung cho các dữ liệu mới; tham khảo receipt/version guard của `src/adapters/d1/healthy-store.ts`.
- Application/API và `src/ai/contracts.ts`: công cụ habit cần quyền và kiểm tra đầu vào tương đương web; LLM không tự chốt kết quả game.
- `src/entrypoints/worker-scheduler.ts`: kết toán có giới hạn; không phá đường gửi lời nhắc riêng hiện tại.
- `web/views/today.js`, `web/views/achievements.js`, điều hướng trong `web/app.js`, UI habit/game riêng và `web/styles.css`: trình bố cục mobile trước khi sửa.
- `src/adapters/d1/day-plan-store.ts` chỉ cần khảo sát tích hợp nếu thực hiện đưa habit vào lịch; không sao chép habit thành task để tận dụng thưởng.
- Test mới tập trung vào kỳ ghi nhận, sửa bản ghi, kết toán trùng, tương tác ngủ và lựa chọn chiến đấu; không tạo test chỉ sao chép công thức.

## 10. Prompt giao cho coding agent sau khi chốt

Prompt khởi động, kiến trúc, phần việc và tiêu chí nghiệm thu được sở hữu tại [HABIT_GAME_IMPLEMENTATION.md](HABIT_GAME_IMPLEMENTATION.md), mục 10. Dùng prompt đó để tránh nhiều bản hướng dẫn lệch nhau.

Không miễn trừ tinh thuần do ốm/nghỉ phép nếu có cam kết mà không làm. Hướng lịch tuần linh hoạt đã được trao đổi ở mục 11; các giới hạn, trọng số và công thức tinh thuần còn mở do AI cụ thể hóa, ghi đặc tả và tự kiểm chứng trong phạm vi /goal, giữ mức nghiêm đã chốt.

## 11. Lịch tuần linh hoạt, ghi thiếu khi không còn đủ cơ hội

Chủ sản phẩm đề xuất: cam kết 3 ngày/tuần, làm ngày đầu thì được tính; ngày 2–5 chưa làm vẫn không bị ghi thiếu; hết ngày 6 chưa làm thì thiếu một ngày, hết ngày 7 tiếp tục chưa làm thì thiếu thêm một ngày. Thay hướng đề xuất trước đó phải đợi cuối tuần để ghi mọi phần thiếu.

### Chuẩn hóa cách xử lý

- Habit định lượng có mục tiêu cho một ngày đạt, ví dụ tập đủ 30 phút; 20/30 phút chưa đạt và không đóng góp.
- Mỗi ngày chỉ được tính một ngày đạt. Đề xuất chỉ X ngày đạt đầu tiên trong tuần được cộng đóng góp; vượt cam kết vẫn lưu lịch sử nhưng không nhân thưởng. AI quyết định giới hạn này trong P0 và kiểm chứng không tạo kẽ hở farm.
- Ngày đạt được cộng vào đúng ngày sinh hoạt đó theo chế độ của ngày; không tính cả luyện và đánh.
- Ngày chưa đạt nhưng còn đủ cơ hội hoàn thành tuần là trung tính: không cộng tiến độ/uy lực, không ghi thiếu, không tính là đã làm và không đưa vào mẫu số tinh thuần như một thành công giả.
- Chỉ ghi thiếu mới khi ngày sinh hoạt kết thúc. Trước đó người dùng vẫn có thể thực hiện hoặc sửa bản ghi hiện tại; cảnh báo sắp thiếu khác với thiếu đã chốt.
- Không miễn trừ do ốm/nghỉ phép; không mở lại ngày cũ; không sửa tầng hoặc trận đã khóa.

### Công thức đề xuất

Sau khi khóa ngày d, đặt:

- Q: số ngày đã cam kết trong tuần.
- C: số ngày đã đạt được tính đến hết d, giới hạn tối đa Q.
- R: số ngày sinh hoạt còn lại sau d, chưa bao gồm ngày d.
- Thiếu chắc chắn lũy kế: `max(0, Q - C - R)`.
- Thiếu mới hôm nay: thiếu lũy kế hôm nay trừ thiếu lũy kế đã ghi hôm trước. Chỉ ghi phần mới, không phạt lại toàn bộ thiếu lũy kế.

Ví dụ Q=3, chỉ ngày 1 đạt:

| Hết ngày | Đã đạt | Ngày còn lại | Thiếu lũy kế | Thiếu mới |
| --- | --- | --- | --- | --- |
| 1 | 1 | 6 | 0 | 0 |
| 5 | 1 | 2 | 0 | 0 |
| 6 | 1 | 1 | 1 | 1 |
| 7, tiếp tục không đạt | 1 | 0 | 2 | 1 |

Nếu ngày 7 đạt thì C=2, thiếu lũy kế vẫn 1: được tính ngày đạt hôm đó, không thiếu thêm và không hoàn tác phần thiếu đã khóa ở ngày 6. Nếu không đạt ngày nào, ngày 5/6/7 mỗi ngày ghi thiếu một lần; nếu đã đủ Q ngày đạt, các ngày sau trung tính.

Đã kiểm tra phép tính trên toàn bộ 128 tổ hợp đạt/chưa đạt của tuần 7 ngày, Q=3: thiếu lũy kế không giảm; mỗi ngày thiếu mới tối đa một; cuối tuần số ngày đạt được tính cộng số lần thiếu bằng Q. Đây là kiểm tra mô hình, không phải kiểm thử tính năng đã triển khai.

### Phân bổ chất lượng và các quyết định còn mở

Đề xuất ghi thành công/thiếu mới vào ngày phát sinh để tính chất lượng trong khoảng luyện tầng đó, không quay lại sửa tầng đã khóa. Như vậy không còn bắt buộc chờ cuối tuần để khóa tầng theo hướng trước. Đây là cách tính theo ngày; không đồng nghĩa mọi tầng luyện trong cùng tuần phải nhận một tỷ lệ tuần giống nhau.

Mức ảnh hưởng của một lần thiếu, trọng số với các habit khác, luật khi đổi chế độ/bản luyện giữa tuần và tác động trong ngày Xuất Chiến còn phải đặc tả. “Thiếu” chưa có nghĩa tự trừ Tu Vi, vé hoặc HP; không tự thêm phạt vào kinh tế hiện có.

Trước khi code phải chốt mốc tuần theo ngày sinh hoạt, xử lý habit tạo giữa tuần và đổi lịch/giờ sinh hoạt, giữ cam kết đã phát sinh, số lần hợp lệ mỗi ngày và trần đóng góp. Không cho nhiều lần trong một ngày bù một cam kết về các ngày khác đã khóa.
