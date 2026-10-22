import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = '0045_linh_thu_v2.sql';
const tables = ['beast_v2_runtime', 'beast_v2_states', 'beast_v2_days', 'beast_v2_buffs'];

function database(beforeV2 = false) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql') && (!beforeV2 || file < migration))
    .sort())
    db.exec(readFileSync('migrations/' + file, 'utf8'));
  return db;
}

function legacyFixture(db: DatabaseSync) {
  db.exec(`
    INSERT INTO beast_accounts(owner,state_json,activated_day,created,updated)
      VALUES('123','{"summonTickets":17,"alchemy":4}',20740,1,1);
    INSERT INTO cultivation_accounts(owner,state_json,updated)
      VALUES('123','{"qi":123,"tickets":45,"inventory":{"basic":6}}',1);
    INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt)
      VALUES('123','legacy_beast','humbug','legacy_attempt',1,'legacy_acquisition');
    INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,
      capacity,thresholds_json,earned,gray,form,counters_json,created)
      VALUES('123','legacy_attempt','legacy_beast',1,1,'completed',600,'[100,250,400]',
        600,0,4,'{"habit":2}',1);
    INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created)
      VALUES('123','companion',20740,'legacy_beast','legacy_attempt',1);
    INSERT INTO beast_ultimates(owner,week_start,beast_id,attempt_id,skill_version,
      activated_at,expires_at,state_json)
      VALUES('123',20738,'legacy_beast','legacy_attempt',1,1,999999,
        '{"kind":"fusion_double","remaining":1,"settled":false}');
    INSERT INTO beast_choices(owner,id,kind,state_json,created)
      VALUES('123','pending_paid_draw','draw',
        '{"candidates":["qi1","basic"],"picks":1}',1);
    INSERT INTO beast_choices(owner,id,kind,state_json,created)
      VALUES('123','pending_paid_summon','summon',
        '{"candidates":["humbug","funglet"],"remaining":1}',1);
    INSERT INTO beast_choices(owner,id,kind,state_json,created)
      VALUES('123','pending_reward','reward','{"options":[{"qi":40}]}',1);
    INSERT INTO beast_skill_events(owner,source_id,kind,day,beast_id,skill_version,result_json,created)
      VALUES('123','old_source','task',20740,'legacy_beast',1,'{"reward":{"tickets":1}}',1);
    INSERT INTO cultivation_receipts(owner,request_id,operation,request_json,result_json,created)
      VALUES('123','old_receipt','draw','{"count":1}','{"reward":"qi1"}',1);
    INSERT INTO tasks(id,owner,title,created) VALUES('old_completed_task','123','Old completion',1);
    UPDATE tasks SET status='completed' WHERE id='old_completed_task';
    UPDATE task_completions SET completed_at=12345 WHERE task_id='old_completed_task';
  `);
}

test('v2 migration supports a fresh database without activating accounts or creating rewards', () => {
  const db = database();
  try {
    for (const table of [...tables, 'cultivation_accounts', 'beast_skill_events'])
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ' + table).get()!.n, 0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('v2 migration preserves wallets, attempts, v1 receipts and all pending paid choices verbatim', () => {
  const db = database(true);
  try {
    legacyFixture(db);
    const legacyTables = [
      'beast_accounts',
      'cultivation_accounts',
      'beasts',
      'beast_attempts',
      'beast_roles',
      'beast_ultimates',
      'beast_choices',
      'beast_skill_events',
      'cultivation_receipts',
    ];
    const before = legacyTables.map((table) => db.prepare('SELECT * FROM ' + table).all());
    const originalCompletions = db
      .prepare('SELECT owner,task_id,completed_at FROM task_completions')
      .all();
    db.exec(readFileSync('migrations/' + migration, 'utf8'));
    legacyTables.forEach((table, index) => {
      assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[index], table);
    });
    for (const table of tables)
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ' + table).get()!.n, 0);
    assert.deepEqual(
      db.prepare('SELECT owner,task_id,completed_at FROM task_completions').all(),
      originalCompletions,
    );
    assert.equal(
      db.prepare('SELECT beast_source_json FROM task_completions').get()!.beast_source_json,
      null,
      'a new source snapshot column must not reinterpret or backfill old completion history',
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});

test('v2 state enforces owner provenance, unique day/buff keys and valid runtime counters', () => {
  const db = database(true);
  try {
    legacyFixture(db);
    db.exec(readFileSync('migrations/' + migration, 'utf8'));
    db.exec(`
      INSERT INTO beast_v2_runtime(owner,cutover_day,updated) VALUES('123',20746,2);
      INSERT INTO beast_v2_states VALUES('123','legacy_attempt','{"version":2}');
      INSERT INTO beast_v2_days(owner,day,snapshot_json,updated)
        VALUES('123',20746,'{"multiplier":1}',2);
      INSERT INTO beast_v2_buffs(owner,source_attempt_id,effective_day,reward_json)
        VALUES('123','legacy_attempt',20747,'{"tickets":1,"qi":1}');
    `);
    const runtime = db.prepare("SELECT * FROM beast_v2_runtime WHERE owner='123'").get()!;
    assert.equal(runtime.version, 1);
    assert.equal(runtime.sleep_streak, 0);
    assert.equal(runtime.last_day, null);
    const invalid = [
      'UPDATE beast_v2_runtime SET version=0',
      'UPDATE beast_v2_runtime SET sleep_streak=-1',
      'UPDATE beast_v2_runtime SET last_day=20745',
      "UPDATE beast_v2_states SET state_json='broken'",
      "UPDATE beast_v2_days SET snapshot_json='broken'",
      "UPDATE beast_v2_days SET habit_json='broken'",
      "UPDATE beast_v2_days SET daily_json='broken'",
      'UPDATE beast_v2_days SET task_count=-1',
      'UPDATE beast_v2_days SET before_noon_tasks=1',
      'UPDATE beast_v2_days SET settled=2',
      "UPDATE beast_v2_buffs SET reward_json='broken'",
      "UPDATE beast_v2_buffs SET kind='unknown'",
    ];
    for (const sql of invalid) assert.throws(() => db.exec(sql), /CHECK constraint/, sql);
    assert.throws(
      () => db.exec("INSERT INTO beast_v2_states VALUES('123','missing_attempt','{}')"),
      /FOREIGN KEY constraint/,
    );
    assert.throws(
      () =>
        db.exec("INSERT INTO beast_v2_runtime(owner,cutover_day,updated) VALUES('999',20746,2)"),
      /FOREIGN KEY constraint/,
    );
    assert.throws(
      () =>
        db.exec(
          "INSERT INTO beast_v2_buffs(owner,source_attempt_id,effective_day,reward_json) VALUES('123','legacy_attempt',20747,'{}')",
        ),
      /UNIQUE constraint/,
    );
    assert.throws(
      () =>
        db.exec(
          "INSERT INTO beast_v2_days(owner,day,snapshot_json,updated) VALUES('123',20746,'{}',2)",
        ),
      /UNIQUE constraint/,
    );
    db.exec("UPDATE beast_v2_days SET task_count=3,before_noon_tasks=2,habit_json='{}',settled=1");
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    db.close();
  }
});
