import type { GeminiTrial } from './gemini.ts';
import type { StoredTask } from '../tasks.ts';
import { decide } from './policy.ts';

export type Chat = (owner: string, text: string, tasks: StoredTask[]) => Promise<string>;
// Dependency injected for offline tests. No key discovery, no default network client.
// Not enabled in production entrypoint until live/data approval and persistent quota exist.
export function trialChat(client: Pick<GeminiTrial, 'generate'>): Chat {
  return async (owner, text, tasks) => {
    const turns = [{ role: 'user' as const, text }];
    const result = await client.generate(turns, JSON.stringify({ userId: owner, tasks }), tasks.map(t => t.id));
    const decision = decide(result.output, turns, { userId: owner,
      entities: tasks.map(t => ({ id: t.id, ownerId: t.owner, type: 'task' as const })) });
    if (decision.pending) return 'Để ghi hoặc sửa việc, cậu dùng /add hoặc /tasks nhé. Chưa có thay đổi nào được lưu từ câu chat này.';
    return decision.text;
  };
}
