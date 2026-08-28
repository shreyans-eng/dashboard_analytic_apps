import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNNELS, getFunnelSteps, COINZY_EXPERT_EVENTS, buildFunnelSql } from '../server/services/analytics/funnel-registry.js';

test('identify funnels exist for bottom nav, home/banner, and combined', () => {
  assert.ok(FUNNELS.identify);
  assert.ok(FUNNELS['identify-nav']);
  assert.ok(FUNNELS['identify-home']);
});

test('nav funnel entry is Identify_bottom_nav only', () => {
  const { steps, status } = getFunnelSteps('identify-nav', 'banknote');
  assert.equal(status, 'ok');
  const entry = steps.find((s) => s.id === 'entry');
  assert.deepEqual(entry.events, ['Identify_bottom_nav']);
});

test('home/banner funnel entry is Identify_home only', () => {
  const { steps, status } = getFunnelSteps('identify-home', 'coinzy');
  assert.equal(status, 'ok');
  const entry = steps.find((s) => s.id === 'entry');
  assert.deepEqual(entry.events, ['Identify_home']);
});

test('first and second image are separate core steps', () => {
  const { steps } = getFunnelSteps('identify', 'banknote');
  const photo1 = steps.find((s) => s.id === 'photo_1');
  const photo2 = steps.find((s) => s.id === 'photo_2');
  const merged = steps.find((s) => s.id === 'photo');
  assert.equal(photo1.core, true);
  assert.equal(photo2.core, true);
  assert.ok(photo1.events.includes('photo_clicked_1'));
  assert.ok(photo2.events.includes('photo_clicked_2'));
  assert.equal(merged, undefined);
});

test('camera click and gallery upload are split, and combined on the core step', () => {
  for (const product of ['banknote', 'coinzy']) {
    const { steps } = getFunnelSteps('identify', product);
    const photo1 = steps.find((s) => s.id === 'photo_1');
    const click1 = steps.find((s) => s.id === 'photo_click_1');
    const upload1 = steps.find((s) => s.id === 'photo_upload_1');
    const photo2 = steps.find((s) => s.id === 'photo_2');
    const click2 = steps.find((s) => s.id === 'photo_click_2');
    const upload2 = steps.find((s) => s.id === 'photo_upload_2');
    assert.deepEqual(click1.events, ['photo_clicked_1']);
    assert.deepEqual(upload1.events, ['photo_uploaded_1']);
    assert.deepEqual(click2.events, ['photo_clicked_2']);
    assert.deepEqual(upload2.events, ['photo_uploaded_2']);
    assert.ok(photo1.events.includes('photo_clicked_1'));
    assert.ok(photo1.events.includes('photo_uploaded_1'));
    assert.ok(photo2.events.includes('photo_clicked_2'));
    assert.ok(photo2.events.includes('photo_uploaded_2'));
    assert.equal(photo1.core, true);
    assert.equal(click1.core, undefined);
    assert.equal(upload1.core, undefined);
    assert.ok(steps.some((s) => s.id === 'view_all' && s.events.includes('identification_view_all')));
  }
});

test('collection and global catalogue are separate funnels', () => {
  const collection = getFunnelSteps('collection', 'banknote');
  const global = getFunnelSteps('global', 'coinzy');
  assert.equal(collection.status, 'ok');
  assert.equal(global.status, 'ok');
  assert.ok(collection.steps.some((s) => s.id === 'collection_screen'));
  assert.equal(collection.steps.find((s) => s.id === 'global_screen'), undefined);
  assert.ok(global.steps.some((s) => s.id === 'global_screen'));
  assert.equal(global.steps.find((s) => s.id === 'collection_screen'), undefined);
  assert.equal(collection.steps.find((s) => s.id === 'collection_tab').core, true);
});

test('marketplace funnel excludes feed, feed funnel excludes marketplace', () => {
  const market = getFunnelSteps('marketplace', 'coinzy');
  const feed = getFunnelSteps('feed', 'banknote');
  assert.equal(market.status, 'ok');
  assert.equal(feed.status, 'ok');
  assert.ok(market.steps.some((s) => s.id === 'market_screen'));
  assert.equal(market.steps.find((s) => s.id === 'feed_screen'), undefined);
  assert.ok(feed.steps.some((s) => s.id === 'feed_screen'));
  assert.equal(feed.steps.find((s) => s.id === 'market_screen'), undefined);
  assert.equal(feed.steps.find((s) => s.id === 'feed_tab').core, true);
});

test('crop is per image and sits after that image, not after both', () => {
  const banknote = getFunnelSteps('identify', 'banknote').steps;
  const coinzy = getFunnelSteps('identify', 'coinzy').steps;
  const ids = (steps) => steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(
    ids(banknote).slice(ids(banknote).indexOf('photo_1'), ids(banknote).indexOf('submit') + 1),
    ['photo_1', 'photo_2', 'submit'],
  );
  assert.deepEqual(
    ids(coinzy).slice(ids(coinzy).indexOf('photo_1'), ids(coinzy).indexOf('submit') + 1),
    ['photo_1', 'photo_2', 'submit'],
  );
  assert.equal(banknote.find((s) => s.id === 'crop_1').core, undefined);
  assert.equal(banknote.find((s) => s.id === 'crop_2').core, undefined);
  assert.deepEqual(banknote.find((s) => s.id === 'crop_1').events, ['photo_cropping_screen_1']);
  assert.deepEqual(banknote.find((s) => s.id === 'crop_2').events, ['photo_cropping_screen_2']);
  assert.deepEqual(coinzy.find((s) => s.id === 'crop_1').events, ['photo_cropping_screen_0']);
  assert.deepEqual(coinzy.find((s) => s.id === 'crop_2').events, ['photo_cropping_screen_1']);
  assert.equal(banknote.find((s) => s.id === 'crop'), undefined);
  assert.equal(coinzy.find((s) => s.id === 'crop'), undefined);
});

test('expert evaluation is Coinzy-only and maps every listed event', () => {
  const coinzy = getFunnelSteps('expert', 'coinzy');
  const banknote = getFunnelSteps('expert', 'banknote');
  assert.equal(coinzy.status, 'ok');
  assert.equal(banknote.status, 'insufficient_instrumentation');
  const core = coinzy.steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(core, [
    'landing',
    'upload',
    'continue',
    'queued',
    'report',
    'buy_credits',
    'credits_continue',
    'token_received',
    'token_consumed',
  ]);
  const mapped = new Set(coinzy.steps.flatMap((s) => s.events));
  for (const event of COINZY_EXPERT_EVENTS) {
    assert.ok(mapped.has(event), `missing ${event}`);
  }
  assert.equal(mapped.size, COINZY_EXPERT_EVENTS.length);
});

test('funnel SQL splits unique people into once vs repeat', () => {
  const { steps } = getFunnelSteps('identify', 'coinzy');
  const sql = buildFunnelSql('proj', 'ds', steps, '2026-08-01', '2026-08-25');
  assert.match(sql, /once_users/);
  assert.match(sql, /repeat_users/);
  assert.match(sql, /hits_per_user/);
  assert.match(sql, /repeat_share/);
});
