import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test, { type TestContext } from 'node:test';
import { Miniflare } from 'miniflare';
import { sqliteDatabase } from '../../scripts/benchmark-habit-runtime.ts';
import type { Database, Statement } from '../../src/adapters/d1/database.ts';
import { RecurrenceStore } from '../../src/adapters/d1/recurrence-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { queueAppointments } from '../../src/adapters/d1/conversation-store.ts';
import { reminderAllowed } from '../../src/adapters/d1/reminders.ts';
import { flushOutbox } from '../../src/adapters/d1/outbox.ts';
import type { RecurrenceRule } from '../../src/domain/recurrence.ts';
import type { Env } from '../../src/config/env.ts';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';

const NOW = Date.parse('2026-11-17T08:00:00+07:00');
const TOKEN = '123:fake';
const migrations = () =>
  readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
function environment(db: Database): Env {
  return {
    DB: db,
    TELEGRAM_USER_ID: '123',
    TELEGRAM_BOT_TOKEN: TOKEN,
    TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
    DELIVERY_MODE: 'outbox',
  };
}
function request(path: string, input?: Record<string, unknown>, authenticated = true) {
  const data = new URLSearchParams({
    auth_date: String(NOW / 1000),
    user: JSON.stringify({ id: 123 }),
  });
  data.set(
    'hash',
    createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest())
      .update(
        [...data]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => k + '=' + v)
          .join('\n'),
      )
      .digest('hex'),
  );
  return new Request('https://local/api/' + path, {
    method: input ? 'POST' : 'GET',
    headers: {
      Origin: 'https://local',
      'Content-Type': 'application/json',
      ...(authenticated ? { 'X-Telegram-Init-Data': data.toString() } : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
}
function remove(env: Env, reminderId: string, extra: Record<string, unknown> = {}) {
  return miniAppApi(
    request('reminders-delete', {
      id: crypto.randomUUID(),
      reminderId,
      version: 1,
      confirm: true,
      ...extra,
    }),
    env,
    NOW,
  );
}
async function fixture(t: TestContext) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  for (const name of migrations()) raw.exec(readFileSync('migrations/' + name, 'utf8'));
  raw.exec('PRAGMA foreign_keys=ON');
  const db = sqliteDatabase(raw),
    env = environment(db);
  await new ScheduleStore(db).configure('123', '05:30', '23:00', 0, NOW);
  return { raw, db, env };
}
async function rule(db: Database, id: string, overrides: Partial<RecurrenceRule> = {}) {
  const value: RecurrenceRule = {
    id,
    owner: '123',
    title: id,
    kind: 'daily',
    times: ['08:00'],
    weekdays: [],
    startDate: '2026-11-17',
    endDate: null,
    enabled: true,
    version: 1,
    ...overrides,
  };
  await new RecurrenceStore(db).save(value, 0, NOW);
  return value;
}
async function assertNoDelivery(env: Env) {
  let calls = 0;
  await flushOutbox(
    env,
    (async () => {
      calls++;
      return Response.json({ ok: true, result: { message_id: 99 } });
    }) as typeof fetch,
    NOW,
    () => NOW,
  );
  assert.equal(calls, 0);
}

test('deleting a recurring reminder atomically cancels pending/future slots, preserves sent history and replays receipts', async (t) => {
  const { raw, db, env } = await fixture(t),
    store = new RecurrenceStore(db);
  const saved = await rule(db, 'water');
  await store.queueDue('123', NOW, false);
  raw
    .prepare(
      "INSERT INTO recurrence_occurrences(id,rule_id,owner,rule_version,slot,due,status) VALUES('old','water','123',1,'old',?,'sent'),('future','water','123',1,'future',?,'scheduled')",
    )
    .run(NOW - 86400000, NOW + 3600000);
  raw.exec(
    "INSERT INTO outbox(id,payload,available,reminder_id,state) VALUES('recurring:old','{}',0,'recurring:old','sent')",
  );
  const before = (await new HealthyStore(db).read('123')).state;
  const input = { id: 'delete_water_once', reminderId: 'water', version: 1, confirm: true };
  const first = await miniAppApi(request('reminders-delete', input), env, NOW);
  assert.equal(first.status, 200);
  const receipt = await first.json();
  assert.deepEqual(receipt, { result: { deleted: true, reminderId: 'water', origin: null } });
  assert.deepEqual(
    await (await miniAppApi(request('reminders-delete', input), env, NOW)).json(),
    receipt,
  );
  assert.deepEqual(
    raw.prepare('SELECT enabled,version,deleted_at FROM recurrence_rules WHERE id=?').get('water'),
    Object.assign(Object.create(null), { enabled: 0, version: 2, deleted_at: NOW }),
  );
  assert.equal(
    raw.prepare("SELECT status FROM recurrence_occurrences WHERE id='old'").get()!.status,
    'sent',
  );
  assert.equal(
    raw.prepare("SELECT status FROM recurrence_occurrences WHERE id='future'").get()!.status,
    'cancelled',
  );
  assert.equal(
    raw
      .prepare(
        "SELECT COUNT(*) AS n FROM recurrence_occurrences WHERE rule_id='water' AND status IN ('scheduled','queued')",
      )
      .get()!.n,
    0,
  );
  assert.equal(
    raw.prepare("SELECT state FROM outbox WHERE id='recurring:old'").get()!.state,
    'sent',
  );
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM outbox WHERE state='pending'").get()!.n, 0);
  assert.equal(await store.get('123', 'water'), null);
  assert.equal((await store.page('123')).rules.length, 0);
  const count = raw.prepare('SELECT COUNT(*) AS n FROM recurrence_occurrences').get()!.n;
  await store.queueDue('123', NOW, false);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM recurrence_occurrences').get()!.n, count);
  await assertNoDelivery(env);
  await assert.rejects(store.save({ ...saved, version: 2 }, 1, NOW), /constraint/i);
  const reused = await remove(env, 'water', { ...input, version: 2 });
  assert.equal(((await reused.json()) as { error: string }).error, 'REQUEST_ID_REUSED');
  assert.deepEqual((await new HealthyStore(db).read('123')).state, before);
});

test('delete supports disabled, once and weekly rules, filters pagination and isolates owners', async (t) => {
  const { raw, db, env } = await fixture(t);
  await rule(db, 'disabled', { enabled: false });
  await rule(db, 'once', { kind: 'once' });
  await rule(db, 'weekly', { kind: 'weekdays', weekdays: [2] });
  for (const id of ['disabled', 'once', 'weekly'])
    assert.equal((await remove(env, id)).status, 200);
  await rule(db, 'foreign', { owner: '999' });
  const denied = await remove(env, 'foreign');
  assert.equal(denied.status, 409);
  assert.equal(((await denied.json()) as { error: string }).error, 'REMINDER_NOT_FOUND');
  assert.equal((await new RecurrenceStore(db).get('999', 'foreign'))!.enabled, true);
  for (let n = 0; n < 103; n++) await rule(db, 'page-' + String(n).padStart(3, '0'));
  assert.equal((await remove(env, 'page-000')).status, 200);
  const store = new RecurrenceStore(db),
    first = await store.page('123'),
    second = await store.page('123', first.nextCursor!);
  assert.equal(first.rules.length, 100);
  assert.equal(second.rules.length, 2);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.rules, ...second.rules].map((r) => r.id)).size, 102);
  const page = (await (await miniAppApi(request('reminders?offset=100'), env, NOW)).json()) as {
    reminders: { id: string }[];
  };
  assert.equal(page.reminders.length, 2);
  assert.equal(raw.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('chat reminder deletion hides active/expired records and retains linked tasks, events and delivered messages', async (t) => {
  const { raw, db, env } = await fixture(t);
  raw.exec(
    "INSERT INTO tasks(id,owner,title,created) VALUES('task','123','Keep task',0); INSERT INTO local_events(id,owner,title,start_at,end_at) VALUES('event','123','Keep event',0,1)",
  );
  raw
    .prepare(
      "INSERT INTO task_appointments(id,owner,task_id,event_id,due,status,subject) VALUES('chat','123','task','event',?,'active','Chat'),('expired','123',NULL,NULL,?,'expired','Old')",
    )
    .run(NOW, NOW - 3600000);
  await queueAppointments(db, '123', NOW);
  raw.exec(
    "INSERT INTO outbox(id,payload,available,reminder_id,state) VALUES('appointment:expired:1','{}',0,'appointment:expired:1','sent')",
  );
  // The same textual ID in the other reminder source must not be touched.
  await rule(db, 'chat');
  for (const id of ['chat', 'expired']) {
    const input = { id: 'delete_chat_' + id, origin: 'appointment' };
    const response = await remove(env, id, input);
    assert.equal(response.status, 200);
    const receipt = await response.json();
    assert.deepEqual(await (await remove(env, id, input)).json(), receipt);
    assert.equal(
      raw.prepare('SELECT status FROM task_appointments WHERE id=?').get(id)!.status,
      'cancelled',
    );
  }
  assert.equal(
    raw.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id='task' AND deleted_at IS NULL").get()!.n,
    1,
  );
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM local_events WHERE id='event'").get()!.n, 1);
  assert.equal(
    raw.prepare("SELECT state FROM outbox WHERE id='appointment:chat:1'").get()!.state,
    'failed',
  );
  assert.equal(
    raw.prepare("SELECT state FROM outbox WHERE id='appointment:expired:1'").get()!.state,
    'sent',
  );
  assert.ok(await new RecurrenceStore(db).get('123', 'chat'));
  const data = (await (await miniAppApi(request('bootstrap'), env, NOW)).json()) as {
    reminders: { origin?: string }[];
  };
  assert.equal(
    data.reminders.some((r) => r.origin === 'appointment'),
    false,
  );
  await assertNoDelivery(env);
});

test('delete validates confirmation, payload, authentication and stale versions without mutations', async (t) => {
  const { db, env } = await fixture(t);
  await rule(db, 'rule');
  for (const [extra, status, error] of [
    [{ confirm: false }, 409, 'CONFIRM_DELETE'],
    [{ confirm: undefined }, 409, 'CONFIRM_DELETE'],
    [{ version: 0 }, 400, 'INVALID_REQUEST'],
    [{ version: 1.5 }, 400, 'INVALID_REQUEST'],
    [{ version: 2 }, 409, 'REMINDER_CHANGED'],
    [{ origin: 'task' }, 400, 'INVALID_REQUEST'],
    [{ reminderId: '' }, 400, 'INVALID_REQUEST'],
    [{ unexpected: true }, 400, 'INVALID_REQUEST'],
  ] as const) {
    const response = await remove(env, 'rule', extra);
    assert.equal(response.status, status);
    assert.equal(((await response.json()) as { error: string }).error, error);
  }
  assert.equal(
    (
      await miniAppApi(
        request(
          'reminders-delete',
          { id: 'no_auth_123', reminderId: 'rule', version: 1, confirm: true },
          false,
        ),
        env,
        NOW,
      )
    ).status,
    401,
  );
  assert.equal((await new RecurrenceStore(db).get('123', 'rule'))!.version, 1);
});

test('atomic delete guard detects a dispatcher claim or edit occurring after the initial read', async (t) => {
  for (const source of ['rule', 'appointment'] as const) {
    for (const change of ['sending', 'edit'] as const) {
      await t.test(source + ' ' + change, async (st) => {
        const { raw, db, env } = await fixture(st);
        if (source === 'rule') {
          await rule(db, 'race');
          await new RecurrenceStore(db).queueDue('123', NOW, false);
        } else {
          raw
            .prepare(
              "INSERT INTO task_appointments(id,owner,due,subject) VALUES('race','123',?,'Race')",
            )
            .run(NOW);
          await queueAppointments(db, '123', NOW);
        }
        let intercepted = false;
        const wrapped: Database = {
          prepare: db.prepare.bind(db),
          async batch(statements) {
            if (!intercepted) {
              intercepted = true;
              if (change === 'sending')
                raw.exec("UPDATE outbox SET state='sending' WHERE state='pending'");
              else
                raw.exec(
                  'UPDATE ' +
                    (source === 'rule' ? 'recurrence_rules' : 'task_appointments') +
                    ' SET version=version+1',
                );
            }
            return db.batch(statements);
          },
        };
        const response = await remove(
          { ...env, DB: wrapped },
          'race',
          source === 'appointment' ? { origin: 'appointment' } : {},
        );
        assert.equal(response.status, 409);
        assert.equal(
          ((await response.json()) as { error: string }).error,
          change === 'sending' ? 'REMINDER_SENDING' : 'REMINDER_CHANGED',
        );
        assert.equal(
          raw
            .prepare(
              "SELECT COUNT(*) AS n FROM cultivation_receipts WHERE operation='delete-reminder'",
            )
            .get()!.n,
          0,
        );
        if (source === 'rule')
          assert.equal(
            raw.prepare("SELECT deleted_at FROM recurrence_rules WHERE id='race'").get()!
              .deleted_at,
            null,
          );
        else
          assert.equal(
            raw.prepare("SELECT status FROM task_appointments WHERE id='race'").get()!.status,
            'active',
          );
      });
    }
  }
});

test('deletion winning the race after the sender read prevents its later claim and transport', async (t) => {
  const { db, env } = await fixture(t);
  await rule(db, 'before-claim');
  await new RecurrenceStore(db).queueDue('123', NOW, false);
  let intercepted = false,
    calls = 0;
  const wrapped: Database = {
    batch: db.batch.bind(db),
    prepare(sql) {
      const wrap = (statement: Statement): Statement => ({
        bind(...values) {
          return wrap(statement.bind(...values));
        },
        first: statement.first.bind(statement),
        all: statement.all.bind(statement),
        async run() {
          if (!intercepted && sql.includes("SET state='sending',attempts")) {
            intercepted = true;
            assert.equal((await remove(env, 'before-claim')).status, 200);
          }
          return statement.run();
        },
      });
      return wrap(db.prepare(sql));
    },
  };
  await flushOutbox(
    { ...env, DB: wrapped },
    (async () => {
      calls++;
      throw Error('Must not send');
    }) as typeof fetch,
    NOW,
    () => NOW,
  );
  assert.equal(intercepted, true);
  assert.equal(calls, 0);
});

test('deleting an archived habit reminder clears its backup, preserves the habit, and allows a fresh explicitly set schedule', async (t) => {
  const { raw, db, env } = await fixture(t),
    store = new D1HabitStore(db),
    service = new HabitService(store);
  const definition = { name: 'Read', metric: 'duration', target: 20, cadence: { kind: 'daily' } };
  const created = await service.execute(
    '123',
    'habit_delete_reminder',
    { operation: 'create', definition, reminderTime: '09:00' },
    NOW,
  );
  await service.execute(
    '123',
    'archive_before_delete',
    { operation: 'archive', habitId: created.habitId, version: 1 },
    NOW,
  );
  const old = (await new RecurrenceStore(db).rules('123'))[0]!;
  const before = raw.prepare('SELECT * FROM habits WHERE id=?').get(created.habitId);
  assert.equal((await remove(env, old.id, { version: old.version })).status, 200);
  assert.deepEqual(raw.prepare('SELECT * FROM habits WHERE id=?').get(created.habitId), before);
  assert.equal(
    raw
      .prepare('SELECT reminder_time FROM habit_presentation WHERE habit_id=?')
      .get(created.habitId)!.reminder_time,
    null,
  );
  await service.execute(
    '123',
    'restore_after_delete',
    { operation: 'restore', habitId: created.habitId, version: 2 },
    NOW,
  );
  assert.equal((await store.today('123', NOW)).habits[0]!.reminderTime, null);
  assert.equal((await new RecurrenceStore(db).rules('123')).length, 0);
  await service.execute(
    '123',
    'explicit_new_reminder',
    {
      operation: 'update',
      habitId: created.habitId,
      version: 3,
      definition,
      reminderTime: '10:00',
    },
    NOW,
  );
  const fresh = (await new RecurrenceStore(db).rules('123'))[0]!;
  assert.notEqual(fresh.id, old.id);
  assert.deepEqual(fresh.times, ['10:00']);
  assert.equal((await store.today('123', NOW)).habits[0]!.reminderTime, '10:00');
  assert.equal(await new RecurrenceStore(db).get('123', old.id), null);
  assert.equal(raw.prepare('PRAGMA foreign_key_check').all().length, 0);
});

test('D1 applies deletion migration and retains atomic rule/occurrence/outbox updates', async (t) => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  t.after(() => mf.dispose());
  const db = (await mf.getD1Database('DB')) as unknown as Database & {
    exec(sql: string): Promise<unknown>;
  };
  for (const name of migrations())
    await db.exec(readFileSync('migrations/' + name, 'utf8').replace(/\r?\n/g, ' '));
  const env = environment(db);
  await rule(db, 'd1-rule');
  await new RecurrenceStore(db).queueDue('123', NOW, false);
  const occurrence = await db
    .prepare("SELECT id FROM recurrence_occurrences WHERE rule_id='d1-rule' AND status='queued'")
    .first<{ id: string }>();
  assert.ok(occurrence);
  const attempts = await Promise.all([
    remove(env, 'd1-rule', { id: 'd1_concurrent_delete' }),
    remove(env, 'd1-rule', { id: 'd1_concurrent_delete' }),
  ]);
  assert.deepEqual(
    attempts.map((response) => response.status),
    [200, 200],
  );
  assert.deepEqual(await attempts[0]!.json(), await attempts[1]!.json());
  assert.equal(await reminderAllowed(db, 'recurring:' + occurrence.id, NOW), false);
  assert.equal(
    (await db
      .prepare('SELECT state FROM outbox WHERE reminder_id=?')
      .bind('recurring:' + occurrence.id)
      .first<{ state: string }>())!.state,
    'failed',
  );
  assert.equal(
    (await db
      .prepare('SELECT status FROM recurrence_occurrences WHERE id=?')
      .bind(occurrence.id)
      .first<{ status: string }>())!.status,
    'cancelled',
  );
});
