export const practiceTiers = ['Nhập môn', 'Tiểu thành', 'Đại thành', 'Viên mãn'];
export const practiceNumber = value => (Number(value) / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export const purityLabel = value => (Number(value) / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
export function practiceStatus(version) {
    if (version.rule === 'practice-v2') {
        if (version.tiers.length === 4) return version.pendingWeeks.length ? 'Hoàn tất 4 tầng · chờ cam kết tuần' : 'Hoàn tất 4 tầng';
        return 'Đang luyện tầng ' + (version.tiers.length + 1);
    }
    if (version.tiers.length === 4) return 'Đã Viên mãn';
    if (version.pendingWeeks.length && version.progressMilli >= version.costsMilli[version.tiers.length]) return 'Đủ tiến độ · chờ cam kết tuần';
    return 'Đang luyện ' + practiceTiers[version.tiers.length];
}
