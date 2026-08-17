import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellFromRow, completeMapping, findColumn, preferDetectedMapping } from './import-columns.js';

test('matches short package and monthly headers', () => {
  const headers = ['Account No', 'Client', 'Fibre Package', 'Monthly Fee', 'Balance', 'Due Date'];
  assert.equal(findColumn(headers, 'servicePackage'), 'Fibre Package');
  assert.equal(findColumn(headers, 'monthlySubscription'), 'Monthly Fee');
  assert.equal(findColumn(headers, 'dueDate'), 'Due Date');
  assert.equal(findColumn(headers, 'outstanding'), 'Balance');
});

test('prefers package name over a generic service column', () => {
  assert.equal(findColumn(['Service', 'Package Name', 'Balance'], 'servicePackage'), 'Package Name');
});

test('reads mapped cells even when the header spacing differs', () => {
  const row = { 'Fibre Package': 'Uncapped 100Mbps', 'Monthly Fee': '299' };
  assert.equal(cellFromRow(row, 'Fibre Package'), 'Uncapped 100Mbps');
  assert.equal(cellFromRow(row, 'fibre package'), 'Uncapped 100Mbps');
});

test('fills unmapped Account Summary columns at import time', () => {
  const mapping = completeMapping({ accountNo: 'Account' }, ['Account', 'Package', 'Monthly']);
  assert.equal(mapping.servicePackage, 'Package');
  assert.equal(mapping.monthlySubscription, 'Monthly');
});

test('keeps auto-detected columns when a saved mapping points at an empty header', () => {
  const rows = [{ Package: 'Fibre 50', Notes: '' }];
  const detected = { servicePackage: 'Package' };
  const saved = { servicePackage: 'Notes' };
  const next = preferDetectedMapping(detected, saved, rows);
  assert.equal(next.servicePackage, 'Package');
});
