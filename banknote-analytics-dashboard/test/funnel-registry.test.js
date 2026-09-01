import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNNELS, getFunnelSteps, COINZY_EXPERT_EVENTS, buildFunnelSql, buildPackMixSql } from '../server/services/analytics/funnel-registry.js';

test('Banknote Identify (all) starts at camera; nav/home are side rows', () => {
  const all = getFunnelSteps('identify', 'banknote');
  const nav = getFunnelSteps('identify-nav', 'banknote');
  const home = getFunnelSteps('identify-home', 'banknote');
  const core = all.steps.filter((s) => s.core).map((s) => s.id);
  assert.equal(core[0], 'camera');
  assert.equal(all.steps.find((s) => s.id === 'entry').core, undefined);
  assert.ok(all.steps.find((s) => s.id === 'home_cta'));
  assert.equal(nav.steps.find((s) => s.id === 'entry').core, true);
  assert.equal(nav.steps.find((s) => s.id === 'home_cta'), undefined);
  assert.equal(home.steps.find((s) => s.id === 'entry').core, true);
  assert.equal(home.steps.find((s) => s.id === 'home_cta'), undefined);
});

test('identify funnels exist for bottom nav, home/banner, camera, gallery, and combined', () => {
  assert.ok(FUNNELS.identify);
  assert.ok(FUNNELS['identify-nav']);
  assert.ok(FUNNELS['identify-home']);
  assert.ok(FUNNELS['identify-camera']);
  assert.ok(FUNNELS['identify-gallery']);
});

test('nav and home funnels restrict every step to that entry cohort', () => {
  const navBn = getFunnelSteps('identify-nav', 'banknote');
  const navCz = getFunnelSteps('identify-nav', 'coinzy');
  const homeBn = getFunnelSteps('identify-home', 'banknote');
  const homeCz = getFunnelSteps('identify-home', 'coinzy');

  assert.deepEqual(navBn.cohortEvents, ['Identify_bottom_nav']);
  assert.deepEqual(navCz.cohortEvents, ['Identify_bottom_nav']);
  assert.deepEqual(navCz.cohortExcludeEvents, ['Identify_home']);
  assert.equal(navBn.cohortExcludeEvents.length, 0);
  assert.deepEqual(homeBn.cohortEvents, ['Identify_home']);
  assert.deepEqual(homeCz.cohortEvents, ['Identify_home']);
  assert.equal(homeCz.cohortExcludeEvents.length, 0);

  assert.deepEqual(navBn.steps.find((s) => s.id === 'entry').events, ['Identify_bottom_nav']);
  assert.equal(navBn.steps.find((s) => s.id === 'entry').core, true);
  assert.deepEqual(navCz.steps.find((s) => s.id === 'entry').events, ['Identify_bottom_nav']);
  assert.equal(navCz.steps.find((s) => s.id === 'entry').core, true);
  assert.equal(navCz.steps.find((s) => s.id === 'home_cta'), undefined);

  assert.deepEqual(homeBn.steps.find((s) => s.id === 'entry').events, ['Identify_home']);
  assert.equal(homeBn.steps.find((s) => s.id === 'entry').core, true);
  assert.deepEqual(homeCz.steps.find((s) => s.id === 'entry').events, ['Identify_home']);
  assert.equal(homeCz.steps.find((s) => s.id === 'entry').core, true);
  assert.equal(homeCz.steps.find((s) => s.id === 'home_cta'), undefined);
  assert.equal(homeCz.steps.filter((s) => s.core)[0].id, 'entry');

  const navSql = buildFunnelSql('p', 'd', navCz.steps, '2026-08-01', '2026-08-25', {
    cohortEvents: navCz.cohortEvents,
    cohortExcludeEvents: navCz.cohortExcludeEvents,
  });
  assert.match(navSql, /AND cohort_hits > 0/);
  assert.match(navSql, /AND cohort_excl = 0/);
  assert.match(navSql, /Identify_home/);

  const homeSql = buildFunnelSql('p', 'd', homeCz.steps, '2026-08-01', '2026-08-25', {
    cohortEvents: homeCz.cohortEvents,
  });
  assert.match(homeSql, /AND cohort_hits > 0/);
  assert.match(homeSql, /Identify_home/);
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

test('Banknote splits camera vs gallery; Coinzy infers gallery as crop/clicked minus shutter', () => {
  const banknote = getFunnelSteps('identify', 'banknote').steps;
  const coinzy = getFunnelSteps('identify', 'coinzy').steps;
  assert.deepEqual(banknote.find((s) => s.id === 'photo_click_1').events, ['photo_clicked_1']);
  assert.deepEqual(banknote.find((s) => s.id === 'photo_upload_1').events, ['photo_uploaded_1']);
  assert.deepEqual(banknote.find((s) => s.id === 'photo_click_2').events, ['photo_clicked_2']);
  assert.deepEqual(banknote.find((s) => s.id === 'photo_upload_2').events, ['photo_uploaded_2']);
  assert.ok(banknote.find((s) => s.id === 'photo_1').events.includes('photo_uploaded_1'));
  assert.equal(coinzy.find((s) => s.id === 'photo_upload_1'), undefined);
  assert.equal(coinzy.find((s) => s.id === 'photo_upload_2'), undefined);
  assert.equal(coinzy.find((s) => s.id === 'photo_1'), undefined);
  assert.deepEqual(coinzy.find((s) => s.id === 'shutter').events, ['Photo_clicked']);
  assert.equal(coinzy.find((s) => s.id === 'shutter').core, undefined);
  const gallery = coinzy.find((s) => s.id === 'gallery');
  assert.deepEqual(gallery.excludeEvents, ['Photo_clicked']);
  assert.ok(gallery.events.includes('photo_cropping_screen_0'));
  assert.ok(gallery.events.includes('photo_clicked_1'));
  assert.ok(!gallery.events.includes('Photo_clicked'));
  const photos = coinzy.find((s) => s.id === 'photos');
  assert.equal(photos.core, undefined);
  assert.deepEqual(photos.events, ['photo_clicked_1', 'photo_clicked_2']);
  assert.ok(!photos.events.includes('Photo_clicked'));
  assert.equal(coinzy.find((s) => s.id === 'photo_click_1').core, true);
  assert.equal(coinzy.find((s) => s.id === 'photo_click_2').core, true);
  const photoIdx = coinzy.findIndex((s) => s.id === 'photos');
  const crop2Idx = coinzy.findIndex((s) => s.id === 'photo_click_2');
  const submitIdx = coinzy.findIndex((s) => s.id === 'submit');
  assert.ok(photoIdx > crop2Idx);
  assert.ok(photoIdx < submitIdx);
  assert.deepEqual(coinzy.find((s) => s.id === 'photo_click_1').events, ['photo_clicked_1']);
});

test('Banknote post-ID uses top5 / view-all / Added_to_collection events', () => {
  const { steps } = getFunnelSteps('identify', 'banknote');
  assert.deepEqual(steps.find((s) => s.id === 'top_matches').events, ['identification_top5_matches']);
  assert.ok(steps.some((s) => s.id === 'view_all' && s.events.includes('identification_view_all')));
  assert.ok(steps.find((s) => s.id === 'add_collection').events.includes('Added_to_collection_identified'));
  assert.ok(steps.find((s) => s.id === 'all_options').events.includes('identification_all_opts_screen'));
  assert.deepEqual(steps.find((s) => s.id === 'details').events, ['banknote_details_identification']);
  assert.equal(steps.find((s) => s.id === 'details').core, true);
  assert.deepEqual(steps.find((s) => s.id === 'result_screen').events, ['identification_details_screen']);
  assert.equal(steps.find((s) => s.id === 'result_screen').core, undefined);
  assert.ok(steps.find((s) => s.id === 'success').events.includes('Identification_done'));
  assert.ok(steps.find((s) => s.id === 'success').events.includes('identification_done_success'));
  assert.equal(steps.find((s) => s.id === 'attempt'), undefined);
});

test('Coinzy Identify core is Camera → crop → after crop → crop → after crop → Submit → API → Success → Details', () => {
  const { steps } = getFunnelSteps('identify', 'coinzy');
  const core = steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(core, [
    'camera', 'crop_1', 'photo_click_1', 'crop_2', 'photo_click_2',
    'submit', 'attempt', 'success', 'details',
  ]);
  assert.equal(steps.find((s) => s.id === 'entry').core, undefined);
  assert.deepEqual(steps.find((s) => s.id === 'submit').events, ['photo_submit_button', 'photos_submitted']);
  assert.ok(steps.find((s) => s.id === 'success').events.includes('identification_done_success'));
  assert.ok(steps.find((s) => s.id === 'success').events.includes('Identification_done'));
  assert.ok(!steps.find((s) => s.id === 'submit').events.includes('Identification_done'));
  assert.deepEqual(steps.find((s) => s.id === 'attempt').events, ['Identification_attempted']);
  assert.equal(steps.find((s) => s.id === 'attempt').core, true);
  assert.equal(steps.find((s) => s.id === 'crop_1').core, true);
  assert.equal(steps.find((s) => s.id === 'crop_2').core, true);
  assert.equal(steps.find((s) => s.id === 'crop_confirm_1').core, undefined);
  assert.equal(steps.find((s) => s.id === 'crop_confirm_2').core, undefined);
  assert.equal(steps.find((s) => s.id === 'quota_block').isDrop, undefined);
  assert.equal(steps.find((s) => s.id === 'failure').isDrop, undefined);
  assert.equal(steps.find((s) => s.id === 'permission_popup').core, undefined);
  assert.ok(steps.find((s) => s.id === 'permission_popup').label.includes('shutter-only'));
  assert.equal(steps.find((s) => s.id === 'option_chosen').core, undefined);
  assert.equal(steps.find((s) => s.id === 'add_collection'), undefined);
  assert.equal(steps.find((s) => s.id === 'owned'), undefined);
  assert.equal(steps.find((s) => s.id === 'add'), undefined);
  const mapped = new Set(steps.flatMap((s) => s.events));
  assert.equal(mapped.has('Added_to_collection_identified'), false);
  assert.equal(mapped.has('identification_top5_matches'), false);
  assert.equal(mapped.has('Collection_clicked'), false);
  assert.equal(mapped.has('owned_button_clicked'), false);
});

test('Coinzy camera and gallery tabs use different step lists', () => {
  const camera = getFunnelSteps('identify-camera', 'coinzy');
  const gallery = getFunnelSteps('identify-gallery', 'coinzy');
  const cameraIds = camera.steps.map((s) => s.id);
  const galleryIds = gallery.steps.map((s) => s.id);

  assert.deepEqual(camera.cohortEvents, ['Photo_clicked']);
  assert.deepEqual(camera.cohortExcludeEvents, []);
  assert.deepEqual(
    camera.steps.filter((s) => s.core).map((s) => s.id),
    ['shutter', 'crop_1', 'photo_click_1', 'crop_2', 'photo_click_2', 'submit', 'attempt', 'success', 'details'],
  );
  assert.ok(cameraIds.includes('shutter'));
  assert.ok(cameraIds.includes('permission_popup'));
  assert.equal(camera.steps.find((s) => s.id === 'gallery'), undefined);
  assert.equal(camera.steps.find((s) => s.id === 'entry'), undefined);

  assert.ok(gallery.cohortEvents.includes('photo_clicked_1'));
  assert.ok(gallery.cohortEvents.includes('photo_cropping_screen_0'));
  assert.deepEqual(gallery.cohortExcludeEvents, ['Photo_clicked']);
  assert.deepEqual(
    gallery.steps.filter((s) => s.core).map((s) => s.id),
    ['crop_1', 'photo_click_1', 'crop_2', 'photo_click_2', 'submit', 'attempt', 'success', 'details'],
  );
  assert.ok(galleryIds.includes('gallery'));
  assert.equal(gallery.steps.find((s) => s.id === 'shutter'), undefined);
  assert.equal(gallery.steps.find((s) => s.id === 'permission_popup'), undefined);
  assert.equal(gallery.steps.find((s) => s.id === 'permission_granted'), undefined);

  const sql = buildFunnelSql('p', 'd', gallery.steps, '2026-08-01', '2026-08-25', {
    cohortEvents: gallery.cohortEvents,
    cohortExcludeEvents: gallery.cohortExcludeEvents,
  });
  assert.match(sql, /cohort_excl/);
  assert.match(sql, /AND cohort_excl = 0/);
  assert.match(sql, /AND cohort_hits > 0/);
});

test('Banknote camera vs gallery tabs are different flows, not the same list filtered', () => {
  const camera = getFunnelSteps('identify-camera', 'banknote');
  const gallery = getFunnelSteps('identify-gallery', 'banknote');
  assert.deepEqual(
    camera.steps.filter((s) => s.core).map((s) => s.id).slice(0, 7),
    ['photo_1', 'crop_1', 'crop_confirm_1', 'photo_2', 'crop_2', 'crop_confirm_2', 'submit'],
  );
  assert.deepEqual(camera.steps.find((s) => s.id === 'photo_1').events, ['photo_clicked_1']);
  assert.equal(camera.steps.find((s) => s.id === 'photo_1').label, 'First photo clicked');
  assert.deepEqual(gallery.steps.find((s) => s.id === 'photo_1').events, ['photo_uploaded_1']);
  assert.equal(gallery.steps.find((s) => s.id === 'photo_1').label, 'First photo uploaded');
  assert.ok(camera.steps.find((s) => s.id === 'permission_popup'));
  assert.equal(gallery.steps.find((s) => s.id === 'permission_popup'), undefined);
  assert.equal(camera.steps.find((s) => s.id === 'photo_upload_1'), undefined);
  assert.equal(gallery.steps.find((s) => s.id === 'photo_click_1'), undefined);
  assert.ok(camera.cohortEvents.includes('photo_clicked_1'));
  assert.ok(gallery.cohortEvents.includes('photo_uploaded_1'));
  assert.equal(gallery.cohortExcludeEvents.length, 0);
  assert.equal(camera.steps.filter((s) => s.core)[0].id, 'photo_1');
  assert.equal(gallery.steps.filter((s) => s.core)[0].id, 'photo_1');
  assert.equal(camera.steps.find((s) => s.id === 'attempt'), undefined);
  assert.equal(gallery.steps.find((s) => s.id === 'attempt'), undefined);
  assert.ok(camera.steps.find((s) => s.id === 'success').events.includes('Identification_done'));
  assert.deepEqual(camera.steps.find((s) => s.id === 'details').events, ['banknote_details_identification']);
});

test('Coinzy nav cohort excludes Home CTA; home cohort is Identify_home', () => {
  const nav = getFunnelSteps('identify-nav', 'coinzy');
  const home = getFunnelSteps('identify-home', 'coinzy');
  assert.deepEqual(nav.steps.find((s) => s.id === 'entry').events, ['Identify_bottom_nav']);
  assert.equal(nav.steps.find((s) => s.id === 'entry').core, true);
  assert.deepEqual(nav.cohortExcludeEvents, ['Identify_home']);
  assert.deepEqual(home.steps.find((s) => s.id === 'entry').events, ['Identify_home']);
  assert.equal(home.steps.find((s) => s.id === 'entry').core, true);
  assert.deepEqual(home.cohortEvents, ['Identify_home']);
  const navCore = ['entry', 'camera', 'crop_1', 'photo_click_1', 'crop_2', 'photo_click_2', 'submit', 'attempt', 'success', 'details'];
  assert.deepEqual(nav.steps.filter((s) => s.core).map((s) => s.id), navCore);
  assert.deepEqual(home.steps.filter((s) => s.core).map((s) => s.id), navCore);
});

test('mixed catalogue funnel is removed; collection and catalogue start at session', () => {
  assert.equal(FUNNELS.catalogue, undefined);
  const collection = getFunnelSteps('collection', 'banknote');
  const global = getFunnelSteps('global', 'coinzy');
  assert.equal(collection.status, 'ok');
  assert.equal(global.status, 'ok');
  const collectionCore = collection.steps.filter((s) => s.core).map((s) => s.id);
  const globalCore = global.steps.filter((s) => s.core).map((s) => s.id);
  assert.equal(collectionCore[0], 'session');
  assert.equal(globalCore[0], 'session');
  assert.deepEqual(collection.steps.find((s) => s.id === 'session').events, [
    'session_start', 'App_open', 'first_open',
  ]);
  assert.deepEqual(global.steps.find((s) => s.id === 'session').events, [
    'session_start', 'App_open', 'first_open',
  ]);
  assert.ok(collection.steps.some((s) => s.id === 'collection_screen'));
  assert.equal(collection.steps.find((s) => s.id === 'global_screen'), undefined);
  assert.ok(global.steps.some((s) => s.id === 'global_screen'));
  assert.equal(global.steps.find((s) => s.id === 'collection_screen'), undefined);
  assert.equal(collection.steps.find((s) => s.id === 'open_kpi'), undefined);
  assert.equal(global.steps.find((s) => s.id === 'open_kpi'), undefined);
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
    ['photo_1', 'crop_1', 'crop_confirm_1', 'photo_2', 'crop_2', 'crop_confirm_2', 'submit'],
  );
  assert.deepEqual(
    ids(coinzy).slice(ids(coinzy).indexOf('crop_1'), ids(coinzy).indexOf('submit') + 1),
    ['crop_1', 'photo_click_1', 'crop_2', 'photo_click_2', 'submit'],
  );
  assert.equal(banknote.find((s) => s.id === 'crop_1').core, true);
  assert.equal(banknote.find((s) => s.id === 'crop_confirm_1').core, true);
  assert.equal(banknote.find((s) => s.id === 'crop_2').core, true);
  assert.equal(banknote.find((s) => s.id === 'crop_confirm_2').core, true);
  assert.deepEqual(banknote.find((s) => s.id === 'crop_1').events, ['photo_cropping_screen_1']);
  assert.deepEqual(banknote.find((s) => s.id === 'crop_2').events, ['photo_cropping_screen_2']);
  assert.deepEqual(coinzy.find((s) => s.id === 'crop_1').events, ['photo_cropping_screen_0']);
  assert.deepEqual(coinzy.find((s) => s.id === 'crop_2').events, ['photo_cropping_screen_1']);
  assert.equal(coinzy.find((s) => s.id === 'crop_1').core, true);
  assert.equal(coinzy.find((s) => s.id === 'crop_2').core, true);
  assert.equal(coinzy.find((s) => s.id === 'crop_confirm_1').core, undefined);
  assert.equal(coinzy.find((s) => s.id === 'crop_confirm_2').core, undefined);
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
  assert.match(sql, /excl_/);
  assert.match(sql, /minus Photo_clicked/);
  assert.match(sql, /hits_\d+ > 0 AND excl_\d+ = 0/);
});

test('Banknote paywall is pack → button → native Google sheet → confirm', () => {
  const { steps, packMix } = getFunnelSteps('paywall', 'banknote');
  const core = steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(core, ['paywall', 'pack', 'button', 'native', 'confirm']);
  assert.deepEqual(steps.find((s) => s.id === 'pack').events, ['Subs_pack']);
  assert.deepEqual(steps.find((s) => s.id === 'button').events, ['subs_button']);
  assert.deepEqual(steps.find((s) => s.id === 'native').events, ['subs_native']);
  assert.deepEqual(steps.find((s) => s.id === 'confirm').events, ['Subs_confirm']);
  assert.ok(!steps.find((s) => s.id === 'paywall').events.includes('Subs_page_onboarding'));
  assert.ok(packMix.packEvents.includes('Subs_pack'));
  assert.ok(!packMix.packEvents.includes('subs_pack'));
});

test('Coinzy paywall excludes onboarding pages and counts unique pack people', () => {
  const { steps, packMix, cohortEvents } = getFunnelSteps('paywall', 'coinzy');
  const core = steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(core, ['paywall', 'pack', 'button', 'confirm']);
  assert.ok(!steps.find((s) => s.id === 'paywall').events.includes('Subs_page_onboarding'));
  assert.ok(steps.find((s) => s.id === 'pack').events.includes('subs_pack_discount'));
  assert.equal((cohortEvents || []).length, 0);
  assert.ok(packMix.packEvents.includes('subs_pack'));
});

test('onboarding funnel restricts later steps to people who saw onboarding', () => {
  const coinzy = getFunnelSteps('paywall-onboarding', 'coinzy');
  const banknote = getFunnelSteps('paywall-onboarding', 'banknote');
  assert.equal(coinzy.status, 'ok');
  assert.equal(banknote.status, 'ok');
  assert.ok(coinzy.cohortEvents.includes('Subs_page_onboarding'));
  assert.ok(coinzy.cohortEvents.includes('subs_page_onboarding_1'));
  assert.ok(coinzy.cohortEvents.includes('Subs_page_onboarding_skip'));
  const sql = buildFunnelSql('p', 'd', coinzy.steps, '2026-08-01', '2026-08-25', {
    cohortEvents: coinzy.cohortEvents,
  });
  assert.match(sql, /cohort_hits/);
  assert.match(sql, /AND cohort_hits > 0/);
  const core = coinzy.steps.filter((s) => s.core).map((s) => s.id);
  assert.deepEqual(core, ['onboarding', 'pack', 'button', 'confirm']);
});

test('Banknote onboarding tab is first-run screens, not pack / confirm', () => {
  const { steps } = getFunnelSteps('onboarding', 'banknote');
  assert.deepEqual(steps.find((s) => s.id === 'onboarding').events, [
    'onboarding_started',
    'onboarding_screen_view',
  ]);
  assert.ok(steps.find((s) => s.id === 'onboarding_done').events.includes('onboarding_completion'));
  assert.ok(steps.find((s) => s.id === 'onboarding_next').events.includes('onboarding_next_step'));
  assert.equal(steps.find((s) => s.id === 'pack'), undefined);
  assert.equal(steps.find((s) => s.id === 'confirm'), undefined);
  assert.ok(!steps.flatMap((s) => s.events).includes('Subs_page_onboarding'));
  assert.deepEqual(
    steps.filter((s) => s.core).map((s) => s.id),
    ['onboarding', 'onboarding_done'],
  );
});

test('Coinzy onboarding tab is logo → values → login → complete', () => {
  const { steps } = getFunnelSteps('onboarding', 'coinzy');
  assert.ok(steps.find((s) => s.id === 'logo').events.includes('Onboarding_logo_animation'));
  assert.ok(steps.find((s) => s.id === 'value_1').events.includes('Onboarding_value_1_3'));
  assert.ok(steps.find((s) => s.id === 'login').events.includes('onboarding_login_1_2'));
  assert.deepEqual(steps.find((s) => s.id === 'onboarding_done').events, ['Onboarding_complete']);
  assert.deepEqual(steps.find((s) => s.id === 'skip').events, ['Onboarding_skipped']);
  assert.equal(steps.find((s) => s.id === 'pack'), undefined);
  assert.ok(!steps.flatMap((s) => s.events).includes('Subs_page_onboarding'));
  assert.deepEqual(
    steps.filter((s) => s.core).map((s) => s.id),
    ['logo', 'value_1', 'value_2', 'value_3', 'value_4', 'value_5', 'login', 'notification', 'onboarding_done'],
  );
});

test('Banknote onboarding → subs uses subscription_shown, not Subs_page_onboarding', () => {
  const { steps, cohortEvents } = getFunnelSteps('paywall-onboarding', 'banknote');
  assert.deepEqual(cohortEvents, [
    'onboarding_started',
    'onboarding_screen_view',
    'subscription_shown',
  ]);
  assert.ok(!cohortEvents.includes('Subs_page_onboarding'));
  assert.deepEqual(steps.find((s) => s.id === 'onboarding_subs').events, ['subscription_shown']);
  assert.equal(steps.find((s) => s.id === 'onboarding_done'), undefined);
  assert.ok(!steps.flatMap((s) => s.events).includes('Subs_page_onboarding'));
  assert.deepEqual(
    steps.filter((s) => s.core).map((s) => s.id),
    ['onboarding_subs', 'pack', 'button', 'native', 'confirm'],
  );
});

test('pack mix SQL groups unique people by pack_name and discount type', () => {
  const { packMix } = getFunnelSteps('paywall', 'banknote');
  const sql = buildPackMixSql('p', 'd', {
    ...packMix,
    startDate: '2026-08-01',
    endDate: '2026-08-25',
  });
  assert.match(sql, /pack_name/);
  assert.match(sql, /discount_type/);
  assert.match(sql, /confirmed_users/);
  assert.match(sql, /Subs_pack/);
});
