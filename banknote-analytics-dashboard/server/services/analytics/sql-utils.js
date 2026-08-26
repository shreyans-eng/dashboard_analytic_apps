import fs from 'fs';
import path from 'path';

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

/** Replace {{var}} placeholders and project/dataset tokens */
export function prepareSql(rawSql, params = {}, config = {}) {
  const { project, dataset, summaryDataset } = config;

  let sql = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const startDate = params.start_date || daysAgo(params.days || 30);
  const endDate = params.end_date || today();
  const country = params.country || '';
  const platform = params.platform || '';
  const allowedChannels = ['Organic', 'Paid', 'Direct'];
  const installChannel = allowedChannels.includes(String(params.install_channel || ''))
    ? String(params.install_channel)
    : '';

  sql = sql
    .replace(/\{PROJECT\}/g, project)
    .replace(/\{DATASET\}/g, dataset)
    .replace(/\{SUMMARY_DATASET\}/g, summaryDataset);

  sql = sql.replace(/\{\{start_date\}\}/g, `DATE '${startDate}'`);
  sql = sql.replace(/\{\{end_date\}\}/g, `DATE '${endDate}'`);

  const eventCountryExpr =
    `COALESCE(` +
    `NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'country'), ''), ` +
    `NULLIF(geo.country, ''), ` +
    `'Unknown')`;

  const countryPatterns = [
    [/\[\[AND country = \{\{country\}\}\]\]/g, `AND country = '${escapeSql(country)}'`],
    [/\[\[AND first_country = \{\{country\}\}\]\]/g, `AND first_country = '${escapeSql(country)}'`],
    // Raw events_* tables (Firebase export)
    [/\[\[AND event_country = \{\{country\}\}\]\]/g, `AND ${eventCountryExpr} = '${escapeSql(country)}'`],
  ];
  const platformPatterns = [
    [/\[\[AND platform = \{\{platform\}\}\]\]/g, `AND platform = '${escapeSql(platform)}'`],
    [/\[\[AND first_platform = \{\{platform\}\}\]\]/g, `AND first_platform = '${escapeSql(platform)}'`],
    [/\[\[AND event_platform = \{\{platform\}\}\]\]/g,
      `AND LOWER(COALESCE(device.operating_system, platform, 'unknown')) = '${escapeSql(platform.toLowerCase())}'`],
  ];

  for (const [pattern, replacement] of countryPatterns) {
    sql = sql.replace(pattern, country ? replacement : '');
  }
  for (const [pattern, replacement] of platformPatterns) {
    sql = sql.replace(pattern, platform ? replacement : '');
  }

  sql = sql.replace(
    /\[\[AND install_channel = \{\{install_channel\}\}\]\]/g,
    installChannel ? `AND install_channel = '${escapeSql(installChannel)}'` : '',
  );

  return sql.trim();
}

export function readSqlFile(sqlRoot, relativePath) {
  const full = path.join(sqlRoot, relativePath);
  if (!fs.existsSync(full)) throw new Error(`SQL file not found: ${relativePath}`);
  return fs.readFileSync(full, 'utf8');
}

export function isMissingTableError(err) {
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist');
}
