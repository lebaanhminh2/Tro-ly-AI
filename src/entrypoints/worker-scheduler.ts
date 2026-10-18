import {ScheduleStore} from '../adapters/d1/schedule-store.ts';
import {HealthyStore} from '../adapters/d1/healthy-store.ts';
import {RecurrenceStore} from '../adapters/d1/recurrence-store.ts';
import {unlockAchievements} from '../adapters/d1/progress-store.ts';
import {configured} from '../config/env.ts';
import type {Env} from '../config/env.ts';
import {recoverInterrupted,query} from '../adapters/d1/database.ts';
import {D1WorkStore} from '../adapters/d1/work-store.ts';
import {flushOutbox} from '../adapters/d1/outbox.ts';
import {processInbox} from '../application/process-inbox.ts';
import {queueReminders} from '../adapters/d1/reminders.ts';
import {expireMemory} from '../adapters/d1/memory.ts';
import {queueAppointments} from '../adapters/d1/conversation-store.ts';
import {DayPlanStore} from '../adapters/d1/day-plan-store.ts';
import {queueWorkNudge} from '../adapters/d1/work-nudges.ts';
import {TaskDayStore} from '../adapters/d1/task-day-store.ts';
import {D1HabitStore} from '../adapters/d1/habit-store.ts';
import type {ChatService} from '../application/plan-command.ts';
import type {Clock} from '../ports/work-store.ts';

export async function runScheduled(env:Env,deps:{cardsEnabled:boolean;transport:typeof fetch;clock:Clock;chat:ChatService|undefined;flushCards:()=>Promise<void>}){
 if(!configured(env))return;
 const {cardsEnabled,transport,clock,chat,flushCards}=deps;
 const now=clock.now();
 const store=new D1WorkStore(env.DB,cardsEnabled);
 const schedule=new ScheduleStore(env.DB);
 if(env.ASSETS){
  // Replies to an explicit user action remain deliverable even if a later
  // maintenance job fails. Proactive messages must wait for inactivity scoring.
  const direct=await query(env.DB,"SELECT id FROM outbox WHERE state='pending' AND available<=? AND attempts<3 AND (id LIKE ? OR id LIKE ?) ORDER BY available,id LIMIT 1",now,`reply:${env.TELEGRAM_USER_ID}:%`,`ack:${env.TELEGRAM_USER_ID}:%`).first<{id:string}>();
  if(direct)await flushOutbox(env,transport,now,()=>clock.now(),direct.id,1);
  await schedule.settleClosedDays(env.TELEGRAM_USER_ID,clock.now());
 }
 // A previous webhook or cron may already have committed a delivery. Send one
 // first so background maintenance cannot consume the entire 10 ms Free-plan
 // CPU allowance before Telegram is called.
 await flushOutbox(env,transport,now,()=>clock.now(),undefined,1);
 await recoverInterrupted(env.DB,clock.now());

 if(!env.ASSETS){
  await expireMemory(env.DB,clock.now());
  await unlockAchievements(env.DB,env.TELEGRAM_USER_ID,clock.now());
  for(const owner of await store.pendingOwners())if(owner===env.TELEGRAM_USER_ID)await processInbox(store,owner,clock,chat,4);
  await queueReminders(env.DB,env.TELEGRAM_USER_ID,clock.now());
  if(cardsEnabled)await queueAppointments(env.DB,env.TELEGRAM_USER_ID,clock.now());
  await flushOutbox(env,transport,clock.now());
  await flushCards();
  return;
 }

 // Stagger independent jobs across four invocations. Due notifications may be
 // queued up to three minutes later, while outbox delivery remains every minute.
 const phase=Math.floor(now/60000)%4;
 if(phase===0){
  const taskDay=new TaskDayStore(env.DB);
  await taskDay.queuePrompt(env.TELEGRAM_USER_ID,clock.now());
  await taskDay.activateAutomatic(env.TELEGRAM_USER_ID,clock.now());
  await new DayPlanStore(env.DB).ensure(env.TELEGRAM_USER_ID,clock.now());
 }else if(phase===1){
  await schedule.queueCheckIns(env.TELEGRAM_USER_ID,clock.now());
  await new RecurrenceStore(env.DB).queueDue(env.TELEGRAM_USER_ID,clock.now(),await schedule.personalRemindersPaused(env.TELEGRAM_USER_ID,clock.now()));
 }else if(phase===2){
  await queueWorkNudge(env,clock.now(),transport);
  if(cardsEnabled)await queueAppointments(env.DB,env.TELEGRAM_USER_ID,clock.now());
 }else{
  // Three maintenance slots within phase3. Personal reminder/work delivery
  // keeps its four-minute cadence. Habit settlement runs separately,
  // leaving query/CPU headroom rather than stacking every job in one call.
  const maintenance=Math.floor(now/240000)%3;
  if(maintenance===1)await new D1HabitStore(env.DB).settleBatch(env.TELEGRAM_USER_ID,clock.now(),30);
  // Keep the remaining maintenance cadence and per-invocation CPU budget.
  else if(maintenance===0){
   for(const owner of await store.pendingOwners())if(owner===env.TELEGRAM_USER_ID)await processInbox(store,owner,clock,chat,1);
   await store.archiveCompleted(env.TELEGRAM_USER_ID,clock.now(),90,25);
   await new HealthyStore(env.DB).syncTaskTickets(env.TELEGRAM_USER_ID,clock.now());
   await expireMemory(env.DB,clock.now());
   await unlockAchievements(env.DB,env.TELEGRAM_USER_ID,clock.now());
   await flushCards();
  }
 }
 await flushOutbox(env,transport,clock.now(),()=>clock.now(),undefined,1);
}
