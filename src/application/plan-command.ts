import { deadlineValue } from '../domain/time.ts';
import { confirmationAvailable } from '../domain/work.ts';
import type { Input, Plan, Proposal, Button } from '../domain/work.ts';
import type { WorkReader } from '../ports/work-store.ts';
import { sessionCommand } from './session-command.ts';
export type ChatService = (owner: string, text: string, tasks: Awaited<ReturnType<WorkReader['tasks']>>) => Promise<string>;

export async function planCommand(input: Input, store: WorkReader, now: number, chat?: ChatService): Promise<Plan> {
  const sessionPlan=await sessionCommand(input,store,now);
  if(sessionPlan)return sessionPlan;
  const { owner, text = '', callback, updateId } = input;
  const view = (text: string, buttons: Button[][] = []): Plan => ({ view: { text, buttons }, changes: [] });
  const proposalCard = (proposal: Proposal, description: string): Plan => ({
    view: { text: description, buttons: [[{ text: 'Xác nhận', callback_data: `yes:${proposal.id}` }, { text: 'Thôi', callback_data: `no:${proposal.id}` }]] },
    changes: [{ type: 'propose', proposal }]
  });
  const newProposal = (value: string, taskId: string | null, version: number): Proposal => ({
    id: `p${owner}_${updateId}`, owner, task_id: taskId ?? `t${owner}_${updateId}`,
    operation: taskId ? 'deadline' : 'capture', value, expected_version: version, expires: now + 300000, status: 'pending'
  });
  if (callback?.startsWith('yes:') || callback?.startsWith('no:')) {
    const accept = callback.startsWith('yes:');
    const proposal = await store.proposal(owner, callback.slice(callback.indexOf(':') + 1));
    const task = proposal ? await store.task(owner, proposal.task_id) : null;
    if (!proposal || !confirmationAvailable(proposal, task, now, accept))
      return view('Lựa chọn đã xử lý, hết hạn hoặc đã cũ. Dùng /tasks để xem bản mới nhé.');
    return { ...view(accept ? 'Đã lưu thay đổi.' : 'Ừ, không đổi nhé.'), changes: [{ type: 'resolve', proposal, accept }] };
  }
  if (callback?.startsWith('deadline:')) {
    const task = await store.task(owner, callback.slice(9));
    if (!task) return view('Không tìm thấy việc này.');
    return { ...view(`Đổi hạn “${task.title}”: nhập DD/MM/YYYY HH:mm theo giờ Việt Nam. /cancel để hủy.`),
      changes: [{ type: 'select', selection: { owner, task_id: task.id, version: task.version, expires: now + 300000 } }] };
  }
  if (text === '/cancel') return { ...view('Đã hủy nhập ngày giờ.'), changes: [{ type: 'cancel', owner }] };
  if (text === '/start' || text === '/help') return view('Ghi việc: /add tên việc. Xem/sửa/lên buổi: /tasks. Hôm nay: /today. Nhắc và giờ nghỉ: /settings. Hủy nhập: /cancel. Hội thoại AI chưa bật.');
  if (text === '/tasks' || callback?.startsWith('page:')) {
    const rawOffset = callback?.slice(5) ?? '0';
    if (!/^\d{1,7}$/.test(rawOffset)) return view('Trang không hợp lệ.');
    const offset = Number(rawOffset), tasks = await store.tasks(owner, offset);
    const buttons = tasks.map(t => [{ text: `Đổi hạn: ${t.title.slice(0, 25)}`, callback_data: `deadline:${t.id}` },{text:'Lên buổi',callback_data:`schedule:${t.id}`}]);
    if (offset > 0) buttons.push([{ text: 'Trang trước', callback_data: `page:${Math.max(0, offset - 10)}` }]);
    if (tasks.length === 10) buttons.push([{ text: 'Trang tiếp', callback_data: `page:${offset + 10}` }]);
    return view(tasks.length ? tasks.map(t => `${t.title} — ${t.deadline ?? 'chưa có hạn'}`).join('\n') : 'Chưa có việc ở trang này.', buttons);
  }
  if (callback) return view('Nút không còn hợp lệ.');
  if (text.startsWith('/add ')) {
    const title = text.slice(5).trim();
    if (!title || title.length > 160) return view('Tên việc cần từ 1 đến 160 ký tự.');
    const result = proposalCard(newProposal(title, null, 0), `Ghi việc “${title}” nhé?`);
    result.changes.push({ type: 'cancel', owner }); // New command exits old input mode.
    return result;
  }
  const selection = await store.selection(owner);
  if (selection && selection.expires > now) {
    const value = deadlineValue(text);
    if (!value || Date.parse(value) <= now) return view('Cần ngày giờ tương lai dạng DD/MM/YYYY HH:mm. /cancel để hủy hoặc chuyển sang việc khác.');
    const task = await store.task(owner, selection.task_id);
    if (!task || task.version !== selection.version) return { ...view('Việc đã thay đổi. Mở /tasks và chọn lại nhé.'), changes: [{ type: 'cancel', owner }] };
    const result = proposalCard(newProposal(value, task.id, task.version), `Hạn “${task.title}”: ${task.deadline ?? 'chưa biết'} → ${value}. Đổi nhé?`);
    result.changes.push({ type: 'cancel', owner });
    return result;
  }
  if (chat) {
    try { return view(await chat(owner, text, await store.tasks(owner, 0))); }
    catch { return view('Hội thoại đang gián đoạn. /add và /tasks vẫn dùng được nhé.'); }
  }
  return view('Hội thoại AI chưa bật. Cậu dùng /add tên việc hoặc /tasks nhé.');
}
