import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import { DayPlanStore } from '../../src/adapters/d1/day-plan-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { D1HabitCompanion } from '../../src/adapters/d1/habit-companion.ts';
import { RecurrenceStore } from '../../src/adapters/d1/recurrence-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ConversationStore } from '../../src/adapters/d1/conversation-store.ts';
import { memoryStatements } from '../../src/adapters/d1/memory.ts';
import { progressData, achievementStatistics } from '../../src/adapters/d1/progress-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { statistics, type ProgressData } from '../../src/domain/progress.ts';
import type { Lease } from '../../src/ports/work-store.ts';
import { bootstrap } from '../../src/entrypoints/mini-app/bootstrap.ts';
import { handleSchedule } from '../../src/entrypoints/mini-app/schedule.ts';

const NOW = Date.parse('2026-10-12T08:00:00+07:00'),
  DAY = 86400000;
test('aggregate progress matches full data at pre-epoch local days and inclusive date deadlines', async () => {
  const { raw, db } = fixture();
  try {
    raw.exec(
      "INSERT INTO tasks(id,owner,title,status,created) VALUES('old','123','Old','completed',0),('edge','123','Edge','completed',0)",
    );
    const deadline = Date.parse('1970-01-01T23:59:59.999+07:00');
    raw
      .prepare(
        "INSERT INTO task_completions(owner,task_id,completed_at,deadline,precision) VALUES('123','old',-25200001,NULL,NULL),('123','edge',?,'1970-01-01','date')",
      )
      .run(deadline);
    const full: ProgressData = {
      completions: raw
        .prepare(
          "SELECT c.*,t.title FROM task_completions c JOIN tasks t ON t.id=c.task_id WHERE c.owner='123'",
        )
        .all() as ProgressData['completions'],
      milestones: [],
      achievements: [],
    };
    for (const at of [0, deadline]) {
      const data = await progressData(db, '123', at);
      assert.deepEqual(statistics(data, at), statistics(full, at));
      assert.throws(() => statistics(data, at + 1), /PROGRESS_SNAPSHOT_TIME_MISMATCH/);
    }
  } finally {
    raw.close();
  }
});
function fixture() {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort())
    raw.exec(readFileSync('migrations/' + file, 'utf8'));
  raw.exec('PRAGMA foreign_keys=ON');
  return { raw, db: sqliteDatabase(raw) };
}
async function planningFixture() {
  const result = fixture(),
    { raw, db } = result;
  await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, NOW);
  raw.exec(
    "INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',1); INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES('123','a',10,0),('123','b',60,0)",
  );
  const prepared = await new D1WorkStore(db).prepareSchedule(
    '123',
    NOW,
    1,
    [],
    [],
    [],
    'activate-day',
  );
  await db.batch(prepared.statements);
  const plans = new DayPlanStore(db);
  return { ...result, plans, saved: (await plans.ensure('123', NOW))! };
}
test('plan edits replay before version/day/task preconditions and reject reused IDs', async () => {
  const { raw, db, plans, saved } = await planningFixture();
  try {
    const items = [
      { taskId: 'a', minutes: 10 },
      { taskId: 'b', minutes: 20 },
    ];
    const result = await plans.replace('123', 'replace-one', saved.version, items, NOW);
    assert.deepEqual(
      await plans.replace('123', 'replace-one', saved.version, items, NOW + DAY),
      result,
    );
    await assert.rejects(
      plans.replace('123', 'replace-one', saved.version, [{ taskId: 'a', minutes: 20 }], NOW),
      /REQUEST_ID_REUSED/,
    );
    const current = (await plans.ensure('123', NOW))!;
    const ids = current.plan.items.map((item) => item.taskId).reverse();
    const ordered = await plans.reorder('123', 'order-one', current.version, ids, NOW);
    assert.deepEqual(
      await plans.reorder('123', 'order-one', current.version, ids, NOW + DAY),
      ordered,
    );
    const logged = await plans.logWork('123', 'log-one', 'a', 20, 'note', NOW);
    raw.exec("UPDATE tasks SET status='completed' WHERE id='a'");
    assert.deepEqual(await plans.logWork('123', 'log-one', 'a', 20, 'note', NOW + DAY), logged);
    await assert.rejects(
      plans.logWork('123', 'log-one', 'a', 10, 'note', NOW),
      /REQUEST_ID_REUSED/,
    );
    assert.equal(
      raw.prepare("SELECT COUNT(*) AS n FROM task_work_logs WHERE task_id='a'").get()!.n,
      1,
    );
    assert.equal(
      await new HealthyStore(db).receipt('999', 'log-one', 'task-work-log', {
        taskId: 'a',
        minutes: 20,
        note: 'note',
      }),
      null,
    );
  } finally {
    raw.close();
  }
});
test('overrun correction is path-independent and explicit estimates reset the balance', async () => {
  const { raw, plans } = await planningFixture();
  try {
    assert.equal((await plans.logWork('123', 'over-20', 'a', 20, null, NOW)).remaining, 0);
    assert.equal((await plans.logWork('123', 'back-10', 'a', 10, null, NOW)).remaining, 0);
    assert.equal((await plans.logWork('123', 'back-00', 'a', 0, null, NOW)).remaining, 10);
    assert.equal((await plans.logWork('123', 'again-20', 'a', 20, null, NOW)).remaining, 0);
    const version = Number(
      raw.prepare("SELECT version FROM task_planning WHERE task_id='a'").get()!.version,
    );
    await plans.editEstimate('123', 'estimate-reset', 'a', version, 30, 0, NOW);
    assert.equal((await plans.logWork('123', 'reset-correct', 'a', 10, null, NOW)).remaining, 40);
    assert.equal(
      raw.prepare("SELECT remaining_balance FROM task_planning WHERE task_id='a'").get()!
        .remaining_balance,
      40,
    );
    await plans.logWork('123', 'max-log', 'a', 1440, null, NOW);
    const latest = Number(
      raw.prepare("SELECT version FROM task_planning WHERE task_id='a'").get()!.version,
    );
    await plans.editEstimate('123', 'max-estimate', 'a', latest, 100000, 0, NOW);
    assert.equal((await plans.logWork('123', 'max-correct', 'a', 0, null, NOW)).remaining, 100000);
    assert.equal(
      (await plans.logWork('123', 'max-restore', 'a', 1440, null, NOW)).remaining,
      100000,
    );
  } finally {
    raw.close();
  }
});
test('schedule API retries return the original receipt after tasks and the day change', async () => {
  const { raw, db } = await planningFixture();
  try {
    const env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_WEBHOOK_SECRET: 'fixture',
      TELEGRAM_BOT_TOKEN: 'fixture',
    };
    const context = { env, owner: '123', now: NOW, healthy: new HealthyStore(db) };
    const version = Number(
      raw.prepare("SELECT version FROM schedule_days WHERE owner='123'").get()!.version,
    );
    const input = {
      id: 'schedule-retry',
      version,
      free: [],
      busy: [],
      estimates: [{ id: 'a', minutes: 25 }],
    };
    const first = await (await handleSchedule(context, input, '/api/schedule'))!.json();
    raw.exec("UPDATE tasks SET status='completed' WHERE id='a'");
    const replay = await (await handleSchedule(
      { ...context, now: NOW + DAY },
      input,
      '/api/schedule',
    ))!.json();
    assert.deepEqual(replay, first);
    await assert.rejects(
      handleSchedule(
        context,
        { ...input, busy: [{ start: NOW, end: NOW + 60000 }] },
        '/api/schedule',
      ),
      /REQUEST_ID_REUSED/,
    );
  } finally {
    raw.close();
  }
});
test('recurrence processing advances through every eligible page beyond disabled/history rules', async () => {
  const { raw, db } = fixture();
  try {
    const store = new RecurrenceStore(db);
    for (let i = 0; i < 165; i++)
      await store.save(
        {
          id: 'rule_' + String(i).padStart(3, '0'),
          owner: '123',
          title: 'Rule ' + i,
          kind: 'daily',
          times: ['08:00'],
          weekdays: [],
          startDate: '2026-10-01',
          endDate: null,
          enabled: i >= 100,
          version: 1,
        },
        0,
        i,
      );
    for (let pass = 0; pass < 4; pass++) await store.materialize('123', NOW - 1000, NOW + 1000);
    assert.equal(
      raw
        .prepare(
          "SELECT COUNT(DISTINCT rule_id) AS n FROM recurrence_occurrences WHERE owner='123'",
        )
        .get()!.n,
      65,
    );
    const late = await store.next('123', 'rule_164', NOW - 1000);
    assert.ok(late);
    await store.skip('123', late.id, late.rule_version);
    await store.materialize('123', NOW - 1000, NOW + 1000);
    assert.equal(
      raw.prepare('SELECT status FROM recurrence_occurrences WHERE id=?').get(late.id)!.status,
      'cancelled',
    );
    const first = await store.page('123'),
      second = await store.page('123', first.nextCursor!);
    assert.equal(new Set([...first.rules, ...second.rules].map((rule) => rule.id)).size, 165);
    assert.equal(first.rules.filter((rule) => rule.enabled).length, 65);
    assert.equal(await store.next('999', 'rule_164', NOW), null);
    let queries = 0;
    const measured = new RecurrenceStore(
      sqliteDatabase(raw, () => {
        queries++;
      }),
    );
    await measured.queueDue('123', NOW, false);
    assert.ok(queries <= 20, 'A page of due rules must retain SQL headroom for the cron');
    assert.equal(
      raw.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'recurring:%'").get()!.n,
      20,
    );
    const delivered = JSON.parse(
      String(
        raw.prepare("SELECT payload FROM outbox WHERE id LIKE 'recurring:%' LIMIT 1").get()!
          .payload,
      ),
    );
    assert.equal(delivered.chat_id, 123);
    assert.equal(delivered.method, 'sendMessage');
    for (let pass = 0; pass < 4; pass++) await store.queueDue('123', NOW, false);
    assert.equal(
      raw.prepare("SELECT COUNT(*) AS n FROM outbox WHERE id LIKE 'recurring:%'").get()!.n,
      64,
      'All enabled rules except the skipped instance are queued once',
    );
    assert.equal(
      raw.prepare('SELECT status FROM recurrence_occurrences WHERE id=?').get(late.id)!.status,
      'cancelled',
    );
  } finally {
    raw.close();
  }
});
test('active habits stay visible, archive pages cover all rows, companion searches beyond page one', async () => {
  const { raw, db } = fixture();
  try {
    await new ScheduleStore(db).configure('123', '05:30', '23:15', 0, NOW);
    const store = new D1HabitStore(db);
    await new HabitService(store).execute(
      '123',
      'create-current',
      {
        operation: 'create',
        definition: { name: 'Current', metric: 'check', target: 1, cadence: { kind: 'daily' } },
      },
      NOW,
    );
    const base = (await store.today('123', NOW)).habits[0]!,
      day = (await store.today('123', NOW)).day.day;
    const insert = raw.prepare(
      'INSERT INTO habits(owner,id,created_day,archived_from,next_day,created,updated) VALUES(?,?,?,?,?,?,?)',
    );
    const revision = raw.prepare(
      'INSERT INTO habit_revisions(owner,habit_id,from_day,definition_json,archived_from) VALUES(?,?,?,?,?)',
    );
    for (let i = 0; i < 125; i++) {
      const id = 'old_' + String(i).padStart(3, '0');
      insert.run('123', id, day - 2, day - 1, day, -1000 + i, 0);
      revision.run(
        '123',
        id,
        day - 2,
        JSON.stringify({
          ...base.definition,
          commitmentFrom: day - 2,
          name: i === 124 ? 'Đọc sách cuối' : 'Old ' + i,
        }),
        day - 1,
      );
    }
    const ids = new Set<string>();
    let offset = 0;
    do {
      const page = await store.today('123', NOW, true, false, { archiveOffset: offset });
      assert.ok(page.habits.some((view) => view.habit.id === base.habit.id));
      assert.ok(page.habits.length <= 51);
      page.habits.forEach((view) => ids.add(view.habit.id));
      offset = page.archivePage.nextCursor ?? -1;
    } while (offset >= 0);
    assert.equal(ids.size, 126);
    const found = await new D1HabitCompanion(db).findHabits('123', 'doc sach', 0, NOW, 'all');
    assert.equal(found.total, 1);
    assert.equal((found.habits[0] as { id: string }).id, 'old_124');
    for (const text of ['ĐỌC SÁCH', 'Đọc sách'.normalize('NFD')]) {
      assert.equal(
        (await new D1HabitCompanion(db).findHabits('123', text, 0, NOW, 'all')).total,
        1,
      );
    }
    const decomposed = {
      ...base.definition,
      commitmentFrom: day - 2,
      name: 'Đọc sách cuối'.normalize('NFD'),
    };
    raw
      .prepare(
        "UPDATE habit_revisions SET definition_json=? WHERE owner='123' AND habit_id='old_124'",
      )
      .run(JSON.stringify(decomposed));
    assert.equal(
      (await new D1HabitCompanion(db).findHabits('123', 'doc sach', 0, NOW, 'all')).total,
      1,
    );
    assert.equal((await new D1HabitCompanion(db).findHabits('123', 'doc sach', 0, NOW)).total, 0);
  } finally {
    raw.close();
  }
});
test('forget scrubs completed AI journals and drafts without removing replay protection or other owners', async () => {
  const { raw, db } = fixture();
  try {
    for (const owner of ['123', '999']) {
      raw
        .prepare(
          "INSERT INTO memories(id,owner,content,kind,source,created) VALUES(?,?,'SECRET','preference','user',0)",
        )
        .run('m' + owner, owner);
      raw
        .prepare(
          "INSERT INTO command_inbox(owner,update_id,payload,state,created,delivery,tool_context,tool_reply) VALUES(?,1,'SECRET','done',0,0,'SECRET','SECRET')",
        )
        .run(owner);
      raw
        .prepare(
          "INSERT INTO tool_steps(owner,update_id,step_key,kind,state,request_json,result_json,created) VALUES(?,1,'write','write','done','SECRET','SECRET',0)",
        )
        .run(owner);
      raw
        .prepare(
          "INSERT INTO pending_tool_actions(id,owner,tool_name,args_json,reason,expires,origin_update_id) VALUES(?,?,'capture_task','SECRET','SECRET',100,1)",
        )
        .run('p' + owner, owner);
    }
    await db.batch(memoryStatements(db, '123', { type: 'forget', owner: '123', id: 'm123' }));
    assert.doesNotMatch(
      JSON.stringify(raw.prepare("SELECT * FROM command_inbox WHERE owner='123'").get()),
      /SECRET/,
    );
    assert.doesNotMatch(
      JSON.stringify(raw.prepare("SELECT * FROM tool_steps WHERE owner='123'").get()),
      /SECRET/,
    );
    assert.doesNotMatch(
      JSON.stringify(raw.prepare("SELECT * FROM pending_tool_actions WHERE owner='123'").get()),
      /SECRET/,
    );
    assert.match(
      JSON.stringify(raw.prepare("SELECT * FROM tool_steps WHERE owner='999'").get()),
      /SECRET/,
    );
    assert.equal(
      raw.prepare("SELECT state FROM command_inbox WHERE owner='123'").get()!.state,
      'done',
    );
    const lease = { owner: '123', input: { updateId: 1 } } as Lease;
    await assert.rejects(new ConversationStore(db).writeResult(lease, {}), /COMMAND_REDACTED/);
    assert.equal(
      await new D1WorkStore(db).accept(
        { owner: '123', chat: 123, updateId: 1, text: 'retry' },
        NOW,
        false,
      ),
      false,
    );
    const store = new D1WorkStore(db);
    raw.exec(
      "INSERT INTO memories(id,owner,content,kind,source,created) VALUES('current','123','CURRENT_SECRET','preference','user',0)",
    );
    await store.accept(
      { owner: '123', chat: 123, updateId: 2, callback: 'forget:current' },
      NOW,
      false,
    );
    const current = (await store.claim('123', NOW))!;
    raw.exec(
      "UPDATE command_inbox SET tool_context='CURRENT_SECRET',tool_reply='CURRENT_SECRET' WHERE owner='123' AND update_id=2; INSERT INTO tool_steps(owner,update_id,step_key,kind,state,request_json,result_json,created) VALUES('123',2,'read:0:0','read','done','CURRENT_SECRET','CURRENT_SECRET',0)",
    );
    await store.commit(
      current,
      {
        view: { text: 'Forgot', buttons: [] },
        changes: [{ type: 'forget', owner: '123', id: 'current' }],
      },
      NOW,
    );
    assert.equal((await store.result('123', 2))?.text, 'Forgot');
    assert.doesNotMatch(
      JSON.stringify(
        raw.prepare("SELECT * FROM command_inbox WHERE owner='123' AND update_id=2").get(),
      ),
      /CURRENT_SECRET/,
    );
    assert.doesNotMatch(
      JSON.stringify(
        raw.prepare("SELECT * FROM tool_steps WHERE owner='123' AND update_id=2").get(),
      ),
      /CURRENT_SECRET/,
    );
  } finally {
    raw.close();
  }
});
test('bounded progress DTO retains exact lifetime totals, streaks and calendar; archived tasks do not enter planning', async () => {
  const { raw, db, plans } = await planningFixture();
  try {
    const task = raw.prepare(
      "INSERT INTO tasks(id,owner,title,status,created,archived_at) VALUES(?,'123','History','completed',0,1)",
    );
    const completion = raw.prepare(
      "INSERT INTO task_completions(owner,task_id,completed_at,deadline,precision) VALUES('123',?,?,?,'date')",
    );
    const milestone = raw.prepare(
      "INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES(?,'123',?,'Progress',?,?)",
    );
    for (let i = 0; i < 1200; i++) {
      const id = 'history_' + i,
        at = NOW - Math.floor(i / 20) * DAY;
      task.run(id);
      completion.run(id, at, '2026-10-12');
      milestone.run('step_' + i, id, at, i);
    }
    const full: ProgressData = {
      completions: raw
        .prepare(
          "SELECT c.*,t.title FROM task_completions c JOIN tasks t ON t.id=c.task_id WHERE c.owner='123'",
        )
        .all() as ProgressData['completions'],
      milestones: raw
        .prepare("SELECT * FROM task_progress WHERE owner='123'")
        .all() as ProgressData['milestones'],
      achievements: [],
    };
    const data = await progressData(db, '123', NOW),
      expected = statistics(full, NOW);
    assert.equal(data.completions.length, 10);
    assert.equal(data.milestones.length, 10);
    assert.deepEqual(statistics(data, NOW), expected);
    assert.deepEqual(await achievementStatistics(db, '123', NOW), {
      total: 1200,
      best: expected.best,
    });
    assert.deepEqual(
      (await plans.inputs('123', NOW))!.tasks.map((task) => task.id),
      ['a', 'b'],
    );
    assert.equal((await progressData(db, '999', NOW)).summary!.stats.total, 0);
    const response = await bootstrap({
      env: { DB: db, TELEGRAM_USER_ID: '123', TELEGRAM_WEBHOOK_SECRET: 'fixture' },
      owner: '123',
      now: NOW,
      healthy: new HealthyStore(db),
    });
    const body = (await response.json()) as { tasks: unknown[]; progress: ProgressData };
    assert.equal(body.tasks.length, 2);
    assert.equal(body.progress.completions.length, 10);
    assert.equal(body.progress.summary!.stats.total, 1200);
  } finally {
    raw.close();
  }
});
