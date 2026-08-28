import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipRowsToCompleteExport,
  computeDailyDau,
  hasDimensionFilter,
  isDauEvent,
  isNotificationEvent,
  isPlaceholderUserId,
  requestedRangeHasIncompleteDates,
  resolveUserId,
  shouldUseSummaryForDau,
  applyDauSqlPlaceholders,
} from '../server/services/analytics/dau-definition.js';

test('notification_display is not a DAU event', () => {
  assert.equal(isDauEvent('notification_display'), false);
  assert.equal(isDauEvent('notification_receive'), false);
  assert.equal(isDauEvent('firebase_campaign'), false);
  assert.equal(isDauEvent('os_update'), false);
});

test('notification events are tracked separately from app-open DAU', () => {
  assert.equal(isNotificationEvent('notification_display'), true);
  assert.equal(isNotificationEvent('notification_display_android'), true);
  assert.equal(isNotificationEvent('notification_interact'), true);
  assert.equal(isNotificationEvent('notification_receive'), true);
  assert.equal(isNotificationEvent('session_start'), false);
  assert.equal(isNotificationEvent('App_open'), false);
  assert.equal(isNotificationEvent('Notification_permission_granted'), false);
  assert.equal(isNotificationEvent('onboarding_notification_permission'), false);
});

test('session_start is DAU', () => {
  assert.equal(isDauEvent('session_start'), true);
});

test('App_open_android is DAU (suffix-stripped to App_open)', () => {
  assert.equal(isDauEvent('App_open_android'), true);
  assert.equal(isDauEvent('App_open_ios'), true);
  assert.equal(isDauEvent('App_open'), true);
  assert.equal(isDauEvent('first_open'), true);
  assert.equal(isDauEvent('first_open_android'), true);
});

test('"anonymous" is not a shared user identity', () => {
  assert.equal(isPlaceholderUserId('anonymous'), true);
  assert.equal(isPlaceholderUserId('Anonymous'), true);
  assert.equal(isPlaceholderUserId(''), true);
  assert.equal(isPlaceholderUserId(null), true);
  assert.equal(
    resolveUserId({
      user_id: null,
      param_user_id: 'anonymous',
      user_pseudo_id: 'device-1',
    }),
    'device-1',
  );
  assert.equal(
    resolveUserId({
      user_id: 'anonymous',
      param_user_id: 'anonymous',
      user_pseudo_id: 'device-2',
    }),
    'device-2',
  );
  assert.equal(
    resolveUserId({
      user_id: 'real-user-9',
      param_user_id: 'anonymous',
      user_pseudo_id: 'device-3',
    }),
    'real-user-9',
  );
});

test('notification-only user is not DAU; session_start user is', () => {
  const rows = computeDailyDau([
    {
      event_date: '2026-08-25',
      event_name: 'notification_display',
      user_pseudo_id: 'n1',
    },
    {
      event_date: '2026-08-25',
      event_name: 'session_start',
      user_pseudo_id: 's1',
    },
  ]);
  assert.deepEqual(rows, [{ event_date: '2026-08-25', dau: 1 }]);
});

test('App_open_android counts as DAU', () => {
  const rows = computeDailyDau([
    {
      event_date: '2026-08-25',
      event_name: 'App_open_android',
      user_pseudo_id: 'a1',
    },
  ]);
  assert.equal(rows[0].dau, 1);
});

test('multiple opens by the same user on the same day count once', () => {
  const rows = computeDailyDau([
    { event_date: '2026-08-25', event_name: 'session_start', user_pseudo_id: 'u1' },
    { event_date: '2026-08-25', event_name: 'App_open_android', user_pseudo_id: 'u1' },
    { event_date: '2026-08-25', event_name: 'session_start', user_pseudo_id: 'u1' },
  ]);
  assert.equal(rows[0].dau, 1);
});

test('anonymous param does not collapse two devices into one user', () => {
  const rows = computeDailyDau([
    {
      event_date: '2026-08-25',
      event_name: 'session_start',
      param_user_id: 'anonymous',
      user_pseudo_id: 'device-a',
    },
    {
      event_date: '2026-08-25',
      event_name: 'session_start',
      param_user_id: 'anonymous',
      user_pseudo_id: 'device-b',
    },
  ]);
  assert.equal(rows[0].dau, 2);
});

test('country and platform filters change the result', () => {
  const events = [
    {
      event_date: '2026-08-25',
      event_name: 'session_start',
      user_pseudo_id: 'us',
      country: 'United States',
      platform: 'android',
    },
    {
      event_date: '2026-08-25',
      event_name: 'session_start',
      user_pseudo_id: 'in',
      country: 'India',
      platform: 'ios',
    },
  ];
  assert.equal(computeDailyDau(events).length && computeDailyDau(events)[0].dau, 2);
  assert.equal(computeDailyDau(events, { country: 'India' })[0].dau, 1);
  assert.equal(computeDailyDau(events, { platform: 'android' })[0].dau, 1);
  assert.equal(hasDimensionFilter({ country: 'India' }), true);
  assert.equal(shouldUseSummaryForDau({ country: 'India' }), false);
  assert.equal(shouldUseSummaryForDau({}), true);
});

test('missing Firebase export days are not filled with zero DAU', () => {
  const clipped = clipRowsToCompleteExport(
    [
      { event_date: '2026-08-25', dau: 145 },
      { event_date: '2026-08-26', dau: 0 },
      { event_date: '2026-08-27', dau: 0 },
    ],
    'event_date',
    '2026-08-25',
  );
  assert.deepEqual(clipped, [{ event_date: '2026-08-25', dau: 145 }]);
  assert.equal(requestedRangeHasIncompleteDates('2026-08-27', '2026-08-25'), true);
  assert.equal(requestedRangeHasIncompleteDates('2026-08-25', '2026-08-25'), false);
});

test('SQL placeholders expand to usage events, notification events, and skip anonymous', () => {
  const sql = applyDauSqlPlaceholders(
    'SELECT {{resolved_user_id}} WHERE {{dau_event_predicate}} OR {{notification_event_predicate}} GROUP BY event_date',
  );
  assert.match(sql, /session_start/);
  assert.match(sql, /App_open/);
  assert.match(sql, /first_open/);
  assert.match(sql, /notification_display/);
  assert.match(sql, /notification_interact/);
  assert.match(sql, /anonymous/);
  assert.match(sql, /android\|ios/);
  assert.match(sql, /GROUP BY event_date/);
  assert.doesNotMatch(sql, /\{\{/);
});
