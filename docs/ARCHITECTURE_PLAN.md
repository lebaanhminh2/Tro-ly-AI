# Kiến trúc và kế hoạch bản đầu

**Đã được thay thế về lịch mốc và ngân sách kiểm chứng bởi [DELIVERY_PLAN.md](DELIVERY_PLAN.md).** Giữ làm tham khảo lịch sử; không chạy lại G1 bên dưới. MODEL_VERDICT đã kết thúc việc chọn model. Chi tiết thực hiện mới nằm ở DATA_DESIGN, UX_FLOWS, SECURITY_RELEASE, VIBE_WORKFLOW.

Ngày: 2026-09-11. **Đề xuất chờ duyệt**, không phải quyền code/API/deploy. Thay thế hướng tiếp tục mở rộng prototype ở các ghi chú cũ.

## 1. Sản phẩm và điều kiện hoàn thành

Một người dùng trên Telegram, iPhone XS Max/iOS 18.3.2. Mục tiêu và persona giữ theo [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md), không chép lại.

MVP phải hoàn thành vòng: nói việc → giữ thông tin → chọn việc hôm nay → xác nhận buổi làm → nhắc → ghi nhận kết quả → điều chỉnh.

| Trải nghiệm bắt buộc | Tiêu chí nghiệm thu đề xuất |
| --- | --- |
| Chat tự nhiên và ghi việc | Không bắt điền form; giữ unknown; phân biệt trò chuyện/yêu cầu sửa; persona được người dùng đánh giá đạt |
| Today trong Telegram | Một việc NOW, việc kế tiếp, tối đa 3 mục Today; có nút xem toàn bộ, không giấu backlog vĩnh viễn |
| Task/buổi làm | Bắt đầu/kết thúc/hoãn; không quy đổi thời gian thành % hoặc im lặng thành thất bại |
| Calendar | Đọc lịch được cấp quyền; đề xuất slot không trùng; chỉ ghi buổi vào Assistant Plan sau xác nhận |
| Nhắc có giới hạn | Đề xuất: một lần chính + một lần sau 15 phút, tối đa 2 lần nhắc thêm/ngày; giờ yên lặng do người dùng chọn |
| Quay lại sau mất nhịp | Không dồn nợ sang ngày sau, không trách; giúp chọn một bước hoặc nghỉ |
| Vận hành | Máy cá nhân tắt vẫn chạy; lưu dữ liệu qua restart; xuất/khôi phục thử thành công; ngắt Calendar được |

Chưa làm: Mini App/game/XP/avatar, giọng nói, đa người dùng, project tree sâu, tự tối ưu lịch cả tuần, học thói quen tự động. Không loại khỏi tầm nhìn dài hạn.

## 2. Công nghệ: chọn có điều kiện

| Thành phần | Đề xuất và lý do | Điều kiện giữ lựa chọn |
| --- | --- | --- |
| Ngôn ngữ | TypeScript, một ứng dụng chia module; cùng kiểu dữ liệu cho nghiệp vụ/adapter | Không phụ thuộc Node filesystem ở runtime cloud |
| Runtime | Workers: webhook và công việc định kỳ, không vận hành VM | Chứng minh tác vụ chia nhỏ chạy dưới giới hạn Free; không dựa vào dry-run để kết luận hiệu năng |
| Database | D1/SQL: task, session, version, proposal, giao dịch và outbox | Kiểm thử atomicity, migration, recovery, export; không dùng memory làm nguồn dữ liệu thật |
| Nhắc/sync | Cron đánh thức dispatcher; việc đến hạn lưu D1 | Tác vụ hữu hạn, có lease/fencing; không timer trong tiến trình hay ping chống ngủ |
| AI | Gemini 3.5 Flash-Lite qua adapter thay được | Qua kiểm thử model VÀ phù hợp điều khoản dữ liệu; quota đủ không thay thế hai điều kiện này |
| Calendar | Google Calendar API + OAuth | Cấp quyền tối thiểu, refresh/reconnect, sự kiện lặp/cả ngày/sync lỗi được xử lý |
| Test | Node test cho nghiệp vụ; Miniflare cho D1/Workers; thử thật có ngân sách | Phân biệt mock, tích hợp local và kiểm chứng production |

Workers phù hợp vì tác vụ chủ yếu chờ I/O, nhưng Free có 10 ms CPU mỗi lượt (chờ mạng không tính CPU). Xếp lịch nặng hoặc xử lý mọi việc trong một lượt không phù hợp. [Giới hạn Workers](https://developers.cloudflare.com/workers/platform/limits/)

Không chọn VM vì chưa có nhu cầu tiến trình liên tục; không thêm database thứ hai, framework agent, vector DB hoặc queue service trước khi có bằng chứng cần. Nếu Workers/D1 không vượt cổng kiểm chứng, dừng và so sánh phương án khác; không đổi công nghệ âm thầm.

Chi phí mục tiêu: 0 tiền dịch vụ trong hạn mức; không cam kết miễn phí mãi. Quota quan sát và các ứng viên cũ nằm tại [DECISIONS.md](DECISIONS.md). Không tự bật billing; nếu AI Free không phù hợp dữ liệu thì phải trình lựa chọn chi phí/riêng tư cho người dùng.

## 3. Trách nhiệm và luồng dữ liệu

```text
Telegram → xác thực → inbox bền vững → xử lý nghiệp vụ theo người dùng
                                        ↕ AI: cách hiểu/lời nói
                                        ↕ D1: facts, task, session, proposal
Cron → dispatcher → nhắc / Calendar sync → outbox → Telegram / Google
```

- Transport chỉ chuyển/kiểm tra tin; domain sở hữu quy tắc; repositories sở hữu SQL; adapters cô lập Telegram/Google/Gemini.
- D1 là nguồn task, kết quả session, xác nhận và ý định ghi. Calendar là nguồn lịch ngoài; bản cache có thời điểm sync. Transcript không thay thế facts.
- Data model tối thiểu: người dùng/preferences; tasks + nguồn/certainty; work_sessions; proposals/version; calendar links/cache/cursor; inbox/outbox/jobs; audit. Chưa chốt tên bảng/DDL; reuse schema chỉ sau review.
- Task không bắt buộc project/subtask. Session planned và actual tách nhau. Deadline khác target finish; chưa cần target finish trong MVP.
- Model nhận message gần đây và thực thể liên quan có owner/nguồn rõ; không nhận mọi docs/backlog hoặc token OAuth. Không dùng confidence của model như bằng chứng quyền.
- Nút đã xác định task/operation thì không gọi AI hiểu lại. Chat thường ưu tiên một lượt AI; thao tác quan trọng có thể dùng lời mẫu đúng trạng thái sau validation, không thêm một agent tự chấm.
- Mơ hồ thì hỏi đúng phần thiếu. Yêu cầu rõ phải đi tiếp; policy chặn tất cả update không đạt nghiệm thu. Prototype nhập DD/MM/YYYY chỉ là fallback, không phải UX cuối cùng.
- Planner bản đầu dùng quy tắc đơn giản: lịch cố định + nghỉ + buffer + thời lượng người dùng chọn → vài slot khả thi. Thiếu workload không khẳng định deadline an toàn.

## 4. Quyền, đồng bộ và phục hồi

- Ghi mới/đổi dữ liệu quan trọng: hiển thị tên việc, trước/sau, ngày giờ rõ, xác nhận rồi mới commit. Chưa duyệt tự dời/bỏ slot.
- Inbox nhận thành công mới ACK; xử lý theo owner, khóa có fencing/version chống worker cũ ghi sau lease. Mutation + trạng thái xử lý + outbox cần giao dịch nhất quán.
- Retry chỉ khi biết an toàn. Gửi Telegram không rõ kết quả → uncertain và xử lý có kiểm soát, không hứa exactly-once. Không để recovery thông báo thay thế vô thời hạn cho việc hoàn tất hành động.
- Calendar ghi tách transaction DB: persist ý định, external ID ổn định, retry/reconcile tránh event trùng. Chưa nhận Google success thì không nói đã sync.
- Đề xuất sync gia tăng khoảng 5 phút khi vận hành bình thường; trước ghi slot phải kiểm tra lịch mới. Sync lỗi/stale thì ngừng tự đề xuất slot chắc chắn, giữ nút thao tác task.
- Sync phải có pagination, deleted event, recurring exceptions, all-day, timezone; token không còn hợp lệ (410) thì full sync. [Google sync](https://developers.google.com/workspace/calendar/api/guides/sync)
- Người dùng kéo/xóa buổi bot tạo: bảo lưu can thiệp đó, không tự tái tạo/dời ngược; hỏi lại nếu ảnh hưởng plan. Lịch ngoài tuyệt đối không tự sửa.
- OAuth ở trạng thái Testing có thể làm refresh token hết hạn sau 7 ngày với các scope liên quan; cần chọn cấu hình consent phù hợp, không hứa liên kết vĩnh viễn. [Google OAuth](https://developers.google.com/identity/protocols/oauth2#expiration)

## 5. Bảo mật và riêng tư là cổng phát hành

- Chỉ private chat và allowlist Telegram ID; kiểm tra owner trên DB/callback; webhook secret, HTTPS, giới hạn kích thước/tần suất và chống replay.
- OAuth state một lần có expiry, callback URL cố định; không lấy owner từ tham số chưa xác thực. Bí mật ở Worker secrets; refresh token lưu mã hóa với khóa riêng, không log prompt/token/header.
- Không coi bot Telegram là kênh được bảo mật đầu cuối cho mọi dữ liệu; MVP không dùng cho hồ sơ y tế, mật khẩu hay dữ liệu nhạy cảm.
- Đề xuất retention: context chat thô 7 ngày; log kỹ thuật không nội dung 14 ngày; task/facts giữ tới khi xóa; backup 7 ngày, giải thích độ trễ xóa khỏi backup. Dedupe retention phải có luật loại update cũ trước khi dọn.
- Có nút/lệnh tắt AI, ngắt Calendar, xuất/xóa dữ liệu và thông tin nơi dữ liệu đi tới. Backup phải thử restore, không chỉ bật lưu.
- **Gemini Free chưa qua cổng riêng tư:** điều khoản yêu cầu không gửi thông tin cá nhân/nhạy cảm/bí mật, có thể có người xem xét nội dung. Chỉ dữ liệu giả cho thử nghiệm; consent của người dùng không tự vô hiệu điều khoản. [Gemini terms](https://ai.google.dev/gemini-api/terms)
- Quota AI đếm bền vững theo project/model, retry hữu hạn, cảnh báo gần mức; hết quota thì nút/nhắc vẫn chạy. Không xoay tài khoản/key để né hạn mức.

## 6. Kiểm chứng hữu hạn trước triển khai

Mọi con số dưới đây là ngân sách/tiêu chí **đề xuất**, chưa cho phép gọi dịch vụ:

| Cổng | Phép thử | Đạt / dừng |
| --- | --- | --- |
| G1 Model | 12 kịch bản mới cố định × 2 lượt/hội thoại = 24 request; tối đa 1 đợt sửa rồi 24 request nữa | Ngân sách tối đa 48, lỗi cũng tính; không tự retry ngoài mức |
| G1 Chấm | Raw intent, hành động sau policy, persona chấm riêng; 4 ca chat, 4 ca thao tác rõ, 4 ca mơ hồ/quá tải/injection | ≥10/12 kịch bản hiểu đúng; 0 mutation sai sau policy; thao tác rõ không bị chặn tất cả; người dùng chấp nhận ≥3/4 ca chat; chưa là bảo đảm thống kê |
| G2 Hạ tầng | 100 jobs giả gồm inbox lặp, crash trước/sau commit, 429/timeout, lease cũ; đo CPU trên cloud sau duyệt | Không mutation trùng/mất im lặng; pending hội tụ hoặc uncertain có đường xử lý; không vượt CPU trong tải thử |
| G3 Calendar | Calendar thử riêng: 10 tình huống sync/ghi/xóa/lặp/OAuth | Không sửa lịch ngoài, không event trùng; lỗi hiển thị đúng; restore/reconnect đạt |
| G4 UX | Dùng thử 3 ngày trên iPhone, máy tính tắt | Tự ghi/xem/xếp/hoãn việc không cần terminal; nhắc thử trong 2 phút khi mạng bình thường, không vượt giờ yên lặng; người dùng thấy hữu ích |

Không pass G1 sau ngân sách thì so sánh model khác hoặc giảm phạm vi AI, không tiếp tục vòng sửa prompt. Không pass riêng tư thì chưa thử dữ liệu thật dù G1 pass.

## 7. Mốc và phần prototype dùng lại

| Mốc | Bàn giao và điều kiện chuyển |
| --- | --- |
| M0 — duyệt thiết kế | Duyệt tài liệu này, phạm vi/retention/quyền/tiêu chí; chưa viết thêm code |
| M1 — quyết định AI/hạ tầng | G1 + phần local G2; ghi kết luận ngắn, giải quyết phương án dữ liệu AI; chưa public |
| M2 — bot dùng được | Task/Today/session/nút/nhắc bền vững + quota + monitoring/export; duyệt file theo mốc và duyệt tài khoản/deploy riêng; G2 cloud |
| M3 — lịch và pilot | OAuth/sync/Assistant Plan + G3, sau đó G4; chỉ lúc này gọi là MVP hoàn tất |

Ứng viên reuse: kiểu dữ liệu task/proposal, validator ngày rõ, adapter có timeout, tests SQL, webhook allowlist, lock/outbox patterns. Reuse không đồng nghĩa đã production-ready.
Phải review/refactor: inbox/outbox atomicity, hội thoại đồng thời, hardcoded UTC+7/ID, state machine và quotas; xem [LOCAL_BOT.md](LOCAL_BOT.md).
Chỉ tham khảo: `trial-flow.ts` memory, prompt/test script và đánh giá thủ công; không mang harness filesystem vào Worker.
Giữ nguyên prototype hiện tại, không tự xóa/viết lại. Schema mới có migration có kiểm chứng và backup khi có dữ liệu thật.

## 8. Cách thực hiện tiết kiệm token

Duyệt một mốc kèm file/phạm vi trước khi code; tự sửa và kiểm thử trong mốc đó. Chỉ dừng khi cần quyền/chi phí/lựa chọn lớn, không xin lại cho từng lỗi nhỏ.
Đọc HANDOFF + tài liệu liên quan; cập nhật kết quả tại một nơi. Không thêm báo cáo dài cho mỗi request hay tài liệu trùng.
Ưu tiên hoàn thành vòng sử dụng được, đo lỗi theo tiêu chí; không lấy số test/file làm tiến độ. Không ước lượng ngày hoàn thành khi các cổng AI/privacy chưa giải quyết.
