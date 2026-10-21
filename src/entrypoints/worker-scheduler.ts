import { ScheduleStore } from '../adapters/d1/schedule-store.ts';
import { HealthyStore } from '../adapters/d1/healthy-store.ts';
import { RecurrenceStore } from '../adapters/d1/recurrence-store.ts';
import { unlockAchievements } from '../adapters/d1/progress-store.ts';
import { configured } from '../config/env.ts';
import type { Env } from '../config/env.ts';
import { recoverInterrupted, query } from '../adapters/d1/database.ts';
import { D1WorkStore } from '../adapters/d1/work-store.ts';
import { flushOutbox } from '../adapters/d1/outbox.ts';
import { processInbox } from '../application/process-inbox.ts';
import { queueReminders } from '../adapters/d1/reminders.ts';
import { expireMemory } from '../adapters/d1/memory.ts';
import { queueAppointments } from '../adapters/d1/conversation-store.ts';
import { DayPlanStore } from '../adapters/d1/day-plan-store.ts';
import { queueWorkNudge } from '../adapters/d1/work-nudges.ts';
import { TaskDayStore } from '../adapters/d1/task-day-store.ts';
import { D1HabitStore } from '../adapters/d1/habit-store.ts';
import type { ChatService } from '../application/plan-command.ts';
import type { Clock } from '../ports/work-store.ts';
import { D1BeastStore } from '../adapters/d1/linh-thu-store.ts';
import { BeastSettlementService } from '../application/linh-thu-settlement.ts';
import { BeastTowerService } from '../application/linh-thu-tower.ts';
import {
  settleOneCombinedBeastDay,
  settleOneExpiredBeastUltimate,
} from '../adapters/d1/linh-thu-maintenance.ts';

export async function runScheduled(
  env: Env,
  deps: {
    cardsEnabled: boolean;
    transport: typeof fetch;
    clock: Clock;
    chat: ChatService | undefined;
    flushCards: () => Promise<void>;
  },
) {
  if (!configured(env)) return;
  const { cardsEnabled, transport, clock, chat, flushCards } = deps;
  const now = clock.now();
  const store = new D1WorkStore(env.DB, cardsEnabled);
  const schedule = new ScheduleStore(env.DB);
  let settledSleep = false;
  if (env.ASSETS) {
    // Replies to an explicit user action remain deliverable even if a later
    // maintenance job fails. Proactive messages must wait for inactivity scoring.
    const direct = await query(
      env.DB,
      "SELECT id FROM outbox WHERE state='pending' AND available<=? AND attempts<3 AND (id LIKE ? OR id LIKE ?) ORDER BY available,id LIMIT 1",
      now,
      `reply:${env.TELEGRAM_USER_ID}:%`,
      `ack:${env.TELEGRAM_USER_ID}:%`,
    ).first<{ id: string }>();
    if (direct) await flushOutbox(env, transport, now, () => clock.now(), direct.id, 1);
    settledSleep = await schedule.settleClosedDays(env.TELEGRAM_USER_ID, clock.now(), 1);
  }
  // A sleep assessment can also apply companion rewards and guards. Do not
  // stack another maintenance transaction into its Free-plan query budget.
  // Until catch-up finishes, hold proactive messages so an account about to
  // become inactive cannot receive them between its bounded sleep assessments.
  if (settledSleep) {
    const explicit = await query(
      env.DB,
      "SELECT id FROM outbox WHERE state='pending' AND available<=? AND attempts<3 AND (id LIKE 'reply:%' OR id LIKE 'ack:%' OR id LIKE 'menu:%' OR id LIKE 'browser-login:%') ORDER BY available,id LIMIT 1",
      now,
    ).first<{ id: string }>();
    if (explicit) await flushOutbox(env, transport, now, () => clock.now(), explicit.id, 1);
    await recoverInterrupted(env.DB, clock.now());
    return;
  }

  // A previous webhook or cron may already have committed a delivery. Send one
  // first so background maintenance cannot consume the entire 10 ms Free-plan
  // CPU allowance before Telegram is called.
  await flushOutbox(env, transport, now, () => clock.now(), undefined, 1);
  await recoverInterrupted(env.DB, clock.now());

  if (!env.ASSETS) {
    await expireMemory(env.DB, clock.now());
    await unlockAchievements(env.DB, env.TELEGRAM_USER_ID, clock.now());
    for (const owner of await store.pendingOwners())
      if (owner === env.TELEGRAM_USER_ID) await processInbox(store, owner, clock, chat, 4);
    await queueReminders(env.DB, env.TELEGRAM_USER_ID, clock.now());
    if (cardsEnabled) await queueAppointments(env.DB, env.TELEGRAM_USER_ID, clock.now());
    await flushOutbox(env, transport, clock.now());
    await flushCards();
    return;
  }

  // Stagger independent jobs across four invocations. Due notifications may be
  // queued up to three minutes later, while outbox delivery remains every minute.
  const phase = Math.floor(now / 60000) % 4;
  if (phase === 0) {
    const taskDay = new TaskDayStore(env.DB);
    await taskDay.queuePrompt(env.TELEGRAM_USER_ID, clock.now());
    const activated = await taskDay.activateAutomatic(env.TELEGRAM_USER_ID, clock.now());
    if (!activated) await new DayPlanStore(env.DB).ensure(env.TELEGRAM_USER_ID, clock.now());
  } else if (phase === 1) {
    await schedule.queueCheckIns(env.TELEGRAM_USER_ID, clock.now());
    await new RecurrenceStore(env.DB).queueDue(
      env.TELEGRAM_USER_ID,
      clock.now(),
      await schedule.personalRemindersPaused(env.TELEGRAM_USER_ID, clock.now()),
    );
  } else if (phase === 2) {
    await queueWorkNudge(env, clock.now(), transport);
    if (cardsEnabled) await queueAppointments(env.DB, env.TELEGRAM_USER_ID, clock.now());
  } else {
    // Three maintenance slots within phase3. Personal reminder/work delivery
    // keeps its four-minute cadence. Habit settlement runs separately,
    // leaving query/CPU headroom rather than stacking every job in one call.
    const maintenance = Math.floor(now / 240000) % 3;
    if (maintenance === 1)
      await new D1HabitStore(env.DB).settleBatch(env.TELEGRAM_USER_ID, clock.now(), 30);
    else if (maintenance === 2) {
      const beasts = new D1BeastStore(env.DB),
        random = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 4294967296;
      // Rotate heavy jobs instead of stacking their SQL into a single invocation.
      // GETs also advance work; jobs rotate every 48 minutes when sleep catch-up
      // does not consume the invocation. Deferred jobs keep their next slot.
      const beastJob = Math.floor(now / 720000) % 4;
      if (beastJob === 0)
        await new BeastTowerService(beasts, random).expire(env.TELEGRAM_USER_ID, clock.now());
      else if (beastJob === 1)
        await new BeastSettlementService(beasts, random).settle(
          env.TELEGRAM_USER_ID,
          clock.now(),
          1,
        );
      else if (beastJob === 2)
        await settleOneCombinedBeastDay(env.DB, env.TELEGRAM_USER_ID, clock.now(), random);
      else await settleOneExpiredBeastUltimate(env.DB, env.TELEGRAM_USER_ID, clock.now());
    }
    // Keep the remaining maintenance cadence and per-invocation CPU budget.
    else if (maintenance === 0) {
      if ((await store.pendingOwners()).includes(env.TELEGRAM_USER_ID)) {
        await processInbox(store, env.TELEGRAM_USER_ID, clock, chat, 1);
        await flushOutbox(env, transport, clock.now(), () => clock.now(), undefined, 1);
        await flushCards();
        // A recovered command owns this invocation. Optional maintenance waits
        // for a later slot instead of sharing its transaction/query budget.
        return;
      }
      await store.archiveCompleted(env.TELEGRAM_USER_ID, clock.now(), 90, 25);
      await new HealthyStore(env.DB).syncTaskTickets(env.TELEGRAM_USER_ID, clock.now());
      await expireMemory(env.DB, clock.now());
      await unlockAchievements(env.DB, env.TELEGRAM_USER_ID, clock.now());
      await flushCards();
    }
  }
  await flushOutbox(env, transport, clock.now(), () => clock.now(), undefined, 1);
}
