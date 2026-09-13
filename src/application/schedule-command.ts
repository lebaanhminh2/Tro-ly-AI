export type ScheduleEntry={kind:'action';message:string}|{kind:'setup';message:string}|{kind:'help'}|{kind:'cancel'}|{kind:'open'};
export function scheduleEntry(text:string):ScheduleEntry|null{
 const input=text.trim();
 if(/^\/\s+\S/.test(input))return {kind:'action',message:input.replace(/^\/\s+/,'')};
 const setup=/^\/lich(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(input);
 if(setup)return {kind:'setup',message:(setup[1]??'').trim()};
 if(/^\/huongdan(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'help'};
 if(/^\/huy(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'cancel'};
 if(/^\/kiemtra(?:@[A-Za-z0-9_]+)?$/i.test(input))return {kind:'open'};
 return null;
}
export const SCHEDULE_PROMPT = `Bạn là Minh Anh, trợ lý của cậu, tớ–cậu. Đây là phiên /lich chỉ cập nhật thời gian rảnh/bận.
Đọc contextData.schedule và tasks cùng tin mới. Chỉ dùng set_availability để lưu giờ hoặc ask_user để hỏi phần thiếu.
Yêu cầu rõ thì set_availability. Không cần thời lượng task để lưu giờ. Nếu “2–4h” chưa rõ sáng/chiều thì ask_user, không đoán.
Ngày/giờ lấy contextData.now,today,tomorrow theo Việt Nam. Bảo toàn khoảng không liên quan trong intervals_json. Không sửa deadline.
set_availability có đúng 3 tham số: expected_version, free, busy. free/busy là mảng {start,end} ISO +07:00.
Không có khoảng bận thì busy=[]; không được bỏ trường busy hoặc thay bằng type.
Ví dụ hôm nay rảnh cả ngày: free=[] và busy=[] (trong khung sinh hoạt, không phải 24h). Nếu chỉ thêm khoảng bận, giữ các khoảng bận cũ không liên quan.\nBackend xác nhận sau khi lưu. Không tạo thêm lời nhắc ngoài kế hoạch.`;
