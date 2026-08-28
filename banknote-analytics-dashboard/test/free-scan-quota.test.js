import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SQL = fs.readFileSync(
  path.join(ROOT, 'sql/dashboard/product/coinzy/22_free_scan_success_quota.sql'),
  'utf8',
);

test('free-scan success quota hit is only free_scan_success_quota_exhausted', () => {
  assert.match(SQL, /free_scan_success_quota_exhausted/);
  assert.match(SQL, /HIT = success_remaining went from >0 → 0/);
  const hitCount = SQL.match(/ev = 'free_scan_success_quota_exhausted'/g) || [];
  assert.equal(hitCount.length, 2);
});

test('consumed / fail / reset are present but Identified and Collection limits are not used', () => {
  assert.match(SQL, /free_scan_success_consumed/);
  assert.match(SQL, /free_scan_blocked/);
  assert.match(SQL, /free_scan_limit_exceeded/);
  assert.match(SQL, /free_scan_go_premium_tapped/);
  assert.match(SQL, /free_scan_not_now_tapped/);
  assert.match(SQL, /free_scan_fail_quota_exhausted/);
  assert.match(SQL, /free_scan_quota_reset/);
  assert.match(SQL, /Identified_limit_reached[\s\S]*do not use/);
  assert.equal(SQL.includes("'Identified_limit_reached'"), false);
  assert.equal(SQL.includes("'Collection_limit_Reached'"), false);
  assert.doesNotMatch(
    SQL,
    /COUNT(?:IF|DISTINCT)[\s\S]{0,80}free_scan_success_consumed[\s\S]{0,40}AS hit_/,
  );
});
