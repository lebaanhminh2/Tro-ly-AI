import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('domain and application do not depend on infrastructure, experiments or environment', () => {
  for (const folder of ['src/domain', 'src/ports', 'src/application']) {
    for (const file of readdirSync(folder)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(folder,file),'utf8');
      assert.doesNotMatch(source, /from\s+['"][^'"]*(?:adapters|experiments|tests|config)\//, file);
      assert.doesNotMatch(source, /process\.env|\bfetch\(|node:fs/, file);
    }
  }
});

test('production AI has one native protocol and no natural-language regex authorization gate',()=>{
 const worker=readFileSync('src/entrypoints/worker.ts','utf8');
 assert.doesNotMatch(worker,/contextualChat|trialChat|conversationChat|generateConversation|AI_MODE\s*[!=]==?\s*['"](?:enabled|conversation)['"]/);
 for(const file of ['src/ai/gemini.ts','src/ai/contracts.ts','src/ai/policy.ts','src/domain/conversation.ts','src/application/conversation-command.ts']){
  const source=readFileSync(file,'utf8');assert.doesNotMatch(source,/directRequest|selectedScope|parseConversation|parseReply|from ['"][^'"]*experiments/);
 }
});
