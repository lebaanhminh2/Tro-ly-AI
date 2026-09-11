import type { Clock, WorkStore } from '../ports/work-store.ts';
import { planCommand } from './plan-command.ts';
import type { ChatService } from './plan-command.ts';

export async function processInbox(store: WorkStore, owner: string, clock: Clock, chat?: ChatService, limit = 4) {
  for (let i = 0; i < limit; i++) {
    const lease = await store.claim(owner, clock.now());
    if (!lease) break;
    try {
      const plan = lease.attempts > 3
        ? { view: { text: 'Lệnh này chưa thực hiện được sau nhiều lần thử. Không có thay đổi từ lệnh này được lưu; cậu có thể gửi lại yêu cầu.', buttons: [] }, changes: [] }
        : await planCommand(lease.input, store, clock.now(), chat);
      await store.commit(lease, plan, clock.now());
    } catch {
      // The failed transaction leaves the whole command pending, not partially applied.
      await store.release(lease);
      break;
    }
  }
}
