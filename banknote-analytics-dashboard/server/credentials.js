import fs from 'fs';
import path from 'path';

/**
 * Hosts (Render / Docker) should pass SA JSON via env, not bake files into the image.
 * Accepts raw JSON or base64. Writes to dashboard/secrets/ and sets path env vars.
 */
const CREDENTIAL_SPECS = [
  {
    jsonEnv: [
      'GOOGLE_CREDENTIALS_JSON',
      'BANKNOTE_GOOGLE_CREDENTIALS_JSON',
      'PRODUCT_BANKNOTE_GOOGLE_CREDENTIALS_JSON',
    ],
    pathEnv: [
      'GOOGLE_APPLICATION_CREDENTIALS',
      'PRODUCT_BANKNOTE_GOOGLE_APPLICATION_CREDENTIALS',
    ],
    file: 'banknote-sa.json',
  },
  {
    jsonEnv: [
      'COINZY_GOOGLE_CREDENTIALS_JSON',
      'PRODUCT_COINZY_GOOGLE_CREDENTIALS_JSON',
    ],
    pathEnv: [
      'COINZY_GOOGLE_APPLICATION_CREDENTIALS',
      'PRODUCT_COINZY_GOOGLE_APPLICATION_CREDENTIALS',
    ],
    file: 'coinzy-sa.json',
  },
];

function decodeCredential(raw) {
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('{')) return trimmed;
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
  if (!decoded.startsWith('{')) {
    throw new Error('Credential env var is neither JSON nor base64 JSON');
  }
  return decoded;
}

export function materializeCredentials(dashboardRoot) {
  const dir = path.join(dashboardRoot, 'secrets');
  fs.mkdirSync(dir, { recursive: true });

  for (const spec of CREDENTIAL_SPECS) {
    const raw = spec.jsonEnv.map((k) => process.env[k]).find((v) => v && String(v).trim());
    if (!raw) continue;
    const json = decodeCredential(raw);
    JSON.parse(json);
    const dest = path.join(dir, spec.file);
    fs.writeFileSync(dest, json, { mode: 0o600 });
    for (const key of spec.pathEnv) {
      if (!process.env[key]) process.env[key] = dest;
    }
    console.log(`  Credentials written → ${spec.file}`);
  }
}
