import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountOwed, applyPaymentToBalance, hasCreditBalance, hasOutstandingBalance, isClearedOrCredit } from './balance.js';

test('negative balances are outstanding and positive balances are credit', () => {
  assert.equal(hasOutstandingBalance(-250), true);
  assert.equal(hasOutstandingBalance(250), false);
  assert.equal(hasOutstandingBalance(0), false);
  assert.equal(hasCreditBalance(120), true);
  assert.equal(hasCreditBalance(-120), false);
  assert.equal(isClearedOrCredit(0), true);
  assert.equal(isClearedOrCredit(50), true);
  assert.equal(isClearedOrCredit(-1), false);
  assert.equal(amountOwed(-250), 250);
  assert.equal(amountOwed(80), 0);
});

test('a payment deducts from a negative outstanding balance', () => {
  assert.equal(applyPaymentToBalance(-461, 100, false), -361);
  assert.equal(applyPaymentToBalance(-461, 461, false), 0);
  assert.equal(applyPaymentToBalance(-461, 500, false), 39);
  assert.equal(applyPaymentToBalance(-461, 100, true), 0);
});
