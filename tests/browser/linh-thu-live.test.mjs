import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { fixture, serve, chrome, browserBin, now } from './app-harness.mjs';
import { miniAppApi } from '../../src/entrypoints/mini-app.ts';
import { HealthyStore } from '../../src/adapters/d1/healthy-store.ts';
import { ScheduleStore } from '../../src/adapters/d1/schedule-store.ts';
import { D1HabitStore } from '../../src/adapters/d1/habit-store.ts';
import { D1WorkStore } from '../../src/adapters/d1/work-store.ts';
import { D1BeastStore } from '../../src/adapters/d1/linh-thu-store.ts';
import { HabitService } from '../../src/application/habit-service.ts';
import { BeastSettlementService } from '../../src/application/linh-thu-settlement.ts';

// Local credential injection only. Every feature request passes through the
// production router, signature verification, application services and real D1.
// Browser pairing remains the existing harness handshake; no Telegram is called.
test(
  'live UI, production API and temporary D1 preserve summons, recovery, training, tower, reset and weekly sleep skill',
  { skip: !browserBin, timeout: 120000 },
  async () => {
    const mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      d1Databases: ['DB'],
    });
    let browser, server;
    const committedSummon = Promise.withResolvers(),
      lostReply = Promise.withResolvers();
    const capture = process.env.LINH_THU_CAPTURE === '1';
    const screenshot = (name) =>
      capture ? browser.screenshot('trial-results/linh-thu/' + name) : Promise.resolve();
    try {
      if (capture) await mkdir('trial-results/linh-thu', { recursive: true });
      const db = await mf.getD1Database('DB');
      for (const file of readdirSync('migrations')
        .filter((file) => file.endsWith('.sql'))
        .sort())
        await db.exec(readFileSync('migrations/' + file, 'utf8').replace(/\r?\n/g, ' '));
      const control = fixture(),
        DAY = 86400000,
        token = 'local-live-beast-token';
      control.at = now;
      const env = {
        DB: db,
        TELEGRAM_USER_ID: '123',
        TELEGRAM_BOT_TOKEN: token,
        TELEGRAM_WEBHOOK_SECRET: 'x'.repeat(32),
        AI_MODE: 'off',
      };
      const schedule = new ScheduleStore(db),
        healthy = new HealthyStore(db),
        habits = new D1HabitStore(db),
        beasts = new D1BeastStore(db);
      await schedule.configure('123', '05:30', '23:15', 0, now - DAY);
      const day = (await schedule.ensureDay('123', now)).day;
      await new HabitService(habits).execute(
        '123',
        'live_create_habit',
        {
          operation: 'create',
          definition: {
            name: 'Live daily habit',
            metric: 'check',
            target: 1,
            cadence: { kind: 'daily' },
          },
        },
        now - DAY,
      );
      await habits.settle('123', now, 30);
      await beasts.initialize('123', day - 1, now - DAY);
      // This regression deliberately exercises already-issued v1 weekly rights.
      // New-account automatic v2 skills have separate browser/runtime coverage.
      await db
        .prepare("UPDATE beast_v2_runtime SET cutover_day=? WHERE owner='123'")
        .bind(day + 100)
        .run();
      await healthy.mutate('123', 'live_seed_wallet', 'fixture', {}, now, (state) => ({
        state: { ...state, tickets: 40 },
        result: {},
      }));
      const responses = [];
      control.api = async (incoming, endpoint) => {
        let raw = '';
        if (incoming.method === 'POST') for await (const part of incoming) raw += part;
        const params = new URLSearchParams({
          auth_date: String(Math.floor(control.at / 1000)),
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
        const input = raw ? JSON.parse(raw) : null;
        if (input) control.posts.push({ path: endpoint, input });
        const headers = new Headers({
          'X-Telegram-Init-Data': params.toString(),
          'Content-Type': 'application/json',
        });
        if (incoming.headers.origin) headers.set('Origin', incoming.headers.origin);
        const result = await miniAppApi(
          new Request(new URL(incoming.url, server.url), {
            method: incoming.method,
            headers,
            ...(raw ? { body: raw } : {}),
          }),
          env,
          control.at,
        );
        responses.push({ endpoint, status: result.status });
        if (control.loseNextSummon && input?.operation === 'summon' && result.ok) {
          control.loseNextSummon = false;
          committedSummon.resolve();
          await lostReply.promise;
          return Response.json({ error: 'OPERATION_NOT_CONFIRMED' }, { status: 503 });
        }
        return result;
      };
      server = await serve(control);
      browser = await chrome();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-empty')");
      await browser.reducedMotion();
      await browser.click('Đến Triệu hồi');
      await browser.tap('.beast-summon-exchange');
      await browser.evaluate(
        "const amount=document.querySelector('#sheet input');amount.value='2';amount.dispatchEvent(new Event('input',{bubbles:true}))",
      );
      await browser.click('Xác nhận đổi');
      await browser.wait(
        "!document.querySelector('#sheet').open&&document.querySelector('.beast-wallet strong')?.getAttribute('aria-label')==='2 vé triệu hồi'",
      );
      assert.equal((await healthy.read('123')).state.tickets, 0);
      for (let index = 0; index < 2; index++) {
        if (index) control.loseNextSummon = true;
        await browser.tap('.beast-summon-actions .secondary');
        if (index) {
          await committedSummon.promise;
          assert.equal(
            await browser.evaluate(
              "[...document.querySelectorAll('button')].find(b=>b.textContent==='Kiểm tra kết quả').disabled",
            ),
            true,
            'Recovery stays disabled until the original write returns',
          );
          lostReply.resolve();
          await browser.wait(
            "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
          );
          const pending = await browser.evaluate(
            "JSON.parse(sessionStorage.getItem('minh-anh-beast-pending-v1'))",
          );
          assert.ok(
            await db
              .prepare(
                "SELECT request_id FROM cultivation_receipts WHERE owner='123' AND request_id=?",
              )
              .bind(pending.id)
              .first(),
          );
          await browser.navigate(server.url, 390);
          await browser.wait("!!document.querySelector('.focus-flip-card')");
          await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
          await browser.wait(
            "[...document.querySelectorAll('button')].some(b=>b.textContent==='Kiểm tra kết quả'&&!b.disabled)",
          );
          await browser.click('Kiểm tra kết quả');
        }
        await browser.wait("!!document.querySelector('.beast-reveal.is-revealed')");
        if (!index) await screenshot('live-summon-390.png');
        await browser.click('Tiếp tục hành trình');
      }
      assert.equal(
        control.posts.filter((post) => post.input.operation === 'summon').length,
        2,
        'Receipt recovery must not POST another summon',
      );
      assert.equal((await beasts.read('123')).state.summonTickets, 0);
      const owned = (await beasts.collection('123', null, 24)).beasts;
      assert.equal(owned.length, 2);
      await browser.click('Đang luyện');
      await browser.click('Chọn linh thú');
      await browser.evaluate("document.querySelector('.beast-picker-item').click()");
      await browser.click('Xác nhận');
      await browser.wait(
        `document.querySelector('.beast-hero')?.dataset.beastId===${JSON.stringify(owned[0].id)}&&document.querySelector('.beast-role-label')?.textContent==='Bắt đầu luyện từ ngày mai'`,
      );
      assert.equal(
        (await beasts.roles('123', day)).current.some((role) => role.role === 'training'),
        false,
      );
      assert.equal(
        (await beasts.roles('123', day)).pending.find((role) => role.role === 'training').beastId,
        owned[0].id,
      );
      control.at += DAY;
      await habits.settle('123', control.at, 30);
      await new BeastSettlementService(beasts, () => 0).settle('123', control.at, 14);
      // A legitimate whole task, completed through the real task store, seeds
      // the independent task requirement; habit logging itself remains UI-driven.
      const work = new D1WorkStore(db);
      const task = await work.mutateHierarchy(
        '123',
        'live_task_create',
        { operation: 'create', title: 'Live whole task' },
        control.at,
      );
      await work.mutateHierarchy(
        '123',
        'live_task_complete',
        { operation: 'complete', taskId: String(task.id), version: 1, complete: true },
        control.at,
      );
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=habits]').click()");
      await browser.wait("!!document.querySelector('.habit-check:not(.checked)')");
      await browser.evaluate("document.querySelector('.habit-check').click()");
      await browser.wait(
        "!!document.querySelector('.habit-check.checked')&&!document.querySelector('.habit-check').disabled",
      );
      await browser.click('Vào tháp');
      await browser.wait(
        "[...document.querySelectorAll('button')].some(b=>b.textContent==='Bắt đầu · Miễn phí'&&!b.disabled)",
      );
      await browser.click('Bắt đầu · Miễn phí');
      for (let floor = 1; floor <= 3; floor++) {
        await browser.wait(
          `document.querySelectorAll('.beast-tower-card').length===${floor === 3 ? 3 : 4}`,
        );
        const run = await beasts.tower('123', day + 1);
        const safe = run.state.trap === 0 ? 1 : 0; // Oracle is DB-only; API must never reveal the trap.
        await browser.evaluate(`document.querySelectorAll('.beast-tower-card')[${safe}].click()`);
        const reward = floor === 1 ? '2 vé thường' : floor === 2 ? '3 vé thường' : '5 vé thường';
        await browser.wait(
          `!!document.querySelector('.beast-tower-claim')&&document.querySelector('.tower-purse-value').textContent==='${reward}'`,
        );
        if (floor < 3) {
          await browser.tap('.beast-tower-continue');
          await browser.wait(
            `document.querySelector('.tower-floor-label').textContent==='Tầng ${floor + 1} / 4'&&!document.querySelector('.tower-board.has-selection')`,
          );
        }
      }
      await browser.tap('.beast-tower-claim');
      await browser.wait("!!document.querySelector('.tower-receipt')");
      assert.equal((await beasts.read('123')).state.summonTickets, 0);
      assert.equal((await beasts.tower('123', day + 1)).state.status, 'claimed');
      await screenshot('live-tower-390.png');
      await browser.press('Escape');
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đổi linh thú luyện');
      await browser.evaluate("document.querySelectorAll('.beast-picker-item')[1].click()");
      await browser.click('Xác nhận');
      await browser.wait(
        `document.querySelector('.beast-hero')?.dataset.beastId===${JSON.stringify(owned[1].id)}&&document.querySelector('.beast-hero')?.dataset.pending==='true'`,
      );
      assert.equal(
        (await beasts.roles('123', day + 1)).current.find((role) => role.role === 'training')
          .beastId,
        owned[0].id,
      );
      assert.equal(
        await browser.evaluate("!!document.querySelector('.beast-role-previous')"),
        true,
      );
      control.at += DAY;
      await habits.settle('123', control.at, 30);
      await new BeastSettlementService(beasts, () => 0).settle('123', control.at, 14);
      const sealed = await beasts.individual('123', owned[0].id);
      assert.equal(sealed.attempt.status, 'sealed');
      assert.equal(sealed.attempt.earned, 10);
      // Advanced furnace fixture avoids simulating thirty UI days; the craft,
      // shared wallet, guaranteed result, reset and receipt all use production code.
      await db
        .prepare(
          "UPDATE beast_accounts SET state_json=json_set(state_json,'$.alchemy.days',30,'$.alchemy.failures',2),version=version+1 WHERE owner='123'",
        )
        .run();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Lò đan · 30/30');
      await browser.click('Luyện Tịnh Linh Đan');
      await browser.wait("document.body.textContent.includes('Tịnh Linh Đan đã thành')");
      assert.equal((await beasts.read('123')).state.alchemy.inventory, 1);
      await browser.click('Trở lại Lò đan');
      await browser.click('Dùng đan · Chọn linh thú');
      await browser.evaluate(
        "[...document.querySelectorAll('#sheet button')].find(b=>b.textContent.includes('Dùng 1 đan')).click()",
      );
      await browser.click('Xác nhận');
      await browser.wait(
        "!document.querySelector('#sheet').open&&!sessionStorage.getItem('minh-anh-beast-pending-v1')",
      );
      const reset = await beasts.individual('123', owned[0].id);
      assert.notEqual(reset.attemptId, sealed.attemptId);
      assert.deepEqual(
        { status: reset.attempt.status, earned: reset.attempt.earned, gray: reset.attempt.gray },
        { status: 'ready', earned: 0, gray: 0 },
      );
      assert.equal(
        (await beasts.individual('123', owned[0].id, sealed.attemptId)).attempt.earned,
        10,
      );
      assert.equal((await beasts.read('123')).state.alchemy.inventory, 0);
      assert.equal(
        (await beasts.roles('123', day + 2)).current.find((role) => role.role === 'training')
          .beastId,
        owned[1].id,
        'Reset never selects a different trainee',
      );
      // A completed companion is an advanced-state fixture; selection, next-day
      // activation, the weekly ultimate and its real sleep hook remain UI/API-driven.
      await beasts.transact(
        '123',
        'live_perfect_fixture',
        'fixture',
        {},
        day + 2,
        control.at,
        (await beasts.read('123')).version,
        (account, wallet) => ({
          state: account.state,
          healthy: wallet,
          result: {},
          newBeasts: [
            { id: 'live_perfect_frost', attemptId: 'live_perfect_attempt', speciesId: 'frostnip' },
          ],
        }),
      );
      await db
        .prepare(
          "UPDATE beast_attempts SET status='completed',earned=1200,form=4 WHERE owner='123' AND id='live_perfect_attempt'",
        )
        .run();
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đồng hành');
      await browser.click('Chọn linh thú');
      await browser.evaluate("document.querySelector('.beast-picker-item').click()");
      await browser.click('Xác nhận');
      await browser.wait(
        "document.querySelector('.beast-hero')?.dataset.beastId==='live_perfect_frost'&&document.querySelector('.beast-role-label')?.textContent==='Hỗ trợ từ ngày mai'",
      );
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      assert.equal(
        await browser.evaluate(
          "[...document.querySelectorAll('#sheet button')].some(button=>button.textContent==='Kích hoạt tuyệt kỹ tuần này')",
        ),
        false,
        'Pending companion cannot activate an ultimate early',
      );
      await browser.press('Escape');
      assert.equal(
        (await beasts.roles('123', day + 2)).pending.find((role) => role.role === 'companion')
          .beastId,
        'live_perfect_frost',
      );
      control.at += DAY;
      await habits.settle('123', control.at, 30);
      await new BeastSettlementService(beasts, () => 0).settle('123', control.at, 14);
      await browser.navigate(server.url, 390);
      await browser.wait("!!document.querySelector('.focus-flip-card')");
      await browser.evaluate("document.querySelector('[data-tab=beasts]').click()");
      await browser.wait("!!document.querySelector('.beast-hero')");
      await browser.click('Đồng hành');
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      await browser.click('Kích hoạt tuyệt kỹ tuần này');
      await browser.click('Xác nhận');
      await browser.wait(
        "document.body.textContent.includes('Đã kích hoạt Băng Nguyệt Phong Ấn.')",
      );
      await browser.wait(
        "!document.querySelector('.feature-updating')&&!sessionStorage.getItem('minh-anh-beast-pending-v1')",
      );
      await browser.click('Xem tuyệt kỹ hoàn mỹ');
      await browser.wait(
        "document.querySelector('#sheet-content').textContent.includes('Hạn mức tuần đã dùng')",
      );
      assert.equal(
        await browser.evaluate(
          "document.querySelector('#sheet-content').textContent.includes('Còn 3 lượt hiệu ứng.')",
        ),
        true,
        'Expiry display must follow the authoritative server clock, not the browser wall date',
      );
      const readUltimate = async () =>
        JSON.parse(
          (await db.prepare("SELECT state_json FROM beast_ultimates WHERE owner='123'").first())
            .state_json,
        );
      assert.equal((await readUltimate()).remaining, 3);
      await screenshot('live-ultimate-390.png');
      await browser.press('Escape');
      const beforeSleep = (await healthy.read('123')).state.qi;
      await browser.evaluate("document.querySelector('#settings').click()");
      await browser.click('Đi ngủ');
      await browser.click('Đi ngủ');
      await browser.wait(
        "document.querySelector('.settings-sleep-controls').textContent.includes('Đang ngủ')",
      );
      assert.equal((await readUltimate()).remaining, 2);
      const gained = (await healthy.read('123')).state.qi - beforeSleep;
      assert.ok(
        gained >= 10 && gained <= 13,
        'Actual sleep pays 5 base +5 ultimate and only the possible 3-qi passive',
      );
      const writes = control.posts.filter((post) => post.path === 'linh-thu');
      for (const { input } of writes)
        assert.ok(
          await db
            .prepare(
              "SELECT request_id FROM cultivation_receipts WHERE owner='123' AND request_id=? AND operation=?",
            )
            .bind(input.id, 'beast-' + input.operation)
            .first(),
        );
      assert.deepEqual(
        responses.filter((result) => result.status >= 400),
        [],
      );
      assert.deepEqual(browser.errors, []);
      if (capture)
        await writeFile(
          'trial-results/linh-thu/live-flow-proof.json',
          JSON.stringify(
            {
              kind: 'Local Chrome -> production miniAppApi -> temporary Miniflare D1 -> receipt -> Chrome; synthetic owner and advanced-state fixtures only',
              pairing:
                'Harness handshake; each feature API call verifies a synthetic signed Telegram credential',
              taskRequirement:
                'Whole task created and completed through production task store; habit log through UI',
              towerOracle: 'Test reads a safe card from D1; client API never receives hidden trap',
              advancedFixtures: [
                'Thirty-day furnace charge and two failures',
                'One completed perfect Frostnip',
              ],
              syntheticNow: new Date(control.at).toISOString(),
              apiResponses: responses,
              writes: writes.map(({ input }) => ({ id: input.id, operation: input.operation })),
              recoveredSummonPostCount: control.posts.filter(
                (post) => post.input.operation === 'summon',
              ).length,
              reset: {
                oldAttempt: sealed.attemptId,
                newAttempt: reset.attemptId,
                earned: reset.attempt.earned,
                gray: reset.attempt.gray,
              },
              ultimate: await readUltimate(),
              sleepQiGained: gained,
              screenshots: ['live-summon-390.png', 'live-tower-390.png', 'live-ultimate-390.png'],
            },
            null,
            2,
          ) + '\n',
        );
    } finally {
      lostReply.resolve();
      await browser?.close();
      await server?.close();
      await mf.dispose();
    }
  },
);
