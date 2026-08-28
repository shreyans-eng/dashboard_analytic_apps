/**
 * Build docs/QUERIES-BY-TAB.pdf from the real SQL each tab runs.
 * Usage: node scripts/render-queries-pdf.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { applyDauSqlPlaceholders } from '../banknote-analytics-dashboard/server/services/analytics/dau-definition.js';
import {
  getFunnelSteps,
  buildFunnelSql,
} from '../banknote-analytics-dashboard/server/services/analytics/funnel-registry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SQL = path.join(ROOT, 'sql');

function readSql(rel) {
  const full = path.join(SQL, rel);
  let text = fs.readFileSync(full, 'utf8');
  text = applyDauSqlPlaceholders(text);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sqlBlock(sql) {
  const lines = escapeHtml(sql).split('\n');
  return `<div class="sql">${lines.map((ln) => `<div>${ln || '&nbsp;'}</div>`).join('')}</div>`;
}

function section(title, note, blocks) {
  const parts = [`<h2>${escapeHtml(title)}</h2>`];
  if (note) parts.push(`<p class="note">${note}</p>`);
  for (const b of blocks) {
    if (b.label) parts.push(`<h3>${escapeHtml(b.label)}</h3>`);
    if (b.file) parts.push(`<p class="file">${escapeHtml(b.file)}</p>`);
    if (b.note) parts.push(`<p>${b.note}</p>`);
    if (b.sql) parts.push(sqlBlock(b.sql));
  }
  return parts.join('\n');
}

function funnelSql(funnelId, productId) {
  const mapped = getFunnelSteps(funnelId, productId);
  if (!mapped || mapped.status !== 'ok') {
    return `-- no mapping for ${funnelId} / ${productId}`;
  }
  return buildFunnelSql('{PROJECT}', '{DATASET}', mapped.steps, 'YYYY-MM-DD', 'YYYY-MM-DD');
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Dashboard queries — actual SQL</title>
<style>
  @page { size: A4; margin: 12mm 10mm 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         font-size: 10pt; line-height: 1.4; color: #111; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 6pt; }
  h2 { font-size: 13pt; margin: 16pt 0 8pt; padding-bottom: 3pt;
       border-bottom: 1.5px solid #111; page-break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 12pt; }
  .note { background: #f4f4f5; border-left: 3px solid #4f8cff; padding: 7pt 9pt; margin: 8pt 0; }
  .file { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8pt;
          color: #4b5563; margin: 0 0 4pt; }
  .sql { background: #111827; color: #e5e7eb; font-family: ui-monospace, Menlo, Consolas, monospace;
        font-size: 7.2pt; line-height: 1.38; padding: 8pt 9pt; margin: 0 0 12pt; }
  .sql div { white-space: pre-wrap; word-break: break-word; min-height: 1em; }
  ul { margin: 0 0 10pt; padding-left: 18pt; }
  li { margin: 0 0 3pt; }
</style>
</head>
<body>
<h1>Dashboard queries — actual SQL</h1>
<p class="meta">Banknote &amp; Coinzy · every tab’s working query (events already expanded).
Placeholders: <code>{PROJECT}</code> <code>{DATASET}</code> <code>{{start_date}}</code> <code>{{end_date}}</code>.
<code>[[AND …]]</code> is added only when country/platform is filtered.</p>
<p class="note">Live order: summary table if refreshed → this SQL. Home / Product Analytics do not query BigQuery.</p>
<ul>
  <li><strong>DAU events:</strong> session_start, App_open, first_open</li>
  <li><strong>User id:</strong> real GA4 user_id → param user_id (skip anonymous) → user_pseudo_id</li>
  <li><strong>Event names:</strong> _android / _ios suffix stripped before matching</li>
</ul>

${section('Compare Apps · Health report',
  'One query per app, then tagged. This is also the source for most MVP rate charts when the summary exists.',
  [
    {
      label: 'Banknote (shared raw) — product_daily_signals',
      file: 'sql/dashboard/raw/16_product_daily_signals.sql',
      sql: readSql('dashboard/raw/16_product_daily_signals.sql'),
    },
    {
      label: 'Coinzy override — product_daily_signals',
      file: 'sql/dashboard/product/coinzy/16_product_daily_signals.sql',
      sql: readSql('dashboard/product/coinzy/16_product_daily_signals.sql'),
    },
  ])}

${section('1. DAU (opened app)',
  'MVP tab + Explorer Daily Active Users. Same events for both apps.',
  [
    {
      label: 'Query',
      file: 'sql/dashboard/product/01_dau.sql  ·  sql/dashboard/raw/01_dau.sql',
      sql: readSql('dashboard/product/01_dau.sql'),
    },
  ])}

${section('2. Install → first scan',
  'Never uses product_daily_signals. Join is user_pseudo_id only, same calendar day.',
  [
    {
      label: 'Banknote',
      file: 'sql/dashboard/product/banknote/02_time_to_first_scan.sql',
      sql: readSql('dashboard/product/banknote/02_time_to_first_scan.sql'),
    },
    {
      label: 'Coinzy',
      file: 'sql/dashboard/product/coinzy/02_time_to_first_scan.sql',
      sql: readSql('dashboard/product/coinzy/02_time_to_first_scan.sql'),
    },
  ])}

${section('3. Identify success',
  'Rate = success events ÷ (success + failure events).',
  [
    {
      label: 'Coinzy (raw events_*)',
      file: 'sql/dashboard/product/coinzy/03_identify_success_rate.sql',
      sql: readSql('dashboard/product/coinzy/03_identify_success_rate.sql'),
    },
    {
      label: 'Banknote — view the product SQL reads (event matching)',
      file: 'sql/08_v_identify_metrics.sql  (dashboard/product/03_identify_success_rate.sql selects from this view)',
      sql: readSql('08_v_identify_metrics.sql'),
    },
  ])}

${section('4. Quota hit',
  'Users who hit scan quota ÷ users who attempted a scan. Not collection limit.',
  [
    {
      label: 'Banknote',
      file: 'sql/dashboard/product/banknote/04_quota_hit_rate.sql',
      sql: readSql('dashboard/product/banknote/04_quota_hit_rate.sql'),
    },
    {
      label: 'Coinzy',
      file: 'sql/dashboard/product/coinzy/04_quota_hit_rate.sql',
      sql: readSql('dashboard/product/coinzy/04_quota_hit_rate.sql'),
    },
  ])}

${section('5. Paywall → purchase',
  'Confirm events ÷ paywall events. Banknote confirm is Subs_confirm; Coinzy is subs_confirm / paid_purchase.',
  [
    {
      label: 'Coinzy (raw events_*)',
      file: 'sql/dashboard/product/coinzy/05_paywall_conversion.sql',
      sql: readSql('dashboard/product/coinzy/05_paywall_conversion.sql'),
    },
    {
      label: 'Banknote — view the product SQL reads',
      file: 'sql/07_v_subscription_metrics.sql',
      sql: readSql('07_v_subscription_metrics.sql'),
    },
  ])}

${section('6. D1 / D7 retention',
  'Cohort = first_open. Returned = any Firebase event on D+1 / D+7. Same SQL for MVP 6 and Explorer D1/D7 (merged).',
  [
    {
      label: 'Query',
      file: 'sql/dashboard/raw/09_retention.sql',
      sql: readSql('dashboard/raw/09_retention.sql'),
    },
  ])}

${section('7. Scans / user  ·  9. Catalogue  ·  10. Marketplace',
  'When signals miss: Coinzy uses dedicated raw SQL. Banknote reads v_engagement_metrics (included once).',
  [
    {
      label: 'Coinzy — scans / user',
      file: 'sql/dashboard/product/coinzy/07_scans_per_user.sql',
      sql: readSql('dashboard/product/coinzy/07_scans_per_user.sql'),
    },
    {
      label: 'Coinzy — catalogue',
      file: 'sql/dashboard/product/coinzy/09_catalogue_engagement.sql',
      sql: readSql('dashboard/product/coinzy/09_catalogue_engagement.sql'),
    },
    {
      label: 'Coinzy — marketplace (Feed is a separate column, not mixed into marketplace rate)',
      file: 'sql/dashboard/product/coinzy/10_marketplace_engagement.sql',
      sql: readSql('dashboard/product/coinzy/10_marketplace_engagement.sql'),
    },
    {
      label: 'Banknote — view for scans / catalogue / marketplace',
      file: 'sql/10_v_engagement_metrics.sql',
      sql: readSql('10_v_engagement_metrics.sql'),
    },
  ])}

${section('8. Identify funnel (open → success rate chart)',
  'This tab is the daily rate. Step drop-off is the Identify funnel pages (next section).',
  [
    {
      label: 'Coinzy',
      file: 'sql/dashboard/product/coinzy/08_identify_funnel_conversion.sql',
      sql: readSql('dashboard/product/coinzy/08_identify_funnel_conversion.sql'),
    },
    {
      label: 'Banknote',
      file: 'sql/dashboard/product/08_identify_funnel_conversion.sql → v_identify_metrics (see section 3)',
      note: 'Banknote product SQL selects users_identify_open / users_success from <code>v_identify_metrics</code> (full view SQL is in section 3).',
      sql: readSql('dashboard/product/08_identify_funnel_conversion.sql'),
    },
  ])}

${section('Funnels — Identify (all)',
  'Generated in funnel-registry.js (not a .sql file). One events_* scan. Distinct users per step. <code>YYYYMMDD</code> in _TABLE_SUFFIX is replaced by the dashboard date filter.<br><br><strong>Scan · bottom nav</strong> is this same query with entry events = <code>Identify_bottom_nav</code> only.<br><strong>Scan · home / banner</strong> is this same query with entry events = <code>Identify_home</code> only.',
  [
    { label: 'Banknote', sql: funnelSql('identify', 'banknote') },
    { label: 'Coinzy', sql: funnelSql('identify', 'coinzy') },
  ])}

${section('Funnels — Catalogue · Collection · Global · Marketplace · Feed · Paywall · Expert',
  'Each tab is its own generated query. Marketplace excludes Feed. Expert is Coinzy only.',
  [
    { label: 'Banknote · catalogue (all)', sql: funnelSql('catalogue', 'banknote') },
    { label: 'Coinzy · catalogue (all)', sql: funnelSql('catalogue', 'coinzy') },
    { label: 'Banknote · private collection', sql: funnelSql('collection', 'banknote') },
    { label: 'Coinzy · private collection', sql: funnelSql('collection', 'coinzy') },
    { label: 'Banknote · global catalogue', sql: funnelSql('global', 'banknote') },
    { label: 'Coinzy · global catalogue', sql: funnelSql('global', 'coinzy') },
    { label: 'Banknote · marketplace', sql: funnelSql('marketplace', 'banknote') },
    { label: 'Coinzy · marketplace', sql: funnelSql('marketplace', 'coinzy') },
    { label: 'Banknote · feed', sql: funnelSql('feed', 'banknote') },
    { label: 'Coinzy · feed', sql: funnelSql('feed', 'coinzy') },
    { label: 'Banknote · paywall', sql: funnelSql('paywall', 'banknote') },
    { label: 'Coinzy · paywall', sql: funnelSql('paywall', 'coinzy') },
    { label: 'Coinzy · expert evaluation', sql: funnelSql('expert', 'coinzy') },
  ])}

${section('Event inventory',
  'Built in funnel-registry.js. List prefers analytics_summary.top_events; click-through is always raw.',
  [
    {
      label: 'List events (raw fallback)',
      sql: `SELECT
  REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name,
  COUNT(*) AS hits,
  COUNT(DISTINCT COALESCE(
    IF(user_id IS NULL OR TRIM(user_id) = '' OR LOWER(TRIM(user_id)) IN ('anonymous','null','undefined','(not set)','(anonymous)'), NULL, TRIM(user_id)),
    user_pseudo_id
  )) AS unique_users,
  MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
  MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen
FROM \`{PROJECT}.{DATASET}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}}) AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\\\d{8}$')
GROUP BY event_name
ORDER BY hits DESC
LIMIT 500`,
    },
  ])}

${section('Explorer — Unique vs repeat',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/19_user_mix.sql', sql: readSql('dashboard/raw/19_user_mix.sql') }])}

${section('Explorer — Monthly Active Users',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/02_mau.sql', sql: readSql('dashboard/raw/02_mau.sql') }])}

${section('Explorer — New Users',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/03_new_users.sql', sql: readSql('dashboard/raw/03_new_users.sql') }])}

${section('Explorer — Installs + time used',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/20_install_day_usage.sql', sql: readSql('dashboard/raw/20_install_day_usage.sql') }])}

${section('Explorer — Scan limits',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/21_scan_limits.sql', sql: readSql('dashboard/raw/21_scan_limits.sql') }])}

${section('Explorer — Top Countries',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/04_countries.sql', sql: readSql('dashboard/raw/04_countries.sql') }])}

${section('Explorer — Platform',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/08_platform.sql', sql: readSql('dashboard/raw/08_platform.sql') }])}

${section('Explorer — Top Events',
  '',
  [{ label: 'Query', file: 'sql/dashboard/raw/07_top_events.sql', sql: readSql('dashboard/raw/07_top_events.sql') }])}

${section('Explorer — Cohort LTV (emergency BigQuery only)',
  'Normal path is Mongo cohort_ltv (no BigQuery on click). This SQL is used only for LTV_FORCE_RAW / empty Mongo fallback.',
  [{ label: 'Query', file: 'sql/dashboard/raw/10_cohort_ltv.sql', sql: readSql('dashboard/raw/10_cohort_ltv.sql') }])}

</body>
</html>
`;

const htmlPath = path.join(ROOT, 'docs', '_queries-sql.html');
const pdfPath = path.join(ROOT, 'docs', 'QUERIES-BY-TAB.pdf');
fs.writeFileSync(htmlPath, html);

const brave = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const r = spawnSync(brave, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--virtual-time-budget=30000',
  `--print-to-pdf=${pdfPath}`,
  `file://${htmlPath}`,
], { encoding: 'utf8' });

if (r.status !== 0) {
  console.error(r.stderr || r.stdout || 'Brave print failed');
  process.exit(r.status || 1);
}

const st = fs.statSync(pdfPath);
console.log(`Wrote ${pdfPath} (${Math.round(st.size / 1024)} KB)`);
fs.unlinkSync(htmlPath);
