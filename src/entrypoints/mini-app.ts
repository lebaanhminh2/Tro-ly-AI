import { browserAuthApi, browserOwner, browserWriteAllowed } from '../adapters/d1/browser-auth.ts';
import { HealthyStore } from '../adapters/d1/healthy-store.ts';
import { verifyMiniApp } from '../adapters/telegram/mini-app-auth.ts';
import type { Env } from '../config/env.ts';
import { activeTasks, bootstrap, history } from './mini-app/bootstrap.ts';
import { json, readInput } from './mini-app/context.ts';
import { handleCultivation } from './mini-app/cultivation.ts';
import { handleReminders, readReminders } from './mini-app/reminders.ts';
import { handleSchedule } from './mini-app/schedule.ts';
import { handleTasks } from './mini-app/tasks.ts';
import { handleHabits, readHabits } from './mini-app/habits.ts';
import { handleBeasts, readBeasts } from './mini-app/linh-thu.ts';
import { logFailure } from '../adapters/observability.ts';
const taskRoutes = new Set(['/api/tasks', '/api/tasks-delete']);
const reminderRoutes = new Set(['/api/reminders', '/api/reminder-instance']);
const scheduleRoutes = new Set([
  '/api/settings',
  '/api/schedule',
  '/api/day-plan',
  '/api/task-work',
  '/api/task-focus',
  '/api/session',
  '/api/timeline',
  '/api/sleep',
]);
const writeRoutes = new Set([
  ...taskRoutes,
  ...reminderRoutes,
  ...scheduleRoutes,
  '/api/cultivation',
  '/api/habits',
  '/api/linh-thu',
]);
export async function miniAppApi(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const receivedAt = Date.now();
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404);
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site')
    return json({ error: 'FORBIDDEN' }, 403);
  if (url.pathname.startsWith('/api/browser-auth/')) {
    try {
      return await browserAuthApi(env.DB, request, env.TELEGRAM_USER_ID, now);
    } catch (error) {
      logFailure('browser_auth', error);
      return json(
        { error: 'LOGIN_UNAVAILABLE', message: 'Chưa kết nối được. Cậu thử lại nhé.' },
        503,
      );
    }
  }
  let owner: string;
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    if (initData)
      owner = (
        await verifyMiniApp(initData, env.TELEGRAM_BOT_TOKEN ?? '', env.TELEGRAM_USER_ID, now)
      ).owner;
    else {
      const authenticated = await browserOwner(env.DB, request, env.TELEGRAM_USER_ID, now);
      if (!authenticated) throw Error('AUTH_REQUIRED');
      if (request.method === 'POST' && !browserWriteAllowed(request))
        return json({ error: 'FORBIDDEN' }, 403);
      owner = authenticated;
    }
  } catch {
    return json(
      {
        error: 'AUTH_REQUIRED',
        message: 'Đăng nhập lại trên trình duyệt hoặc mở lại từ Telegram để tiếp tục.',
      },
      401,
    );
  }
  try {
    const context = { env, owner, now, healthy: new HealthyStore(env.DB) };
    if (
      request.method === 'GET' &&
      [
        '/api/linh-thu',
        '/api/linh-thu/collection',
        '/api/linh-thu/receipt',
        '/api/linh-thu/tower',
      ].includes(url.pathname)
    )
      return await readBeasts(context, url);
    if (request.method === 'GET' && url.pathname === '/api/reminders')
      return await readReminders(context, url);
    if (
      request.method === 'GET' &&
      ['/api/habits', '/api/habit-history', '/api/habit-report'].includes(url.pathname)
    )
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
    if (input instanceof Response) return input;
    if (url.pathname === '/api/linh-thu') return await handleBeasts(context, input);
    if (url.pathname === '/api/habits')
      return await handleHabits(
        { ...context, now: now + Math.max(0, Date.now() - receivedAt) },
        input,
      );
    if (taskRoutes.has(url.pathname))
      return (await handleTasks(context, input, url.pathname)) ?? json({ error: 'NOT_FOUND' }, 404);
    if (reminderRoutes.has(url.pathname))
      return (
        (await handleReminders(context, input, url.pathname)) ?? json({ error: 'NOT_FOUND' }, 404)
      );
    if (scheduleRoutes.has(url.pathname))
      return (
        (await handleSchedule(context, input, url.pathname)) ?? json({ error: 'NOT_FOUND' }, 404)
      );
    return await handleCultivation(context, input);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const beastErrors: Record<string, string> = {
      BEAST_CHANGED: 'Linh thú vừa có thay đổi. Tải lại để tiếp tục nhé.',
      BEAST_DAY_CLOSED: 'Ngày này đã kết thúc. Tải lại để xem ngày hiện tại.',
      BEAST_NO_SUMMON_TICKETS: 'Chưa đủ vé triệu hồi cho lượt này.',
      BEAST_ALCHEMY_NOT_READY: 'Lò đan chưa tích đủ 30 ngày đạt thói quen.',
      BEAST_NOT_FOUND: 'Không tìm thấy linh thú này trong bộ sưu tập.',
      BEAST_PERFECT_REQUIRED: 'Luyện đầy dạng IV với độ thuần chính xác 100% để mở tuyệt kỹ.',
      BEAST_COMPANION_REQUIRED: 'Chọn linh thú này đồng hành có hiệu lực trước khi kích hoạt.',
      BEAST_ULTIMATE_WEEK_USED: 'Tài khoản đã dùng tuyệt kỹ tuần này. Tuần mới bắt đầu thứ Hai.',
      BEAST_SLEEP_TARGET_PASSED: 'Kích hoạt bảo hộ trước mốc giờ ngủ và trước khi báo ngủ nhé.',
      BEAST_CHOICE_CLOSED: 'Phần thưởng này đã được chọn hoặc không còn tồn tại.',
      BEAST_SUMMON_CHOICE_PENDING: 'Chọn ứng viên của lần triệu hồi trước để tiếp tục nhé.',
      BEAST_TRAINING_LOCKED: 'Lượt luyện này đã khóa. Cần Tịnh Linh Đan để luyện lại.',
      BEAST_NO_ELIXIR: 'Cậu chưa có Tịnh Linh Đan.',
      BEAST_RESET_NOT_AVAILABLE: 'Chỉ luyện lại khi lượt cũ đã khóa hoặc đã hoàn tất.',
      TOWER_ALREADY_PLAYED: 'Cậu đã bắt đầu lượt tháp hôm nay. Tiếp tục lượt đã lưu nhé.',
      TOWER_NOT_ELIGIBLE: 'Hoàn thành thói quen hôm nay và một task công việc hợp lệ để mở tháp.',
      TOWER_NOT_STARTED: 'Cậu chưa bắt đầu lượt tháp hôm nay.',
      TOWER_CHANGED: 'Lượt tháp đã thay đổi ở nơi khác. Tải lại để tiếp tục.',
      TOWER_NOT_CHOOSING: 'Tầng này đã có kết quả. Kiểm tra trước khi đi tiếp nhé.',
      TOWER_CANNOT_CONTINUE: 'Lượt này không thể đi tiếp.',
      TOWER_CANNOT_CLAIM: 'Lượt này chưa có quà để nhận hoặc đã kết thúc.',
    };
    if (beastErrors[code]) return json({ error: code, message: beastErrors[code] }, 409);
    const habitErrors: Record<string, string> = {
      HABIT_CHANGED: 'Thói quen vừa thay đổi. Tải lại để tiếp tục nhé.',
      HABIT_LOG_CHANGED: 'Lần ghi này đã thay đổi ở một nơi khác. Tải lại để kiểm tra.',
      HABIT_DAY_CLOSED: 'Ngày này đã kết thúc. Cậu chỉ có thể ghi cho ngày hiện tại.',
      HABIT_ARCHIVED: 'Thói quen này đã có lịch lưu trữ.',
      HABIT_NOT_FOUND: 'Không tìm thấy thói quen này.',
      HABIT_NOT_ARCHIVED: 'Thói quen này đang hoạt động.',
      HABIT_LIMIT: 'Cậu có thể giữ tối đa 30 thói quen hoạt động.',
      HABIT_SLOT_CONFLICT:
        'Khoảng giờ này đã có việc, đang bận hoặc ngoài giờ sinh hoạt. Chọn một khoảng còn trống nhé.',
      HABIT_ALREADY_MET: 'Thói quen này đã đạt hôm nay, không cần xếp thêm vào lịch.',
    };
    if (habitErrors[code]) return json({ error: code, message: habitErrors[code] }, 409);
    const sleepErrors: Record<string, string> = {
      SLEEP_CHANGED: 'Trạng thái ngủ vừa thay đổi. Đóng cài đặt rồi mở lại nhé.',
      SLEEP_UNDO_EXPIRED: 'Đã hết 5 phút để hoàn tác báo ngủ.',
      SLEEP_UNDO_LOCKED: 'Không thể hoàn tác vì kết quả tu luyện đã thay đổi sau khi báo ngủ.',
    };
    if (sleepErrors[code]) return json({ error: code, message: sleepErrors[code] }, 409);
    if (code === 'NO_TICKETS')
      return json(
        {
          error: code,
          message:
            'Chưa đủ vé cho lượt quay này. Hoàn thành task, thói quen hoặc điểm danh để nhận thêm vé.',
        },
        409,
      );
    if (code === 'SETUP_REQUIRED') return json({ error: code }, 409);
    if (code.startsWith('TIMELINE_')) return json({ error: code }, 409);
    if (
      [
        'ALREADY_CHECKED_IN',
        'CHECKIN_COMPLETE',
        'NO_ACTIVE_DAY',
        'NO_ACTIVE_TASK_WINDOW',
        'NO_TICKETS',
        'ACCOUNT_SUSPENDED',
        'DRAW_UNAVAILABLE',
        'FUSION_UNAVAILABLE',
        'ITEM_UNAVAILABLE',
        'BREAKTHROUGH_UNAVAILABLE',
        'ALREADY_PROTECTED',
        'REQUEST_ID_REUSED',
        'STALE_TASK',
        'TASK_NOT_AVAILABLE',
        'PLAN_CHANGED',
        'CONFIRM_CHILDREN',
        'CONFIRM_REOPEN_PARENT',
        'CONFIRM_DELETE',
        'STEP_NOT_FOUND',
        'NO_NEXT_REMINDER',
        'SESSION_CHANGED',
      ].includes(code)
    )
      return json({ error: code }, 409);
    if (code.startsWith('INVALID_')) return json({ error: 'INVALID_REQUEST' }, 400);
    if (error instanceof SyntaxError) return json({ error: 'INVALID_REQUEST' }, 400);
    logFailure('mini_app', error);
    return json(
      {
        error: 'OPERATION_NOT_CONFIRMED',
        message: 'Chưa xác nhận được kết quả. Kiểm tra lại trước khi thử hành động mới.',
      },
      503,
    );
  }
}
