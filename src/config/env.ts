import type { Database } from '../adapters/d1/database.ts';
export type Env = { DB: Database; TELEGRAM_USER_ID: string; TELEGRAM_WEBHOOK_SECRET: string; AI_MODE?: string;
  GEMINI_API_KEY?: string; GEMINI_MODEL?: string; AI_DAILY_LIMIT?: string;
  AI_TRIAL_ENDS_AT?:string;
  TELEGRAM_BOT_TOKEN?: string; DELIVERY_MODE?: 'outbox' | 'preview';
};
export function configured(env: Env) {
  return /^\d+$/.test(env.TELEGRAM_USER_ID ?? '') && (env.TELEGRAM_WEBHOOK_SECRET?.length ?? 0) >= 24
    && !!env.DB && aiConfigured(env)
    && (env.DELIVERY_MODE === undefined || env.DELIVERY_MODE === 'preview' ||
      (env.DELIVERY_MODE === 'outbox' && /^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN ?? '')));
}
export function aiConfigured(env: Env): boolean {
  if (env.AI_MODE === undefined || env.AI_MODE === 'off') return true;
  return env.AI_MODE === 'on'
    && /^[A-Za-z0-9._-]{1,256}$/.test(env.GEMINI_API_KEY ?? '')
    && /^[A-Za-z0-9._-]{1,100}$/.test(env.GEMINI_MODEL ?? '')
    && (env.AI_DAILY_LIMIT===undefined || (/^[1-9]\d{0,2}$/.test(env.AI_DAILY_LIMIT) && Number(env.AI_DAILY_LIMIT)<=500));
}
