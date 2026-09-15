import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync('src/entrypoints/worker.ts','utf8');
const chat=readFileSync('src/entrypoints/worker-chat.ts','utf8');
const scheduler=readFileSync('src/entrypoints/worker-scheduler.ts','utf8');
const webhook=readFileSync('src/entrypoints/telegram-webhook.ts','utf8');

test('worker entrypoint delegates chat, scheduler and webhook responsibilities',()=>{
 assert.match(worker,/createRuntimeChat/);
 assert.match(worker,/runScheduled/);
 assert.match(worker,/handleTelegramWebhook/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/ai\/gemini\.ts/);
 assert.doesNotMatch(worker,/from ['"]\.\.\/adapters\/d1\/work-store\.ts/);
 assert.doesNotMatch(worker,/receiveNudgeReply/);
});

test('entrypoint modules expose explicit bounded responsibilities',()=>{
 assert.match(chat,/export function createRuntimeChat/);
 assert.match(chat,/new Gemini/);
 assert.match(scheduler,/export async function runScheduled/);
 assert.match(scheduler,/queueWorkNudge/);
 assert.match(webhook,/export async function handleTelegramWebhook/);
 assert.match(webhook,/processInbox/);
 assert.match(webhook,/receiveNudgeReply/);
});
