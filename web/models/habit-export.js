/** A readable archive of the selected period, not an import/restore command. */
export function habitJsonExport(data, rows, range, filters) {
    return {
        format: 'assistant-habits', version: 1, exportedAt: new Date(data.now).toISOString(),
        operatingDay: { ...data.day }, range: { ...range }, filters: { ...filters }, valueScale: 100,
        states: { achieved: 'Đủ mục tiêu', missed: 'Thiếu cam kết', neutral: 'Không phát sinh nghĩa vụ hôm đó', processing: 'Ngày chưa chốt' },
        habits: data.habits.filter(view => !filters.habitId || view.habit.id === filters.habitId).map(view => ({
            id: view.habit.id, createdDay: view.habit.createdDay, archivedFrom: view.habit.archivedFrom,
            revisions: view.habit.revisions, reminderTime: view.reminderTime ?? null,
        })),
        history: rows,
    };
}
