import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImportDate } from './import-date.js';

test('parses South African day/month dates instead of defaulting to today', () => {
  assert.equal(parseImportDate('17/08/2025'), '2025-08-17');
  assert.equal(parseImportDate('7-1-2026'), '2026-01-07');
  assert.equal(parseImportDate('2026-03-09'), '2026-03-09');
  assert.equal(parseImportDate('32/13/2026'), undefined);
  assert.equal(parseImportDate(''), undefined);
});
