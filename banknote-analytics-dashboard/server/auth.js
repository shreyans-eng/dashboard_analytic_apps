import crypto from 'crypto';

const COOKIE = 'dashboard_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map();

function authEnabled() {
  const flag = String(process.env.DASHBOARD_AUTH_ENABLED || 'true').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
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

function setSessionCookie(res, username) {
  const token = sign({ u: username, exp: Date.now() + MAX_AGE_MS });
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

export function authStatus() {
  return {
    enabled: authEnabled(),
    usernameConfigured: Boolean(process.env.DASHBOARD_USERNAME),
  };
}

export function mountAuth(app) {
  app.get('/api/auth/me', (req, res) => {
    if (!authEnabled()) {
      return res.json({ authenticated: true, authDisabled: true, user: 'local' });
    }
    const cookies = parseCookies(req.headers.cookie);
    const session = verify(cookies[COOKIE]);
    if (!session) return res.json({ authenticated: false });
    return res.json({ authenticated: true, user: session.u });
  });

  app.post('/api/auth/login', (req, res) => {
    if (!authEnabled()) {
      return res.json({ ok: true, authDisabled: true });
    }
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (tooManyAttempts(ip)) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }
    const username = String(req.body?.username || '');
    const password = String(req.body?.password || '');
    const okUser = safeEqual(username, process.env.DASHBOARD_USERNAME);
    const okPass = safeEqual(password, process.env.DASHBOARD_PASSWORD);
    if (!okUser || !okPass) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    setSessionCookie(res, username);
    res.json({ ok: true, user: username });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) return next();
    if (publicApiPath(req)) return next();
    if (!authEnabled()) return next();
    const cookies = parseCookies(req.headers.cookie);
    const session = verify(cookies[COOKIE]);
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = session.u;
    next();
  });
}
