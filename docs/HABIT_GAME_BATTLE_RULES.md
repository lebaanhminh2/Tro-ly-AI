# Chiến đấu — quyết định A05/A06 và luật đang triển khai

Cập nhật 2026-10-12. Engine/store/API/UI và toàn catalog đang chạy local; chưa release remote. Phạm vi và luật user tại [GAMEPLAY](HABIT_GAME_GAMEPLAY.md), checkpoint tại [PROGRESS](HABIT_GAME_PROGRESS.md). Các số cân bằng là quyết định của agent; chỉnh theo bằng chứng và giữ version của trận đã bắt đầu.

## Ngày và nguồn sức mạnh

`battle-v1` / content mới `than-lo-3`, đọc snapshots `than-lo-1/2/3`. Chuẩn bị từ hôm nay, Xuất Chiến từ ngày sinh hoạt kế tiếp. Mỗi ngày một chiêu, có thể đổi trước khi ngày kết thúc. Server chốt theo giá trị cuối cùng; ngủ không chốt lượt. Có backlog chưa kết toán thì chọn/rút/cứu chờ `GAME_CATCHING_UP`.

| Nguồn | Luật |
| --- | --- |
| Rank snapshot | HP tối đa `180+60×rank`; công `30+12×rank`; giáp `2×rank` |
| Tầng | Potency thêm 18% mỗi tầng sau Nhập môn |
| Tinh thuần | Hệ số `0,4+0,6×purity`; không thay phẩm chất đã khóa |
| Habit | Đạt ít nhất một nguồn: +30%; mỗi nguồn trưởng thành thêm +6%, tổng tối đa +60%; trưởng thành sau 7 ngày từ hiệu lực cam kết |
| Task | Snapshot tối đa 200 task gốc đang mở lúc chuẩn bị; hoàn thành trong cửa sổ ngày +5% mỗi nguồn, tối đa hai nguồn/ngày (+10%) |

Partial/neutral không góp habit. Task không tính steps, phút work log hay estimate. Task thêm sau snapshot không góp trận này. `task_battle_awards` giữ một lần trên mọi trận, cả khi tick/untick hoặc đánh lại; thưởng vé cũ giữ nguyên. Đòn trễ giết boss trước khi chiêu mới thi triển thì không nhận/tiêu nguồn task ngày đó. Võ Kỹ giữ nền để có đường nhập môn khi chưa có habit.

Rank đổi ngoài trận giữ snapshot đã công bố. Cứu bằng Nghịch Mệnh giảm nền trong trận nếu rank mới thấp hơn snapshot, giữ tỷ lệ HP tối đa đã hiến. Không tự nâng nền giữa trận vì đột phá ngoài trận.

## Thứ tự và các giới hạn

1. Hiệu ứng đòn trễ đến hạn. Giết boss thật thì không thi triển chiêu mới hoặc trả giá chiêu đó.
2. Trả giá thi triển, áp effects theo thứ tự khai báo.
3. Táng Nhật còn 1 HP ngay cả khi thắng. Chiêu đã thi triển luôn giữ cái giá.
4. Boss sống thì phản công từng hit; dừng chuỗi tại hit khiến HP người chơi về 0.
5. Cứu/tử trận, kết quả và expiry; ghi game/habit/audit/delta trong cùng batch.

Mỗi hit: giảm thương [-50%,70%] → giáp sau xuyên → giảm 40% nếu Giáp Ảo có ở đầu hit → tiêu giáp ảo → khiên → HP thật. Giáp 20 +100/100 mất HP40/100; giáp110 +100/100/100 mất0/10/100. Phản thương chỉ từ HP thật đã mất, không phản thương lặp. Echo chỉ một lần, không mang effects hoặc tạo echo khác.

Hai status cùng loại/đối tượng tối đa, lặp refresh/replace. Cương Kình tối đa3, Hư Ảnh một, bốn ấn khác ID trong cùng trận và burst một lần. Phong Thần niêm phong hai lượt/hồi ba lượt, để có một lượt không bị niêm phong giữa hai lần. Lạc Tử nổ sau hai lượt: còn một lượt để Thất Tinh tiêu ấn; ấn đã tiêu không nổ lại. Tam Nhật chỉ một Tử Ấn, không chồng thêm.

Người chơi đánh trước; boss chết thật không phản công. Hồi sinh boss có số lần/HP đã báo. Đồng quy do phản thương: xử lý hồi sinh boss, sau đó chờ cứu hoặc tử trận. Chỉ thắng khi người chơi còn sống; cứu sau đồng quy và boss đã chết mới ghi thắng. Cứu không chạy lại các hit còn lại của lượt tử.

Public DTO chỉ lộ intent kế tiếp. Quan Thiên cho biết hai hành động sắp tới. Swap giữ đủ hành động và không đẩy tuyệt kỹ ra ngoài lượt cuối. Vô Môn đổi một ô trước lựa chọn ngày sau, không reset HP/ấn/thời hạn/quyền cứu; đã chọn chiêu ngày đó thì chưa đổi ô.

## Cứu mạng, tử trận và đột phá

Content3 thêm thế đọc chiêu: trừ bốn trận chính chương1, lặp chiêu đã thi triển lượt trước giảm toàn sát thương gây ra lượt này65/75/85% theo chương≤3/≤9/sau9. Đổi chiêu phá thế đọc, không giảm hiệu quả thủ/hồi máu hoặc giá hiến tế. Stance được chốt trước intent swap, gồm delayed/reflect; UI báo trước trong intent/lựa chọn. `repeatWard` optional lưu cùng intents, v1/v2 không có vẫn giữ damage cũ. Chi tiết bằng chứng trước/sau tại [BALANCE](HABIT_GAME_BALANCE.md).

| Hành động | Cái giá và kết quả |
| --- | --- |
| Hộ Mệnh | Hồi35% HP tối đa hiện tại; giá `max(5,min(100,ceil(8% ngưỡng Tu Vi của rank snapshot)))` |
| Nghịch Mệnh | Phải đã chọn ở lượt tử; hy sinh một rank đang có, hồi35% sau giảm nền; không trừ Tu Vi |
| Tử trận | Trừ `min(qi,60,max(5,ceil(8% qi hiện tại)))`, không tự hạ rank/tiêu vật phẩm |

Một quyền cứu chung/trận. Giá cần xác nhận rõ và expected healthy version; không tự cứu thay user. Nghịch Mệnh giữ earned/highestRank/streak/vật phẩm/protection timer, reset failures và ghi attemptDay. Cooldown riêng tới `day+3`: chưa tái đột phá trước đó, không thay tỷ lệ/giá đột phá thường. Guard SQL kiểm cooldown lại ở commit.

Delta ghi cùng trạng thái/audit một lần. Undo ngủ vẫn là đảo delta ngủ: Hộ Mệnh giữ khoản Tu Vi đã trả sau undo; hạ rank bởi Nghịch Mệnh khóa undo nếu trường liên quan đã đổi. Không khôi phục nguyên account từ snapshot trận.

Không chọn chiêu: chờ, boss không tự đánh; sau ba ngày liên tiếp rút an toàn. Cam kết habit và audit tuần vẫn chốt. HP=0 còn hai ngày sinh hoạt kế tiếp để quyết định; hết hạn tử trận/charge một lần. Sau kết thúc, quay lại lịch luyện trước khi chuẩn bị (hoặc idle nếu đã yêu cầu dừng), từ ngày sau. Không chuyển nguồn ngày kết thúc sang luyện.

## Bằng chứng và phần còn phải giao

- 936 mẫu một cast theo 39 môn/tier/purity/contribution; cases combo/đồng quy/giáp/cost/niêm phong/intent.
- D1 chuẩn bị/ngày hiệu lực, concurrent/rollback/replay/owner, thắng bốn ngày/unlock một lần, task once-only và cứu/rank/death cùng batch.
- Weekly audit qua battle/absence chốt vào bản luyện gốc; 30 nguồn vẫn trong50 SQL và overview<50KB.
- Chrome chuẩn bị/chọn/cứu 320/390/desktop/light-dark. Chiêu chỉ pending trước khi chốt.
- Mô phỏng offline production engine:100 cấu hình mở đầu gồm truyền thừa Thiên Kiếm,93 thắng; cả năm phái thắng với một habit đạt. Bảy thất bại không có habit cần thêm chuẩn bị. Fixture cấp bốn môn thường/tầng1/rank gợi ý, không chứng minh unlock từ tài khoản mới.
- D1 truyền thừa: fixture cấp rank và chiến thắng tuyến chính trước đó; bốn bản luyện được tạo/chốt thật từ habit daily. Thắng bằng bộ chiêu đó chỉ mở quyền học Kiếm Vực, không tặng tầng. HTTP kiểm auth/Origin/input/stale day/cooldown và không lộ future patterns.
- D1 exchange/timeout/payment rollback: giữ HP/effects/turn khi đổi ô, không đổi sau lựa chọn hôm nay; timeout trừ một lần; rescue batch lỗi không làm mất rank hoặc tạo cooldown.

F4 đã có art thật cho5encounters và cảnh cửa núi, QA390/320 qua Chrome. F5–F6/R1 vẫn bắt buộc: toàn39 môn/15 chương/tuyến phụ/thần binh/chiến tích, graph thật, cân bằng endgame, vận hành và staging.
