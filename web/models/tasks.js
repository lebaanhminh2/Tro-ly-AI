const DAY_MS = 86400000;
export function taskBuckets(tasks, day, start = '04:30') {
    const [hour, minute] = String(start).split(':').map(Number), startMinutes = hour * 60 + minute;
    const completionDay = at => Math.floor((at + 7 * 3600000 - startMinutes * 60000) / DAY_MS);
    const active = [], completedToday = [], history = [];
    for (const task of tasks) {
        if (!task.done)
            active.push(task);
        else if (Number.isFinite(task.completedAt) && Number.isInteger(day) && completionDay(task.completedAt) === day)
            completedToday.push(task);
        else
            history.push(task);
    }
    return { active, completedToday, history };
}
