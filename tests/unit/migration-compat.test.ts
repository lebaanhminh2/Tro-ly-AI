import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

test('all migrations apply in order without semicolons in SQL comments', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(`migrations/${file}`, 'utf8');
      for (const comment of sql.match(/\/\*[\s\S]*?\*\/|--[^\n]*/g) ?? []) {
        assert.ok(!comment.includes(';'), `${file}: D1 may split comments at semicolons`);
      }
      db.exec(sql);
    }
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='command_inbox'").get());
  } finally { db.close(); }
});

test('initial migration keeps CASE parenthesized for D1 and preserves trigger guards', () => {
  const sql = readFileSync('migrations/0001_initial.sql', 'utf8');
  assert.match(sql, /SELECT \(CASE WHEN NEW.operation/);
  assert.match(sql, /RAISE\(ABORT,'STALE_PROPOSAL'\) END\)/);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(sql);
    const proposal = db.prepare(`INSERT INTO proposals
      (id,owner,task_id,operation,value,expected_version,expires) VALUES(?,?,?,?,?,?,?)`);
    proposal.run('capture', '123', 'task', 'capture', 'Bài vẽ', 0, 99999);
    db.exec("UPDATE proposals SET status='accepted' WHERE id='capture'");
    assert.equal(db.prepare("SELECT title FROM tasks WHERE id='task'").get()!.title, 'Bài vẽ');
    proposal.run('deadline', '123', 'task', 'deadline', '2026-10-01', 1, 99999);
    db.exec("UPDATE proposals SET status='accepted' WHERE id='deadline'");
    assert.equal(db.prepare("SELECT version FROM tasks WHERE id='task'").get()!.version, 2);
    for (const [id, owner, version] of [['stale', '123', 1], ['foreign', '999', 2]] as const) {
      proposal.run(id, owner, 'task', 'deadline', '2026-11-01', version, 99999);
      assert.throws(() => db.prepare("UPDATE proposals SET status='accepted' WHERE id=?").run(id), /STALE_PROPOSAL/);
      assert.equal(db.prepare('SELECT status FROM proposals WHERE id=?').get(id)!.status, 'pending');
    }
    assert.equal(db.prepare("SELECT deadline FROM tasks WHERE id='task'").get()!.deadline, '2026-10-01');
  } finally { db.close(); }
});
