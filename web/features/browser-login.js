import { browserAuthRequest } from '../core/http.js';
import { refreshLive } from '../core/live-data.js';
import { applySnapshot } from '../core/state.js';
import { button, card, el } from '../ui/dom.js';
export function createBrowserLoginActions(context) {
    const { state, runtime, sheet, closeSheet, render, toast, openSettings } = context;
    let loginTimer, loginGeneration = 0;
    function showBrowserLogin() {
        clearTimeout(loginTimer);
        loginGeneration++;
        runtime.revision++;
        state.loaded = false;
        state.tasks = [];
        state.reminders = [];
        state.authChallenge = null;
        state.loginError = '';
        state.screenState = 'login';
        if (sheet.open)
            closeSheet();
        render();
    }
    function connected(data) {
        clearTimeout(loginTimer);
        loginGeneration++;
        runtime.revision++;
        applySnapshot(state, data);
        runtime.pendingReceipt = null;
        runtime.refreshPending = false;
        state.screenState = 'ready';
        state.authChallenge = null;
        state.loginError = '';
        render();
        if (state.needsSetup)
            openSettings();
    }
    async function pollBrowserLogin(generation) {
        if (generation !== loginGeneration || state.screenState !== 'login')
            return;
        try {
            if (document.visibilityState === 'visible') {
                const result = await browserAuthRequest('status');
                if (generation !== loginGeneration)
                    return;
                if (result.authenticated) {
                    const data = await refreshLive();
                    if (generation !== loginGeneration)
                        return;
                    connected(data);
                    return;
                }
            }
        }
        catch (error) {
            if (generation !== loginGeneration)
                return;
            if (error.code === 'LOGIN_EXPIRED') {
                state.authChallenge = null;
                state.loginError = error.message;
                render();
                return;
            }
            state.loginError = 'Chưa kết nối được. Minh Anh sẽ thử lại…';
            render();
        }
        loginTimer = setTimeout(() => pollBrowserLogin(generation), 3000);
    }
    async function beginBrowserLogin() {
        clearTimeout(loginTimer);
        const generation = ++loginGeneration;
        state.loginError = '';
        state.loginBusy = true;
        render();
        try {
            const result = await browserAuthRequest('start');
            if (generation !== loginGeneration)
                return;
            if (result.authenticated) {
                connected(await refreshLive());
                return;
            }
            state.authChallenge = result;
            loginTimer = setTimeout(() => pollBrowserLogin(generation), 2000);
        }
        catch (error) {
            if (generation === loginGeneration)
                state.loginError = error.message;
        }
        finally {
            if (generation === loginGeneration) {
                state.loginBusy = false;
                render();
            }
        }
    }
    function renderBrowserLogin() {
        const root = el('section', undefined, 'browser-login');
        root.append(el('p', 'MINH ANH TRÊN MÁY TÍNH', 'eyebrow'), el('h1', 'Một góc riêng cho công việc của cậu.'), el('p', 'Đăng nhập bằng Telegram để mở task, lịch và thành tích của cậu trên trình duyệt.', 'subtitle'));
        const box = card('login-card');
        if (state.authChallenge) {
            box.append(el('h2', 'Xác nhận với Minh Anh'), el('p', 'Sao chép lệnh bên dưới và gửi trong cuộc trò chuyện với Minh Anh. Tab này sẽ tự đăng nhập.', 'subtitle'));
            const command = '/dangnhap ' + state.authChallenge.code, code = el('code', command, 'login-command');
            box.append(code);
            const actions = el('div', undefined, 'login-actions'), copy = button('Sao chép lệnh', async () => {
                try {
                    await navigator.clipboard.writeText(command);
                    toast('Đã sao chép. Gửi lệnh cho Minh Anh trong Telegram nhé.');
                }
                catch {
                    toast('Cậu chọn và sao chép lệnh trên màn hình nhé.');
                }
            }, 'primary');
            const link = el('a', 'Mở Telegram', 'secondary');
            link.href = 'https://t.me/Minh_Anh_cua_Minh_bot';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            actions.append(copy, link);
            box.append(actions);
            box.append(el('p', 'Đang chờ xác nhận · Mã có hiệu lực 10 phút. Chỉ gửi mã từ tab mà cậu vừa mở.', 'login-status'));
            box.append(button('Tạo mã mới', beginBrowserLogin, 'text-button'));
        }
        else {
            box.append(el('h2', 'Đăng nhập bằng Telegram'), el('p', 'Nhận mã dùng một lần, gửi cho Minh Anh rồi quay lại đây. Trình duyệt ghi nhớ đăng nhập trong 30 ngày.', 'subtitle'));
            const start = button(state.loginBusy ? 'Đang tạo mã…' : 'Lấy mã đăng nhập', beginBrowserLogin, 'primary');
            start.disabled = !!state.loginBusy;
            box.append(start);
        }
        if (state.loginError) {
            const error = el('p', state.loginError, 'login-error');
            error.setAttribute('role', 'status');
            box.append(error);
        }
        root.append(box);
        return root;
    }
    return { showBrowserLogin, connected, pollBrowserLogin, beginBrowserLogin, renderBrowserLogin };
}
