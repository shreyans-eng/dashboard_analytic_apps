/**
 * DAU (app_open_dau) = unique users/devices that opened the app or started a session that day.
 *
 * Qualifying events (suffix-stripped): session_start, App_open, first_open.
 * notification_dau is a separate series (notification_display and related push events).
 * any_event_dau = anyone who fired any Firebase event that day.
 * The dashboard field `dau` is always app_open_dau (never notifications).
 *
 * Identity: GA4 user_id, then event param user_id, then user_pseudo_id.
 * Placeholder values such as "anonymous" are skipped so they cannot collapse
 * many devices into one fake user.
 */

export const DAU_EVENT_BASES = Object.freeze(['session_start', 'App_open', 'first_open']);

/**
 * Push delivery / display / tap — not in-app permission or onboarding screens.
 * These are tracked as notification_dau and are never counted as app-open DAU.
 */
export const NOTIFICATION_EVENT_BASES = Object.freeze([
  'notification_display',
  'notification_receive',
  'notification_foreground',
  'notification_open',
  'notification_opened',
  'notification_dismiss',
  'notification_interact',
]);

export const IDENTITY_PLACEHOLDERS = Object.freeze([
  'anonymous',
  'null',
  'undefined',
  '(not set)',
  '(anonymous)',
]);

function asString(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function isPlaceholderUserId(value) {
  const s = asString(value);
  if (!s) return true;
  return IDENTITY_PLACEHOLDERS.includes(s.toLowerCase());
}

export function eventNameBase(eventName) {
  return String(eventName || '').replace(/_(android|ios)$/i, '');
}

export function isDauEvent(eventName) {
  return DAU_EVENT_BASES.includes(eventNameBase(eventName));
}

export function isNotificationEvent(eventName) {
  return NOTIFICATION_EVENT_BASES.includes(eventNameBase(eventName));
}

/**
 * Stable daily identity already present in the Firebase export.
 * Does not invent IDs. Falls back to user_pseudo_id (device) when no real user_id exists.
 */
export function resolveUserId({ user_id, param_user_id, user_pseudo_id } = {}) {
  if (!isPlaceholderUserId(user_id)) return asString(user_id);
  if (!isPlaceholderUserId(param_user_id)) return asString(param_user_id);
  const device = asString(user_pseudo_id);
  return device || null;
}

export function hasDimensionFilter(params = {}) {
  return Boolean(asString(params.country) || asString(params.platform));
}

/** Summary product_daily_signals is date-only — skip it when country/platform is set. */
export function shouldUseSummaryForDau(params = {}) {
  return !hasDimensionFilter(params);
}

export function isCompleteExportDate(eventDate, latestCompleteDate) {
  if (!eventDate || !latestCompleteDate) return false;
  return String(eventDate).slice(0, 10) <= String(latestCompleteDate).slice(0, 10);
}

export function requestedRangeHasIncompleteDates(endDate, latestCompleteDate) {
  if (!endDate || !latestCompleteDate) return false;
  return String(endDate).slice(0, 10) > String(latestCompleteDate).slice(0, 10);
}

/**
 * Drop rows after the latest complete Firebase daily export.
 * Never invents zero-DAU rows for missing/incomplete dates.
 */
export function clipRowsToCompleteExport(rows, dateKey, latestCompleteDate) {
  if (!Array.isArray(rows)) return [];
  if (!latestCompleteDate) return rows.slice();
  return rows.filter((row) => {
    const value = row?.[dateKey];
    const date = value?.value ?? value;
    if (date == null || date === '') return true;
    return isCompleteExportDate(String(date), latestCompleteDate);
  });
}

export function computeDailyDau(events, { country, platform } = {}) {
  const byDate = new Map();
  for (const event of events || []) {
    if (country && event.country !== country) continue;
    if (platform && String(event.platform || '').toLowerCase() !== String(platform).toLowerCase()) {
      continue;
    }
    if (!isDauEvent(event.event_name)) continue;
    const id = resolveUserId(event);
    if (!id) continue;
    const day = String(event.event_date);
    if (!byDate.has(day)) byDate.set(day, new Set());
    byDate.get(day).add(id);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([event_date, users]) => ({ event_date, dau: users.size }));
}

function placeholderSqlList() {
  return IDENTITY_PLACEHOLDERS.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

export function resolvedUserIdSql({ cheap = false } = {}) {
  const invalid = placeholderSqlList();
  const ga4 = `IF(user_id IS NULL OR TRIM(user_id) = '' OR LOWER(TRIM(user_id)) IN (${invalid}), NULL, TRIM(user_id))`;
  const param = cheap
    ? 'NULL'
    : `(SELECT TRIM(ep.value.string_value)
        FROM UNNEST(event_params) ep
        WHERE ep.key = 'user_id'
          AND ep.value.string_value IS NOT NULL
          AND TRIM(ep.value.string_value) != ''
          AND LOWER(TRIM(ep.value.string_value)) NOT IN (${invalid})
        LIMIT 1)`;
  return `COALESCE(${ga4}, ${param}, user_pseudo_id)`;
}

export function dauEventPredicateSql(eventNameCol = 'event_name') {
  const list = DAU_EVENT_BASES.map((n) => `'${n}'`).join(', ');
  return `REGEXP_REPLACE(${eventNameCol}, r'_(android|ios)$', '') IN (${list})`;
}

export function dauEventBasePredicateSql(baseCol = 'event_name_base') {
  const list = DAU_EVENT_BASES.map((n) => `'${n}'`).join(', ');
  return `${baseCol} IN (${list})`;
}

export function notificationEventPredicateSql(eventNameCol = 'event_name') {
  const list = NOTIFICATION_EVENT_BASES.map((n) => `'${n}'`).join(', ');
  return `REGEXP_REPLACE(${eventNameCol}, r'_(android|ios)$', '') IN (${list})`;
}

export function notificationEventBasePredicateSql(baseCol = 'event_name_base') {
  const list = NOTIFICATION_EVENT_BASES.map((n) => `'${n}'`).join(', ');
  return `${baseCol} IN (${list})`;
}

export function applyDauSqlPlaceholders(sql) {
  if (!sql) return sql;
  return sql
    .replaceAll('{{resolved_user_id}}', () => resolvedUserIdSql({ cheap: false }))
    .replaceAll('{{resolved_user_id_cheap}}', () => resolvedUserIdSql({ cheap: true }))
    .replaceAll('{{dau_event_predicate}}', () => dauEventPredicateSql('event_name'))
    .replaceAll('{{dau_event_predicate_base}}', () => dauEventBasePredicateSql('event_name_base'))
    .replaceAll('{{notification_event_predicate}}', () => notificationEventPredicateSql('event_name'))
    .replaceAll(
      '{{notification_event_predicate_base}}',
      () => notificationEventBasePredicateSql('event_name_base'),
    );
}
