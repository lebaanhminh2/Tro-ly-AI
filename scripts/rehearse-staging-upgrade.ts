import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Offline only: restore an explicitly selected trusted SQL backup into a NEW
// SQLite file, rehearse unapplied migrations, and report counts/hashes without
// printing personal rows. No Worker, cron, transport, cloud credentials or env.
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';
type TableProof = { table: string; columns: string[]; count: number; sha256: string };
export function tableProofs(db: DatabaseSync, definitions?: Pick<TableProof, 'table' | 'columns'>[]): TableProof[] {
    const tables = definitions ?? (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
        .all() as { name: string }[]).map(({ name }) => ({ table: name,
            columns: (db.prepare('PRAGMA table_info(' + identifier(name) + ')').all() as { name: string }[]).map(column => column.name) }));
    return tables.map(({ table, columns }) => {
        const hash = createHash('sha256'), list = columns.map(identifier).join(','); let count = 0;
        hash.update(JSON.stringify(columns) + '\n');
        const query = db.prepare('SELECT ' + list + ' FROM ' + identifier(table) + ' ORDER BY ' + list);
        query.setReadBigInts(true);
        for (const row of query.iterate()) {
            hash.update(JSON.stringify(columns.map(column => row[column]), (_key, value) => typeof value === 'bigint'
                ? { integer: value.toString() } : value instanceof Uint8Array ? { blob: Buffer.from(value).toString('hex') } : value) + '\n');
            count++;
        }
        return { table, columns, count, sha256: hash.digest('hex') };
    });
}
function checkDatabase(db: DatabaseSync) {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0]!)[0] !== 'ok') throw Error('RESTORE_INTEGRITY_FAILED');
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw Error('RESTORE_FOREIGN_KEYS_FAILED');
}
export function rehearseUpgrade(backup: string, output: string, through: string, migrationsDir = 'migrations') {
    if (!/^\d{4}$/.test(through)) throw Error('EXPLICIT_MIGRATION_BASELINE_REQUIRED');
    const files = readdirSync(migrationsDir).filter(file => /^\d{4}.*\.sql$/.test(file)).sort();
    if (!files.some(file => file.startsWith(through))) throw Error('UNKNOWN_MIGRATION_BASELINE');
    const input = resolve(backup), target = resolve(output);
    if (input === target || statSync(input).size > 256 * 1024 * 1024) throw Error('INVALID_RESTORE_TARGET_OR_BACKUP_SIZE');
    // Exclusive creation prevents accidental overwrite of an existing DB.
    closeSync(openSync(target, 'wx'));
    const db = new DatabaseSync(target);
    try {
        db.exec('PRAGMA foreign_keys=OFF'); db.exec(readFileSync(input, 'utf8')); db.exec('PRAGMA foreign_keys=ON');
        checkDatabase(db);
        if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get()) {
            const applied = (db.prepare('SELECT name FROM d1_migrations ORDER BY name').all() as { name: string }[]).map(row => row.name.slice(0, 4));
            const expected = files.filter(file => file.slice(0, 4) <= through).map(file => file.slice(0, 4));
            if (expected.some(name => !applied.includes(name)) || applied.some(name => !expected.includes(name)))
                throw Error('BACKUP_MIGRATION_BASELINE_MISMATCH');
        }
        const before = tableProofs(db), applied: string[] = [];
        for (const file of files.filter(file => file.slice(0, 4) > through)) {
            db.exec('BEGIN IMMEDIATE');
            try {
                db.exec(readFileSync(resolve(migrationsDir, file), 'utf8')); checkDatabase(db);
                if (JSON.stringify(tableProofs(db, before)) !== JSON.stringify(before)) throw Error('UPGRADE_CHANGED_EXISTING_DATA');
                db.exec('COMMIT');
            }
            catch { db.exec('ROLLBACK'); throw Error('UPGRADE_MIGRATION_FAILED:' + file); }
            applied.push(file);
        }
        const after = tableProofs(db, before);
        if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('UPGRADE_CHANGED_EXISTING_DATA');
        checkDatabase(db);
        return { format: 'assistant-upgrade-rehearsal', version: 1, baseline: through,
            backupSha256: createHash('sha256').update(readFileSync(input)).digest('hex'),
            integrity: 'ok', foreignKeyViolations: 0, legacyDataUnchanged: true, applied, legacyTables: before,
            newTables: tableProofs(db).filter(table => !before.some(old => old.table === table.table)),
            limitation: 'Offline SQLite restore and migration proof; d1_migrations tracking is preserved, not advanced; no remote apply, dispatch or live mutation claim' };
    } finally { db.close(); }
}
if (process.argv[1]?.endsWith('rehearse-staging-upgrade.ts')) {
    const arg = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
    const backup = arg('--backup'), output = arg('--restore'), through = arg('--through'), report = arg('--report');
    if (!backup || !output || !through || !report) throw Error('USE_--backup_--restore_--through_--report');
    const result = rehearseUpgrade(backup, output, through);
    writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ integrity: result.integrity, legacyDataUnchanged: result.legacyDataUnchanged,
        applied: result.applied, legacyTables: result.legacyTables.length, newTables: result.newTables.length }));
}
