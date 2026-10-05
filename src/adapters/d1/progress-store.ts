import { achievementRules, type BoardSelection, type ProgressChange, type ProgressData, type WorkFilter, type WorkPage } from '../../domain/progress.ts';
import { query, type Database, type Statement } from './database.ts';
export async function progressData(db: Database, owner: string): Promise<ProgressData> {
    const [c, m, a] = await Promise.all([
        query(db, 'SELECT c.*,t.title FROM task_completions c JOIN tasks t ON t.id=c.task_id AND t.owner=c.owner WHERE c.owner=? ORDER BY c.completed_at DESC', owner).all<ProgressData['completions'][number]>(),
        query(db, 'SELECT * FROM task_progress WHERE owner=? ORDER BY created DESC', owner).all<ProgressData['milestones'][number]>(),
        query(db, 'SELECT * FROM achievements WHERE owner=?', owner).all<ProgressData['achievements'][number]>()
    ]);
    return { completions: c.results, milestones: m.results, achievements: a.results };
}
// Achievement rules need counts and active dates, not every task title/note.
export async function achievementStatistics(db: Database, owner: string, now: number) {
    const today = Math.floor((now + 25200000) / 86400000);
    const [count, days] = await Promise.all([
        query(db, 'SELECT COUNT(*) AS total FROM task_completions c JOIN tasks t ON t.id=c.task_id AND t.owner=c.owner WHERE c.owner=?', owner).first<{
            total: number;
        }>(),
        query(db, `WITH activity AS (
   SELECT c.completed_at AS at FROM task_completions c JOIN tasks t ON t.id=c.task_id AND t.owner=c.owner WHERE c.owner=?
   UNION ALL SELECT created AS at FROM task_progress WHERE owner=?
  ), dates AS (
   SELECT CAST((at+25200000)/86400000 AS INTEGER)-CASE WHEN at+25200000<0 AND (at+25200000)%86400000<>0 THEN 1 ELSE 0 END AS day FROM activity
  ) SELECT DISTINCT day FROM dates WHERE day<=? ORDER BY day`, owner, owner, today).all<{
            day: number;
        }>()
    ]);
    let best = 0, run = 0, previous = -Infinity;
    for (const { day } of days.results) {
        run = day === previous + 1 ? run + 1 : 1;
        best = Math.max(best, run);
        previous = day;
    }
    return { total: count?.total ?? 0, best };
}
export async function unlockAchievements(db: Database, owner: string, now: number) {
    const stats = await achievementStatistics(db, owner, now);
    const earned = achievementRules.filter(r => stats[r.kind] >= r.target);
    if (earned.length)
        await db.batch(earned.map(r => query(db, 'INSERT OR IGNORE INTO achievements(owner,code,unlocked_at) VALUES(?,?,?)', owner, r.code, now)));
    // One deterministic delivery key per achievement prevents concurrent cron/webhook
    // unlockers from sending overlapping groups twice.
    for (const rule of earned)
        await db.batch([
            query(db, "INSERT OR IGNORE INTO outbox(id,payload,available) SELECT ?,?,? FROM achievements WHERE owner=? AND code=? AND notified=0", 'achievement:' + owner + ':' + rule.code, JSON.stringify({ method: 'sendMessage', chat_id: Number(owner), text: '🏅 Mở khóa: ' + rule.label + '\nUi giỏi thế :> tớ tự hào về cậu đấy.' }), now, owner, rule.code),
            query(db, 'UPDATE achievements SET notified=1 WHERE owner=? AND code=? AND EXISTS(SELECT 1 FROM outbox WHERE id=?)', owner, rule.code, 'achievement:' + owner + ':' + rule.code)
        ]);
}
export async function boardSelection(db: Database, owner: string): Promise<BoardSelection> {
    const row = await query(db, 'SELECT items,expires,revision FROM task_board_selection WHERE owner=?', owner).first<{
        items: string;
        expires: number;
        revision: number;
    }>();
    return row ? { ...row, items: JSON.parse(row.items) } : { items: [], expires: 0, revision: 0 };
}
export async function workPage(db: Database, owner: string, filter: WorkFilter, offset: number, now: number): Promise<WorkPage> {
    if (!['active', 'all', 'overdue', 'today', 'upcoming', 'undated', 'completed'].includes(filter) || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
        throw Error('INVALID_BOARD_QUERY');
    const start = Math.floor((now + 25200000) / 86400000) * 86400000 - 25200000, end = start + 86400000;
    const deadline = "CAST((julianday(CASE WHEN deadline_precision='date' THEN deadline||'T23:59:00+07:00' ELSE deadline END)-2440587.5)*86400000 AS INTEGER)";
    const clauses = { all: '1=1', active: "status='active'", completed: "status='completed'", undated: "status='active' AND deadline IS NULL", overdue: `status='active' AND deadline IS NOT NULL AND ${deadline}<?`, today: `status='active' AND ${deadline}>=? AND ${deadline}<?`, upcoming: `status='active' AND ${deadline}>=?` };
    const values = filter === 'overdue' ? [now] : filter === 'today' ? [start, end] : filter === 'upcoming' ? [end] : [];
    const where = 'owner=? AND deleted_at IS NULL AND ' + clauses[filter];
    const count = await query(db, 'SELECT COUNT(*) AS n FROM tasks WHERE ' + where, owner, ...values).first<{
        n: number;
    }>();
    const rows = await query(db, 'SELECT * FROM tasks WHERE ' + where + ' ORDER BY status,deadline IS NULL,deadline,created,id LIMIT 5 OFFSET ?', owner, ...values, offset).all<import('../../domain/work.ts').Task>();
    return { items: rows.results, total: count?.n ?? 0 };
}
export function progressStatements(db: Database, owner: string, c: ProgressChange): Statement[] {
    if (c.owner !== owner)
        throw Error('OWNER_MISMATCH');
    const q = (sql: string, ...args: (string | number | null)[]) => query(db, sql, ...args);
    if (c.type === 'progress-record')
        return [
            q("INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE id=? AND owner=? AND status='active' AND deleted_at IS NULL) THEN 1 ELSE 0 END", c.taskId, owner),
            q('INSERT OR IGNORE INTO task_progress(id,owner,task_id,content,created,source_update) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM task_progress WHERE owner=? AND task_id=? AND trim(content)=trim(?))', c.id, owner, c.taskId, c.content, c.created, c.updateId, owner, c.taskId, c.content)
        ];
    if (c.type === 'board-select')
        return [
            q('INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT revision FROM task_board_selection WHERE owner=?),0)=? THEN 1 ELSE 0 END', owner, c.expectedRevision),
            q('INSERT INTO task_board_selection(owner,items,expires) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET items=excluded.items,expires=excluded.expires,revision=revision+1', owner, JSON.stringify(c.items), c.expires)
        ];
    if (!c.items.length || c.items.length > 50)
        throw Error('INVALID_DELETE_GROUP');
    const statements = [q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM task_board_selection WHERE owner=? AND revision=? AND expires>? AND items=?) THEN 1 ELSE 0 END', owner, c.selectionRevision, c.now, JSON.stringify(c.items))];
    for (const t of c.items)
        statements.push(q('INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM tasks WHERE owner=? AND id=? AND version=? AND deleted_at IS NULL) THEN 1 ELSE 0 END', owner, t.id, t.version), q('UPDATE tasks SET deleted_at=?,version=version+1 WHERE owner=? AND id=?', c.now, owner, t.id), q("UPDATE task_appointments SET status='cancelled',version=version+1 WHERE owner=? AND task_id=? AND status='active'", owner, t.id), q("UPDATE reminders SET status='cancelled' WHERE owner=? AND session_id IN (SELECT id FROM sessions WHERE owner=? AND task_id=?) AND status IN ('pending','queued')", owner, owner, t.id), q("UPDATE sessions SET status='skipped',version=version+1,active_since=NULL WHERE owner=? AND task_id=? AND status NOT IN ('completed','skipped')", owner, t.id), q("UPDATE conversation_clarifications SET status='cancelled' WHERE owner=? AND task_id=? AND status='waiting'", owner, t.id));
    statements.push(q("UPDATE task_board_selection SET items='[]',revision=revision+1,expires=0 WHERE owner=?", owner));
    return statements;
}
