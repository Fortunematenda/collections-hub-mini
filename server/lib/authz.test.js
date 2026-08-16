import { test } from 'node:test';
import assert from 'node:assert/strict';

function canWrite(user, keys) {
  if (user?.role === 'admin') return true;
  const owned = new Set(user?.permissions || []);
  return keys.some((key) => owned.has(key));
}

const WRITE = ['customers.manage', 'collections.manage', 'imports.manage'];

test('viewer cannot write app data', () => {
  assert.equal(canWrite({ role: 'viewer', permissions: ['companies.view', 'customers.view'] }, WRITE), false);
});

test('operator can write app data', () => {
  assert.equal(
    canWrite({ role: 'collections_operator', permissions: ['customers.manage', 'customers.view'] }, WRITE),
    true,
  );
});

test('admin can write even without listed permissions', () => {
  assert.equal(canWrite({ role: 'admin', permissions: [] }, WRITE), true);
});
