import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { Miniflare } from 'miniflare';
import { bootstrap } from '../src/entrypoints/mini-app/bootstrap.ts';
import { ScheduleStore } from '../src/adapters/d1/schedule-store.ts';
import { HealthyStore } from '../src/adapters/d1/healthy-store.ts';
import { D1WorkStore } from '../src/adapters/d1/work-store.ts';

const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: ['DB'],
});
try {
  const raw = await mf.getD1Database('DB');
  for (const file of (await readdir('migrations')).filter((file) => file.endsWith('.sql')).sort())
    await raw.exec((await readFile('migrations/' + file, 'utf8')).replace(/\r?\n/g, ' '));
  const now = Date.parse('2026-10-22T10:00:00+07:00');
  await new ScheduleStore(raw).configure('123', '04:30', '22:30', 0, now);
  const work = new D1WorkStore(raw);
  for (let index = 0; index < 8; index++)
    await work.mutateHierarchy(
      '123',
      'server_benchmark_' + index,
      { operation: 'create', title: 'Việc ' + index, remainingMinutes: 30 },
      now,
    );
  const unwrap = new WeakMap();
  let queries = 0,
    active = 0,
    maxParallel = 0;
  const db = new Proxy(raw, {
    get(target, property) {
      if (property === 'prepare') return (sql) => wrap(target.prepare(sql));
      if (property === 'batch')
        return async (statements) => {
          queries++;
          active++;
          maxParallel = Math.max(maxParallel, active);
          try {
            await delay(20);
            return await target.batch(
              statements.map((statement) => unwrap.get(statement) ?? statement),
            );
          } finally {
            active--;
          }
        };
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  function wrap(statement) {
    const proxy = new Proxy(statement, {
      get(target, property) {
        if (property === 'bind') return (...values) => wrap(target.bind(...values));
        if (['first', 'all', 'run', 'raw'].includes(property))
          return async (...args) => {
            queries++;
            active++;
            maxParallel = Math.max(maxParallel, active);
            try {
              await delay(20);
              return await target[property](...args);
            } finally {
              active--;
            }
          };
        return target[property];
      },
    });
    unwrap.set(proxy, statement);
    return proxy;
  }
  const context = { env: { DB: db }, owner: '123', now, healthy: new HealthyStore(db) };
  await bootstrap(context);
  const measurements = [];
  for (let run = 0; run < 5; run++) {
    queries = 0;
    maxParallel = 0;
    const start = performance.now(),
      response = await bootstrap(context),
      body = await response.json();
    measurements.push({
      wallMs: performance.now() - start,
      queries,
      maxParallel,
      tasks: body.tasks.length,
      hasTimeline: !!body.timeline,
    });
  }
  const report = {
    fixture:
      'Local Miniflare D1, eight tasks, warmed operating day, 20ms injected per DB operation, five runs. No production latency claim.',
    measurements,
    medianMs: measurements.map((row) => row.wallMs).sort((a, b) => a - b)[2],
  };
  const target = resolve(process.argv[2] ?? 'output/app-performance/server-current.json');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mf.dispose();
}
