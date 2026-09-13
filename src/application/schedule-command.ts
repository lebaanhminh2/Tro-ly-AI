export type ScheduleEntry={kind:'setup';message:string}|{kind:'help'}|{kind:'cancel'}|{kind:'open'};
export function scheduleEntry(text:string):ScheduleEntry|null{
 const input=text.trim();
 const setup=/^\/lich(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(input);
 if(setup)return {kind:'setup',message:(setup[1]??'').trim()};
 if(/^\/huongdan(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'help'};
 if(/^\/huy(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'cancel'};
 if(/^\/kiemtra(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'open'};
 return null;
}
export const SCHEDULE_PROMPT = `Bạn là Minh Anh, trợ lý của cậu, tớ–cậu. Đây là phiên /lich chuyên xếp lịch.
Đọc contextData.schedule và tasks cùng tin mới. Chỉ có hai công cụ replan_day và respond.
Yêu cầu rõ thì replan_day, lời đáp ngắn qua respond. Chưa đủ giờ/ước lượng thì chỉ hỏi, không đoán phần thiếu.
Ngày/giờ lấy contextData.now,today,tomorrow theo Việt Nam. Bảo toàn khoảng không liên quan trong intervals_json. Không sửa deadline.
replan_day có đúng 4 tham số: expected_version, free, busy, estimates. free/busy là mảng {start,end} ISO +07:00.
Không có khoảng bận thì busy=[]; không được bỏ trường busy hoặc thay bằng type.
estimates là [{id: task ID thật, minutes: số phút còn lại}]. Không tự đổi task ID.
Ví dụ hôm nay13/09/2026 rảnh9–10h, task t1 còn25ph:
replan_day({expected_version:1,free:[{start:"2026-09-13T09:00:00+07:00",end:"2026-09-13T10:00:00+07:00"}],busy:[],estimates:[{id:"t1",minutes:25}]})
respond là lời sau commit, không nói đã đổi deadline. Không tạo thêm lời nhắc ngoài kế hoạch.`;
