const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
export const habitWeekdays = weekdays;
export const habitNumber = value => Number(value / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const habitDate = day => new Date(day * 86400000).toLocaleDateString('vi-VN', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
export function cadenceLabel(cadence) {
    if (cadence.kind === 'daily') return 'Mỗi ngày';
    if (cadence.kind === 'weekly') return cadence.quota + ' ngày / tuần';
    return cadence.weekdays.map(day => day === 6 ? 'CN' : 'T' + (day + 2)).join(' · ');
}
export function habitStatus(view, day) {
    const { habit, definition, pending, preview, log } = view;
    if (habit.archivedFrom !== null && day >= habit.archivedFrom)
        return pending?.archivedFrom === null ? 'Hoạt động lại từ ' + habitDate(pending.fromDay) : 'Đã lưu trữ';
    if (day < definition.commitmentFrom) return 'Cam kết từ ' + habitDate(definition.commitmentFrom);
    if (preview?.reason === 'not_scheduled') return 'Hôm nay ngoài lịch';
    if (preview?.reason === 'quota_met') return 'Đã đủ cam kết tuần';
    if (log.value >= definition.target) return 'Đã đạt hôm nay';
    return definition.cadence.kind === 'weekly' ? 'Linh hoạt trong tuần' : 'Chưa đạt hôm nay';
}
export const habitClock = at => new Date(at).toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
});
// Each fact appears once in details; the list shows only the most useful one.
export function habitFacts(view, day) {
    const { habit, definition, preview, pending, slot, reminderTime, log } = view;
    const facts = [], archived = habit.archivedFrom !== null && day >= habit.archivedFrom;
    const add = (key, text, priority, urgent = false) => facts.push({ key, text, priority, urgent });
    if (archived) add('status', habitStatus(view, day), 0);
    else if (day < definition.commitmentFrom) add('status', 'Cam kết từ ' + habitDate(definition.commitmentFrom), 5);
    else if (definition.cadence.kind === 'weekly' && preview?.misses && log.value < definition.target) add('status', 'Cần đạt hôm nay để giữ cam kết tuần', 0, true);
    else if (preview?.reason === 'not_scheduled') add('status', 'Hôm nay ngoài lịch', 10);
    else if (preview?.reason === 'quota_met') add('status', 'Đã đủ cam kết tuần', 10);
    if (slot && !archived) add('slot', 'Lịch ' + habitClock(slot.startAt) + ' · ' + slot.minutes + ' phút', 20);
    const cadence = definition.cadence.kind === 'weekly' && preview && day >= definition.commitmentFrom
        ? 'Tuần này ' + preview.period.completedDays.length + '/' + definition.cadence.quota + ' ngày'
        : cadenceLabel(definition.cadence);
    add('cadence', cadence, 30);
    if (reminderTime && !archived) add('reminder', 'Nhắc lúc ' + reminderTime, 40);
    if (pending && !(archived && pending.archivedFrom === null)) add('pending', 'Thay đổi từ ' + habitDate(pending.fromDay), 50);
    if (!archived && habit.archivedFrom !== null) add('archive', 'Lưu trữ từ ' + habitDate(habit.archivedFrom), 50);
    if (definition.note) add('definitionNote', definition.note, 60);
    if (log.note) add('logNote', log.note, 60);
    return facts.sort((a, b) => a.priority - b.priority);
}
export function habitSummary(view, day) {
    const facts = habitFacts(view, day);
    return { primary: facts[0], extra: Math.max(0, facts.length - 1) };
}
export function safeCsvCell(value) {
    const raw = String(value ?? '');
    const text = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + text.replaceAll('"', '""') + '"';
}
