import { payBattleDeath } from '../../domain/battle-economy.ts';
import { battleHabitContribution, settleBattleDay } from '../../domain/battle-run.ts';
import type { PracticeSource } from '../../domain/practice.ts';
import type { HabitDay } from '../../ports/habit-store.ts';
import { battleJson, battleVictoryStatements, storedBattle, type BattleRow } from './battle-store.ts';
import { query, type Database, type Statement } from './database.ts';
import { HealthyStore } from './healthy-store.ts';
import { supportsContentVersion } from '../../domain/game-content.ts';

export async function prepareBattleSettlement(db: Database, owner: string, id: string, day: HabitDay, now: number, sources: PracticeSource[]) {
    const [row, choice] = await Promise.all([
        query(db, 'SELECT id,version,status,state_json,content_json,created FROM battles WHERE owner=? AND id=?', owner, id).first<BattleRow>(),
        query(db, 'SELECT technique_id,accept_cost FROM battle_choices WHERE owner=? AND battle_id=? AND day=?', owner, id, day.day)
            .first<{ technique_id: string; accept_cost: number }>(),
    ]);
    if (!row) throw Error('BATTLE_NOT_FOUND');
    const battle = storedBattle(row);
    if (!supportsContentVersion(battle.run.contentVersion)) throw Error('GAME_CONTENT_UNSUPPORTED');
    const habits = battleHabitContribution(sources);
    const tasks = battle.run.state.status === 'active' && choice ? (await query(db, `SELECT s.task_id,s.title FROM battle_task_sources s
        JOIN tasks t ON t.owner=s.owner AND t.id=s.task_id JOIN task_completions c ON c.owner=t.owner AND c.task_id=t.id
        WHERE s.owner=? AND s.battle_id=? AND t.status='completed' AND t.deleted_at IS NULL AND c.completed_at>=? AND c.completed_at<?
        AND NOT EXISTS(SELECT 1 FROM task_battle_awards a WHERE a.owner=s.owner AND a.task_id=s.task_id) ORDER BY c.completed_at,s.task_id LIMIT 2`,
        owner, id, day.startAt, day.endAt).all<{ task_id: string; title: string }>()).results : [];
    const outcome = settleBattleDay(battle.run, day.day, choice ? { techniqueId: choice.technique_id, acceptCost: !!choice.accept_cost,
        contribution: { habits, tasks: tasks.length * 50 } } : null);
    battle.run = outcome.run; battle.version++; battle.status = outcome.run.state.status;
    const castExecuted = !!choice && battle.run.state.lastUses[choice.technique_id] === battle.run.state.turn && outcome.fought;
    const usedTasks = castExecuted ? tasks : [];
    const statements: Statement[] = [query(db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM battles WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END', owner, id, row.version)];
    let qiSpent = 0;
    if (outcome.automaticDeath && !battle.run.deathPaid) {
        const healthy = await new HealthyStore(db).read(owner), paid = payBattleDeath(healthy.state, battle.run.state);
        battle.run.state = paid.battle; battle.run.deathPaid = true; battle.status = 'dead'; qiSpent = paid.qiSpent;
        statements.push(query(db, 'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM cultivation_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END', owner, healthy.version),
            query(db, `INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)
                ON CONFLICT(owner) DO UPDATE SET state_json=excluded.state_json,version=version+1,updated=excluded.updated`, owner, JSON.stringify(paid.healthy), now));
        outcome.entries.push({ kind: 'cost', text: 'Tử trận: mất ' + qiSpent + ' Tu Vi; cảnh giới và vật phẩm được giữ.', amount: qiSpent });
    }
    const result = { status: battle.run.state.status, turn: battle.run.state.turn, fought: outcome.fought, castExecuted,
        player: battle.run.state.player, boss: battle.run.state.boss, contribution: { habits: castExecuted ? habits : 0, tasks: usedTasks.length * 50 },
        tasks: usedTasks.map(task => ({ taskId: task.task_id, title: task.title })), waitDays: battle.run.waitDays, qiSpent };
    if (['won', 'expired', 'withdrawn', 'dead'].includes(battle.status)) battle.finishedDay = day.day;
    statements.push(query(db, 'UPDATE battles SET version=?,status=?,state_json=?,updated=? WHERE owner=? AND id=?', battle.version, battle.status, battleJson(battle), now, owner, id),
        query(db, 'INSERT INTO battle_events(owner,battle_id,sequence,day,kind,entries_json,result_json,created) VALUES(?,?,?,?,?,?,?,?)',
            owner, id, battle.version, day.day, 'settlement', JSON.stringify(outcome.entries), JSON.stringify(result), now),
        query(db, `INSERT INTO task_battle_awards(owner,task_id,battle_id,day,created) SELECT ?,value,?,?,? FROM json_each(?)`,
            owner, id, day.day, now, JSON.stringify(usedTasks.map(task => task.task_id))),
        ...battleVictoryStatements(db, owner, battle, now));
    if (['won', 'dead', 'expired', 'withdrawn'].includes(battle.run.state.status)) statements.push(query(db, `INSERT INTO game_selections(owner,from_day,mode,practice_id,battle_id,created)
        SELECT ?,?,CASE WHEN p.id IS NULL THEN 'idle' ELSE 'practice' END,p.id,NULL,? FROM (SELECT 1) anchor
        LEFT JOIN practice_versions p ON p.owner=? AND p.id=? AND json_array_length(p.state_json,'$.tiers')<4
        WHERE 1
        ON CONFLICT(owner,from_day) DO NOTHING`, owner, day.day + 1, now, owner, battle.resumePracticeId));
    return { statements, result, entries: outcome.entries };
}
