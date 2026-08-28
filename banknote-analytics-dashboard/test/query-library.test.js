import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeSqlPath, listDiskSql } from '../server/services/query-library.js';
import path from 'path';
import { fileURLToPath } from 'url';

test('SQL library rejects path traversal', () => {
  assert.throws(() => assertSafeSqlPath('../secrets.sql'));
  assert.throws(() => assertSafeSqlPath('foo/../../secrets.sql'));
  assert.throws(() => assertSafeSqlPath('foo.txt'));
  assert.throws(() => assertSafeSqlPath(''));
  assert.equal(
    assertSafeSqlPath('dashboard/product/coinzy/08_identify_funnel_conversion.sql'),
    'dashboard/product/coinzy/08_identify_funnel_conversion.sql',
  );
});

test('disk walk finds Coinzy identify SQL', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'sql');
  const files = listDiskSql(root);
  assert.ok(files.length > 20);
  assert.ok(files.some((f) => f.path === 'dashboard/product/coinzy/08_identify_funnel_conversion.sql'));
  assert.ok(files.every((f) => f.path.endsWith('.sql')));
  assert.ok(files.every((f) => !f.path.includes('..')));
});
