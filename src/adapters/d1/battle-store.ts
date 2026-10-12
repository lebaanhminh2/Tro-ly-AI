import { bossById } from '../../domain/game-content.ts';
import { publicBattleState, type EquippedTechnique } from '../../domain/battle.ts';
import type { PracticeVersion } from '../../domain/practice.ts';
import type { BattleChange, BattleSaved, BattleSnapshot, BattleStore, StoredBattle } from '../../ports/battle-store.ts';
import type { HabitDay } from '../../ports/habit-store.ts';
import { query, type Database, type Statement } from './database.ts';
import { D1GameStore } from './game-store.ts';
import { HealthyStore } from './healthy-store.ts';
import { initialHealthy, type HealthyState } from '../../domain/healthy.ts';
import { rescueQuote } from '../../domain/battle-economy.ts';
import { earnedBattleRewards } from '../../domain/game-rewards.ts';

export type BattleRow = { id: string; version: number; status: string; state_json: string; content_json: string; created: number };
export const storedBattle = (row: BattleRow): StoredBattle => ({ ...JSON.parse(row.state_json) as Omit<StoredBattle, 'version' | 'status' | 'content' | 'created'>,
    version: row.version, status: row.status, content: JSON.parse(row.content_json), created: row.created });
export const battleJson = (battle: StoredBattle) => JSON.stringify({ run: battle.run, resumePracticeId: battle.resumePracticeId });

export function battleVictoryStatements(db: Database, owner: string, battle: StoredBattle, now: number): Statement[] {
    if (battle.run.state.status !== 'won') return [];
    const rewards = earnedBattleRewards(battle.content, battle.run.state);
    const entitlements = [...rewards.weapons.map(id => ({ kind: 'weapon', id })), ...rewards.achievements.map(id => ({ kind: 'achievement', id }))];
    return [query(db, 'INSERT OR IGNORE INTO boss_victories(owner,boss_id,battle_id,created) VALUES(?,?,?,?)', owner, battle.run.bossId, battle.run.id, now),
        query(db, `INSERT OR IGNORE INTO technique_unlocks(owner,technique_id,source,created)
            SELECT ?,value,?,? FROM json_each(?)`, owner, 'boss:' + battle.run.bossId, now, JSON.stringify(battle.content.unlocks)),
        query(db, `INSERT OR IGNORE INTO game_entitlements(owner,kind,id,battle_id,created)
            SELECT ?,json_extract(value,'$.kind'),json_extract(value,'$.id'),?,? FROM json_each(?)`, owner, battle.run.id, now, JSON.stringify(entitlements))];
}

export class D1BattleStore implements BattleStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    async readBattle(owner: string, id: string): Promise<StoredBattle | null> {
        const row = await query(this.db, 'SELECT id,version,status,state_json,content_json,created FROM battles WHERE owner=? AND id=?', owner, id).first<BattleRow>();
        return row ? storedBattle(row) : null;
    }
    private async loadout(owner: string, ids: string[]): Promise<EquippedTechnique[]> {
        return (await this.resolveLoadout(owner, ids)).map(version => ({ id: version.techniqueId,
            versionId: version.versionId, tier: version.tier, purityBp: version.purityBp }));
    }
    async resolveLoadout(owner: string, ids: string[]) {
        if (!Array.isArray(ids) || ids.length > 5 || new Set(ids).size !== ids.length ||
            ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,110}$/.test(id))) throw Error('INVALID_BATTLE_LOADOUT');
        if (!ids.length) return [];
        const rows = (await query(this.db, 'SELECT id,state_json FROM practice_versions WHERE owner=? AND id IN(SELECT value FROM json_each(?))',
            owner, JSON.stringify(ids)).all<{ id: string; state_json: string }>()).results;
        return ids.flatMap(id => {
            const row = rows.find(row => row.id === id);
            if (!row) return [];
            const practice = JSON.parse(row.state_json) as PracticeVersion, tier = practice.tiers.at(-1);
            if (!tier) return [];
            return [{ ...tier, techniqueId: practice.techniqueId, versionId: id, edition: practice.edition, tier: practice.tiers.length }];
        });
    }
    async availableLoadout(owner: string) {
        // One suggested version per technique, across all editions. A recent
        // restart must not bury an older, stronger version behind a page cap.
        const rows = (await query(this.db, `SELECT id,state_json FROM (
            SELECT id,state_json,technique_id,ROW_NUMBER() OVER (PARTITION BY technique_id ORDER BY
                json_array_length(state_json,'$.tiers') DESC,json_extract(state_json,'$.tiers[#-1].purityBp') DESC,created DESC,id) AS position
            FROM practice_versions WHERE owner=? AND json_array_length(state_json,'$.tiers')>0
            ) WHERE position=1 ORDER BY technique_id LIMIT 39`, owner).all<{ id: string; state_json: string }>()).results;
        return rows.map(row => { const practice = JSON.parse(row.state_json) as PracticeVersion;
            return { ...practice.tiers.at(-1)!, techniqueId: practice.techniqueId, versionId: row.id, edition: practice.edition, tier: practice.tiers.length }; });
    }
    async list(owner: string, before: string | null, limit = 20) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw Error('INVALID_BATTLE_HISTORY');
        let created = Number.MAX_SAFE_INTEGER, id = '';
        if (before) {
            const match = /^(\d+):([a-zA-Z0-9_-]{8,110})$/.exec(before);
            if (!match || !Number.isSafeInteger(Number(match[1]))) throw Error('INVALID_BATTLE_HISTORY');
            created = Number(match[1]); id = match[2]!;
        }
        const rows = (await query(this.db, `SELECT id,boss_id,status,starts_day,created,
            json_extract(content_json,'$.name') AS name,json_extract(state_json,'$.run.state.turn') AS turn
            FROM battles WHERE owner=? AND (created<? OR (created=? AND id>?))
            ORDER BY created DESC,id LIMIT ?`, owner, created, created, id, limit + 1)
            .all<{ id: string; boss_id: string; status: string; starts_day: number; created: number; name: string; turn: number }>()).results;
        const page = rows.slice(0, limit), last = page.at(-1);
        return { battles: page.map(row => ({ id: row.id, bossId: row.boss_id, status: row.status, startsDay: row.starts_day,
            created: row.created, turn: row.turn, content: { name: row.name } })), next: rows.length > limit && last ? last.created + ':' + last.id : null };
    }
    async overview(owner: string, day: HabitDay) {
        // Three bounded subqueries in one prepare keep the free D1 query budget
        // independent of the number of active weekly habits.
        const data = await query(this.db, `SELECT
            (SELECT json_group_array(json_object('id',id,'version',version,'status',status,'state',json(state_json),'content',json(content_json),'created',created))
                FROM (SELECT * FROM battles WHERE owner=? ORDER BY created DESC,id LIMIT 4)) AS battles,
            (SELECT json_group_array(boss_id) FROM boss_victories WHERE owner=?) AS victories,
            (SELECT json_group_array(technique_id) FROM (SELECT DISTINCT technique_id FROM practice_versions WHERE owner=? AND json_array_length(state_json,'$.tiers')>0)) AS learned,
            (SELECT json_group_array(json_object('kind',kind,'id',id,'battleId',battle_id,'created',created)) FROM game_entitlements WHERE owner=?) AS rewards,
            (SELECT json_group_array(json_object('battleId',battle_id,'techniqueId',technique_id,'acceptCost',accept_cost)) FROM battle_choices WHERE owner=? AND day=?) AS choices,
            (SELECT state_json FROM cultivation_accounts WHERE owner=?) AS healthy,
            COALESCE((SELECT version FROM cultivation_accounts WHERE owner=?),0) AS healthy_version,
            (SELECT rank_lock_until_day FROM game_accounts WHERE owner=?) AS rank_lock_until_day`,
            owner, owner, owner, owner, owner, day.day, owner, owner, owner).first<{ battles: string; victories: string; learned: string; rewards: string; choices: string;
                healthy: string | null; healthy_version: number; rank_lock_until_day: number | null }>();
        const rows = JSON.parse(data!.battles) as { id: string; version: number; status: string; state: { run: StoredBattle['run']; resumePracticeId: string | null }; content: StoredBattle['content']; created: number }[];
        const healthy = { ...initialHealthy(), ...(data!.healthy ? JSON.parse(data!.healthy) : {}) } as HealthyState;
        return { battles: rows.map(row => ({ id: row.id, version: row.version, status: row.status, created: row.created,
            startsDay: row.state.run.startsDay, bossId: row.state.run.bossId, contentVersion: row.state.run.contentVersion,
            weaponId: row.state.run.weaponId ?? null,
            combatRank: row.state.run.combatRank, waitDays: row.state.run.waitDays, rescueUntilDay: row.state.run.rescueUntilDay,
            content: { ...row.content, pattern: undefined, victory: row.status === 'won' ? row.content.victory : undefined },
            state: publicBattleState(row.state.run.state), rescue: rescueQuote(healthy, row.state.run.combatRank) })),
            combatEconomy: { healthyVersion: data!.healthy_version, qi: healthy.qi, rank: healthy.rank, rankLockUntilDay: data!.rank_lock_until_day },
            rewards: JSON.parse(data!.rewards) as { kind: string; id: string; battleId: string; created: number }[],
            victories: JSON.parse(data!.victories) as string[], learned: JSON.parse(data!.learned) as string[], choices: JSON.parse(data!.choices) as { battleId: string; techniqueId: string; acceptCost: number }[] };
    }
    async history(owner: string, id: string, before: number, limit = 20) {
        if (!/^[a-zA-Z0-9_-]{8,110}$/.test(id) || !Number.isSafeInteger(before) || before < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50)
            throw Error('INVALID_BATTLE_HISTORY');
        const rows = (await query(this.db, 'SELECT sequence,day,kind,entries_json,result_json FROM battle_events WHERE owner=? AND battle_id=? AND sequence<? ORDER BY sequence DESC LIMIT ?',
            owner, id, before, limit + 1).all<{ sequence: number; day: number; kind: string; entries_json: string; result_json: string }>()).results;
        return { events: rows.slice(0, limit).map(row => ({ sequence: row.sequence, day: row.day, kind: row.kind,
            entries: JSON.parse(row.entries_json), result: JSON.parse(row.result_json) })), next: rows.length > limit ? rows[limit - 1]!.sequence : null };
    }
    async mutateBattle(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: BattleSnapshot) => { change: BattleChange; result: BattleSaved }): Promise<BattleSaved> {
        if (!/^\d+$/.test(owner) || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw Error('INVALID_BATTLE_REQUEST');
        const request = JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key]])));
        if (request.length > 4000) throw Error('INVALID_BATTLE_REQUEST');
        const replay = () => query(this.db, 'SELECT request_json,result_json FROM game_receipts WHERE owner=? AND request_id=?', owner, id)
            .first<{ request_json: string; result_json: string }>();
        const receipt = await replay();
        if (receipt) { if (receipt.request_json !== request) throw Error('REQUEST_ID_REUSED'); return JSON.parse(receipt.result_json) as BattleSaved; }
        const ids = input.operation === 'prepare_battle' ? input.versions as string[] : input.operation === 'exchange_battle' ? [String(input.practiceId)] : [];
        const account = await query(this.db, 'SELECT version,next_day,rank_lock_until_day FROM game_accounts WHERE owner=?', owner)
            .first<{ version: number; next_day: number; rank_lock_until_day: number | null }>();
        const [game, healthy, battle, liveRow, victories, learned, loadout, weapons] = await Promise.all([
            new D1GameStore(this.db).read(owner, now),
            new HealthyStore(this.db).read(owner), typeof input.battleId === 'string' ? this.readBattle(owner, input.battleId) : Promise.resolve(null),
            query(this.db, "SELECT id,version,status,state_json,content_json,created FROM battles WHERE owner=? AND status IN('prepared','active','awaiting_rescue') LIMIT 1", owner).first<BattleRow>(),
            query(this.db, 'SELECT boss_id FROM boss_victories WHERE owner=?', owner).all<{ boss_id: string }>(),
            query(this.db, "SELECT DISTINCT technique_id FROM practice_versions WHERE owner=? AND json_array_length(state_json,'$.tiers')>0 LIMIT 39", owner).all<{ technique_id: string }>(),
            this.loadout(owner, ids),
            query(this.db, "SELECT id FROM game_entitlements WHERE owner=? AND kind='weapon' LIMIT 10", owner).all<{ id: string }>(),
        ]);
        if (game.version !== (account?.version ?? 0)) throw Error('GAME_CHANGED');
        const { change, result } = apply({ day: game.day, gameVersion: game.version, nextSettlementDay: account?.next_day ?? game.day.day,
            current: game.current, pending: game.pending, healthy, battle, live: liveRow ? storedBattle(liveRow) : null,
            victories: victories.results.map(row => row.boss_id), learned: learned.results.map(row => row.technique_id), ownedWeapons: weapons.results.map(row => row.id), loadout, restrictions: { rankLockUntilDay: account?.rank_lock_until_day ?? null } });
        const value = change.battle;
        const statements: Statement[] = [query(this.db, `INSERT INTO transaction_guard SELECT CASE WHEN
            COALESCE((SELECT version FROM game_accounts WHERE owner=?),0)=? AND
            COALESCE((SELECT version FROM cultivation_accounts WHERE owner=?),0)=? AND
            EXISTS(SELECT 1 FROM schedule_days WHERE owner=? AND day=? AND start_at<=? AND end_at>?) THEN 1 ELSE 0 END`,
            owner, game.version, owner, healthy.version, owner, game.day.day, now, now),
            query(this.db, `INSERT INTO game_accounts(owner,joined_day,anchor_start,next_day,updated) VALUES(?,?,?,?,?)
                ON CONFLICT(owner) DO UPDATE SET version=version+1,updated=excluded.updated`, owner, game.day.day, game.day.startAt, game.day.day, now)];
        if (change.kind === 'prepare') {
            bossById(value.run.bossId);
            statements.push(query(this.db, 'INSERT INTO battles(owner,id,boss_id,status,starts_day,state_json,content_json,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',
                owner, value.run.id, value.run.bossId, value.status, value.run.startsDay, battleJson(value), JSON.stringify(value.content), now, now),
                query(this.db, `INSERT INTO battle_task_sources(owner,battle_id,task_id,title)
                    SELECT owner,?,id,title FROM tasks WHERE owner=? AND status='active' AND deleted_at IS NULL AND archived_at IS NULL
                    AND NOT EXISTS(SELECT 1 FROM task_battle_awards a WHERE a.owner=tasks.owner AND a.task_id=tasks.id)
                    ORDER BY created,id LIMIT 200`, value.run.id, owner));
        } else {
            statements.push(query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN EXISTS(SELECT 1 FROM battles WHERE owner=? AND id=? AND version=?) THEN 1 ELSE 0 END', owner, value.run.id, value.version - 1),
                query(this.db, 'UPDATE battles SET version=?,status=?,state_json=?,updated=? WHERE owner=? AND id=?', value.version, value.status, battleJson(value), now, owner, value.run.id));
        }
        if (change.choice) statements.push(query(this.db, `INSERT INTO battle_choices(owner,battle_id,day,technique_id,accept_cost,created) VALUES(?,?,?,?,?,?)
            ON CONFLICT(owner,battle_id,day) DO UPDATE SET technique_id=excluded.technique_id,accept_cost=excluded.accept_cost,created=excluded.created`,
            owner, value.run.id, game.day.day, change.choice.techniqueId, Number(change.choice.acceptCost), now));
        if (change.kind === 'exchange') statements.push(query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM battle_choices WHERE owner=? AND battle_id=? AND day=?) THEN 1 ELSE 0 END', owner, value.run.id, game.day.day));
        if (change.selection) statements.push(query(this.db, 'DELETE FROM game_selections WHERE owner=? AND from_day>?', owner, game.day.day),
            query(this.db, 'INSERT INTO game_selections(owner,from_day,mode,practice_id,battle_id,created) VALUES(?,?,?,?,?,?)',
                owner, change.selection.fromDay, change.selection.mode, change.selection.practiceId, change.selection.battleId, now));
        if (change.healthy) statements.push(query(this.db, `INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES(?,?,?)
            ON CONFLICT(owner) DO UPDATE SET state_json=excluded.state_json,version=version+1,updated=excluded.updated`, owner, JSON.stringify(change.healthy), now));
        if (change.restrictions) statements.push(query(this.db, 'UPDATE game_accounts SET rank_lock_until_day=? WHERE owner=?', change.restrictions.rankLockUntilDay, owner));
        statements.push(...battleVictoryStatements(this.db, owner, value, now),
            query(this.db, 'INSERT INTO battle_events(owner,battle_id,sequence,day,kind,entries_json,result_json,created) VALUES(?,?,?,?,?,?,?,?)',
                owner, value.run.id, value.version, game.day.day, change.kind, JSON.stringify([{ kind: 'effect', text: eventText(change) }]),
                JSON.stringify({ status: value.status, qiSpent: change.qiSpent ?? 0, rankSpent: change.rankSpent ?? 0 }), now),
            query(this.db, 'INSERT INTO game_receipts(owner,request_id,request_json,result_json,created) VALUES(?,?,?,?,?)', owner, id, request, JSON.stringify(result), now),
            query(this.db, 'DELETE FROM transaction_guard'));
        try { await this.db.batch(statements); }
        catch (error) {
            const committed = await replay();
            if (committed?.request_json === request) return JSON.parse(committed.result_json) as BattleSaved;
            const changed = await query(this.db, 'SELECT version FROM game_accounts WHERE owner=?', owner).first<{ version: number }>();
            if ((changed?.version ?? 0) !== game.version) throw Error('GAME_CHANGED');
            if ((await new HealthyStore(this.db).read(owner)).version !== healthy.version) throw Error('HEALTHY_CHANGED');
            if (change.kind === 'exchange' && await query(this.db, 'SELECT 1 FROM battle_choices WHERE owner=? AND battle_id=? AND day=?', owner, value.run.id, game.day.day).first())
                throw Error('BATTLE_EXCHANGE_UNAVAILABLE');
            throw error;
        }
        return result;
    }
}
function eventText(change: BattleChange): string {
    const texts = { prepare: 'Đã chuẩn bị trận cho ngày sinh hoạt kế tiếp.', cancel: 'Đã hủy chuẩn bị trận.',
        choose: 'Đã chọn chiêu cho ngày hiện tại; có thể đổi trước khi ngày kết thúc.', withdraw: 'Đã rút lui trước lượt hôm nay.',
        rescue: 'Đã cứu mạng. Cái giá được ghi cùng trạng thái trận.', death: 'Đã chấp nhận tử trận và ghi khoản tổn thất.', exchange: 'Đã đổi một ô công pháp cho lượt kế tiếp.' };
    return texts[change.kind];
}
