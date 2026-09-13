import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Config intentionally uses the JSON subset of JSONC; no runtime dependency needed.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const staging = config.env.staging;
const localId = '00000000-0000-0000-0000-000000000000';
const placeholderId = '11111111-1111-1111-1111-111111111111';

test('staging has a distinct worker and database, outbox and minute scheduler', () => {
  assert.equal(config.assets.directory,'./web');
  assert.equal(config.assets.binding,'ASSETS');
  assert.equal(config.assets.run_worker_first,true);
  assert.equal(config.workers_dev, false);
  assert.equal(config.d1_databases[0].database_id, localId);
  assert.notEqual(staging.name, config.name);
  assert.equal(staging.name, 'personal-assistant-staging');
  assert.equal(staging.workers_dev, true);
  assert.equal(staging.preview_urls, false);
  assert.equal(staging.d1_databases.length, 1);
  const db = staging.d1_databases[0];
  assert.equal(db.binding, 'DB');
  assert.equal(db.database_name, 'assistant-staging');
  assert.notEqual(db.database_name, config.d1_databases[0].database_name);
  assert.notEqual(db.database_id, localId);
  assert.match(db.database_id, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  assert.equal(db.migrations_dir, 'migrations');
  assert.deepEqual(staging.triggers.crons, ['* * * * *']);
  assert.equal(staging.vars.DELIVERY_MODE, 'outbox');
});

test('production conversation has no local pilot cutoff without Google integration and secrets stay private', () => {
  assert.equal(config.vars.AI_MODE,'off');
  assert.equal(staging.vars.AI_MODE,'on'); // User approved the time-bounded native pilot.
  assert.equal(staging.vars.GEMINI_MODEL,'gemini-3.5-flash-lite');
  assert.equal(staging.vars.AI_DAILY_LIMIT,undefined);
  assert.equal(staging.vars.AI_TRIAL_ENDS_AT,undefined);
  for (const vars of [config.vars, staging.vars]) {
    for (const flag of ['CALENDAR_MODE', 'CALENDAR_WRITES']) assert.equal(vars[flag], undefined);
    assert.ok(!Object.keys(vars).some(key => /TOKEN|SECRET|KEY|TELEGRAM_USER_ID/.test(key)));
  }
  assert.ok(!staging.routes?.length);
  assert.ok(!staging.services?.length);
});

test('remote scripts select staging explicitly and run readiness guard first', () => {
  const guard = 'node tests/unit/staging-config.test.ts --require-ready && ';
  assert.equal(scripts['deploy:staging'], guard + 'wrangler deploy --env staging');
  assert.equal(scripts['db:staging'], guard + 'wrangler d1 migrations apply DB --env staging --remote');
  assert.equal(scripts['staging:check'], 'node --test tests/unit/staging-config.test.ts && wrangler deploy --env staging --dry-run');
});

// The same local checks gate remote npm commands. This is not account verification
// or approval: a real UUID still needs to be checked against the intended account.
if (process.argv.includes('--require-ready')) {
  test('remote operation requires replacing the staging database placeholder', () => {
    assert.notEqual(staging.d1_databases[0].database_id, placeholderId,
      'Staging chưa có database thật. Làm theo docs/STAGING_SETUP.md; không deploy placeholder.');
  });
}
