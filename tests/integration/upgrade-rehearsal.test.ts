import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { rehearseUpgrade, tableProofs } from '../../scripts/rehearse-staging-upgrade.ts';
import { initialHealthy } from '../../src/domain/healthy.ts';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';

test('pre-habit SQL backup restores, keeps legacy data and supports production habit flows without dispatch or overwriting a DB', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-upgrade-'));
  const backup = join(directory, 'backup.sql'),
    target = join(directory, 'restored.sqlite');
  try {
    const source = new DatabaseSync(':memory:');
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql') && file < '0031')
      .sort())
      source.exec(readFileSync('migrations/' + file, 'utf8'));
    source
      .prepare("INSERT INTO tasks(id,owner,title,created) VALUES('upgrade-task','123',?,1)")
      .run('Đọc sách; không gửi tin thử');
    source.prepare("INSERT INTO sleep_reports(owner,reported_at) VALUES('123',1)").run();
    source
      .prepare(
        "INSERT INTO outbox(id,payload,available,state) VALUES('upgrade-delivery',?,1,'uncertain')",
      )
      .run(JSON.stringify({ text: 'Private fixture' }));
    const accountTable = (
      source.prepare('PRAGMA table_info(cultivation_accounts)').all() as { name: string }[]
    ).map((column) => column.name);
    assert.ok(accountTable.includes('state_json'));
    source
      .prepare("INSERT INTO cultivation_accounts(owner,state_json,updated) VALUES('123',?,1)")
      .run(JSON.stringify(initialHealthy()));
    const before = tableProofs(source);
    const literal = (value: unknown) =>
      value === null
        ? 'NULL'
        : typeof value === 'number'
          ? String(value)
          : "'" + String(value).replaceAll("'", "''") + "'";
    const schema = (
      source
        .prepare(
          "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,name",
        )
        .all() as { sql: string }[]
    ).map((row) => row.sql + ';');
    const rows = before.flatMap((table) =>
      source
        .prepare('SELECT * FROM "' + table.table + '"')
        .all()
        .map(
          (row) =>
            'INSERT INTO "' +
            table.table +
            '" VALUES(' +
            Object.values(row).map(literal).join(',') +
            ');',
        ),
    );
    writeFileSync(backup, [...schema, ...rows].join('\n'));
    source.close();
    const result = rehearseUpgrade(backup, target, '0030');
    assert.deepEqual(
      result.applied,
      readdirSync('migrations')
        .filter((file) => /^\d{4}.*\.sql$/.test(file) && file.slice(0, 4) > '0030')
        .sort(),
    );
    assert.ok(result.applied.includes('0038_cultivation_progression.sql'));
    assert.equal(result.legacyDataUnchanged, true);
    assert.deepEqual(result.legacyTables, before);
    assert.ok(result.newTables.some((table) => table.table === 'habits'));
    assert.ok(result.newTables.some((table) => table.table === 'battles'));
    const reopened = new DatabaseSync(target);
    try {
      assert.equal(
        reopened.prepare("SELECT state FROM outbox WHERE id='upgrade-delivery'").get()!.state,
        'uncertain',
      );
      assert.equal(
        reopened.prepare("SELECT title FROM tasks WHERE id='upgrade-task'").get()!.title,
        'Đọc sách; không gửi tin thử',
      );
      assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM habits').get()!.n, 0);
      assert.deepEqual(tableProofs(reopened, before), before);
      const db = sqliteDatabase(reopened),
        at = Date.parse('2026-10-12T08:00:00+07:00'),
        dayMs = 86400000;
      await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, at);
      const healthy = await new HealthyStore(db).read('123');
      const habits = new D1HabitStore(db);
      const habit = await new HabitService(habits).execute(
        '123',
        'restore_new_habit',
        {
          operation: 'create',
          definition: {
            name: 'Đọc sách',
            metric: 'duration',
            target: 20,
            cadence: { kind: 'daily' },
          },
        },
        at,
      );
      const tomorrow = await habits.today('123', at + dayMs);
      await new HabitService(habits).execute(
        '123',
        'restore_habit_log',
        {
          operation: 'log',
          habitId: habit.habitId,
          version: 1,
          logVersion: 0,
          day: tomorrow.day.day,
          value: 20,
        },
        at + dayMs,
      );
      await habits.settle('123', at + 2 * dayMs, 10);
      assert.deepEqual(await new HealthyStore(db).read('123'), {
        state: { ...healthy.state, tickets: healthy.state.tickets + 1 },
        version: healthy.version + 1,
      });
      assert.equal(
        reopened.prepare("SELECT state FROM outbox WHERE id='upgrade-delivery'").get()!.state,
        'uncertain',
      );
      assert.equal(
        reopened.prepare("SELECT title FROM tasks WHERE id='upgrade-task'").get()!.title,
        'Đọc sách; không gửi tin thử',
      );
    } finally {
      reopened.close();
    }
    assert.throws(() => rehearseUpgrade(backup, target, '0030'), /EEXIST/);
    assert.throws(
      () => rehearseUpgrade(backup, join(directory, 'bad.sqlite'), 'unknown'),
      /EXPLICIT_MIGRATION_BASELINE_REQUIRED/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a failed or data-changing migration rolls back its schema and writes; incomplete migration tracking is rejected', () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-upgrade-failure-'));
  try {
    const migrations = join(directory, 'migrations');
    mkdirSync(migrations);
    writeFileSync(
      join(migrations, '0030_baseline.sql'),
      'CREATE TABLE original(id INTEGER PRIMARY KEY,value TEXT);',
    );
    const backup = join(directory, 'backup.sql');
    writeFileSync(
      backup,
      "CREATE TABLE original(id INTEGER PRIMARY KEY,value TEXT);INSERT INTO original VALUES(1,'keep');",
    );
    for (const [kind, migration] of [
      ['sql-error', 'CREATE TABLE partial(id INTEGER);INSERT INTO missing VALUES(1);'],
      ['data-change', "CREATE TABLE partial(id INTEGER);UPDATE original SET value='changed';"],
    ]) {
      writeFileSync(join(migrations, '0031_trial.sql'), migration!);
      const target = join(directory, kind + '.sqlite');
      assert.throws(
        () => rehearseUpgrade(backup, target, '0030', migrations),
        /UPGRADE_MIGRATION_FAILED:0031_trial.sql/,
      );
      const reopened = new DatabaseSync(target);
      try {
        assert.equal(reopened.prepare('SELECT value FROM original').get()!.value, 'keep');
        assert.equal(
          reopened.prepare("SELECT 1 FROM sqlite_master WHERE name='partial'").get(),
          undefined,
        );
        assert.equal(reopened.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      } finally {
        reopened.close();
      }
    }
    writeFileSync(join(migrations, '0029_earlier.sql'), 'SELECT 1;');
    writeFileSync(
      backup,
      readFileSync(backup, 'utf8') +
        "CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO d1_migrations VALUES(1,'0030_baseline.sql');",
    );
    assert.throws(
      () => rehearseUpgrade(backup, join(directory, 'incomplete.sqlite'), '0030', migrations),
      /BACKUP_MIGRATION_BASELINE_MISMATCH/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
