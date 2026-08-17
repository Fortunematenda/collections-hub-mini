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

test('short date-only reply Next week Friday is a promise for that Friday', () => {
  const parsed = parsePromiseFromReply('Next week. Friday');
  assert.ok(parsed);
  assert.equal(parsed.dateInferred, false);
  const date = new Date(`${parsed.date}T00:00:00`);
  assert.equal(date.getDay(), 5);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  assert.ok(days >= 5 && days <= 13, `expected next week's Friday, got +${days} days`);
});

test('does not treat a long unrelated Friday mention as a promise', () => {
  const parsed = parsePromiseFromReply(
    'Thanks for the statement. We discussed this last Friday with accounts and will revert once we have checked the invoice details on our side.',
  );
  assert.equal(parsed, null);
});
