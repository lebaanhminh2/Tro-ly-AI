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
