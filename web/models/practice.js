export const practiceTiers = ['Nhập môn', 'Tiểu thành', 'Đại thành', 'Viên mãn'];
export const practiceNumber = value => (Number(value) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const purityLabel = value => (Number(value) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
export function practiceStatus(version) {
    if (version.tiers.length === 4) return 'Đã Viên mãn';
    if (version.pendingWeeks.length && version.progressMilli >= version.costsMilli[version.tiers.length]) return 'Đủ tiến độ · chờ cam kết tuần';
    return 'Đang luyện ' + practiceTiers[version.tiers.length];
}
