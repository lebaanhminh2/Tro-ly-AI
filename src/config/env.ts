import type { Database } from '../adapters/d1/database.ts';
export type Env = { DB: Database; TELEGRAM_USER_ID: string; TELEGRAM_WEBHOOK_SECRET: string; AI_MODE?: string;
  TELEGRAM_BOT_TOKEN?: string; DELIVERY_MODE?: 'outbox' | 'preview' };
export function configured(env: Env) {
  return /^\d+$/.test(env.TELEGRAM_USER_ID ?? '') && (env.TELEGRAM_WEBHOOK_SECRET?.length ?? 0) >= 24
    && !!env.DB && (env.AI_MODE === undefined || env.AI_MODE === 'off')
    && (env.DELIVERY_MODE === undefined || env.DELIVERY_MODE === 'preview' ||
      (env.DELIVERY_MODE === 'outbox' && /^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN ?? '')));
}
