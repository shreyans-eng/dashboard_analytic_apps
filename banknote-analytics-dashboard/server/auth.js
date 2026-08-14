import crypto from 'crypto';
import { mongoConfigured } from './db.js';
import { authenticateUser, findUserById, findUserByUsername } from './users.js';
import {
  canAccessPage,
  canAccessProduct,
  isAdmin,
  isAdminOnlyApi,
  pageIdForApiPath,
  toPublicUser,
} from './access.js';

const COOKIE = 'dashboard_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map();

function authEnabled() {
  const flag = String(process.env.DASHBOARD_AUTH_ENABLED || 'true').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (mongoConfigured()) return true;
  return Boolean(process.env.DASHBOARD_USERNAME && process.env.DASHBOARD_PASSWORD);
}

function secret() {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || 'dev-insecure-secret';
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.u || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) {
    crypto.timingSafeEqual(aa, Buffer.alloc(aa.length));
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

function cookieFlags(maxAge) {
  const secure = process.env.NODE_ENV === 'production' || process.env.AUTH_SECURE_COOKIE === 'true';
  return [
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : null,
  ].filter(Boolean).join('; ');
}

function setSessionCookie(res, { username, userId }) {
  const token = sign({ u: username, uid: userId || null, exp: Date.now() + MAX_AGE_MS });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; ${cookieFlags(Math.floor(MAX_AGE_MS / 1000))}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { n: 0, reset: now + 15 * 60 * 1000 };
  if (now > rec.reset) {
    rec.n = 0;
    rec.reset = now + 15 * 60 * 1000;
  }
  rec.n += 1;
  loginAttempts.set(ip, rec);
  return rec.n > 12;
}

function publicApiPath(req) {
  const p = req.path || '';
  return (
    p === '/api/health' ||
    p === '/api/live' ||
    p === '/api/auth/login' ||
    p === '/api/auth/me' ||
    p === '/api/auth/logout'
  );
}

function envAdminUser() {
  return {
    id: 'env-admin',
    username: process.env.DASHBOARD_USERNAME || 'admin',
    displayName: 'Admin',
    role: 'admin',
    active: true,
    isAdmin: true,
    permissions: { products: ['*'], pages: ['*'] },
  };
}

async function resolveSessionUser(session) {
  if (!session?.u) return null;
  if (mongoConfigured()) {
    const doc = session.uid
      ? await findUserById(session.uid)
      : await findUserByUsername(session.u);
    if (!doc || doc.active === false) return null;
    return toPublicUser(doc);
  }
  if (session.u === process.env.DASHBOARD_USERNAME) return envAdminUser();
  return null;
}

async function loginWithMongoOrEnv(username, password) {
  if (mongoConfigured()) {
    const result = await authenticateUser(username, password);
    if (result?.disabled) return { error: 'This account is disabled', status: 403 };
    if (!result?.user) return { error: 'Invalid username or password', status: 401 };
    return { user: toPublicUser(result.user), userId: String(result.user._id) };
  }
  const okUser = safeEqual(username, process.env.DASHBOARD_USERNAME);
  const okPass = safeEqual(password, process.env.DASHBOARD_PASSWORD);
  if (!okUser || !okPass) return { error: 'Invalid username or password', status: 401 };
  return { user: envAdminUser(), userId: 'env-admin' };
}

function deny(res, status, error) {
  return res.status(status).json({ error });
}

function assertApiAccess(req, res) {
  const user = req.auth;
  const p = req.path || '';

  if (isAdminOnlyApi(p) && !isAdmin(user)) {
    deny(res, 403, 'Admin access required');
    return false;
  }

  const pageId = pageIdForApiPath(p);
  if (pageId && !canAccessPage(user, pageId)) {
    deny(res, 403, 'You do not have access to this page');
    return false;
  }

  const product = req.body?.product ?? req.query?.product;
  if (product && !canAccessProduct(user, String(product))) {
    deny(res, 403, 'You do not have access to this app');
    return false;
  }
  return true;
}

export function authStatus() {
  return {
    enabled: authEnabled(),
    mongo: mongoConfigured(),
    usernameConfigured: Boolean(process.env.DASHBOARD_USERNAME),
  };
}

export function mountAuth(app) {
  app.get('/api/auth/me', async (req, res) => {
    if (!authEnabled()) {
      return res.json({ authenticated: true, authDisabled: true, user: envAdminUser() });
    }
    const cookies = parseCookies(req.headers.cookie);
    const session = verify(cookies[COOKIE]);
    if (!session) return res.json({ authenticated: false });
    const user = await resolveSessionUser(session);
    if (!user) return res.json({ authenticated: false });
    return res.json({ authenticated: true, user });
  });

  app.post('/api/auth/login', async (req, res) => {
    if (!authEnabled()) {
      return res.json({ ok: true, authDisabled: true, user: envAdminUser() });
    }
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (tooManyAttempts(ip)) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    try {
      const result = await loginWithMongoOrEnv(username, password);
      if (result.error) return res.status(result.status).json({ error: result.error });
      setSessionCookie(res, { username: result.user.username, userId: result.userId });
      res.json({ ok: true, user: result.user });
    } catch (err) {
      console.error('login failed', err);
      res.status(500).json({ error: 'Login failed. Try again.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.use(async (req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    if (publicApiPath(req)) return next();
    if (!authEnabled()) {
      req.auth = envAdminUser();
      req.user = req.auth.username;
      return next();
    }
    const cookies = parseCookies(req.headers.cookie);
    const session = verify(cookies[COOKIE]);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const user = await resolveSessionUser(session);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      req.auth = user;
      req.user = user.username;
      if (!assertApiAccess(req, res)) return;
      next();
    } catch (err) {
      console.error('auth middleware', err);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}
