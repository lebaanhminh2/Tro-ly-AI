import { readFile, writeFile } from 'node:fs/promises';
import * as prettier from 'prettier';

// Incremental format baseline: extend this list when another module is cleaned.
const paths = [
  '.github/workflows/ci.yml',
  '.prettierrc.json',
  '.vscode/settings.json',
  'docs/HABITS.md',
  'docs/OPERATIONS.md',
  'eslint.config.mjs',
  'package.json',
  'scripts/format.mjs',
  'src/adapters/d1/conversation-store.ts',
  'src/adapters/d1/day-plan-store.ts',
  'src/adapters/d1/habit-companion.ts',
  'src/adapters/d1/habit-store.ts',
  'src/adapters/d1/healthy-store.ts',
  'src/adapters/d1/memory.ts',
  'src/adapters/d1/progress-store.ts',
  'src/adapters/d1/recurrence-store.ts',
  'src/adapters/d1/task-hierarchy-store.ts',
  'src/adapters/d1/ui-store.ts',
  'src/adapters/d1/work-reader.ts',
  'src/adapters/d1/work-store.ts',
  'src/adapters/observability.ts',
  'src/application/context-builder.ts',
  'src/application/process-inbox.ts',
  'src/application/progress-renderer.ts',
  'src/domain/progress.ts',
  'src/entrypoints/mini-app.ts',
  'src/entrypoints/mini-app/bootstrap.ts',
  'src/entrypoints/mini-app/habits.ts',
  'src/entrypoints/mini-app/reminders.ts',
  'src/entrypoints/mini-app/schedule.ts',
  'src/entrypoints/mini-app/tasks.ts',
  'src/entrypoints/telegram-webhook.ts',
  'src/entrypoints/worker.ts',
  'src/ports/habit-store.ts',
  'src/ports/work-store.ts',
  'tests/browser/app-flows.test.mjs',
  'tests/integration/runtime-hardening.test.ts',
  'tests/integration/read-models.test.ts',
  'tests/unit/observability.test.ts',
  'tests/unit/web-modules.test.ts',
  'tests/unit/web-assets.test.ts',
  'tsconfig.web.json',
  'web/app.js',
  'web/core/http.js',
  'web/core/lifecycle.js',
  'web/core/live-data.js',
  'web/core/mutations.js',
  'web/features/habits.js',
  'web/features/reminders.js',
  'web/features/schedule.js',
  'web/features/tasks.js',
  'web/styles.css',
  'web/ui/feedback.js',
  'web/views/achievements.js',
  'web/views/habits.js',
  'web/views/reminders.js',
  'web/views/timeline.js',
];

const write = process.argv.includes('--write');
let failures = 0;
for (const path of paths) {
  const source = await readFile(path, 'utf8');
  const options = { ...(await prettier.resolveConfig(path)), filepath: path };
  if (write) await writeFile(path, await prettier.format(source, options));
  else if (!(await prettier.check(source, options))) {
    console.error(path);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log((write ? 'Formatted ' : 'Format checked ') + paths.length + ' files.');
