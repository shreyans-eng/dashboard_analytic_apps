import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDb, closeDb } from '../server/db.js';
import { findUserByUsername, seedAdmin, updateUser } from '../server/users.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env'), override: true });

const resetPassword = process.argv.includes('--reset-password');

await connectDb();
const seeded = await seedAdmin();
const username = process.env.DASHBOARD_USERNAME || 'admin';
const admin = await findUserByUsername(username);
if (!admin) {
  console.error('Admin user was not created. Set DASHBOARD_USERNAME and DASHBOARD_PASSWORD.');
  process.exit(1);
}
if (resetPassword && process.env.DASHBOARD_PASSWORD) {
  await updateUser(String(admin._id), {
    password: process.env.DASHBOARD_PASSWORD,
    role: 'admin',
    active: true,
  }, { actor: { id: 'seed', username: 'seed' } });
  console.log(`Admin password reset for "${admin.username}"`);
} else {
  console.log(`Admin ready: ${admin.username}`, seeded);
}
await closeDb();
