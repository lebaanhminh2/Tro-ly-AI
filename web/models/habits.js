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
export function safeCsvCell(value) {
    const raw = String(value ?? '');
    const text = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + text.replaceAll('"', '""') + '"';
}
