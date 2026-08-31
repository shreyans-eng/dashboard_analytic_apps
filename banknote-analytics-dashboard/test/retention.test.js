import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSql(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const RAW_RETENTION = [
  'sql/dashboard/raw/05_d1_retention.sql',
  'sql/dashboard/raw/06_d7_retention.sql',
  'sql/dashboard/raw/09_retention.sql',
];

test('raw D1/D4/D7 retention counts only app-open DAU events, not any event', () => {
  for (const rel of RAW_RETENTION) {
    const sql = readSql(rel);
    assert.match(sql, /\{\{dau_event_predicate\}\}/);
    assert.match(sql, /\{\{resolved_user_id_cheap\}\}/);
    assert.match(sql, /first_open/);
  }
});

test('scheduled daily_retention cohort is first_open and activity is DAU events', () => {
  const sql = readSql('sql/scheduled/daily_retention.sql');
  assert.match(sql, /IN \('session_start', 'App_open', 'first_open'\)/);
  assert.match(sql, /WHERE event_name_base = 'first_open'/);
  assert.doesNotMatch(sql, /first_seen/);
});

test('v_retention_cohorts activity is app-open events, not any-event DAU grain', () => {
  const sql = readSql('sql/06_v_retention_cohorts.sql');
  assert.match(sql, /event_name_base IN \('session_start', 'App_open', 'first_open'\)/);
  assert.doesNotMatch(sql, /v_daily_active_users/);
});
