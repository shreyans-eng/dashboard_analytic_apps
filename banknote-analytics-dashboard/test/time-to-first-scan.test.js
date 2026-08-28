import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SAME_DAY_SQL = [
  'sql/dashboard/raw/02_time_to_first_scan.sql',
  'sql/dashboard/product/02_time_to_first_scan.sql',
  'sql/dashboard/product/banknote/02_time_to_first_scan.sql',
  'sql/dashboard/product/coinzy/02_time_to_first_scan.sql',
];

function stripEventSuffix(name) {
  return String(name || '').replace(/_(android|ios)$/, '');
}

/**
 * Same-day first ID: distinct devices with first_open that day, of which
 * those that also fired identification_done_success that day.
 * Join key is user_pseudo_id only — user_id is ignored.
 */
export function sameDayFirstId(events) {
  const installs = new Set();
  const success = new Set();
  for (const e of events) {
    const device = String(e.user_pseudo_id || '').trim();
    if (!device) continue;
    const day = e.event_date;
    const name = stripEventSuffix(e.event_name);
    const key = `${day}|${device}`;
    if (name === 'first_open' || name.startsWith('first_open')) installs.add(key);
    if (name === 'identification_done_success' || name === 'Identification_done_success') {
      success.add(key);
    }
  }
  const byDay = {};
  for (const key of installs) {
    const day = key.slice(0, key.indexOf('|'));
    byDay[day] ||= { installs: 0, sameDay: 0 };
    byDay[day].installs += 1;
    if (success.has(key)) byDay[day].sameDay += 1;
  }
  return byDay;
}

for (const rel of SAME_DAY_SQL) {
  test(`${rel} joins on user_pseudo_id, not COALESCE(user_id, …)`, () => {
    const sql = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    assert.match(sql, /user_pseudo_id AS device_id/);
    assert.match(sql, /ON i\.device_id = s\.device_id/);
    assert.match(sql, /i\.cohort_date = s\.success_date/);
    assert.match(sql, /identification_done_success/);
    assert.doesNotMatch(sql, /COALESCE\(\s*user_id/);
    assert.doesNotMatch(sql, /event_params\.user_id/);
  });
}

test('v_time_to_first_scan joins on user_pseudo_id, not resolved_user_id', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'sql/14_v_time_to_first_scan.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(sql, /user_pseudo_id AS device_id/);
  assert.match(sql, /i\.device_id = s\.device_id/);
  assert.match(sql, /i\.cohort_date = s\.success_date/);
  assert.doesNotMatch(sql, /n\.resolved_user_id = f\.resolved_user_id/);
});

test('empty-string user_id does not collapse two devices into one install', () => {
  const out = sameDayFirstId([
    { event_date: '2026-08-01', event_name: 'first_open', user_id: '', user_pseudo_id: 'd1' },
    { event_date: '2026-08-01', event_name: 'identification_done_success', user_id: '', user_pseudo_id: 'd1' },
    { event_date: '2026-08-01', event_name: 'first_open', user_id: '', user_pseudo_id: 'd2' },
  ]);
  assert.equal(out['2026-08-01'].installs, 2);
  assert.equal(out['2026-08-01'].sameDay, 1);
});

test('login after first_open still matches on the same device', () => {
  const out = sameDayFirstId([
    { event_date: '2026-08-01', event_name: 'first_open', user_id: null, user_pseudo_id: 'd1' },
    {
      event_date: '2026-08-01',
      event_name: 'identification_done_success',
      user_id: 'logged-in-user',
      user_pseudo_id: 'd1',
    },
  ]);
  assert.equal(out['2026-08-01'].installs, 1);
  assert.equal(out['2026-08-01'].sameDay, 1);
});

test('success on a later calendar day is not same-day ID', () => {
  const out = sameDayFirstId([
    { event_date: '2026-08-01', event_name: 'first_open', user_pseudo_id: 'd1' },
    { event_date: '2026-08-02', event_name: 'identification_done_success', user_pseudo_id: 'd1' },
  ]);
  assert.equal(out['2026-08-01'].installs, 1);
  assert.equal(out['2026-08-01'].sameDay, 0);
  assert.equal(out['2026-08-02'], undefined);
});

test('a device is counted once per install day even with duplicate first_open', () => {
  const out = sameDayFirstId([
    { event_date: '2026-08-01', event_name: 'first_open', user_pseudo_id: 'd1' },
    { event_date: '2026-08-01', event_name: 'first_open_android', user_pseudo_id: 'd1' },
    { event_date: '2026-08-01', event_name: 'identification_done_success', user_pseudo_id: 'd1' },
    { event_date: '2026-08-01', event_name: 'identification_done_success', user_pseudo_id: 'd1' },
  ]);
  assert.equal(out['2026-08-01'].installs, 1);
  assert.equal(out['2026-08-01'].sameDay, 1);
});
