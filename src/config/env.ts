import type { Database } from '../adapters/d1/database.ts';
export type Env = { DB: Database; TELEGRAM_USER_ID: string; TELEGRAM_WEBHOOK_SECRET: string; AI_MODE?: string;
  TELEGRAM_BOT_TOKEN?: string; DELIVERY_MODE?: 'outbox' | 'preview';
  CALENDAR_MODE?: 'off'|'enabled'; CALENDAR_WRITES?: 'off'|'enabled';
  GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; GOOGLE_TOKEN_KEY?: string; PUBLIC_ORIGIN?: string };
export function configured(env: Env) {
  return /^\d+$/.test(env.TELEGRAM_USER_ID ?? '') && (env.TELEGRAM_WEBHOOK_SECRET?.length ?? 0) >= 24
    && !!env.DB && (env.AI_MODE === undefined || env.AI_MODE === 'off') && calendarConfigured(env)
    && (env.DELIVERY_MODE === undefined || env.DELIVERY_MODE === 'preview' ||
      (env.DELIVERY_MODE === 'outbox' && /^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN ?? '')));
}
export function calendarConfigured(env:Env){
  if(env.CALENDAR_MODE===undefined||env.CALENDAR_MODE==='off')return true;
  if(env.CALENDAR_MODE!=='enabled'||!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!/^[a-f0-9]{64}$/.test(env.GOOGLE_TOKEN_KEY??''))return false;
  try{const u=new URL(env.PUBLIC_ORIGIN??'');return u.protocol==='https:'&&u.origin===env.PUBLIC_ORIGIN&&!u.username&&!u.password;}catch{return false;}
}
