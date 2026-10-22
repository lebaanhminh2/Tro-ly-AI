import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { sqliteDatabase } from './benchmark-habit-runtime.ts';
import { ScheduleStore } from '../src/adapters/d1/schedule-store.ts';
import { D1BeastStore } from '../src/adapters/d1/linh-thu-store.ts';
import { D1WorkStore } from '../src/adapters/d1/work-store.ts';
import { HealthyStore } from '../src/adapters/d1/healthy-store.ts';
import { settleOneBeastV2Day } from '../src/adapters/d1/linh-thu-v2-daily.ts';
import { handleCultivation } from '../src/entrypoints/mini-app/cultivation.ts';
import { BEAST_TRAINING } from '../src/domain/linh-thu-training.ts';
import { beastSpecies } from '../src/domain/linh-thu-catalog.ts';
import { readBeasts } from '../src/entrypoints/mini-app/linh-thu.ts';
import { runScheduled } from '../src/entrypoints/worker-scheduler.ts';
import { bootstrap as readBootstrap } from '../src/entrypoints/mini-app/bootstrap.ts';

/** Local SQLite query/wall-time diagnostic; never a claim about remote CPU. */
const now = Date.parse('2026-10-22T10:00:00+07:00');
const owner = '123';
const metrics: {
  individuals: number;
  speciesId: string;
  path: string;
  queries: number;
  localWallMs: number;
  bytes?: number;
}[] = [];
for (const individuals of [24, 2400]) {
  for (const speciesId of ['flameow', 'skinklet', 'pyropup']) {
    const raw = new DatabaseSync(':memory:');
    let queries = 0;
    const db = sqliteDatabase(raw, () => {
      queries++;
    });
    try {
      raw.exec('PRAGMA foreign_keys=ON');
      for (const file of readdirSync('migrations')
        .filter((file) => file.endsWith('.sql'))
        .sort())
        raw.exec(readFileSync('migrations/' + file, 'utf8'));
      const schedule = new ScheduleStore(db);
      await schedule.configure(owner, '05:30', '23:15', 0, now);
      const today = (await schedule.ensureDay(owner, now))!;
      const store = new D1BeastStore(db);
      await store.initialize(owner, today.day, now);
      const capacity = BEAST_TRAINING[beastSpecies(speciesId).rank].capacity;
      raw.exec('BEGIN');
      for (let index = 0; index < individuals; index++) {
        raw
          .prepare(
            'INSERT INTO beasts(owner,id,species_id,current_attempt_id,acquired_at,acquired_receipt) VALUES(?,?,?,?,?,?)',
          )
          .run(
            owner,
            'v2_perf_beast_' + index,
            speciesId,
            'v2_perf_attempt_' + index,
            now + index,
            'fixture',
          );
        raw
          .prepare(
            `INSERT INTO beast_attempts(owner,id,beast_id,rule_version,skill_version,status,
          capacity,thresholds_json,earned,gray,form,created) VALUES(?,?,?,1,1,'completed',?,'[]',?,0,4,?)`,
          )
          .run(
            owner,
            'v2_perf_attempt_' + index,
            'v2_perf_beast_' + index,
            capacity,
            capacity,
            now,
          );
      }
      raw.exec('COMMIT');
      raw
        .prepare(
          'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
        )
        .run(owner, 'companion', today.day, 'v2_perf_beast_0', 'v2_perf_attempt_0', now);
      const healthy = new HealthyStore(db);
      await healthy.mutate(owner, 'v2_perf_seed', 'fixture', {}, now, (state) => ({
        state: { ...state, qi: 1000, earned: 1000, tickets: 1000 },
        result: {},
      }));
      const work = new D1WorkStore(db);
      const measure = async (path: string, run: () => Promise<unknown>) => {
        queries = 0;
        const start = performance.now();
        const result = await run();
        const metric = {
          individuals,
          speciesId,
          path,
          queries,
          localWallMs: Number((performance.now() - start).toFixed(3)),
          ...(result instanceof Response
            ? { bytes: (await result.clone().arrayBuffer()).byteLength }
            : {}),
        };
        metrics.push(metric);
        assert.ok(metric.queries <= 50, JSON.stringify(metric));
        if (path.startsWith('get-') && path !== 'get-wallet-bootstrap')
          assert.ok(metric.bytes! < 40000, JSON.stringify(metric));
        return result;
      };
      for (let ordinal = 1; ordinal <= 8; ordinal++) {
        const created = await work.mutateHierarchy(
          owner,
          'v2_perf_create_' + ordinal,
          { operation: 'create', title: 'Task ' + ordinal },
          now,
        );
        await measure('task-' + ordinal, () =>
          work.mutateHierarchy(
            owner,
            'v2_perf_complete_' + ordinal,
            { operation: 'complete', taskId: String(created.id), version: 1, complete: true },
            now,
          ),
        );
      }
      const context = {
        env: {
          DB: db,
          TELEGRAM_USER_ID: owner,
          TELEGRAM_BOT_TOKEN: 'fixture',
          TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
        },
        owner,
        now,
        healthy,
      };
      const response = (await measure('draw-x10', () =>
        handleCultivation(context, { id: 'v2_perf_draw_x10', operation: 'draw', count: 10 }),
      )) as Response;
      assert.equal(response.status, 200);
      assert.equal(
        ((await measure('get-wallet-bootstrap', () => readBootstrap(context))) as Response).status,
        200,
      );
      assert.equal(
        (
          (await measure('get-active', () =>
            readBeasts(context, new URL('https://local/api/linh-thu')),
          )) as Response
        ).status,
        200,
      );
      await schedule.configure('456', '05:30', '23:15', 0, now);
      const bootstrap = (await measure('get-bootstrap', () =>
        readBeasts({ ...context, owner: '456' }, new URL('https://local/api/linh-thu')),
      )) as Response;
      assert.equal(bootstrap.status, 200);
      assert.equal(
        raw.prepare("SELECT cutover_day FROM beast_v2_runtime WHERE owner='456'").get()!
          .cutover_day,
        today.day,
      );
      const cron = async (at: number) =>
        runScheduled(
          {
            ...context.env,
            AI_MODE: 'off',
            ASSETS: { fetch: async () => new Response('fixture') },
          },
          {
            cardsEnabled: false,
            clock: { now: () => at },
            chat: undefined,
            flushCards: async () => {},
            transport: async () => Response.json({ ok: true, result: { message_id: 1 } }),
          },
        );
      const slot = (after: number, maintenance: number, beastJob?: number) => {
        let minute = Math.ceil(after / 60000);
        while (
          minute % 4 !== 3 ||
          Math.floor(minute / 4) % 3 !== maintenance ||
          (beastJob !== undefined && Math.floor(minute / 12) % 4 !== beastJob)
        )
          minute++;
        return minute * 60000;
      };
      raw
        .prepare(
          "INSERT INTO tasks(id,owner,title,created) VALUES('v2_pending_chat',?,'Pending chat completion',?)",
        )
        .run(owner, now + 100);
      raw.exec("UPDATE tasks SET status='completed' WHERE id='v2_pending_chat'");
      raw
        .prepare("UPDATE task_completions SET completed_at=? WHERE task_id='v2_pending_chat'")
        .run(now + 100);
      await measure('cron-task-recovery', () => cron(slot(now + 60000, 0)));
      assert.equal(
        raw
          .prepare("SELECT COUNT(*) AS n FROM task_ticket_awards WHERE task_id='v2_pending_chat'")
          .get()!.n,
        1,
      );
      assert.equal(
        raw
          .prepare("SELECT task_count FROM beast_v2_days WHERE owner='123' AND day=?")
          .get(today.day)!.task_count,
        9,
      );
      raw
        .prepare(
          "UPDATE beast_attempts SET status='training',form=1,earned=0 WHERE id='v2_perf_attempt_1'",
        )
        .run();
      raw
        .prepare(
          'INSERT INTO beast_roles(owner,role,effective_day,beast_id,attempt_id,created) VALUES(?,?,?,?,?,?)',
        )
        .run(owner, 'training', today.day, 'v2_perf_beast_1', 'v2_perf_attempt_1', now);
      raw
        .prepare(
          `INSERT INTO sleep_assessments(owner,day,target,reported_at,result,qi_delta,demoted,assessed_at)
        VALUES(?,?,?,?,'on_time',5,0,?)`,
        )
        .run(owner, today.day, today.target_sleep, today.target_sleep - 1000, today.end_at);
      const pendingRead = (await measure('get-training-pending', () =>
        readBeasts({ ...context, now: today.end_at + 1 }, new URL('https://local/api/linh-thu')),
      )) as Response;
      assert.equal(pendingRead.status, 200);
      assert.equal(
        raw
          .prepare("SELECT COUNT(*) AS n FROM beast_day_settlements WHERE owner='123' AND day=?")
          .get(today.day)!.n,
        1,
      );
      await measure('cron-closed-day', () => cron(slot(today.end_at + 60000, 2, 2)));
      assert.equal(
        raw.prepare("SELECT settled FROM beast_v2_days WHERE owner='123' AND day=?").get(today.day)!
          .settled,
        1,
      );
      assert.equal(
        await measure('closed-day-replay', () =>
          settleOneBeastV2Day(db, owner, today.end_at + 2, () => 0),
        ),
        false,
      );
      assert.deepEqual(raw.prepare('PRAGMA foreign_key_check').all(), []);
    } finally {
      raw.close();
    }
  }
}
console.log(JSON.stringify({ kind: 'linh-thu-v2-local-runtime-benchmark', metrics }, null, 2));
