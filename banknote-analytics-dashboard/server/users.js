import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb, mongoConfigured, ensureDb } from './db.js';
import { ASSIGNABLE_PAGE_IDS, PRODUCT_OPTIONS, toPublicUser } from './access.js';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false;
  const [saltHex, hashHex] = String(stored).split(':');
  let expected;
  let actual;
  try {
    expected = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), KEYLEN);
    actual = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function usersCol() {
  return getDb().collection('users');
}

async function readyUsers() {
  await ensureDb();
  return usersCol();
}

function normalizeUsername(raw) {
  return String(raw || '').trim().toLowerCase();
}

function cleanPermissions(input, { isAdminRole }) {
  if (isAdminRole) {
    return { products: ['*'], pages: ['*'] };
  }
  const allowedProducts = new Set(PRODUCT_OPTIONS.map((p) => p.id));
  const products = [...new Set((input?.products || []).map(String))]
    .filter((id) => allowedProducts.has(id));
  const pages = [...new Set((input?.pages || []).map(String))]
    .filter((id) => ASSIGNABLE_PAGE_IDS.includes(id));
  return { products, pages };
}

export async function findUserByUsername(username) {
  if (!mongoConfigured()) return null;
  const uname = normalizeUsername(username);
  if (!uname) return null;
  const col = await readyUsers();
  return col.findOne({ username: uname });
}

export async function findUserById(id) {
  if (!mongoConfigured() || !id) return null;
  let oid;
  try {
    oid = new ObjectId(String(id));
  } catch {
    return null;
  }
  const col = await readyUsers();
  return col.findOne({ _id: oid });
}

export async function authenticateUser(username, password) {
  const doc = await findUserByUsername(username);
  if (!doc) return null;
  if (doc.active === false) return { disabled: true };
  if (!verifyPassword(password, doc.passwordHash)) return null;
  return { user: doc };
}

function normalizeEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  return email;
}

export async function listUsers() {
  const col = await readyUsers();
  const docs = await col.find({}).sort({ role: 1, username: 1 }).toArray();
  return docs.map(toPublicUser);
}

export async function listUsersPaged({ page = 1, limit = 10, q = '', product = '' } = {}) {
  const col = await readyUsers();
  const clauses = [];
  const query = String(q || '').trim();
  if (query) {
    const rx = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    clauses.push({ $or: [{ username: rx }, { displayName: rx }, { email: rx }] });
  }
  if (product) {
    clauses.push({
      $or: [
        { role: 'admin' },
        { 'permissions.products': product },
        { 'permissions.products': '*' },
      ],
    });
  }
  const filter = clauses.length ? { $and: clauses } : {};
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(limit) || 10));
  const total = await col.countDocuments(filter);
  const docs = await col
    .find(filter)
    .sort({ role: 1, username: 1 })
    .skip((pageNum - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  return {
    users: docs.map(toPublicUser),
    total,
    page: pageNum,
    limit: pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createUser({ username, password, displayName, role, permissions, createdBy, email, receiveReports }) {
  const uname = normalizeUsername(username);
  if (!uname || uname.length < 2) throw new Error('Username must be at least 2 characters');
  if (!/^[a-z0-9._-]+$/.test(uname)) throw new Error('Username may only contain letters, numbers, dot, dash, underscore');
  if (!password || String(password).length < 8) throw new Error('Password must be at least 8 characters');

  const nextRole = role === 'admin' ? 'admin' : 'sub_admin';
  const cleaned = cleanPermissions(permissions, { isAdminRole: nextRole === 'admin' });
  if (nextRole !== 'admin') {
    if (!cleaned.products.length) throw new Error('Assign at least one app (Banknote and/or Coinzy)');
    if (!cleaned.pages.length) throw new Error('Assign at least one page this person can open');
  }

  const now = new Date();
  const doc = {
    username: uname,
    displayName: String(displayName || uname).trim() || uname,
    email: normalizeEmail(email),
    receiveReports: receiveReports !== false,
    role: nextRole,
    active: true,
    passwordHash: hashPassword(password),
    permissions: cleaned,
    createdAt: now,
    updatedAt: now,
    createdBy: createdBy || 'system',
  };

  try {
    const col = await readyUsers();
    const result = await col.insertOne(doc);
    return toPublicUser({ ...doc, _id: result.insertedId });
  } catch (err) {
    if (err?.code === 11000) throw new Error('That username is already taken');
    throw err;
  }
}

export async function updateUser(id, patch, { actor }) {
  const existing = await findUserById(id);
  if (!existing) throw new Error('User not found');
  const col = await readyUsers();

  const next = {};
  if (patch.displayName != null) {
    next.displayName = String(patch.displayName).trim() || existing.username;
  }
  if (patch.email != null) {
    next.email = normalizeEmail(patch.email);
  }
  if (patch.receiveReports != null) {
    next.receiveReports = Boolean(patch.receiveReports);
  }
  if (patch.role != null) {
    const nextRole = patch.role === 'admin' ? 'admin' : 'sub_admin';
    if (existing.role === 'admin' && nextRole !== 'admin') {
      const admins = await col.countDocuments({ role: 'admin', active: { $ne: false } });
      if (admins <= 1) throw new Error('Cannot demote the last admin');
    }
    next.role = nextRole;
  }
  if (patch.active != null) {
    const active = Boolean(patch.active);
    if (existing.role === 'admin' && !active) {
      const admins = await col.countDocuments({ role: 'admin', active: { $ne: false } });
      if (admins <= 1) throw new Error('Cannot deactivate the last admin');
    }
    if (actor && String(existing._id) === String(actor.id) && !active) {
      throw new Error('You cannot deactivate your own account');
    }
    next.active = active;
  }
  if (patch.permissions != null) {
    const role = next.role || existing.role;
    const cleaned = cleanPermissions(patch.permissions, { isAdminRole: role === 'admin' });
    if (role !== 'admin') {
      if (!cleaned.products.length) throw new Error('Assign at least one app (Banknote and/or Coinzy)');
      if (!cleaned.pages.length) throw new Error('Assign at least one page this person can open');
    }
    next.permissions = cleaned;
  }
  if (patch.password) {
    if (String(patch.password).length < 8) throw new Error('Password must be at least 8 characters');
    next.passwordHash = hashPassword(patch.password);
  }

  if (!Object.keys(next).length) return toPublicUser(existing);

  next.updatedAt = new Date();
  next.updatedBy = actor?.username || 'system';
  await col.updateOne({ _id: existing._id }, { $set: next });
  return toPublicUser({ ...existing, ...next });
}

export async function deleteUser(id, { actor }) {
  const existing = await findUserById(id);
  if (!existing) throw new Error('User not found');
  const col = await readyUsers();
  if (actor && String(existing._id) === String(actor.id)) {
    throw new Error('You cannot delete your own account');
  }
  if (existing.role === 'admin') {
    const admins = await col.countDocuments({ role: 'admin', active: { $ne: false } });
    if (admins <= 1) throw new Error('Cannot delete the last admin');
  }
  await col.deleteOne({ _id: existing._id });
  return { ok: true };
}

export async function resetPasswordWithEmail({ username, email, password }) {
  const uname = normalizeUsername(username);
  const submitted = normalizeEmail(email);
  if (!password || String(password).length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const user = await findUserByUsername(uname);
  const stored = String(user?.email || '').trim().toLowerCase();
  const envAdminEmail = String(process.env.DASHBOARD_EMAIL || '').trim().toLowerCase();
  const expected = stored || (user?.role === 'admin' ? envAdminEmail : '');

  if (!user || user.active === false || !expected || submitted !== expected) {
    throw new Error('Username and email do not match');
  }

  const col = await readyUsers();
  const next = {
    passwordHash: hashPassword(password),
    updatedAt: new Date(),
    updatedBy: 'forgot-password',
  };
  if (!stored) next.email = submitted;
  await col.updateOne({ _id: user._id }, { $set: next });
  return { username: user.username, email: submitted };
}

export async function seedAdmin() {
  if (!mongoConfigured()) return { skipped: true, reason: 'no-mongo' };

  const username = normalizeUsername(process.env.DASHBOARD_USERNAME || 'admin');
  const password = process.env.DASHBOARD_PASSWORD;
  const email = String(process.env.DASHBOARD_EMAIL || '').trim();
  const existing = await findUserByUsername(username);
  if (existing) {
    if (email && !existing.email) {
      const col = await readyUsers();
      await col.updateOne({ _id: existing._id }, { $set: { email: normalizeEmail(email), updatedAt: new Date() } });
      console.log(`  MongoDB: set admin email for "${username}"`);
    }
    return { skipped: true, reason: 'exists', username };
  }
  if (!password) {
    console.warn('  MongoDB: no DASHBOARD_PASSWORD — admin not seeded');
    return { skipped: true, reason: 'no-password' };
  }

  await createUser({
    username,
    password,
    displayName: 'Admin',
    email,
    role: 'admin',
    permissions: { products: ['*'], pages: ['*'] },
    createdBy: 'seed',
  });
  console.log(`  MongoDB: seeded admin user "${username}"`);
  return { seeded: true, username };
}
