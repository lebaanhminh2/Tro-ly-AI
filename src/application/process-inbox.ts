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
        ? { view: { text: 'Lệnh này chưa thực hiện được sau nhiều lần thử. Không có thay đổi từ lệnh này được lưu; cậu có thể gửi lại yêu cầu.', buttons: [] }, changes: [] }
        : await planCommand(lease.input, store, clock.now(), chat, calendar ? {command: input=>calendar.command(input,{token:lease.token})} : undefined);
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
