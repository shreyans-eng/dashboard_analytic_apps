import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readSql(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('D0/D1 percentiles SQL has P10–P99 including P90 for time, scans, and retain', () => {
  const sql = readSql('sql/dashboard/raw/23_install_d0_d1_percentiles.sql');
  assert.match(sql, /first_open/);
  assert.match(sql, /d0_went_in_rate/);
  assert.match(sql, /d1_retention_rate/);
  for (const p of [10, 25, 50, 75, 90, 95, 99]) {
    assert.match(sql, new RegExp(`AS d0_time_p${p}\\b`));
    assert.match(sql, new RegExp(`AS d1_time_p${p}\\b`));
    assert.match(sql, new RegExp(`AS d0_scans_p${p}\\b`));
    assert.match(sql, new RegExp(`AS d1_scans_p${p}\\b`));
  }
  assert.match(sql, /identification_done_success/);
  assert.match(sql, /user_pseudo_id/);
});

test('scans per user SQL includes P90', () => {
  for (const rel of [
    'sql/dashboard/product/07_scans_per_user.sql',
    'sql/dashboard/product/coinzy/07_scans_per_user.sql',
  ]) {
    const sql = readSql(rel);
    assert.match(sql, /AS scans_p90\b/);
  }
});

test('install-day usage SQL includes time P10–P99', () => {
  const sql = readSql('sql/dashboard/raw/20_install_day_usage.sql');
  for (const p of [10, 25, 50, 75, 90, 95, 99]) {
    assert.match(sql, new RegExp(`AS time_p${p}\\b`));
  }
});
