import test from 'node:test';
import assert from 'node:assert/strict';
import { listEventCatalog } from '../server/services/analytics/event-catalog.js';

test('event catalog lists mapped events for both apps', () => {
  const { unique, usages, summary } = listEventCatalog();
  assert.ok(summary.banknote > 20);
  assert.ok(summary.coinzy > 20);
  assert.ok(summary.shared > 5);
  assert.equal(summary.totalUsages, usages.length);
  assert.ok(unique.length >= summary.banknote + summary.coinzy - summary.shared);
});

test('Banknote catalog uses live Identify / onboarding names', () => {
  const { unique } = listEventCatalog();
  const events = new Set(unique.filter((r) => r.product === 'banknote').map((r) => r.event));
  assert.ok(events.has('identification_all_opts_screen'));
  assert.ok(events.has('onboarding_started'));
  assert.ok(events.has('subscription_shown'));
  assert.ok(events.has('banknote_details_identification'));
  assert.equal(events.has('Subs_page_onboarding'), false);
  assert.equal(events.has('Identification_attempted'), false);
});

test('Coinzy catalog includes onboarding value-flow and Identify camera', () => {
  const { unique } = listEventCatalog();
  const events = new Set(unique.filter((r) => r.product === 'coinzy').map((r) => r.event));
  assert.ok(events.has('Onboarding_logo_animation'));
  assert.ok(events.has('Onboarding_complete'));
  assert.ok(events.has('Photo_clicked'));
  assert.ok(events.has('expert_evaluation_landing'));
  assert.ok(events.has('Subs_page_onboarding'));
});

test('unique rows join surfaces for downloadable sheet', () => {
  const { unique } = listEventCatalog();
  const session = unique.find((r) => r.product === 'banknote' && r.event === 'session_start');
  assert.ok(session);
  assert.ok(session.used_in.includes('DAU'));
  assert.ok(session.roles.includes('kpi'));
});
