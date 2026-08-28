import { ensureDb, mongoConfigured } from './db.js';
import { listUsers } from './users.js';
import { canAccessProduct, productLabel } from './access.js';
import { sendMail, smtpConfigured, smtpStatus } from './mailer.js';

const SETTINGS_ID = 'monthly_reports';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function previousMonthRange(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start_date: isoDate(start), end_date: isoDate(end), key, label };
}

async function settingsCol() {
  const db = await ensureDb();
  return db.collection('settings');
}

export async function getReportSettings() {
  const extraFromEnv = String(process.env.REPORT_EMAIL || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!mongoConfigured()) {
    return {
      enabled: true,
      sendToUsers: true,
      extraRecipients: extraFromEnv,
      lastSentKey: null,
      lastSentAt: null,
      smtp: smtpStatus(),
    };
  }
  const col = await settingsCol();
  const doc = await col.findOne({ _id: SETTINGS_ID });
  const extra = [...new Set([
    ...(doc?.extraRecipients || []),
    ...extraFromEnv,
  ])];
  return {
    enabled: doc?.enabled !== false,
    sendToUsers: doc?.sendToUsers !== false,
    extraRecipients: extra,
    lastSentKey: doc?.lastSentKey || null,
    lastSentAt: doc?.lastSentAt || null,
    smtp: smtpStatus(),
  };
}

export async function saveReportSettings(patch) {
  const col = await settingsCol();
  const extraRecipients = [...new Set(
    (patch.extraRecipients || [])
      .flatMap((v) => String(v).split(','))
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
  )];
  const next = {
    enabled: patch.enabled !== false,
    sendToUsers: patch.sendToUsers !== false,
    extraRecipients,
    updatedAt: new Date(),
  };
  await col.updateOne({ _id: SETTINGS_ID }, { $set: next }, { upsert: true });
  return getReportSettings();
}

function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${(v <= 1 ? v * 100 : v).toFixed(1)}%`;
}

function num(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function reportHtml({ product, period, kpi, dashboardUrl }) {
  const name = productLabel(product);
  return `
  <div style="font-family:Inter,system-ui,sans-serif;background:#0f1117;color:#e8eaed;padding:24px">
    <div style="max-width:640px;margin:0 auto;background:#1a1d27;border:1px solid #2a2f3d;border-radius:12px;padding:24px">
      <p style="color:#9aa0b0;font-size:12px;margin:0 0 6px">${period.label} · ${period.start_date} to ${period.end_date}</p>
      <h1 style="font-size:22px;margin:0 0 8px">${name} monthly report</h1>
      <p style="color:#9aa0b0;font-size:14px">Product analytics summary for the previous calendar month.</p>
      <table style="width:100%;border-collapse:collapse;margin:18px 0">
        <tr>
          <td style="padding:12px;background:#141720;border-radius:8px">
            <div style="font-size:11px;color:#9aa0b0;text-transform:uppercase">Latest DAU (opened the app)</div>
            <div style="font-size:26px;font-weight:700">${num(kpi.dau)}</div>
          </td>
          <td style="width:8px"></td>
          <td style="padding:12px;background:#141720;border-radius:8px">
            <div style="font-size:11px;color:#9aa0b0;text-transform:uppercase">MAU</div>
            <div style="font-size:26px;font-weight:700">${num(kpi.mau)}</div>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#9aa0b0">New users</td><td style="text-align:right;font-weight:600">${num(kpi.newUsers)}</td></tr>
        <tr><td style="padding:8px 0;color:#9aa0b0">D1 retention</td><td style="text-align:right;font-weight:600">${pct(kpi.d1)}</td></tr>
        <tr><td style="padding:8px 0;color:#9aa0b0">D7 retention</td><td style="text-align:right;font-weight:600">${pct(kpi.d7)}</td></tr>
      </table>
      ${dashboardUrl ? `<p style="margin-top:20px"><a href="${dashboardUrl}" style="color:#4f8cff">Open dashboard</a></p>` : ''}
    </div>
  </div>`;
}

async function buildProductReport(facade, product, period) {
  const kpi = await facade.getKpi({
    product,
    start_date: period.start_date,
    end_date: period.end_date,
  });
  const dashboardUrl = process.env.DASHBOARD_PUBLIC_URL || '';
  const html = reportHtml({ product, period, kpi, dashboardUrl });
  const text = [
    `${productLabel(product)} monthly report — ${period.label}`,
    `${period.start_date} to ${period.end_date}`,
    `DAU: ${num(kpi.dau)}`,
    `MAU: ${num(kpi.mau)}`,
    `New users: ${num(kpi.newUsers)}`,
    `D1: ${pct(kpi.d1)}`,
    `D7: ${pct(kpi.d7)}`,
  ].join('\n');
  return { product, kpi, html, text, subject: `${productLabel(product)} monthly report — ${period.label}` };
}

function recipientsForProduct(users, settings, productId) {
  const set = new Set(settings.extraRecipients || []);
  if (settings.sendToUsers) {
    for (const user of users) {
      if (!user.active || !user.email || user.receiveReports === false) continue;
      if (canAccessProduct(user, productId)) set.add(user.email);
    }
  }
  return [...set];
}

export async function sendMonthlyReports(facade, { force = false } = {}) {
  if (!smtpConfigured()) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }
  const settings = await getReportSettings();
  if (!settings.enabled && !force) {
    return { skipped: true, reason: 'disabled' };
  }
  const period = previousMonthRange();
  if (!force && settings.lastSentKey === period.key) {
    return { skipped: true, reason: 'already-sent', period };
  }

  const productIds = (facade.registry?.productIds || ['banknote', 'coinzy']).filter(Boolean);
  const users = mongoConfigured() ? await listUsers() : [];
  const sent = [];

  for (const productId of productIds) {
    const to = recipientsForProduct(users, settings, productId);
    if (!to.length) {
      sent.push({ product: productId, skipped: true, reason: 'no-recipients' });
      continue;
    }
    const report = await buildProductReport(facade, productId, period);
    await sendMail({
      to,
      subject: report.subject,
      html: report.html,
      text: report.text,
    });
    sent.push({ product: productId, to, period: period.key });
  }

  if (mongoConfigured()) {
    const col = await settingsCol();
    await col.updateOne(
      { _id: SETTINGS_ID },
      { $set: { lastSentKey: period.key, lastSentAt: new Date() } },
      { upsert: true },
    );
  }

  return { ok: true, period, sent };
}

let schedulerStarted = false;

export function startReportScheduler(facade) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCDate() !== 1 || now.getUTCHours() < 8) return;
      const settings = await getReportSettings();
      if (!settings.enabled || !smtpConfigured()) return;
      const period = previousMonthRange(now);
      if (settings.lastSentKey === period.key) return;
      const result = await sendMonthlyReports(facade);
      console.log('Monthly reports:', JSON.stringify(result));
    } catch (err) {
      console.error('Monthly reports failed:', err.message);
    }
  };
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 20 * 1000);
  console.log('  Reports: monthly scheduler on (1st of month, 08:00 UTC)');
}
