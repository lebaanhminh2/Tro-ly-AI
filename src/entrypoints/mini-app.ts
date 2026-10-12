import { browserAuthApi, browserOwner, browserWriteAllowed } from '../adapters/d1/browser-auth.ts';
import { HealthyStore } from '../adapters/d1/healthy-store.ts';
import { verifyMiniApp } from '../adapters/telegram/mini-app-auth.ts';
import type { Env } from '../config/env.ts';
import { activeTasks, bootstrap, history } from './mini-app/bootstrap.ts';
import { json, readInput } from './mini-app/context.ts';
import { handleCultivation } from './mini-app/cultivation.ts';
import { handleReminders } from './mini-app/reminders.ts';
import { handleSchedule } from './mini-app/schedule.ts';
import { handleTasks } from './mini-app/tasks.ts';
import { handleHabits, readHabits } from './mini-app/habits.ts';
import { handleGame, readGame } from './mini-app/game.ts';
const taskRoutes = new Set(['/api/tasks', '/api/tasks-delete']);
const reminderRoutes = new Set(['/api/reminders', '/api/reminder-instance']);
const scheduleRoutes = new Set(['/api/settings', '/api/schedule', '/api/day-plan', '/api/task-work', '/api/task-focus', '/api/session', '/api/timeline', '/api/sleep']);
const writeRoutes = new Set([...taskRoutes, ...reminderRoutes, ...scheduleRoutes, '/api/cultivation', '/api/habits', '/api/game']);
export async function miniAppApi(request: Request, env: Env, now = Date.now()): Promise<Response> {
    const receivedAt = Date.now();
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/'))
        return json({ error: 'NOT_FOUND' }, 404);
    if (!['GET', 'POST'].includes(request.method))
        return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')
        return json({ error: 'FORBIDDEN' }, 403);
    if (url.pathname.startsWith('/api/browser-auth/')) {
        try {
            return await browserAuthApi(env.DB, request, env.TELEGRAM_USER_ID, now);
        }
        catch {
            return json({ error: 'LOGIN_UNAVAILABLE', message: 'Chưa kết nối được. Cậu thử lại nhé.' }, 503);
        }
    }
    let owner: string;
    try {
        const initData = request.headers.get('X-Telegram-Init-Data');
        if (initData)
            owner = (await verifyMiniApp(initData, env.TELEGRAM_BOT_TOKEN ?? '', env.TELEGRAM_USER_ID, now)).owner;
        else {
            const authenticated = await browserOwner(env.DB, request, env.TELEGRAM_USER_ID, now);
            if (!authenticated)
                throw Error('AUTH_REQUIRED');
            if (request.method === 'POST' && !browserWriteAllowed(request))
                return json({ error: 'FORBIDDEN' }, 403);
            owner = authenticated;
        }
    }
    catch {
        return json({ error: 'AUTH_REQUIRED', message: 'Đăng nhập lại trên trình duyệt hoặc mở lại từ Telegram để tiếp tục.' }, 401);
    }
    try {
        const context = { env, owner, now, healthy: new HealthyStore(env.DB) };
        if (request.method === 'GET' && ['/api/game', '/api/game-catalog', '/api/game-boss', '/api/game-chapter', '/api/practice-versions', '/api/battle-history', '/api/battle-loadout', '/api/battles'].includes(url.pathname))
            return await readGame(context, url);
        if (request.method === 'GET' && ['/api/habits', '/api/habit-history', '/api/habit-report'].includes(url.pathname))
            return await readHabits(context, url);
        if (request.method === 'GET' && url.pathname === '/api/bootstrap')
            return await bootstrap(context);
        if (request.method === 'GET' && url.pathname === '/api/history')
            return await history(context, url);
        if (request.method === 'GET' && url.pathname === '/api/tasks-page')
            return await activeTasks(context, url);
        if (request.method !== 'POST' || !writeRoutes.has(url.pathname))
            return json({ error: 'NOT_FOUND' }, 404);
        const input = await readInput(request);
        if (input instanceof Response)
            return input;
        if (url.pathname === '/api/game') return await handleGame({ ...context, now: now + Math.max(0, Date.now() - receivedAt) }, input);
        if (url.pathname === '/api/habits') return await handleHabits({ ...context, now: now + Math.max(0, Date.now() - receivedAt) }, input);
        if (taskRoutes.has(url.pathname))
            return await handleTasks(context, input, url.pathname) ?? json({ error: 'NOT_FOUND' }, 404);
        if (reminderRoutes.has(url.pathname))
            return await handleReminders(context, input, url.pathname) ?? json({ error: 'NOT_FOUND' }, 404);
        if (scheduleRoutes.has(url.pathname))
            return await handleSchedule(context, input, url.pathname) ?? json({ error: 'NOT_FOUND' }, 404);
        return await handleCultivation(context, input);
    }
    catch (error) {
        const code = error instanceof Error ? error.message : '';
        const gameErrors: Record<string, string> = {
            GAME_CHANGED: 'Tiến độ vừa được cập nhật. Tải lại để tiếp tục nhé.', GAME_DAY_CLOSED: 'Ngày này đã kết thúc. Tải lại để chọn cho ngày hiện tại.',
            TECHNIQUE_LOCKED: 'Cậu chưa có quyền học công pháp này.', CONFIRM_PRACTICE_RESTART: 'Xác nhận luyện một bản mới từ Nhập môn. Bản cũ vẫn được giữ.',
            PRACTICE_NOT_FOUND: 'Không tìm thấy bản luyện này.', PRACTICE_COMPLETE: 'Bản này đã Viên mãn. Cậu có thể luyện bản mới nếu muốn cải thiện tinh thuần.',
            PRACTICE_DAILY_LIMIT: 'Cậu đã tạo đủ 7 bản luyện mới trong ngày. Có thể tiếp tục bản đang có.',
            BATTLE_ACTIVE: 'Kết thúc trận trước khi chọn lịch luyện mới.',
            BATTLE_CHANGED: 'Trận vừa được cập nhật. Tải lại trước khi chọn tiếp.', BATTLE_NOT_FOUND: 'Không tìm thấy trận này.',
            BOSS_LOCKED: 'Chưa đủ điều kiện mở đoạn này. Xem trận trước và các môn cần luyện trong Hành trình nhé.', GAME_CATCHING_UP: 'Đang chốt ngày trước. Cập nhật kết quả rồi chọn tiếp nhé.',
            GAME_WEAPON_LOCKED: 'Cậu chưa sở hữu thần binh này.',
            BATTLE_COST_NOT_ACCEPTED: 'Cần xác nhận cái giá trước khi chọn chiêu hoặc cứu mạng.',
            BATTLE_INSUFFICIENT_HP: 'HP hiện tại chưa đủ để trả giá thi triển chiêu này.', BATTLE_NOT_ACTIVE: 'Trận hiện không còn chờ chọn chiêu.',
            BATTLE_NOT_STARTED: 'Trận bắt đầu từ ngày sinh hoạt kế tiếp.', BATTLE_NOT_CURRENT: 'Trận này không thuộc chế độ của hôm nay.',
            BATTLE_RESCUE_UNAFFORDABLE: 'Chưa đủ Tu Vi hoặc cảnh giới để cứu theo cách này.', BATTLE_RESCUE_UNAVAILABLE: 'Quyền cứu này không còn dùng được trong trận.',
            BATTLE_RESCUE_EXPIRED: 'Đã hết thời gian quyết định cứu mạng.', BATTLE_CANCEL_UNAVAILABLE: 'Chỉ hủy chuẩn bị trước ngày xuất chiến.',
            BATTLE_WITHDRAWAL_UNAVAILABLE: 'Chỉ rút trước lượt; sau khi hết HP cần chọn cứu hoặc chấp nhận tử trận.',
            BATTLE_TECHNIQUE_COOLDOWN: 'Chiêu này còn đang hồi. Chọn một chiêu khác cho lượt hôm nay.',
            HEALTHY_CHANGED: 'Tu Vi hoặc cảnh giới vừa thay đổi. Tải lại để xem cái giá hiện tại.',
            BREAKTHROUGH_COMBAT_COOLDOWN: 'Nghịch Mệnh còn đang hồi; chưa thể đột phá lại trong những ngày này.',
            CONFIRM_BATTLE_WITHDRAWAL: 'Xác nhận rút lui trước lượt hôm nay.', CONFIRM_BATTLE_DEATH: 'Xác nhận tử trận và khoản tổn thất trước khi tiếp tục.',
            BATTLE_DEATH_UNAVAILABLE: 'Trận không còn chờ quyết định tử trận.', BATTLE_EXCHANGE_UNAVAILABLE: 'Lượt hiện tại chưa mở quyền đổi một ô công pháp.',
        };
        if (gameErrors[code]) return json({ error: code, message: gameErrors[code] }, 409);
        const habitErrors: Record<string, string> = {
            HABIT_CHANGED: 'Thói quen vừa thay đổi. Tải lại để tiếp tục nhé.', HABIT_LOG_CHANGED: 'Lần ghi này đã thay đổi ở một nơi khác. Tải lại để kiểm tra.',
            HABIT_DAY_CLOSED: 'Ngày này đã kết thúc. Cậu chỉ có thể ghi cho ngày hiện tại.', HABIT_ARCHIVED: 'Thói quen này đã có lịch lưu trữ.',
            HABIT_NOT_FOUND: 'Không tìm thấy thói quen này.', HABIT_NOT_ARCHIVED: 'Thói quen này đang hoạt động.', HABIT_LIMIT: 'Cậu có thể giữ tối đa 30 thói quen hoạt động.',
            HABIT_SLOT_CONFLICT: 'Khoảng giờ này đã có việc, đang bận hoặc ngoài giờ sinh hoạt. Chọn một khoảng còn trống nhé.',
            HABIT_ALREADY_MET: 'Thói quen này đã đạt hôm nay, không cần xếp thêm vào lịch.',
        };
        if (habitErrors[code]) return json({ error: code, message: habitErrors[code] }, 409);
        const sleepErrors:Record<string,string>={SLEEP_CHANGED:'Trạng thái ngủ vừa thay đổi. Đóng cài đặt rồi mở lại nhé.',SLEEP_UNDO_EXPIRED:'Đã hết 5 phút để hoàn tác báo ngủ.',SLEEP_UNDO_LOCKED:'Không thể hoàn tác vì kết quả tu luyện đã thay đổi sau khi báo ngủ.'};
        if(sleepErrors[code])return json({error:code,message:sleepErrors[code]},409);
        if(code==='SETUP_REQUIRED')return json({error:code},409);
        if (code.startsWith('TIMELINE_'))
            return json({ error: code }, 409);
        if (['ALREADY_CHECKED_IN', 'CHECKIN_COMPLETE', 'NO_ACTIVE_DAY', 'NO_ACTIVE_TASK_WINDOW', 'NO_TICKETS', 'ACCOUNT_SUSPENDED', 'DRAW_UNAVAILABLE', 'FUSION_UNAVAILABLE', 'ITEM_UNAVAILABLE', 'BREAKTHROUGH_UNAVAILABLE', 'ALREADY_PROTECTED', 'REQUEST_ID_REUSED', 'STALE_TASK', 'TASK_NOT_AVAILABLE', 'PLAN_CHANGED', 'CONFIRM_CHILDREN', 'CONFIRM_REOPEN_PARENT', 'CONFIRM_DELETE', 'STEP_NOT_FOUND', 'NO_NEXT_REMINDER', 'SESSION_CHANGED'].includes(code))
            return json({ error: code }, 409);
        if (code.startsWith('INVALID_'))
            return json({ error: 'INVALID_REQUEST' }, 400);
        if (error instanceof SyntaxError)
            return json({ error: 'INVALID_REQUEST' }, 400);
        return json({ error: 'OPERATION_NOT_CONFIRMED', message: 'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thử hành động mới.' }, 503);
    }
}
