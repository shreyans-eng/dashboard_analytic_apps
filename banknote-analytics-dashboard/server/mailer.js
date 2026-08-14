import nodemailer from 'nodemailer';

export function smtpConfigured() {
  return Boolean(String(process.env.SMTP_HOST || '').trim() && String(process.env.SMTP_USER || '').trim());
}

export function smtpStatus() {
  return {
    configured: smtpConfigured(),
    host: process.env.SMTP_HOST || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  };
}

function transporter() {
  if (!smtpConfigured()) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS on Render.');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transporter().sendMail({
    from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    text,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}
