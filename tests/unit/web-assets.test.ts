import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const contains = (source: string, fragment: string) => source.includes(fragment) || source.replace(/\s+/g, '').includes(fragment.replace(/\s+/g, ''));
const app = ["web/app.js", "web/core/state.js", "web/core/mutations.js", "web/core/lifecycle.js", "web/ui/dom.js", "web/ui/sheets.js", "web/ui/feedback.js", "web/ui/effects.js", "web/features/tasks.js", "web/features/today-plan.js", "web/features/reminders.js", "web/features/schedule.js", "web/features/cultivation.js", "web/features/browser-login.js"].map(path => readFileSync(path, 'utf8')).join('\n');
const styles = readFileSync('web/styles.css', 'utf8');
const today = readFileSync('web/views/today.js', 'utf8');
const achievements = readFileSync('web/views/achievements.js', 'utf8');
const api = ["web/api.js", "web/core/http.js", "web/core/live-data.js", "web/core/theme.js", "web/models/cultivation.js", "web/models/tasks.js", "web/demo/state.js", "web/demo/cultivation.js"].map(path => readFileSync(path, 'utf8')).join('\n');
const reminders = readFileSync('web/views/reminders.js', 'utf8');
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>;
const makeNode = (tag: string, value = '', className = '') => ({ tag, value, className, children: [] as any[], attrs: {} as Record<string, string>, style: { setProperty() {
        } },
    append(...children: any[]) {
        this.children.push(...children);
    }, replaceChildren(...children: any[]) {
        this.children = children;
    }, setAttribute(key: string, value: string) {
        this.attrs[key] = value;
    }, addEventListener() {
    }, getBoundingClientRect() {
        return { top: 100 };
    },
    get lastChild() {
        return this.children.at(-1);
    }, get firstElementChild() {
        return this.children[0];
    }, get classList() {
        return { add: (...names: string[]) => {
                this.className = [this.className, ...names].join(' ');
            } };
    } });
const walk = (n: any): any[] => [n, ...n.children.flatMap(walk)];
const flatten = (n: any): string => [n.textContent ?? n.value, ...n.children.map(flatten)].join(' ');
const mockUi = (state: any) => ({ el: makeNode, card: (css = '') => makeNode('div', '', 'card ' + css), button: (text: string, action: () => void, css = 'secondary') => ({ ...makeNode('button', text, css), action }), heading: (title: string, description: string) => {
        const n = makeNode('div', '', 'heading');
        const group = makeNode('div');
        group.append(makeNode('h1', title), makeNode('p', description));
        n.append(group);
        return n;
    }, cultivation: () => state.cultivation, render() {
    }, claimCheckin() {
    }, openRewardCalendar() {
    }, openDailyReward() {
    }, openTask() {
    }, openTodayPlan() {
    }, openAvailability() {
    }, toggleTaskFocus() {
    }, toggleTask() {
    }, openReminder() {
    }, demoDay() {
        return 0;
    } });
test('task editor exposes remaining estimate and confirmed child deletion', () => {
    assert.ok(contains(app, "field('Thời gian còn cần làm (phút)'"));
    assert.ok(contains(app, 'remainingMinutes:remainingValue()'));
    assert.ok(contains(app, "operation:'delete_step'"));
    assert.ok(contains(app, "confirm('Xóa bước nhỏ?'"));
    assert.ok(contains(app, "remainingSlider.disabled=timeMode==='progress'"));
    assert.ok(contains(app, "remainingDirty=()=>timeMode==='estimate'"));
    assert.ok(contains(app, 'task-time-modes'));
    assert.ok(styles.includes('.task-step-row .step-delete{min-width:44px;min-height:44px'));
});
test('work card keeps the flip interaction and shows current, next and expired states', async () => {
    const viewPath = '../../web/views/today.js';
    const { renderWorkState } = await import(viewPath);
    const make = (tag: string, value = '', className = '') => ({ tag, value, className, children: [] as any[], attrs: {} as Record<string, string>, style: { setProperty() {
            } },
        append(...children: any[]) {
            this.children.push(...children);
        }, setAttribute(key: string, value: string) {
            this.attrs[key] = value;
        } });
    let clicked = false;
    const ui = { el: make, button: (label: string, click: () => void, css: string) => ({ ...make('button', label, css), click }), toggleTaskFocus: () => {
            clicked = true;
        } };
    const now = Date.parse('2026-09-22T14:10:00+07:00');
    const start = now - 10 * 60000, end = now + 20 * 60000, nextStart = now + 50 * 60000, nextEnd = now + 95 * 60000;
    const plan = { items: [{ taskId: 'a', windows: [{ start, end }] }, { taskId: 'b', windows: [{ start: nextStart, end: nextEnd }] }] };
    const state = { tasks: [{ id: 'a', title: 'Báo cáo', done: false }, { id: 'b', title: 'Tiếng Anh', done: false }], taskFocus: null as any, taskFocusTarget: { taskId: 'a', endsAt: end }, resting: false };
    const flatten = (node: any): string => [node.value, ...node.children.map(flatten)].join(' ');
    let root = renderWorkState(ui, state, plan, now), text = flatten(root);
    assert.match(text, /14:00–14:30/);
    assert.match(text, /Tiếp theo · 15:00–15:45/);
    assert.doesNotMatch(text, /Không đang làm|Tớ đang làm/);
    assert.match(text, /ngừng nhắc để cậu tập trung/);
    const card = root.children.find((child: any) => child.tag === 'button');
    assert.equal(card.attrs['aria-pressed'], 'false');
    assert.match(card.attrs['aria-label'], /Bắt đầu nhé/);
    card.click();
    assert.equal(clicked, true);
    state.taskFocus = { taskId: 'a', endsAt: end };
    root = renderWorkState(ui, state, plan, now);
    assert.equal(root.children.find((child: any) => child.tag === 'button').attrs['aria-pressed'], 'true');
    assert.match(flatten(root), /Đang làm đến 14:30/);
    root = renderWorkState(ui, state, plan, end);
    assert.match(flatten(root), /Sắp tới · 15:00–15:45/);
    assert.equal(root.children.find((child: any) => child.tag === 'button').attrs['aria-pressed'], 'false');
    state.resting = true;
    assert.match(flatten(renderWorkState(ui, state, plan, end)), /Đang nghỉ/);
    state.tasks[1]!.done = true;
    assert.match(flatten(renderWorkState(ui, state, plan, end)), /Không còn phiên làm việc trong lịch/);
    assert.match(flatten(renderWorkState(ui, state, null, end)), /Chưa có lịch làm việc/);
});
test('web syntax check covers every shipped JavaScript asset', () => {
    assert.equal(scripts['check:web'], 'node scripts/check-web.mjs');
    const checker = readFileSync('scripts/check-web.mjs', 'utf8');
    assert.match(checker, /withFileTypes:\s*true/);
    assert.match(checker, /entry.isDirectory\(\)\s*\?\s*webScripts/);
    assert.match(checker, /\[\s*'--check',\s*path\s*\]/);
});
test('today controls use the shared task and progress flows', () => {
    assert.ok(contains(api, "mode:'timeline'"));
    assert.ok(contains(today, 'ui.openTodayPlan(t.id)'));
    assert.ok(contains(app, "performLive('task-work'"));
    assert.ok(contains(app, "performLive('day-plan'"));
    assert.ok(contains(app, "performLive('task-focus'"));
    assert.ok(contains(app, "{operation:active?'stop':'start'}"));
    assert.ok(!contains(app, "operation:active?'stop':'start',taskId"));
    assert.ok(contains(today, "ui.toggleTaskFocus(card)"));
    assert.ok(contains(today, "'Bắt đầu nhé?'"));
    assert.ok(!contains(today, 'Không đang làm'));
    assert.ok(contains(today, 'Đang làm'));
    assert.ok(contains(today, 'Tiếp theo · '));
    assert.ok(contains(today, 'flameLevel(state.cultivation?.streak)'));
    assert.ok(contains(achievements, 'flameLevel(streak)'));
    assert.ok(contains(today, "setProperty('--flame',flame.color)"));
    assert.ok(contains(achievements, "setProperty('--flame',flame.color)"));
    assert.ok(contains(app, 'nextBoundary-now+20'));
    assert.ok(contains(today, "'Cậu cứ tập trung nhé'"));
    assert.ok(contains(today, "state.taskFocusTarget"));
    assert.ok(contains(today, 'focus-flip-card'));
    assert.ok(contains(today, "addFace('front'"));
    assert.ok(contains(today, "addFace('back'"));
    assert.ok(contains(app, "focusEffect(target)"));
    assert.ok(contains(app, "revertFocusEffect(target)"));
    assert.ok(styles.includes('@keyframes focus-card-flip-forward'));
    assert.ok(styles.includes('.focus-flip-card.focus-activating:not(.is-focused) .focus-flip-inner'));
    assert.ok(styles.includes('@media(prefers-reduced-motion:reduce){.focus-flip-card .focus-flip-inner'));
    assert.ok(styles.includes('.plan-actions .plan-action-main{background:var(--surface)'));
    assert.ok(!contains(today, 'VIỆC TIẾP THEO'));
    assert.ok(!contains(today, "button('Mở việc'"));
    assert.ok(!contains(today, 'daily-focus-action'));
    assert.ok(!contains(today, 'Khung hôm nay đã hết'));
    assert.ok(!contains(app, "entries.push({taskId:select.value,minutes:45})"));
    assert.ok(contains(api, 'actualMinutes'));
});
test('breakthrough progress tracks qi while sleep streak remains a separate condition', () => {
    assert.ok(contains(achievements, 'Math.round(100*qi/next.qi)'));
    assert.ok(contains(achievements, 'Math.min(100,percent)'));
    assert.ok(contains(achievements, "' · dư '+surplus+' tu vi'"));
    assert.ok(contains(achievements, "'Điều kiện đột phá'"));
    assert.ok(contains(achievements, "c.streak+' / '+next.days+' ngày đúng giờ'"));
    assert.ok(!contains(achievements, 'Math.min(c.qi/next.qi,c.streak/next.days)'));
});
test('task sheet has touch, backdrop and system-close escape paths', () => {
    assert.ok(contains(app, "data-sheet-close"));
    assert.ok(contains(app, "sheet.addEventListener('cancel'"));
    assert.ok(contains(app, 'closeSheet()'));
    assert.ok(contains(app, "sheet.classList.remove('task-sheet-open','schedule-sheet-open','reward-sheet-open')"));
});
test('schedule sheet locks the page and only edits explicitly selected tasks', () => {
    assert.ok(contains(app, "sheet.classList.add('schedule-sheet-open')"));
    assert.ok(contains(app, "document.body.classList.add('sheet-open')"));
    assert.ok(contains(app, "const estimates=[]"));
    assert.ok(contains(app, "button('Chọn task'"));
    assert.ok(contains(app, 'Không chọn thì task giữ nguyên thời lượng đã lưu'));
    assert.ok(!contains(app, 'document.body.style.top='));
    assert.ok(styles.includes('dialog.schedule-sheet-open .schedule-form{flex:1 1 auto'));
    assert.ok(styles.includes('dialog.schedule-sheet-open{display:flex;flex-direction:column;height:min(88dvh,760px)'));
    assert.ok(styles.includes('dialog.schedule-sheet-open input[type=time]{position:relative;pointer-events:auto}'));
});
test('reward result stays visually plain without a decorative star prefix', () => {
    assert.ok(contains(app, 'reveal.textContent=rewardLabels[saved.reward]??saved.reward'));
    assert.ok(contains(app, "result.textContent=reward.label+' · Còn '"));
    assert.ok(!contains(app, "textContent='✦ '+(rewardLabels"));
    assert.ok(!contains(app, "textContent='✦ '+reward.label"));
});
test('checkin calendar reveals all30 rewards, upcoming days and received/today states only when opened', async () => {
    const viewPath = '../../web/views/achievements.js', apiPath = '../../web/api.js';
    const { renderRewardCalendar } = await import(viewPath), { createDemo, checkinProgress } = await import(apiPath);
    const make = (tag: string, value = '', className = '') => ({ tag, value, className, children: [] as any[], attrs: {} as Record<string, string>, style: {} as Record<string, string>,
        append(...children: any[]) {
            this.children.push(...children);
        }, setAttribute(key: string, value: string) {
            this.attrs[key] = value;
        } });
    const state = createDemo(), now = Date.parse('2026-10-05T09:00:00+07:00'), day = Math.floor((now + 25200000) / 86400000);
    state.cultivation.checkin = { cycleStartDay: day - 7, count: 6, lastDay: day - 1 };
    const ui = { el: make, card: (css: string) => make('div', '', 'card ' + css), button: (text: string, action: () => void, css: string) => ({ ...make('button', text, css), action }), cultivation: () => state.cultivation, claimCheckin() {
        }, openDailyReward() {
        } };
    const flatten = (n: any): string => [n.value, ...n.children.map(flatten)].join(' ');
    let root = renderRewardCalendar(ui, state, now), grid = root.children.find((n: any) => n.className === 'reward-calendar');
    assert.equal(grid.children.length, 30);
    assert.equal(grid.children.filter((n: any) => n.className.includes('is-received')).length, 6);
    assert.equal(grid.children.filter((n: any) => n.className.includes('is-today')).length, 1);
    assert.equal(grid.children[6].attrs['aria-current'], 'step');
    assert.match(grid.children[6].attrs['aria-label'], /3 Phá Cảnh Phù · Sơ cấp/);
    assert.match(grid.children[29].attrs['aria-label'], /30 tu vi.*5 vé quay.*Phá Cảnh Phù · Cực phẩm/);
    assert.match(flatten(root), /NGÀY MAI.*NGÀY THƯỞNG 8/);
    assert.doesNotMatch(flatten(root), /Ngày kia/);
    state.cultivation.checkin = { cycleStartDay: day - 7, count: 7, lastDay: day };
    root = renderRewardCalendar(ui, state, now);
    grid = root.children.find((n: any) => n.className === 'reward-calendar');
    assert.equal(grid.children.filter((n: any) => n.className.includes('is-today')).length, 0);
    assert.match(flatten(root), /ĐÃ NHẬN HÔM NAY/);
    assert.match(flatten(root), /NGÀY THƯỞNG 8/);
    assert.equal(checkinProgress(state.cultivation, now).canClaim, false);
    state.cultivation.checkin = { cycleStartDay: day - 31, count: 29, lastDay: day - 1 };
    root = renderRewardCalendar(ui, state, now);
    const preview = root.children.find((n: any) => n.className === 'checkin-preview');
    assert.match(flatten(preview), /QUÀ HÔM NAY · NGÀY 30/);
    assert.match(flatten(preview), /NGÀY MAI · CHU KỲ MỚI/);
    assert.match(flatten(preview), /1 tu vi/);
    assert.doesNotMatch(flatten(preview), /NGÀY THƯỞNG 31/);
});
test('achievements puts the streak first and keeps the30-day calendar behind an explicit action', async () => {
    const viewPath = '../../web/views/achievements.js', apiPath = '../../web/api.js';
    const { renderAchievements, renderCheckin } = await import(viewPath), { createDemo } = await import(apiPath);
    const state = createDemo(), now = Date.parse('2026-10-05T09:00:00+07:00'), ui = mockUi(state);
    let opened = 0;
    ui.openRewardCalendar = () => {
        opened++;
    };
    let root = renderAchievements(ui, state);
    assert.equal(root.children[1].className, 'achievement-overview');
    assert.match(root.children[2].className, /checkin-compact/);
    assert.equal(walk(root).filter(n => n.className.includes('reward-cell')).length, 0);
    const link = walk(root).find(n => n.className.includes('checkin-calendar-link'));
    link.action();
    assert.equal(opened, 1);
    root = renderCheckin(ui, state, now);
    assert.match(flatten(root), /QUÀ HÔM NAY.*1 tu vi/);
    const day = Math.floor((now + 25200000) / 86400000);
    state.cultivation.checkin = { cycleStartDay: day, count: 1, lastDay: day };
    root = renderCheckin(ui, state, now);
    assert.match(flatten(root), /ĐÃ NHẬN HÔM NAY/);
    assert.equal(walk(root).find(n => n.className.includes('checkin-claim')).disabled, true);
    assert.doesNotMatch(achievements + api + app, /bùa tối cao|Bùa tối cao/);
    assert.ok(contains(app, 'openRewardCalendar'));
    assert.ok(contains(app, 'item.boost'));
});
test('Today switches only its work panel while keeping the flame, controls and frame intact', async () => {
    const viewPath = '../../web/views/today.js', apiPath = '../../web/api.js';
    const { renderToday } = await import(viewPath), { createDemo } = await import(apiPath), state = createDemo();
    const now = Date.parse('2026-10-05T11:30:00+07:00');
    state.serverNow = now;
    state.loadedAt = Date.now();
    state.tasks.forEach((t: any, i: number) => t.id = 'task-' + i);
    state.dailyPlan = { plan: { items: [{ taskId: 'task-1', minutes: 120, windows: [{ start: now + 3600000, end: now + 10800000 }] }, { taskId: 'task-0', minutes: 120, windows: [{ start: now - 900000, end: now + 6300000 }] }], planned: 240, capacity: 300, risks: ['late'] } };
    const ui = mockUi(state);
    let renders = 0, anchors = 0;
    ui.render = () => {
        renders++;
    };
    const root = renderToday({ ...ui, keepViewAnchor: () => {
            anchors++;
        } }, state), work = root.children.find((n: any) => n.className === 'work-state'), main = root.children.find((n: any) => n.className === 'today-main');
    const [toggle, panel] = main.children, flame = work.children[0];
    const assertCurrentSession = () => {
        const current = walk(panel).filter(n => n.className.includes('session-window') && n.attrs['aria-current'] === 'time');
        assert.equal(current.length, 1);
        assert.match(flatten(current[0]), /▶\s+11:15–13:15/);
    };
    assertCurrentSession();
    assert.match(flatten(panel), /2 việc trong lịch đã quá hạn/);
    const rows = walk(panel).filter(n => n.className.startsWith('daily-item') && !n.className.includes('open') && !n.className.includes('windows'));
    assert.match(flatten(rows[0]), /#24/);
    assert.match(flatten(rows[1]), /#25/);
    toggle.children[1].action();
    assert.equal(state.mode, 'tasks');
    assert.equal(toggle.children[1].attrs['aria-pressed'], 'true');
    assert.equal(work.children[0], flame);
    assert.equal(main.children[0], toggle);
    assert.equal(main.children[1], panel);
    assert.equal(panel.children[0].className, 'task-list-section');
    assert.equal(renders, 0);
    assert.equal(anchors, 1);
    assertCurrentSession();
    assert.match(flatten(panel), /2 việc trong lịch đã quá hạn/);
    toggle.children[0].action();
    assert.equal(state.mode, 'timeline');
    assert.equal(panel.children[0].className, 'daily-plan');
    assert.equal(anchors, 2);
    assert.equal(work.children[0], flame);
    assert.ok(!styles.includes('.today-page:has(.daily-plan)'));
    state.dailyPlan = null;
    state.mode = 'tasks';
    assert.ok(renderToday(ui, state).children.some((n: any) => n.className === 'work-state'));
});
test('Today collapses completed work in both modes while keeping unfinished sessions and daily totals', async () => {
    const viewPath = '../../web/views/today.js', apiPath = '../../web/api.js';
    const { renderToday } = await import(viewPath);
    const { createDemo } = await import(apiPath);
    const state: any = createDemo(), now = Date.parse('2026-10-05T11:30:00+07:00');
    Object.assign(state, { serverNow: now, loadedAt: Date.now(), operatingDay: Math.floor((now + 25200000 - 270 * 60000) / 86400000) });
    state.tasks.forEach((task: any, index: number) => task.id = 'task-' + index);
    Object.assign(state.tasks[0], { done: true, completedAt: now });
    Object.assign(state.tasks[2], { done: true, completedAt: now - 86400000 });
    state.dailyPlan = { plan: { items: [
        { taskId: 'task-0', minutes: 120, actualMinutes: 0, windows: [{ start: now - 14400000, end: now - 7200000 }] },
        { taskId: 'task-1', minutes: 120, actualMinutes: 30, windows: [{ start: now - 3600000, end: now - 600000 }] }
    ], planned: 240, capacity: 300, risks: [] } };
    for (const mode of ['timeline', 'tasks']) {
        state.mode = mode;
        const root = renderToday(mockUi(state), state);
        const section = walk(root).find(n => n.className === (mode === 'timeline' ? 'daily-plan' : 'task-list-section'));
        const done = section.children.find((n: any) => n.className.includes('completed-today'));
        assert.equal(done.open, false);
        assert.equal(done.children[0].value, 'Xem việc đã xong (1)');
        assert.match(flatten(done), /#24/);
        const list = section.children.find((n: any) => n.className === (mode === 'timeline' ? 'daily-list' : 'card task-board'));
        assert.match(flatten(list), /#25/);
        assert.doesNotMatch(flatten(list), /#24|#26/);
        assert.equal(walk(list).filter(n => n.className.split(' ').includes('done')).length, 0);
        assert.equal(walk(list).some(n => n.attrs['aria-current'] === 'time'), false);
        if (mode === 'timeline')
            assert.match(flatten(section), /30 phút đã làm · 1 đã xong · 4 giờ đã xếp/);
        else
            assert.match(flatten(section.children.find((n: any) => n.className.includes('history-section'))), /#26/);
    }
    Object.assign(state.tasks[1], { done: true, completedAt: now });
    state.mode = 'timeline';
    const root = renderToday(mockUi(state), state);
    assert.match(flatten(root), /Đã xong các việc trong lịch hôm nay/);
    assert.match(flatten(root), /Xem việc đã xong \(2\)/);
    assert.match(flatten(root), /2 đã xong · 4 giờ đã xếp/);
});

test('reminders defaults to all and offers a way out of empty filters', async () => {
    const viewPath = '../../web/views/reminders.js', apiPath = '../../web/api.js';
    const { renderReminders } = await import(viewPath), { createDemo } = await import(apiPath), state = createDemo(), ui = mockUi(state);
    state.reminders = [{ id: 1, title: 'Gọi cho mẹ', kind: 'once', times: '18:30', start: '2026-10-06', weekdays: [], enabled: true }];
    let root = renderReminders(ui, state);
    assert.equal(state.reminderFilter, 'all');
    assert.equal(walk(root).filter(n => n.className === 'reminder-row').length, 1);
    assert.match(flatten(root), /18:30.*Gọi cho mẹ.*06\/10\/2026.*Đang bật/);
    state.reminderFilter = 'recurring';
    root = renderReminders(ui, state);
    assert.match(flatten(root), /Nhóm này chưa có lịch/);
    walk(root).find(n => n.value === 'Xem tất cả lời nhắc').action();
    assert.equal(state.reminderFilter, 'all');
    state.reminders = [];
    root = renderReminders(ui, state);
    assert.match(flatten(root), /Một lời nhắc, nhẹ đầu hơn/);
    assert.ok(contains(reminders, 'reminder-times'));
    assert.ok(!styles.includes('.reminder-badge{display:none}'));
});
test('reward sheet keeps its header outside one bounded, keyboard-accessible scroll region', () => {
    assert.ok(contains(app, "sheet.classList.add('reward-sheet-open')"));
    assert.ok(contains(app, "calendar.tabIndex=0;calendar.setAttribute('role','region')"));
    assert.ok(contains(app, "sheetContent.append(calendar);calendar.scrollTop=0"));
    assert.ok(contains(app, "function openSheet(title){resetSheetLayout()"));
    assert.ok(contains(app, "function closeSheet(){resetSheetLayout()"));
    assert.ok(contains(app, "sheet.addEventListener('close',()=>{resetSheetLayout()"));
    const sheet = styles.match(/dialog\.reward-sheet-open\{([^}]+)\}/)?.[1] ?? '';
    const content = styles.match(/dialog\.reward-sheet-open #sheet-content\{([^}]+)\}/)?.[1] ?? '';
    const header = styles.match(/dialog\.reward-sheet-open \.sheet-title-row\{([^}]+)\}/)?.[1] ?? '';
    const calendar = styles.match(/dialog\.reward-sheet-open \.checkin-calendar-content\{([^}]+)\}/)?.[1] ?? '';
    assert.match(sheet, /display:flex/);
    assert.match(sheet, /overflow:hidden/);
    assert.match(sheet, /height:min\(88dvh,840px\)/);
    assert.match(content, /min-height:0/);
    assert.match(content, /overflow:hidden/);
    assert.match(header, /position:static/);
    assert.match(header, /flex:0 0 auto/);
    assert.doesNotMatch(header, /sticky|fixed/);
    assert.match(calendar, /flex:1 1 auto/);
    assert.match(calendar, /min-height:0/);
    assert.match(calendar, /overflow-y:auto/);
    assert.ok(!styles.includes('dialog:has(.checkin-calendar-content) .sheet-title-row'));
});
test('desktop identity and navigation scroll together while mobile keeps its bottom navigation', () => {
    const desktop = styles.slice(styles.indexOf('@media(min-width:900px){'), styles.indexOf('/* Reward calendar:'));
    const header = desktop.match(/\.app-header\{([^}]+)\}/)?.[1] ?? '', nav = desktop.match(/\.bottom-nav\{([^}]+)\}/)?.[1] ?? '';
    assert.match(header, /position:static/);
    assert.match(nav, /position:static/);
    assert.doesNotMatch(header, /sticky|fixed/);
    assert.doesNotMatch(nav, /sticky|fixed/);
    assert.match(desktop, /grid-template-rows:auto auto 1fr/, 'header height must not overlap the navigation');
    assert.match(styles, /\.bottom-nav\{position:fixed;bottom:0/, 'mobile bottom navigation stays fixed');
});
test('compact checkin shows the next milestone and exact claims remaining, then the new-cycle date', async () => {
    const viewPath = '../../web/views/achievements.js', apiPath = '../../web/api.js';
    const { renderCheckin } = await import(viewPath), { createDemo } = await import(apiPath), state = createDemo(), ui = mockUi(state);
    const now = Date.parse('2026-10-05T09:00:00+07:00'), day = Math.floor((now + 25200000) / 86400000);
    for (const [count, milestone, left] of [[0, 7, 7], [1, 7, 6], [6, 7, 1], [7, 14, 7], [14, 21, 7], [21, 30, 9], [29, 30, 1]]) {
        state.cultivation.checkin = { cycleStartDay: day - 29, count, lastDay: day - 1 };
        const goal = walk(renderCheckin(ui, state, now)).find(n => n.className === 'subtitle checkin-goal');
        assert.match(flatten(goal).replace(/\s+/g, ' '), new RegExp('Mốc ' + milestone + ' · Còn ' + left + ' lần điểm danh'));
        assert.match(goal.attrs['aria-label'], /để nhận quà mốc/);
    }
    state.cultivation.checkin = { cycleStartDay: day - 29, count: 30, lastDay: day };
    assert.match(flatten(renderCheckin(ui, state, now)), /Đã nhận đủ quà · Chu kỳ mới từ 08[-/]10/);
    state.cultivation.checkin = { cycleStartDay: day - 32, count: 30, lastDay: day - 1 };
    assert.match(flatten(renderCheckin(ui, state, now)).replace(/\s+/g, ' '), /Mốc 7 · Còn 7 lần điểm danh/);
    assert.doesNotMatch(achievements, /Ngày kia/);
});
