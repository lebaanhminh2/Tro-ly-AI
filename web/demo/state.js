// Prototype intentionally has no network/storage/auth. Reload restores the sample.
export function createDemo() {
    return {
        tab: 'today', mode: 'timeline', reminderFilter: 'all', screenState: 'ready', selected: new Set(), selecting: false,
        historyOffset: 0, historyHasMore: false, historyLoading: false,
        start: '04:30', sleep: '22:30', autoPlanDelayMinutes: 180, resting: false,
        cultivation: { qi: 20, totalEarned: 145, rank: 1, highestRank: 1, streak: 3, tickets: 3, checkin: null, rewardedTasks: [], failures: 0, immortalPity: false, attemptDay: null, protectedUntil: 0, inventory: { basic: 3, middle: 0, high: 0, supreme: 0, immortal: 0, heart: 1, peace: 1, keepsake: 0 }, active: { heart: false, peace: false }, log: [] },
        tasks: [
            { code: 24, title: 'Báo cáo môn học', deadline: '2026-09-18', done: false, steps: [{ code: '24.1', title: 'Đọc yêu cầu', done: true }, { code: '24.2', title: 'Viết dàn ý', done: false }, { code: '24.3', title: 'Viết bản nháp', done: false }], nextStep: 4 },
            { code: 25, title: 'Bài tập xác suất', deadline: '2026-09-19', done: false, steps: [], nextStep: 1 },
            { code: 26, title: 'Ôn từ vựng tiếng Anh', deadline: '', done: false, steps: [], nextStep: 1 }
        ],
        nextTask: 27,
        reminders: [
            { id: 1, title: 'Uống nước', kind: 'daily', times: '09:00, 15:00', weekdays: [], start: '2026-09-13', end: '', enabled: true },
            { id: 2, title: 'Ôn từ vựng', kind: 'weekdays', times: '19:00', weekdays: [1, 3, 5], start: '2026-09-13', end: '', enabled: true },
            { id: 3, title: 'Gọi cho mẹ', kind: 'once', times: '18:30', weekdays: [], start: '2026-09-14', end: '', enabled: true }
        ],
        nextReminder: 4
    };
}
