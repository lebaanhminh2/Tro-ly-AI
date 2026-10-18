import { Miniflare } from 'miniflare';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import type { Database, Statement } from '../../src/adapters/d1/database.ts';
import { DayPlanStore } from '../../src/adapters/d1/day-plan-store.ts';
import { achievementStatistics, progressData } from '../../src/adapters/d1/progress-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { TimelineStore } from '../../src/adapters/d1/timeline-store.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { statistics } from '../../src/domain/progress.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
async function fixture() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  const db = (await mf.getD1Database('DB')) as unknown as Database & {
    exec(sql: string): Promise<unknown>;
  };
  for (const path of readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync('migrations/' + path, 'utf8').replace(/\r?\n/g, ' '));
  return { mf, db };
}
function observed(db: Database) {
  const reads: {
      sql: string;
      rows: number;
    }[] = [],
    underlying = new WeakMap<Statement, Statement>();
  const wrap = (sql: string, statement: Statement): Statement => {
    const result: Statement = {
      bind(...values) {
        return wrap(sql, statement.bind(...values));
      },
      async first<T>() {
        const row = await statement.first<T>();
        reads.push({ sql, rows: row ? 1 : 0 });
        return row;
      },
      async all<T>() {
        const result = await statement.all<T>();
        reads.push({ sql, rows: result.results.length });
        return result;
      },
      run() {
        return statement.run();
      },
    };
    underlying.set(result, statement);
    return result;
  };
  return {
    reads,
    db: {
      prepare(sql: string) {
        return wrap(sql, db.prepare(sql));
      },
      batch(statements: Statement[]) {
        return db.batch(statements.map((s) => underlying.get(s) ?? s));
      },
    } satisfies Database,
  };
}
test('hierarchy preserves ordering and ownership while fetching steps only for the selected page', async () => {
  const { mf, db } = await fixture();
  try {
    await db.batch(
      Array.from({ length: 250 }, (_, i) =>
        db
          .prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)')
          .bind('task-' + i, '123', 'Task ' + i, i),
      ),
    );
    await db.batch(
      Array.from({ length: 500 }, (_, i) =>
        db
          .prepare(
            'INSERT INTO task_steps(id,owner,task_id,step_code,title,created) VALUES(?,?,?,?,?,?)',
          )
          .bind('step-' + i, '123', 'task-' + Math.floor(i / 2), (i % 2) + 1, 'Step ' + i, i),
      ),
    );
    await db.exec(
      "INSERT INTO tasks(id,owner,title,created) VALUES('foreign','999','Private task',0); INSERT INTO task_steps(id,owner,task_id,step_code,title,created) VALUES('foreign-step','999','foreign',1,'Private step',0); UPDATE tasks SET deleted_at=1 WHERE id='task-0'; UPDATE tasks SET archived_at=1 WHERE id='task-1'; UPDATE task_steps SET deleted_at=1 WHERE id='step-4'",
    );
    const tasks = (
      await db
        .prepare(
          "SELECT * FROM tasks WHERE owner='123' AND deleted_at IS NULL AND archived_at IS NULL ORDER BY status,deadline IS NULL,deadline,public_code LIMIT 200",
        )
        .all<any>()
    ).results;
    const steps = (
      await db
        .prepare(
          "SELECT s.* FROM task_steps s JOIN tasks t ON t.id=s.task_id AND t.owner=s.owner WHERE s.owner='123' AND s.deleted_at IS NULL AND t.deleted_at IS NULL AND t.archived_at IS NULL ORDER BY s.step_code",
        )
        .all<any>()
    ).results;
    const reference = tasks.map((task) => ({
      ...task,
      steps: steps.filter((step) => step.task_id === task.id),
    }));
    const traced = observed(db),
      result = await new D1WorkStore(traced.db).hierarchy('123');
    assert.deepEqual(result, reference);
    const stepRead = traced.reads.find((read) => read.sql.startsWith('SELECT s.*'));
    assert.ok(stepRead);
    assert.equal(
      stepRead.rows,
      reference.reduce((n, task) => n + task.steps.length, 0),
    );
    assert.ok(stepRead.rows < steps.length);
    const store = new D1WorkStore(db),
      day = 20731;
    await db.exec(
      "INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES('123','task-249',45,0)",
    );
    await db
      .prepare('INSERT INTO task_work_logs(owner,day,task_id,minutes,updated) VALUES(?,?,?,?,?)')
      .bind('123', day, 'task-249', 15, 0)
      .run();
    const tail = await store.activeTaskPage('123', 200, day);
    assert.equal(tail.total, 248);
    assert.equal(tail.items.length, 48);
    assert.equal(tail.hasMore, false);
    assert.equal(new Set([...result, ...tail.items].map((t) => t.id)).size, 248);
    assert.equal(tail.items.at(-1)?.remaining_minutes, 45);
    assert.equal(tail.items.at(-1)?.actual_minutes, 15);
    assert.equal(tail.items.at(-1)?.steps.length, 2);
    assert.equal((await store.activeTaskPage('123', 1000, day)).items.length, 0);
    await assert.rejects(store.activeTaskPage('123', -1, day), /INVALID_PAGE/);
    const beyond = await store.planTaskDetails('123', ['task-249', 'foreign'], day);
    assert.equal(beyond.length, 1);
    assert.equal(beyond[0]?.id, 'task-249');
    assert.equal(beyond[0]?.steps.length, 2);
    const at = Date.parse('2026-10-05T10:00:00+07:00'),
      token = '123:fake',
      env = {
        DB: db,
        TELEGRAM_USER_ID: '123',
        TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
        TELEGRAM_BOT_TOKEN: token,
      };
    const params = new URLSearchParams({
      auth_date: String(at / 1000),
      user: JSON.stringify({ id: 123 }),
    });
    params.set(
      'hash',
      createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
        .update(
          [...params]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => key + '=' + value)
            .join('\n'),
        )
        .digest('hex'),
    );
    const get = (path: string, authenticated = true) =>
      miniAppApi(
        new Request('https://local/api/' + path, {
          headers: authenticated ? { 'X-Telegram-Init-Data': params.toString() } : undefined,
        }),
        env,
        at,
      );
    assert.equal((await get('tasks-page?offset=200', false)).status, 401);
    assert.equal((await get('tasks-page?offset=-1')).status, 400);
    const pageResponse = await get('tasks-page?offset=200');
    assert.equal(pageResponse.status, 200);
    const body = (await pageResponse.json()) as {
      result: {
        items: {
          id: string;
        }[];
        total: number;
      };
    };
    assert.equal(body.result.total, 248);
    assert.equal(body.result.items.length, 48);
    assert.ok(!body.result.items.some((t) => t.id === 'foreign'));
    const snapshot = await get('bootstrap');
    assert.equal(snapshot.status, 200);
    const view = (await snapshot.json()) as {
      activeTasksPage: {
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    assert.deepEqual(view.activeTasksPage, { offset: 200, total: 248, hasMore: true });
  } finally {
    await mf.dispose();
  }
});
test('lightweight achievement statistics match full progress for future days, repeats, ownership and pre-epoch dates', async () => {
  const { mf, db } = await fixture();
  try {
    const now = Date.parse('2026-10-05T09:00:00+07:00'),
      day = 86400000;
    await db.exec(
      "INSERT INTO tasks(id,owner,title,created) VALUES('a','123','A',0),('b','123','B',1),('foreign','999','Private',0)",
    );
    await db.batch([
      db
        .prepare('INSERT INTO task_completions(owner,task_id,completed_at) VALUES(?,?,?)')
        .bind('123', 'a', now),
      db
        .prepare('INSERT INTO task_completions(owner,task_id,completed_at) VALUES(?,?,?)')
        .bind('123', 'b', now + day),
      db
        .prepare('INSERT INTO task_completions(owner,task_id,completed_at) VALUES(?,?,?)')
        .bind('999', 'foreign', now),
    ]);
    const milestones = Array.from({ length: 300 }, (_, i) =>
      db
        .prepare(
          'INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES(?,?,?,?,?,?)',
        )
        .bind('milestone-' + i, '123', 'a', 'Progress ' + i, now - Math.floor(i / 10) * day, i),
    );
    milestones.push(
      db
        .prepare(
          'INSERT INTO task_progress(id,owner,task_id,content,created,source_update) VALUES(?,?,?,?,?,?)',
        )
        .bind('old', '123', 'a', 'Before epoch', -25200001, 999),
    );
    await db.batch(milestones);
    // Deliberately load the complete fixture as an independent historical reference.
    const data = {
      completions: (
        await db
          .prepare(
            "SELECT c.*,t.title FROM task_completions c JOIN tasks t ON t.id=c.task_id AND t.owner=c.owner WHERE c.owner='123'",
          )
          .all<import('../../src/domain/progress.ts').Completion>()
      ).results,
      milestones: (
        await db
          .prepare("SELECT * FROM task_progress WHERE owner='123'")
          .all<import('../../src/domain/progress.ts').Milestone>()
      ).results,
      achievements: [],
    };
    for (const at of [0, now - day, now, now + day]) {
      const expected = statistics(data, at),
        actual = await achievementStatistics(db, '123', at);
      assert.deepEqual(actual, { total: expected.total, best: expected.best });
    }
    const traced = observed(db);
    await achievementStatistics(traced.db, '123', now);
    assert.equal(traced.reads.length, 2);
    assert.ok(
      traced.reads.reduce((n, r) => n + r.rows, 0) <
        data.completions.length + data.milestones.length,
    );
  } finally {
    await mf.dispose();
  }
});
test('timeline resolves only planned tasks and skips task reads entirely for an empty plan', async () => {
  const { mf, db } = await fixture();
  try {
    const now = Date.parse('2026-10-05T10:00:00+07:00');
    await db.batch(
      Array.from({ length: 50 }, (_, i) =>
        db
          .prepare('INSERT INTO tasks(id,owner,title,created) VALUES(?,?,?,?)')
          .bind('task-' + i, '123', 'Task ' + i, i),
      ),
    );
    const schedule = new ScheduleStore(db);
    await schedule.configure('123', '04:30', '22:30', 0, now, 'read-model-setup');
    const day = await schedule.ensureDay('123', now);
    assert.ok(day);
    const traced = observed(db),
      timeline = new TimelineStore(traced.db);
    await timeline.read('123', now);
    assert.equal(
      traced.reads.filter((r) => r.sql.startsWith('SELECT id,version,deadline FROM tasks')).length,
      0,
    );
    await db
      .prepare(
        "UPDATE schedule_days SET task_plan_status='active',task_plan_effective_from=? WHERE owner=? AND day=?",
      )
      .bind(now, '123', day.day)
      .run();
    await db.batch(
      [0, 1].map((i) =>
        db
          .prepare(
            'INSERT INTO task_planning(owner,task_id,remaining_minutes,updated) VALUES(?,?,?,?)',
          )
          .bind('123', 'task-' + i, 30, now),
      ),
    );
    const plan = await new DayPlanStore(db).ensure('123', now);
    assert.ok(plan);
    assert.equal(plan.plan.items.length, 2);
    traced.reads.length = 0;
    const result = await timeline.read('123', now);
    assert.ok(result);
    assert.equal(result.blocks.length, 2);
    const taskRead = traced.reads.find((r) =>
      r.sql.startsWith('SELECT id,version,deadline FROM tasks'),
    );
    assert.ok(taskRead);
    assert.equal(taskRead.rows, 2);
    assert.equal(new Set(result.blocks.map((b) => b.task_id)).size, 2);
  } finally {
    await mf.dispose();
  }
});
