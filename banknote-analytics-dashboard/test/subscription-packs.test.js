import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ALL_PACKS,
  YEARLY_LIST_PRICE,
  YEARLY_ROLLUP,
  isRollupPack,
  summarizePackRows,
  yearlyListPrice,
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

test('yearly list price is Banknote $20 and Coinzy $15', () => {
  assert.equal(YEARLY_LIST_PRICE.banknote, 20);
  assert.equal(YEARLY_LIST_PRICE.coinzy, 15);
  assert.equal(yearlyListPrice('banknote'), 20);
  assert.equal(yearlyListPrice('coinzy'), 15);
  assert.equal(yearlyListPrice('unknown'), null);
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
  assert.doesNotMatch(body, /in_app_purchase/);
  assert.doesNotMatch(body, /subscription_tier/);
});

test('Banknote pack SQL uses Subs_confirm and attributes pack from Subs_pack', () => {
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
  assert.match(body, /event_name_base = 'Subs_confirm'/);
  assert.match(body, /Subs_pack/);
  assert.match(body, /pack_clicks/);
  assert.doesNotMatch(body, /paid_purchase/);
  assert.doesNotMatch(body, /in_app_purchase/);
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

test('summarizePackRows uses yearly unique people times list price', () => {
  const rows = [
    { grain: 'range', pack_name: ALL_PACKS, unique_users: 10, takes: 12 },
    { grain: 'range', pack_name: YEARLY_ROLLUP, unique_users: 4, takes: 4 },
  ];
  const banknote = summarizePackRows(rows, 'banknote');
  assert.equal(banknote.unique_users, 10);
  assert.equal(banknote.yearly_users, 4);
  assert.equal(banknote.yearly_list_price, 20);
  assert.equal(banknote.yearly_revenue, 80);

  const coinzy = summarizePackRows(rows, 'coinzy');
  assert.equal(coinzy.yearly_list_price, 15);
  assert.equal(coinzy.yearly_revenue, 60);

  assert.equal(isRollupPack(ALL_PACKS), true);
  assert.equal(isRollupPack(YEARLY_ROLLUP), true);
  assert.equal(isRollupPack('yearly_pro'), false);
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
