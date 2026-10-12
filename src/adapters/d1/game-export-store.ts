import { publicBattleState } from '../../domain/battle.ts';
import { INITIAL_TECHNIQUES } from '../../domain/techniques.ts';
import type { GameExportSnapshot, GameExportStore, StoredExportBattle } from '../../ports/game-export-store.ts';
import { query, type Database } from './database.ts';

const ownerScope = 'owner=(SELECT owner FROM scope)';
const dayScope = 'day BETWEEN (SELECT first_day FROM scope) AND (SELECT last_day FROM scope)';
// Static SQL expressions only. Each array refuses overflow inside the same read snapshot,
// before JSON materialization; the service also caps the final UTF-8 response.
function boundedArray(table: string, condition: string, order: string, value: string, limit: number, size = '0', chars = 524288) {
    const where = ownerScope + (condition ? ' AND (' + condition + ')' : '');
    return `CASE WHEN (SELECT COUNT(*) FROM ${table} WHERE ${where})<=${limit}
        AND (SELECT COALESCE(SUM(${size}),0) FROM ${table} WHERE ${where})<=${chars}
        THEN (SELECT COALESCE(json_group_array(json(value)),'[]') FROM
            (SELECT ${value} AS value FROM ${table} WHERE ${where} ORDER BY ${order} LIMIT ${limit})) ELSE NULL END`;
}
export class D1GameExportStore implements GameExportStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    async read(owner: string, from: number, to: number): Promise<GameExportSnapshot> {
        const fields = {
            owned: boundedArray('technique_unlocks', '', 'technique_id', 'json_quote(technique_id)', 50),
            victories: boundedArray('boss_victories', '', 'boss_id', 'json_quote(boss_id)', 100),
            entitlements: boundedArray('game_entitlements', '', 'kind,id', "json_object('kind',kind,'id',id,'battleId',battle_id,'created',created)", 100),
            presets: boundedArray('game_presets', '', 'created,id', "json_object('id',id,'name',name,'versions',json(versions_json),'weaponId',weapon_id)", 6),
            selections: boundedArray('game_selections', `from_day BETWEEN (SELECT first_day FROM scope) AND (SELECT last_day FROM scope)+1
                OR from_day=(SELECT MAX(from_day) FROM game_selections WHERE ${ownerScope} AND from_day<(SELECT first_day FROM scope))`,
                'from_day', "json_object('fromDay',from_day,'mode',mode,'practiceId',practice_id,'battleId',battle_id)", 368),
            practiceVersions: boundedArray('practice_versions', '', 'created,id', "json_object('practice',json(state_json),'version',version,'created',created)", 2000, 'length(state_json)', 1048576),
            days: boundedArray('game_days', dayScope, 'day', "json_object('day',day,'startAt',start_at,'endAt',end_at,'mode',mode,'practiceId',practice_id,'battleId',battle_id,'rule',rule,'result',json(result_json),'settledAt',settled_at)", 366, 'length(result_json)'),
            battles: boundedArray('battles', `starts_day BETWEEN (SELECT first_day FROM scope) AND (SELECT last_day FROM scope)
                OR status IN('prepared','active','awaiting_rescue') OR id IN
                (SELECT battle_id FROM battle_events WHERE ${ownerScope} AND ${dayScope})`, 'created,id',
                "json_object('run',json_extract(state_json,'$.run'),'version',version,'bossName',json_extract(content_json,'$.name'),'chapter',json_extract(content_json,'$.chapter'),'created',created,'updated',updated,'victory',CASE WHEN status='won' THEN json_extract(content_json,'$.victory') ELSE NULL END)", 500, 'length(state_json)'),
            events: boundedArray('battle_events', dayScope, 'day,battle_id,sequence', "json_object('battleId',battle_id,'sequence',sequence,'day',day,'kind',kind,'entries',json(entries_json),'result',json(result_json))", 2000, 'length(entries_json)+length(result_json)'),
            weeklyAudits: boundedArray('practice_week_audits', 'closed_day IS NULL OR (end_day>=(SELECT first_day FROM scope) AND start_day<=(SELECT last_day FROM scope))', 'start_day,habit_id', 'state_json', 1000, 'length(state_json)'),
        };
        const row = await query(this.db, `WITH scope(owner,first_day,last_day) AS (VALUES(?,?,?)) SELECT
            (SELECT json_object('version',version,'joinedDay',joined_day,'settledThrough',next_day-1,'rankLockUntilDay',rank_lock_until_day) FROM game_accounts WHERE ${ownerScope}) AS account,
            (SELECT state_json FROM cultivation_accounts WHERE ${ownerScope}) AS cultivation,
            ${Object.entries(fields).map(([name, sql]) => sql + ' AS ' + name).join(',\n')}`, owner, from, to).first<Record<string, string | null>>();
        if (!row) throw Error('GAME_EXPORT_UNAVAILABLE');
        for (const name of Object.keys(fields)) if (row[name] === null) throw Error('GAME_EXPORT_TOO_LARGE');
        function parse<T>(name: string): T { return JSON.parse(row![name] ?? 'null') as T; }
        const snapshot: GameExportSnapshot = {
            profile: { account: parse('account'), cultivation: parse('cultivation'),
                owned: [...new Set([...INITIAL_TECHNIQUES, ...parse<string[]>('owned')])], victories: parse('victories'),
                entitlements: parse('entitlements'), presets: parse('presets') },
            selections: parse('selections'), practiceVersions: parse('practiceVersions'), days: parse('days'),
            battles: parse<StoredExportBattle[]>('battles').map(({ run, version, bossName, chapter, created, updated, victory }) => ({
                id: run.id, bossId: run.bossId, bossName, chapter, contentVersion: run.contentVersion, version,
                startsDay: run.startsDay, lastDay: run.lastDay, waitDays: run.waitDays, rescueUntilDay: run.rescueUntilDay,
                created, updated, state: publicBattleState(run.state), victory })), events: parse('events'), weeklyAudits: parse('weeklyAudits'),
        };
        return snapshot;
    }
}
