// Owns transport and retry identities, including ambiguous network failures.
const pendingRequests = new Map();
export function settleRequest(path, input) {
    pendingRequests.delete(path + JSON.stringify(input));
}
export async function browserAuthRequest(action) {
    const response = await fetch('/api/browser-auth/' + action, { method: 'POST', credentials: 'same-origin', headers: { 'X-Minh-Anh-Request': '1' }, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) {
        const error = Error(data.message ?? (data.error === 'LOGIN_EXPIRED' ? 'Mã đã hết hạn. Tạo mã mới nhé.' : 'Chưa đăng nhập được. Cậu thử lại nhé.'));
        error.code = data.error;
        throw error;
    }
    if (action === 'logout')
        pendingRequests.clear();
    return data;
}
export async function liveRequest(path, body) {
    const initData = globalThis.Telegram?.WebApp?.initData;
    const key = body ? path + JSON.stringify(body) : null;
    let request = body;
    if (key) {
        if (!pendingRequests.has(key))
            pendingRequests.set(key, { ...body, id: crypto.randomUUID() });
        request = pendingRequests.get(key);
    }
    let response;
    try {
        response = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { ...(initData ? { 'X-Telegram-Init-Data': initData } : { 'X-Minh-Anh-Request': '1' }), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(request) : undefined, signal: AbortSignal.timeout(15000) });
    } catch {
        // A transport failure does not prove that a write failed to commit.
        // Keep the same request identity so an unchanged retry can recover it.
        const error = Error(body ? 'Chưa xác nhận được lần lưu. Kiểm tra kết nối rồi thử lại thao tác này với thông tin giữ nguyên.'
            : 'Chưa kết nối được. Kiểm tra mạng rồi tải lại nhé.');
        error.code = body ? 'NETWORK_UNCONFIRMED' : 'NETWORK_UNAVAILABLE';
        throw error;
    }
    const result = await response.json();
    if (!response.ok) {
        if (response.status < 500 && key)
            pendingRequests.delete(key);
        const messages = { AUTH_REQUIRED: 'Phiên đã hết hạn. Đóng và mở lại từ Telegram nhé.', SETUP_REQUIRED: 'Chọn giờ bắt đầu và giờ nghỉ trước nhé.', STALE_TASK: 'Việc vừa thay đổi. Mở lại danh sách rồi thử lại.', TASK_NOT_AVAILABLE: 'Task này không còn phù hợp để thêm vào hôm nay.', NO_ACTIVE_TASK_WINDOW: 'Khung làm việc này vừa kết thúc hoặc lịch đã thay đổi rồi nhé.', PLAN_CHANGED: 'Kế hoạch vừa thay đổi. Mở lại rồi chỉnh trên bản mới nhé.', CONFIRM_CHILDREN: 'Task còn bước chưa xong. Hãy xác nhận hoàn thành cả nhóm.', CONFIRM_REOPEN_PARENT: 'Cần xác nhận mở lại task cha.', DRAW_UNAVAILABLE: 'Chưa thể quay lúc này.', NO_TICKETS: 'Cậu chưa có vé. Hoàn thành task hoặc điểm danh để nhận vé nhé.', ACCOUNT_SUSPENDED: 'Tài khoản tạm ngưng do ba ngày không chat. Nhắn cho Minh Anh để hoạt động lại; đây không phải chế độ /ngu.', NO_ACTIVE_DAY: 'Cậu đã lưu giờ sinh hoạt. Ngày hoạt động tiếp theo chưa bắt đầu; không cần thiết lập lại.', BREAKTHROUGH_UNAVAILABLE: 'Chưa đủ điều kiện hoặc hôm nay đã thử đột phá.', FUSION_UNAVAILABLE: 'Chưa đủ ba phù cùng cấp.', ITEM_UNAVAILABLE: 'Vật phẩm chưa dùng được lúc này.', ALREADY_PROTECTED: 'Hôm nay đã kích hoạt bảo vệ rồi.', NO_NEXT_REMINDER: 'Không còn lần nhắc sắp tới để sửa.' };
        const timelineErrors = { TIMELINE_CHANGED: 'Lịch vừa thay đổi. Đóng hộp và mở lại lịch trước khi kéo nhé.', TIMELINE_BLOCKED: 'Giờ đó đã qua, đang bận hoặc ngoài khung làm việc. Chưa đổi lịch.', TIMELINE_NO_ROOM: 'Không đủ chỗ cho các việc phía sau. Chưa lưu lần kéo này; hãy điều chỉnh khoảng rảnh hoặc thời lượng.', TIMELINE_DEADLINE: 'Cách xếp này vượt deadline. Chưa đổi lịch.', TIMELINE_UNDO_EXPIRED: 'Đã hết thời gian hoàn tác. Cậu vẫn có thể chỉnh giờ trực tiếp.', INVALID_TIMELINE_MOVE: 'Chọn giờ tương lai theo nấc 5 phút nhé.' };
        const checkinErrors = { ALREADY_CHECKED_IN: 'Cậu đã nhận quà hôm nay rồi. Hẹn cậu ngày mai nhé.', CHECKIN_COMPLETE: 'Đã nhận đủ 30 phần quà. Chu kỳ tiếp theo bắt đầu sau khi đủ 32 ngày.' };
        const error = Error(result.message ?? checkinErrors[result.error] ?? timelineErrors[result.error] ?? messages[result.error] ?? 'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thao tác mới.');
        error.code = result.error;
        throw error;
    }
    return result;
}
