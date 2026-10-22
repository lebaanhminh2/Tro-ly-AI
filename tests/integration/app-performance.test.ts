import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Miniflare } from 'miniflare';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import type { Database } from '../../src/adapters/d1/database.ts';

test('task mutation receipts carry the current task version, completion and confirmed wallet without another bootstrap', async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ['DB'],
  });
  try {
    const db = (await mf.getD1Database('DB')) as unknown as Database & {
      exec(sql: string): Promise<unknown>;
    };
    for (const file of readdirSync('migrations')
      .filter((file) => file.endsWith('.sql'))
      .sort())
      await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
    const now = Date.parse('2026-10-22T10:00:00+07:00'),
      token = '123:test';
    await new ScheduleStore(db).configure('123', '04:30', '22:30', 0, now);
    const params = new URLSearchParams({
      auth_date: String(Math.floor(now / 1000)),
      user: JSON.stringify({ id: 123 }),
    });
    params.set(
      'hash',
      createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest())
        .update(
          [...params]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => k + '=' + v)
            .join('\n'),
        )
        .digest('hex'),
    );
    const env = {
      DB: db,
      TELEGRAM_USER_ID: '123',
      TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
      TELEGRAM_BOT_TOKEN: token,
    };
    const post = async (body: Record<string, unknown>) => {
      const response = await miniAppApi(
        new Request('https://local/api/tasks', {
          method: 'POST',
          headers: { Origin: 'https://local', 'X-Telegram-Init-Data': params.toString() },
          body: JSON.stringify(body),
        }),
        env,
        now,
      );
      const data = (await response.json()) as any;
      assert.equal(response.status, 200, JSON.stringify(data));
      return data;
    };
    const created = await post({
      id: 'receipt_task_create',
      operation: 'create',
      title: 'Task confirmed',
      remainingMinutes: 45,
    });
    assert.equal(created.task.id, created.result.id);
    assert.equal(created.task.version, 1);
    assert.equal(created.task.remaining_minutes, 45);
    assert.equal(created.task.actual_minutes, 0);
    assert.ok(created.account.state);
    const id = created.task.id;
    const edited = await post({
      id: 'receipt_task_edit',
      operation: 'edit',
      taskId: id,
      version: 1,
      title: 'New title',
      note: 'Saved note',
    });
    assert.equal(edited.task.version, 2);
    assert.equal(edited.task.title, 'New title');
    assert.equal(edited.task.note, 'Saved note');
    const input = {
      id: 'receipt_task_complete',
      operation: 'complete',
      taskId: id,
      version: 2,
      complete: true,
      confirm: true,
    };
    const completed = await post(input);
    assert.equal(completed.task.status, 'completed');
    assert.equal(completed.task.version, 3);
    assert.equal(completed.task.completed_at, now);
    assert.equal(completed.account.state.tickets, created.account.state.tickets + 1);
    assert.deepEqual(await post(input), completed);
    const stale = await miniAppApi(
      new Request('https://local/api/tasks', {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': params.toString() },
        body: JSON.stringify({
          id: 'receipt_stale_edit',
          operation: 'edit',
          taskId: id,
          version: 2,
          title: 'Stale',
        }),
      }),
      env,
      now,
    );
    assert.equal(stale.status, 409);
    assert.equal(
      (await db.prepare('SELECT title FROM tasks WHERE id=?').bind(id).first<{ title: string }>())
        ?.title,
      'New title',
    );
  } finally {
    await mf.dispose();
  }
});
