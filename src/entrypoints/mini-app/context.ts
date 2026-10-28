import type { HealthyStore } from '../../adapters/d1/healthy-store.ts';
import type { Env } from '../../config/env.ts';
export type MiniAppContext = {
    env: Env;
    owner: string;
    now: number;
    healthy: HealthyStore;
};
export type MiniAppInput = Record<string, unknown> & {
    id: string;
};
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
export async function readInput(request: Request, maxBytes = 4096): Promise<MiniAppInput | Response> {
    // Read a bounded body, including chunked requests.
    const reader = request.body?.getReader();
    if (!reader)
        return json({ error: 'INVALID_REQUEST' }, 400);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let raw = '', bytes = 0;
    while (true) {
        const part = await reader.read();
        if (part.done)
            break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) {
            await reader.cancel();
            return json({ error: 'TOO_LARGE' }, 413);
        }
        raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    const input = JSON.parse(raw) as MiniAppInput;
    if (!input || Array.isArray(input) || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.id))
        return json({ error: 'INVALID_REQUEST' }, 400);
    return input;
}
