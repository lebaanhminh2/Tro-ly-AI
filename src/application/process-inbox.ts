import type { Clock, WorkStore } from '../ports/work-store.ts';
import { planCommand } from './plan-command.ts';
import type { ChatService } from './plan-command.ts';
import type { CalendarCommands } from '../ports/calendar.ts';

export async function processInbox(store: WorkStore, owner: string, clock: Clock, chat?: ChatService, limit = 4, calendar?: CalendarCommands) {
  for (let i = 0; i < limit; i++) {
    const lease = await store.claim(owner, clock.now());
    if (!lease) break;
    try {
      await store.prepareUi?.(lease,clock.now());
      const plan = lease.uiStale ? {view:{text:'Lựa chọn đã cũ. Mở lại danh sách nhé.',buttons:[],silent:true},changes:[]}
        : lease.attempts > 3
        ? { view: { text: 'Xử lý phản hồi bị gián đoạn nhiều lần. Thay đổi có thể đã lưu; cậu kiểm tra trạng thái trước khi gửi lại yêu cầu nhé.', buttons: [] }, changes: [] }
        : await planCommand(lease.input, store, clock.now(), chat?.forLease?.(lease)??chat, calendar ? {command: input=>{
          const run=()=>calendar.command(input,{token:lease.token});
          return store.calendarResult?store.calendarResult(lease,run,clock):run();
        }} : undefined);
      if(['/start','/help','/settings','/memory','/today','/tasks'].includes(lease.input.text??'')&&!plan.changes.some(c=>c.type==='cancel'))
        plan.changes.push({type:'cancel',owner});
      await store.commit(lease, plan, clock.now());
    } catch {
      // The failed transaction leaves the whole command pending, not partially applied.
      await store.release(lease);
      break;
    }
  }
}
