import { D1FirstStepStore } from '../../adapters/d1/first-step-store.ts';
import { FirstStepService } from '../../application/first-step-service.ts';
import { json, type MiniAppContext, type MiniAppInput } from './context.ts';

export async function readFirstStep({ env, owner, now }: MiniAppContext, url: URL) {
  const occurrenceId = url.searchParams.get('occurrenceId') ?? undefined;
  return json(await new D1FirstStepStore(env.DB).read(owner, now, occurrenceId));
}

export async function handleFirstStep({ env, owner, now }: MiniAppContext, input: MiniAppInput) {
  const { id, ...command } = input;
  return json(
    await new FirstStepService(new D1FirstStepStore(env.DB)).execute(owner, id, command, now),
  );
}
