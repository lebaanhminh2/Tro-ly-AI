import { JournalStore } from '../../adapters/d1/journal-store.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readJournals({ env, owner, now }: MiniAppContext, url: URL) {
  return json(
    await new JournalStore(env.DB).read(
      owner,
      now,
      url.searchParams.has('day') ? Number(url.searchParams.get('day')) : undefined,
      url.searchParams.has('before') ? Number(url.searchParams.get('before')) : undefined,
    ),
  );
}
export async function handleJournals({ env, owner, now }: MiniAppContext, input: MiniAppInput) {
  const { id, ...command } = input;
  return json(await new JournalStore(env.DB).write(owner, id, command, now));
}
