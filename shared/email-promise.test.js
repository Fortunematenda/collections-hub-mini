import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePromiseFromReply, splitEmailThread } from './email-promise.js';

test('detects a dated promise and ignores quoted thread', () => {
  const parsed = parsePromiseFromReply('Ok will pay on 24th of this month');
  assert.ok(parsed);
  assert.match(parsed.date, /^\d{4}-\d{2}-24$/);
  assert.equal(parsed.dateInferred, false);
});

test('rejects payment-already and opt-out language', () => {
  assert.equal(parsePromiseFromReply('I paid and want to cancel'), null);
  assert.equal(parsePromiseFromReply('I am no longer interested'), null);
});

test('infers seven days when they promise without a date', () => {
  const parsed = parsePromiseFromReply('I will pay');
  assert.ok(parsed);
  assert.equal(parsed.dateInferred, true);
});

test('uses only the new reply body', () => {
  const { body } = splitEmailThread('I will pay Friday\nOn Sun, 16 Aug 2026 someone wrote:\nPlease pay');
  assert.match(body, /I will pay Friday/i);
  assert.doesNotMatch(body, /Please pay/);
});
