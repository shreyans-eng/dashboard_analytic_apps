import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ALL_PACKS,
  CLICKS_ROLLUP,
  COINZY_PACK_SKUS,
  LIFETIME_ROLLUP,
  MONTHLY_ROLLUP,
  YEARLY_FACE_PRICE,
  YEARLY_LIST_PRICE,
  YEARLY_NET_SHARE,
  YEARLY_OFFER_LIST_PRICE,
  YEARLY_ROLLUP,
  classifyBanknotePack,
  classifyCoinzyPack,
  classifyPack,
  isHalfYearlyPack,
  isRollupPack,
  summarizePackRows,
  yearlyListPrice,
  yearlyOfferListPrice,
  yearlyNetShare,
  yearlyNetUsd,
  packEstimateUsd,
  packListPrice,
} from '../server/services/analytics/subscription-packs.js';

const sqlPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'sql',
  'dashboard',
  'raw',
  '18_subscription_packs.sql',
);

test('yearly estimate is unique people × share × Play US list (Banknote 20%, Coinzy 15%)', () => {
  assert.equal(YEARLY_FACE_PRICE, 22.99);
  assert.equal(YEARLY_NET_SHARE, 0.20);
  assert.equal(yearlyNetShare('banknote'), 0.20);
  assert.equal(yearlyNetShare('coinzy'), 0.15);
  assert.equal(YEARLY_LIST_PRICE.banknote, 22.99);
  assert.equal(YEARLY_LIST_PRICE.coinzy, 29.99);
  assert.equal(yearlyListPrice('banknote'), 22.99);
  assert.equal(yearlyListPrice('coinzy'), 29.99);
  assert.equal(yearlyListPrice('unknown'), null);
  assert.equal(yearlyNetUsd(81, 'banknote', 'yearly_banknote_pack'), 81 * 0.20 * 22.99);
  assert.equal(yearlyNetUsd(14, 'banknote', 'yearly_banknote_pack_offer'), 14 * 0.20 * 11.99);
  assert.equal(yearlyOfferListPrice('banknote'), 11.99);
  assert.equal(YEARLY_OFFER_LIST_PRICE.banknote, 11.99);
  assert.equal(yearlyOfferListPrice('coinzy'), 14.99);
  assert.equal(YEARLY_OFFER_LIST_PRICE.coinzy, 14.99);
  assert.equal(yearlyNetUsd(81, 'coinzy'), 81 * 0.15 * 29.99);
  assert.equal(yearlyNetUsd(40, 'coinzy', 'yearly_coinzy_pack_trial_half_price'), 40 * 0.15 * 14.99);
  assert.equal(yearlyNetUsd(30, 'coinzy', 'monthly_coin_pack'), 0);
  assert.equal(yearlyNetUsd(3, 'coinzy', 'lifetime_coin'), 0);
  assert.equal(yearlyNetUsd(6, 'coinzy', 'lifetime_pack_half_price'), 0);
  assert.equal(yearlyNetUsd(8, 'banknote', 'monthly_banknote_pack'), 0);
  assert.equal(packEstimateUsd(30, 'coinzy', 'monthly_coin_pack'), null);
  assert.equal(packEstimateUsd(3, 'coinzy', 'lifetime_coin'), null);
  assert.equal(packListPrice('coinzy', 'yearly_coinzy_pack_trial'), 29.99);
  assert.equal(packListPrice('coinzy', 'monthly_coin_pack'), 4.49);
  assert.equal(packListPrice('coinzy', 'lifetime_coin'), 54.99);
  assert.equal(packListPrice('banknote', 'monthly_banknote_pack'), null);
  assert.equal(yearlyNetUsd(81), 81 * 0.20 * 22.99);
  assert.equal(yearlyNetUsd(0), 0);
  assert.equal(isHalfYearlyPack('yearly_coin_half_pack'), true);
  assert.equal(isHalfYearlyPack('yearly_coinzy_pack_trial_half_price'), true);
  assert.equal(isHalfYearlyPack('yearly_banknote_pack_offer'), true);
  assert.equal(isHalfYearlyPack('yearly_banknote_pack'), false);
  assert.equal(isHalfYearlyPack('yearly_coin_pack'), false);
  assert.equal(isHalfYearlyPack('yearly_coinzy_pack_trial'), false);
  assert.equal(isHalfYearlyPack('lifetime_pack_half_price'), false);
  assert.equal(isHalfYearlyPack('lifetime_banknote_pack_offer'), false);
});

test('pack SQL counts unique users per day per pack from confirms, not IAP tiers', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const body = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(body, /COUNT\(DISTINCT uid\) AS unique_users/);
  assert.match(body, /Subs_pack/);
  assert.match(body, /pack_clicks/);
  assert.match(body, /\(all packs\)/);
  assert.match(body, /\(yearly\)/);
  assert.match(body, /\(monthly\)/);
  assert.match(body, /\(lifetime\)/);
  assert.match(body, /\(pack clicks\)/);
  assert.doesNotMatch(body, /in_app_purchase/);
  assert.doesNotMatch(body, /subscription_tier/);
});

test('Banknote pack SQL counts store in_app_purchase product IDs, not Subs_confirm', () => {
  const banknotePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'sql',
    'dashboard',
    'product',
    'banknote',
    '18_subscription_packs.sql',
  );
  const body = fs.readFileSync(banknotePath, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(body, /event_name_base = 'Subs_pack'/);
  assert.match(body, /in_app_purchase/);
  assert.match(body, /UNNEST\(items\)/);
  assert.match(body, /yearly_banknote_pack/);
  assert.match(body, /monthly_banknote_pack/);
  assert.match(body, /lifetime_banknote_pack/);
  assert.match(body, /FROM purchases/);
  assert.match(body, /\(monthly\)/);
  assert.doesNotMatch(body, /Subs_confirm/);
  assert.doesNotMatch(body, /pack_source/);
  assert.doesNotMatch(body, /paid_purchase/);
  assert.doesNotMatch(body, /subs_pack/);
  assert.doesNotMatch(body, /subs_confirm/);
});

test('Coinzy pack SQL counts store in_app_purchase SKUs, not subs_confirm', () => {
  const body = sqlBody('dashboard/product/coinzy/18_subscription_packs.sql');
  assert.match(body, /subs_pack/);
  assert.match(body, /subs_pack_discount/);
  assert.match(body, /in_app_purchase/);
  assert.match(body, /UNNEST\(items\)/);
  assert.match(body, /FROM purchases/);
  assert.match(body, /yearly_coin_pack/);
  assert.match(body, /monthly_coin_pack/);
  assert.match(body, /lifetime_coin/);
  assert.match(body, /yearly_coin_half_pack/);
  assert.match(body, /yearly_coinzy_pack_trial/);
  assert.match(body, /lifetime_pack_half_price/);
  assert.doesNotMatch(body, /'Subs_pack'/);
  assert.doesNotMatch(body, /'Subs_confirm'/);
  assert.doesNotMatch(body, /subs_confirm/);
  assert.doesNotMatch(body, /paid_purchase/);
});

test('Coinzy SKUs map yearly / monthly / lifetime from the paywall JSON', () => {
  assert.equal(classifyCoinzyPack('yearly_coin_pack').kind, 'Yearly');
  assert.equal(classifyCoinzyPack('yearly_coin_half_pack').kind, 'Yearly');
  assert.equal(classifyCoinzyPack('yearly_coinzy_pack_trial').kind, 'Yearly');
  assert.equal(classifyCoinzyPack('yearly_coinzy_pack_trial_half_price').kind, 'Yearly');
  assert.equal(classifyCoinzyPack('monthly_coin_pack').kind, 'Monthly');
  assert.equal(classifyCoinzyPack('lifetime_coin').kind, 'Lifetime');
  assert.equal(classifyCoinzyPack('lifetime_pack_half_price').kind, 'Lifetime');
  assert.equal(classifyCoinzyPack('lifetime_pack_half_price').billing, 'IAP');
  assert.equal(classifyCoinzyPack('yearly_coin_pack').billing, 'SUBS');
  assert.equal(classifyCoinzyPack('full_pack').kind, 'Other');
  assert.equal(Object.keys(COINZY_PACK_SKUS).length, 7);
});

test('Banknote SKUs map GA product IDs to yearly / monthly / lifetime', () => {
  assert.equal(classifyPack('yearly_banknote_pack', 'banknote').kind, 'Yearly');
  assert.equal(classifyPack('yearly_banknote_pack', 'banknote').offer, 'full_pack');
  assert.equal(classifyPack('yearly_banknote_pack_offer', 'banknote').kind, 'Yearly');
  assert.equal(classifyPack('yearly_banknote_pack_offer', 'banknote').offer, 'half_pack');
  assert.equal(classifyPack('monthly_banknote_pack', 'banknote').kind, 'Monthly');
  assert.equal(classifyPack('lifetime_banknote_pack_offer', 'banknote').kind, 'Lifetime');
  assert.equal(classifyBanknotePack('yearly_banknote_pack_offer').sku, 'yearly_banknote_pack_offer');
});

test('Banknote paywall SQL is in-app Subs_page and Subs_confirm only', () => {
  const paywallPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'sql',
    'dashboard',
    'product',
    'banknote',
    '05_paywall_conversion.sql',
  );
  const body = fs.readFileSync(paywallPath, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.match(body, /Subs_page/);
  assert.match(body, /Subs_confirm/);
  assert.doesNotMatch(body, /subscription_shown/);
  assert.doesNotMatch(body, /Subs_page_onboarding/);
  assert.doesNotMatch(body, /paid_purchase/);
});

test('summarizePackRows splits yearly vs half-yearly and uses product yearly share × Play US list', () => {
  const rows = [
    { grain: 'range', pack_name: ALL_PACKS, unique_users: 10, takes: 12 },
    { grain: 'range', pack_name: YEARLY_ROLLUP, unique_users: 4, takes: 4 },
    { grain: 'range', pack_name: MONTHLY_ROLLUP, unique_users: 5, takes: 6 },
    { grain: 'range', pack_name: LIFETIME_ROLLUP, unique_users: 1, takes: 1 },
    { grain: 'range', pack_name: CLICKS_ROLLUP, unique_users: 20, takes: 0 },
    { grain: 'range', pack_name: 'yearly_coin_pack', unique_users: 3, takes: 3 },
    { grain: 'range', pack_name: 'yearly_coin_half_pack', unique_users: 1, takes: 1 },
    { grain: 'range', pack_name: 'yearly_coinzy_pack_trial', unique_users: 2, takes: 2 },
  ];
  const banknote = summarizePackRows(rows, 'banknote');
  assert.equal(banknote.unique_users, 10);
  assert.equal(banknote.yearly_users, 4);
  assert.equal(banknote.yearly_full_users, 5);
  assert.equal(banknote.yearly_half_users, 1);
  assert.equal(banknote.monthly_users, 5);
  assert.equal(banknote.lifetime_users, 1);
  assert.equal(banknote.clickers, 20);
  assert.equal(banknote.click_to_confirm_rate, 0.5);
  assert.equal(banknote.retries_per_user, 1.2);
  assert.equal(banknote.yearly_list_price, 22.99);
  assert.equal(banknote.yearly_net_share, 0.20);
  assert.equal(banknote.yearly_revenue, yearlyNetUsd(5, 'banknote'));
  assert.equal(banknote.yearly_half_revenue, yearlyNetUsd(1, 'banknote', 'yearly_offer'));

  const coinzy = summarizePackRows(rows, 'coinzy');
  assert.equal(coinzy.yearly_list_price, 29.99);
  assert.equal(coinzy.yearly_net_share, 0.15);
  assert.equal(coinzy.yearly_full_users, 5);
  assert.equal(coinzy.yearly_half_users, 1);
  assert.equal(coinzy.yearly_revenue, yearlyNetUsd(5, 'coinzy'));
  assert.equal(coinzy.yearly_half_revenue, yearlyNetUsd(1, 'coinzy', 'yearly_offer'));
  assert.equal(coinzy.monthly_users, 5);
  assert.equal(coinzy.full_users, 3);
  assert.equal(coinzy.half_users, 1);
  assert.equal(coinzy.trial_users, 2);

  assert.equal(isRollupPack(ALL_PACKS), true);
  assert.equal(isRollupPack(YEARLY_ROLLUP), true);
  assert.equal(isRollupPack(MONTHLY_ROLLUP), true);
  assert.equal(isRollupPack(LIFETIME_ROLLUP), true);
  assert.equal(isRollupPack(CLICKS_ROLLUP), true);
  assert.equal(isRollupPack('yearly_pro'), false);
  assert.equal(classifyPack('yearly_coin_pack', 'coinzy').kind, 'Yearly');
});

function sqlBody(rel) {
  const file = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'sql',
    ...rel.split('/'),
  );
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

test('Banknote daily signals confirm Subs_confirm only and Identify nav ∪ home', () => {
  const body = sqlBody('dashboard/product/banknote/16_product_daily_signals.sql');
  assert.match(body, /event_name_base = 'Subs_confirm'/);
  assert.match(body, /Identify_bottom_nav/);
  assert.match(body, /Identify_home/);
  assert.doesNotMatch(body, /paid_purchase/);
  assert.doesNotMatch(body, /trial_purchase/);
  assert.doesNotMatch(body, /subs_confirm/);
  assert.doesNotMatch(body, /free_scan_limit_exceeded/);
  assert.doesNotMatch(body, /Identification_screen/);
});

test('Coinzy daily signals use camera open and Coinzy confirms, not Subs_confirm', () => {
  const body = sqlBody('dashboard/product/coinzy/16_product_daily_signals.sql');
  assert.match(body, /Identification_screen/);
  assert.match(body, /subs_confirm/);
  assert.match(body, /paid_purchase/);
  assert.doesNotMatch(body, /'Subs_confirm'/);
  assert.doesNotMatch(body, /Identify_bottom_nav/);
});

test('Coinzy paywall SQL does not count Banknote Subs_confirm', () => {
  const body = sqlBody('dashboard/product/coinzy/05_paywall_conversion.sql');
  assert.match(body, /subs_confirm/);
  assert.doesNotMatch(body, /'Subs_confirm'/);
  assert.doesNotMatch(body, /subscription_shown/);
  assert.doesNotMatch(body, /Subs_page_onboarding/);
});

test('scheduled Coinzy signals use Identification_screen and Coinzy confirms', () => {
  const body = sqlBody('scheduled/coinzy/product_daily_signals.sql');
  assert.match(body, /Identification_screen/);
  assert.match(body, /subs_confirm/);
  assert.doesNotMatch(body, /'Subs_confirm'/);
  assert.doesNotMatch(body, /Identify_bottom_nav/);
});

test('scheduled Banknote signals confirm Subs_confirm only', () => {
  const body = sqlBody('scheduled/product_daily_signals.sql');
  assert.match(body, /event_name_base = 'Subs_confirm'/);
  assert.match(body, /Identify_bottom_nav/);
  assert.doesNotMatch(body, /paid_purchase/);
  assert.doesNotMatch(body, /free_scan_limit_exceeded/);
});

test('pack SQL keeps one person per day so confirm retries do not inflate unique_users', () => {
  for (const rel of [
    'dashboard/raw/18_subscription_packs.sql',
    'dashboard/product/banknote/18_subscription_packs.sql',
    'dashboard/product/coinzy/18_subscription_packs.sql',
  ]) {
    const body = sqlBody(rel);
    assert.match(body, /GROUP BY event_date, uid/);
    assert.match(body, /confirm_taps/);
    assert.match(body, /COUNT\(DISTINCT uid\) AS unique_users/);
    assert.match(body, /SUM\(confirm_taps\) AS takes/);
  }
});

test('paywall conversion rate uses unique confirmers, not raw Subs_confirm taps', () => {
  for (const rel of [
    'dashboard/product/banknote/05_paywall_conversion.sql',
    'dashboard/product/coinzy/05_paywall_conversion.sql',
    'dashboard/product/banknote/16_product_daily_signals.sql',
    'dashboard/product/coinzy/16_product_daily_signals.sql',
  ]) {
    const body = sqlBody(rel);
    const rate = body.split('AS paywall_to_confirm_rate')[0].split('SAFE_DIVIDE').pop();
    assert.ok(rate, rel);
    assert.match(rate, /COUNT\(DISTINCT/);
    assert.doesNotMatch(rate, /COUNTIF/);
  }
});
