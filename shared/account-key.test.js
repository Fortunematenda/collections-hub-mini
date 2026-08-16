import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccountKey } from './account-key.js';

test('matches Excel-style account numbers', () => {
  assert.equal(normalizeAccountKey('1499'), '1499');
  assert.equal(normalizeAccountKey('1499.0'), '1499');
  assert.equal(normalizeAccountKey('14 99'), '1499');
  assert.equal(normalizeAccountKey('14-99'), '1499');
  assert.equal(normalizeAccountKey(1499), '1499');
});

test('does not treat different accounts as the same', () => {
  assert.notEqual(normalizeAccountKey('1499'), normalizeAccountKey('14990'));
});
