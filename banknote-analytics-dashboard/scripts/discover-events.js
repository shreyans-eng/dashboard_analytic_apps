#!/usr/bin/env node
/**
 * Automatic Firebase event discovery for a product.
 * Writes inventory JSON under analytics-inventory/ (gitignored).
 * Does not create KPI summary tables (inventory ≠ KPIs).
 *
 * Usage:
 *   PRODUCT=coinzy node scripts/discover-events.js
 *   PRODUCT=banknote DAYS=30 node scripts/discover-events.js
 *   PRODUCT=coinzy FULL=1 node scripts/discover-events.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, '..', 'analytics-inventory');

dotenv.config({ path: path.join(ROOT, '.env') });

const BUILTIN = {
  banknote: {
    project: process.env.GCP_PROJECT || 'banknote-app-4f3fd',
    dataset: process.env.BQ_DATASET || 'analytics_488476338',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  coinzy: {
    project: process.env.COINZY_GCP_PROJECT || 'coinzy-26a4d',
    dataset: process.env.COINZY_BQ_DATASET || 'analytics_487601380',
    credentials: process.env.COINZY_GOOGLE_APPLICATION_CREDENTIALS,
  },
};

/** Preferred + alias names from authoritative repo SQL/docs (not invented). */
const DOCUMENTED_KPI_EVENTS = [
  'first_open',
  'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
  'Identify_open', 'Identify', 'identify_open', 'Identification_open', 'camera_opened',
  'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked',
  'photo_uploaded_1', 'photo_uploaded_2',
  'photo_screen', 'photo_submit_button', 'photos_submitted',
  'Camera_permission_popup', 'camera_permission_granted',
  'camer_permission_denied', 'camera_permission_denied',
  'photo_cropping_screen_0', 'photo_cropping_screen_1', 'photo_cropping_screen_2',
  'photo_crop_tick_0', 'photo_crop_tick_1', 'photo_crop_tick_2',
  'identification_view_all', 'identification_all_options_screen',
  'idetnification_option_chosen', 'identification_details_screen',
  'identiifcation_limit_exceeded',
  'identification_done_success', 'Identification_done_success',
  'identification_done_failure', 'Identification_done_failure',
  'Identification_done',
  'Identified_limit_reached', 'identified_limit_reached', 'scan_quota_exhausted', 'limit_exceeded',
  'free_scan_limit_exceeded', 'free_scan_blocked',
  'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
  'Subs_page', 'Subs_page_discount', 'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
  'Collection_screen', 'Global_catalogue_screen',
  'Collection_open', 'collection_open', 'Collection', 'My_collection',
  'Collection_detail', 'banknote_detail', 'coin_detail',
  'Coin_details', 'Coin_details_collection', 'Coin_details_global',
  'marketplace_screen', 'market_item_expolre', 'market_contact', 'market_contact_button',
  'Marketplace_open', 'marketplace_open', 'Market_open', 'Listing_view', 'listing_view', 'contact_seller',
  'Feed_screen', 'feed_like', 'feed_comment', 'feed_add',
  'expert_evaluation_landing', 'expert_evaluations_list', 'expert_evaluation_start',
  'expert_evaluation_buy_credits', 'expert_evaluation_view_all', 'expert_evaluation_item_click',
  'expert_upload_photos', 'expert_upload_continue_with_credit', 'expert_upload_continue_payment',
  'expert_request_queued', 'expert_evaluation_status', 'expert_book_new_evaluation',
  'expert_book_new_evaluation_created', 'expert_outbox_retry', 'expert_outbox_retry_after_credits',
  'expert_request_retry_started', 'expert_refund_requested',
  'expert_status_buy_credits_continue_payment', 'expert_buy_credits_continue_payment',
  'expert_token_purchase_received', 'expert_token_purchase_pending', 'expert_token_purchase_cancelled',
  'expert_token_purchase_failed', 'expert_token_purchase_consumed', 'expert_token_verification_failed',
  'expert_evaluation_report', 'expert_rating_submitted',
  'expert_report_pdf_download', 'expert_report_pdf_share', 'expert_report_pdf_failed',
];

function resolveCred(rel) {
  if (!rel) return null;
  const p = path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel);
  return fs.existsSync(p) ? p : null;
}

async function q(bq, sql) {
  const [job] = await bq.createQueryJob({ query: sql, location: 'US' });
  const [rows] = await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  return {
    rows,
    bytes: Number(metadata.statistics?.query?.totalBytesProcessed || 0),
  };
}

function serialize(rows) {
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      o[k] = v && typeof v === 'object' && 'value' in v ? v.value : v;
    }
    return o;
  });
}

async function main() {
  const productId = (process.env.PRODUCT || 'coinzy').toLowerCase();
  const cfg = BUILTIN[productId];
  if (!cfg) throw new Error(`Unknown PRODUCT=${productId}`);

  const keyFilename = resolveCred(cfg.credentials);
  if (!keyFilename) throw new Error(`Missing credentials for ${productId}`);

  const bq = new BigQuery({ projectId: cfg.project, keyFilename });
  const P = cfg.project;
  const D = cfg.dataset;
  const days = Number(process.env.DAYS || 30);
  const full = ['1', 'true', 'yes'].includes(String(process.env.FULL || '').toLowerCase());

  console.log(`Discovering ${productId} → ${P}.${D}`);

  const meta = await q(
    bq,
    `
    SELECT
      COUNT(*) AS events_table_count,
      MIN(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS earliest_date,
      MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest_date,
      SUM(row_count) AS sum_table_row_counts
    FROM \`${P}.${D}.__TABLES__\`
    WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
  `,
  );

  const m = serialize(meta.rows)[0] || {};
  console.log('Tables:', m);

  // Gaps
  const gaps = await q(
    bq,
    `
    WITH dates AS (
      SELECT PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})')) AS d
      FROM \`${P}.${D}.__TABLES__\`
      WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
    ),
    bounds AS (SELECT MIN(d) AS mn, MAX(d) AS mx FROM dates),
    expected AS (
      SELECT day FROM bounds, UNNEST(GENERATE_DATE_ARRAY(mn, mx)) AS day
    )
    SELECT COUNT(*) AS missing_days
    FROM expected e LEFT JOIN dates d ON e.day = d.d
    WHERE d.d IS NULL
  `,
  );

  let inventorySql;
  if (full) {
    inventorySql = `
      SELECT
        event_name,
        COUNT(*) AS event_count,
        COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS unique_users,
        MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
        MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen
      FROM \`${P}.${D}.events_*\`
      WHERE REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
      GROUP BY event_name
      ORDER BY event_count DESC
    `;
  } else {
    inventorySql = `
      WITH bounds AS (
        SELECT MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest
        FROM \`${P}.${D}.__TABLES__\`
        WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
      )
      SELECT
        event_name,
        COUNT(*) AS event_count,
        COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS unique_users,
        MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
        MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen
      FROM \`${P}.${D}.events_*\`, bounds
      WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(latest, INTERVAL ${days - 1} DAY))
                              AND FORMAT_DATE('%Y%m%d', latest)
        AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
      GROUP BY event_name
      ORDER BY event_count DESC
    `;
  }

  const inventory = await q(bq, inventorySql);
  const events = serialize(inventory.rows);
  console.log(`Event names: ${events.length} (bytes ${(inventory.bytes / 1e6).toFixed(1)} MB)`);

  const aliasList = DOCUMENTED_KPI_EVENTS.map((e) => `'${e}'`).join(',');
  const mapped = await q(
    bq,
    `
    SELECT event_name, COUNT(*) AS event_count,
      COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS unique_users,
      MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
      MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen
    FROM \`${P}.${D}.events_*\`
    WHERE REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
      AND event_name IN UNNEST([${aliasList}])
    GROUP BY event_name
    ORDER BY event_count DESC
  `,
  );

  const present = new Set(serialize(mapped.rows).map((r) => r.event_name));
  const documentedPresent = DOCUMENTED_KPI_EVENTS.filter((e) => present.has(e));
  const documentedMissing = DOCUMENTED_KPI_EVENTS.filter((e) => !present.has(e));
  const bqOnlySample = events
    .map((e) => e.event_name)
    .filter((n) => !DOCUMENTED_KPI_EVENTS.includes(n))
    .slice(0, 50);

  // Parameter inventory for top KPI event if present
  let parameters = [];
  if (present.has('identification_done_success')) {
    const params = await q(
      bq,
      `
      WITH bounds AS (
        SELECT MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest
        FROM \`${P}.${D}.__TABLES__\`
        WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
      )
      SELECT
        ep.key AS parameter_name,
        CASE
          WHEN ep.value.string_value IS NOT NULL THEN 'string'
          WHEN ep.value.int_value IS NOT NULL THEN 'int'
          WHEN ep.value.float_value IS NOT NULL THEN 'float'
          WHEN ep.value.double_value IS NOT NULL THEN 'double'
          ELSE 'other'
        END AS parameter_type,
        ANY_VALUE(COALESCE(
          ep.value.string_value,
          CAST(ep.value.int_value AS STRING),
          CAST(ep.value.float_value AS STRING),
          CAST(ep.value.double_value AS STRING)
        )) AS example_value,
        COUNT(*) AS occurrence_count
      FROM \`${P}.${D}.events_*\` e, UNNEST(event_params) ep, bounds
      WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(latest, INTERVAL 6 DAY))
                              AND FORMAT_DATE('%Y%m%d', latest)
        AND event_name = 'identification_done_success'
      GROUP BY 1, 2
      ORDER BY occurrence_count DESC
      LIMIT 50
    `,
    );
    parameters = serialize(params.rows);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(OUT_DIR, `${productId}-events-${stamp}.json`);
  const payload = {
    product: productId,
    project: P,
    dataset: D,
    discoveredAt: new Date().toISOString(),
    window: full ? 'full' : `last_${days}_days_of_available_data`,
    tables: m,
    missingDays: serialize(gaps.rows)[0],
    uniqueEventNamesInWindow: events.length,
    eventInventory: events,
    documentedKpiEvents: {
      present: documentedPresent,
      missing: documentedMissing,
      presenceCounts: serialize(mapped.rows),
    },
    bigqueryEventsWithoutDocPreferredNameSample: bqOnlySample,
    parameterInventorySample: {
      event_name: 'identification_done_success',
      parameters,
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(`Documented present: ${documentedPresent.length}, missing: ${documentedMissing.length}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
