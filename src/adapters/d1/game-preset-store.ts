import type { GamePreset } from '../../domain/game-presets.ts';
import type { GamePresetSaved, GamePresetSnapshot, GamePresetStore } from '../../ports/game-preset-store.ts';
import { D1BattleStore } from './battle-store.ts';
import { query, type Database, type Statement } from './database.ts';

export class D1GamePresetStore implements GamePresetStore {
    private db: Database;
    constructor(db: Database) { this.db = db; }
    async read(owner: string) {
        const row = await query(this.db, `SELECT COALESCE((SELECT version FROM game_preset_accounts WHERE owner=?),0) AS version,
            (SELECT json_group_array(json_object('id',id,'name',name,'versions',json(versions_json),'weaponId',weapon_id))
                FROM (SELECT * FROM game_presets WHERE owner=? ORDER BY created,id LIMIT 7)) AS presets`, owner, owner)
            .first<{ version: number; presets: string }>();
        return { version: row!.version, presets: JSON.parse(row!.presets) as GamePreset[] };
    }
    async mutate(owner: string, id: string, input: Record<string, unknown>, now: number,
        apply: (snapshot: GamePresetSnapshot) => { preset: GamePreset; deleted: boolean; result: GamePresetSaved }): Promise<GamePresetSaved> {
        if (!/^\d+$/.test(owner) || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw Error('INVALID_GAME_PRESET');
        const request = JSON.stringify(Object.fromEntries(Object.keys(input).sort().map(key => [key, input[key]])));
        if (request.length > 2500) throw Error('INVALID_GAME_PRESET');
        const replay = () => query(this.db, 'SELECT request_json,result_json FROM game_preset_receipts WHERE owner=? AND request_id=?', owner, id)
            .first<{ request_json: string; result_json: string }>();
        const receipt = await replay();
        if (receipt) { if (receipt.request_json !== request) throw Error('REQUEST_ID_REUSED'); return JSON.parse(receipt.result_json); }
        const current = await this.read(owner), versions = input.operation === 'save' ? input.versions as string[] : [];
        const [available, weapons] = await Promise.all([
            new D1BattleStore(this.db).resolveLoadout(owner, versions),
            query(this.db, "SELECT id FROM game_entitlements WHERE owner=? AND kind='weapon' LIMIT 10", owner).all<{ id: string }>(),
        ]);
        const { preset, deleted, result } = apply({ ...current, available: available.map(skill => ({ id: skill.techniqueId,
            versionId: skill.versionId, tier: skill.tier, purityBp: skill.purityBp })), ownedWeapons: weapons.results.map(row => row.id) });
        const statements: Statement[] = [query(this.db, 'INSERT INTO transaction_guard SELECT CASE WHEN COALESCE((SELECT version FROM game_preset_accounts WHERE owner=?),0)=? THEN 1 ELSE 0 END', owner, current.version),
            query(this.db, 'INSERT INTO game_preset_accounts(owner) VALUES(?) ON CONFLICT(owner) DO UPDATE SET version=version+1', owner)];
        if (deleted) statements.push(query(this.db, 'DELETE FROM game_presets WHERE owner=? AND id=?', owner, preset.id));
        else {
            statements.push(query(this.db, `INSERT INTO transaction_guard SELECT CASE WHEN
                (SELECT COUNT(*) FROM practice_versions WHERE owner=? AND id IN(SELECT value FROM json_each(?)) AND json_array_length(state_json,'$.tiers')>0)=?
                AND (? IS NULL OR EXISTS(SELECT 1 FROM game_entitlements WHERE owner=? AND kind='weapon' AND id=?)) THEN 1 ELSE 0 END`,
                owner, JSON.stringify(preset.versions), preset.versions.length, preset.weaponId, owner, preset.weaponId),
                query(this.db, `INSERT INTO game_presets(owner,id,name,versions_json,weapon_id,created,updated) VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(owner,id) DO UPDATE SET name=excluded.name,versions_json=excluded.versions_json,weapon_id=excluded.weapon_id,updated=excluded.updated`,
                    owner, preset.id, preset.name, JSON.stringify(preset.versions), preset.weaponId, now, now));
        }
        statements.push(query(this.db, 'INSERT INTO game_preset_receipts(owner,request_id,request_json,result_json,created) VALUES(?,?,?,?,?)', owner, id, request, JSON.stringify(result), now),
            query(this.db, 'DELETE FROM transaction_guard'));
        try { await this.db.batch(statements); }
        catch (error) {
            const committed = await replay();
            if (committed) { if (committed.request_json !== request) throw Error('REQUEST_ID_REUSED'); return JSON.parse(committed.result_json); }
            if ((await this.read(owner)).version !== current.version) throw Error('GAME_PRESETS_CHANGED'); throw error;
        }
        return result;
    }
}
