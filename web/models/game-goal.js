// Suggestions use public, already unlocked data. Following opens a screen;
// it never starts a battle, logs a habit or spends a resource.
export function nearestGameGoal(data, catalog) {
    if (!data || !catalog) return null;
    if (data.settledThrough !== null && data.settledThrough < data.day.day - 1) return { kind: 'refresh', title: 'Chốt nhịp đã qua',
        description: 'Cập nhật kết quả trước khi chọn bước tiếp theo.', action: 'Cập nhật kết quả' };
    if ((data.battles ?? []).some(battle => ['prepared', 'active', 'awaiting_rescue'].includes(battle.status)) || data.pending) return null;
    const version = data.currentPractice?.practice;
    if (version && !version.tiers.length) return { kind: 'habits', title: 'Tới Nhập môn',
        description: version.pendingWeeks.length && version.progressMilli >= version.costsMilli[0]
            ? 'Đủ tiến độ rồi. Tầng sẽ chốt khi cam kết tuần kết thúc hoặc đã đủ số ngày cần làm.'
            : 'Đạt mục tiêu habit theo lịch để luyện tầng đầu. Từ Nhập môn, bản này đã dùng được trong trận.', action: 'Xem thói quen' };
    const won = new Set(data.victories ?? []), learned = new Set(data.learned ?? []);
    const mainIds = (catalog.chapters ?? []).flatMap(chapter => chapter.encounters);
    const nextMain = mainIds.map(id => catalog.bosses.find(boss => boss.id === id)).find(boss => boss && !won.has(boss.id));
    const ready = boss => boss.requires.every(id => won.has(id));
    const next = nextMain && ready(nextMain) ? nextMain : catalog.bosses.find(boss => !won.has(boss.id) && ready(boss));
    if (!next) return { kind: 'collection', title: 'Một hành trình đã trọn', description: 'Cậu có thể đọc lại những trận đã qua, xem chiến tích hoặc luyện một bản mới.', action: 'Mở sưu tập' };
    const missing = (next.practicePrerequisites ?? []).find(id => !learned.has(id));
    if (missing) {
        const technique = catalog.techniques.find(value => value.id === missing);
        return { kind: 'technique', id: missing, title: 'Chuẩn bị cho ' + next.name,
            description: 'Cần luyện ' + (technique?.name ?? missing) + ' tới Nhập môn trước thử thách này.', action: 'Xem công pháp' };
    }
    return { kind: 'boss', id: next.id, chapter: next.chapter, title: next.name,
        description: 'Chương ' + next.chapter + ' · ' + (nextMain?.id === next.id ? 'Bước tiếp theo của tuyến truyện.' : 'Một thử thách còn chờ cậu.')
            + ' Xem cơ chế và bộ chiêu trước khi quyết định xuất chiến.', action: 'Xem thử thách' };
}

export function returnGameSummary(data) {
    if ((data?.battles ?? []).some(battle => ['prepared', 'active', 'awaiting_rescue'].includes(battle.status))) return null;
    // The last battle remains available after a long absence, even when its
    // settlement is no longer among the recent daily rows.
    const battle = (data?.battles ?? [])[0];
    const latest = [...(data?.recent ?? [])].sort((a, b) => b.day - a.day)[0];
    const result = battle ?? (latest && data.day.day - latest.day <= 7 && latest.mode === 'battle' ? latest.result.battle : null);
    if (!result) return null;
    if (result.status === 'withdrawn' && result.waitDays >= 3) return 'Trận đã rút an toàn sau ba ngày chưa chọn chiêu. Cam kết habit vẫn chốt theo lịch; cậu có thể chuẩn bị lại khi sẵn sàng.';
    if (result.status === 'expired') return 'Trận đã hết lượt giao chiến. Mở nhật ký để xem chiêu nào cần đổi trước lần tiếp theo.';
    if (result.status === 'dead') return 'Trận đã kết thúc. Nhật ký giữ diễn biến và phần Tu Vi đã mất; các bản luyện vẫn được giữ.';
    return null;
}
