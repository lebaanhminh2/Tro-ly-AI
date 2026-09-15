import {ScheduleStore} from '../adapters/d1/schedule-store.ts';
import {HealthyStore} from '../adapters/d1/healthy-store.ts';
import {RecurrenceStore} from '../adapters/d1/recurrence-store.ts';
import {unlockAchievements} from '../adapters/d1/progress-store.ts';
import {configured} from '../config/env.ts';
import type {Env} from '../config/env.ts';
import {recoverInterrupted} from '../adapters/d1/database.ts';
import {D1WorkStore} from '../adapters/d1/work-store.ts';
import {flushOutbox} from '../adapters/d1/outbox.ts';
import {processInbox} from '../application/process-inbox.ts';
import {queueReminders} from '../adapters/d1/reminders.ts';
import {expireMemory} from '../adapters/d1/memory.ts';
import {queueAppointments} from '../adapters/d1/conversation-store.ts';
import {DayPlanStore} from '../adapters/d1/day-plan-store.ts';
import {queueWorkNudge} from '../adapters/d1/work-nudges.ts';
import type {ChatService} from '../application/plan-command.ts';
import type {Clock} from '../ports/work-store.ts';

export async function runScheduled(env:Env,deps:{cardsEnabled:boolean;transport:typeof fetch;clock:Clock;chat:ChatService|undefined;flushCards:()=>Promise<void>}){
 if(!configured(env))return;
 const {cardsEnabled,transport,clock,chat,flushCards}=deps;
 const store=new D1WorkStore(env.DB,cardsEnabled);
 if(env.ASSETS){
  const schedule=new ScheduleStore(env.DB);
  await schedule.settleClosedDays(env.TELEGRAM_USER_ID,clock.now());
  await new DayPlanStore(env.DB).ensure(env.TELEGRAM_USER_ID,clock.now());
  await store.archiveCompleted(env.TELEGRAM_USER_ID,clock.now(),90,100);
  await new HealthyStore(env.DB).syncTaskTickets(env.TELEGRAM_USER_ID,clock.now());
  await schedule.queueCheckIns(env.TELEGRAM_USER_ID,clock.now());
  await new RecurrenceStore(env.DB).queueDue(env.TELEGRAM_USER_ID,clock.now(),await schedule.notificationsPaused(env.TELEGRAM_USER_ID,clock.now()));
 }
 await expireMemory(env.DB,clock.now());
 await unlockAchievements(env.DB,env.TELEGRAM_USER_ID,clock.now());
 await recoverInterrupted(env.DB,clock.now());
 for(const owner of await store.pendingOwners())if(owner===env.TELEGRAM_USER_ID)await processInbox(store,owner,clock,chat,4);
 if(env.ASSETS)await queueWorkNudge(env,clock.now(),transport);
 else await queueReminders(env.DB,env.TELEGRAM_USER_ID,clock.now());
 if(cardsEnabled)await queueAppointments(env.DB,env.TELEGRAM_USER_ID,clock.now());
 await flushOutbox(env,transport,clock.now());
 await flushCards();
}
