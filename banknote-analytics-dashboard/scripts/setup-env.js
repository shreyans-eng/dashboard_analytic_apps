#!/usr/bin/env node
/**
 * One-time local setup: create .env and locate BigQuery service account key.
 * Run: node scripts/setup-env.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const DEFAULT_SA = path.join(REPO_ROOT, 'secrets', 'bigquery-metabase-sa.json');

const SEARCH_PATHS = [
  DEFAULT_SA,
  path.join(ROOT, 'secrets', 'bigquery-metabase-sa.json'),
  path.join(REPO_ROOT, 'secrets', 'metabase-local-dev.json'),
];

function isServiceAccountFile(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.type === 'service_account' && Boolean(data.client_email);
  } catch {
    return false;
  }
}

function findServiceAccount() {
  for (const p of SEARCH_PATHS) {
    if (fs.existsSync(p) && isServiceAccountFile(p)) return p;
  }
  // Search workspace secrets/ and dashboard secrets/
  for (const dir of [path.join(REPO_ROOT, 'secrets'), path.join(ROOT, 'secrets')]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const full = path.join(dir, f);
      if (isServiceAccountFile(full)) return full;
    }
  }
  return null;
}

function main() {
  console.log('Banknote Analytics Dashboard — local setup\n');

  // Create .env
  if (!fs.existsSync(ENV_FILE)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      console.log('✓ Created .env from .env.example');
    } else {
      fs.writeFileSync(ENV_FILE, [
        'GCP_PROJECT=banknote-app-4f3fd',
        'BQ_DATASET=analytics_488476338',
        'BQ_SUMMARY_DATASET=analytics_summary',
        'USE_SUMMARY_TABLES=true',
        'GOOGLE_APPLICATION_CREDENTIALS=../secrets/bigquery-metabase-sa.json',
        'PORT=3001',
        'VITE_API_URL=http://localhost:3001',
        'DEFAULT_DAYS=30',
        '',
      ].join('\n'));
      console.log('✓ Created .env with defaults');
    }
  } else {
    console.log('✓ .env already exists');
  }

  const sa = findServiceAccount();
  let envContent = fs.readFileSync(ENV_FILE, 'utf8');

  if (sa) {
    const rel = path.relative(ROOT, sa);
    const credPath = rel.startsWith('..') ? rel : `./${rel}`;
    if (!envContent.includes('GOOGLE_APPLICATION_CREDENTIALS=')) {
      envContent += `\nGOOGLE_APPLICATION_CREDENTIALS=${credPath}\n`;
    } else {
      envContent = envContent.replace(
        /GOOGLE_APPLICATION_CREDENTIALS=.*/,
        `GOOGLE_APPLICATION_CREDENTIALS=${credPath}`
      );
    }
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`✓ Service account found: ${sa}`);
  } else {
    console.log('\n⚠ Service account JSON not found.');
    console.log('  Place your key at one of:');
    console.log(`    ${DEFAULT_SA}`);
    console.log('    Or copy from GCP Console → IAM → Service Accounts → Keys');
    console.log('\n  Then re-run: node scripts/setup-env.js\n');
  }

  if (!envContent.includes('VITE_API_URL=')) {
    envContent += 'VITE_API_URL=http://localhost:3001\n';
    fs.writeFileSync(ENV_FILE, envContent);
  }

  console.log('\nSetup complete. Run: npm run dev');
}

main();
