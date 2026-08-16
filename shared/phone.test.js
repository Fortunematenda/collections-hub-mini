import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsAppAddress } from './phone.js';

test('formats local SA numbers to WhatsApp E.164', () => {
  assert.equal(toWhatsAppAddress('0715353482', '27'), 'whatsapp:+27715353482');
  assert.equal(toWhatsAppAddress('+27715353482'), 'whatsapp:+27715353482');
  assert.equal(toWhatsAppAddress('whatsapp:+27715353482'), 'whatsapp:+27715353482');
});

test('rejects empty or short values', () => {
  assert.equal(toWhatsAppAddress(''), null);
  assert.equal(toWhatsAppAddress('123'), null);
});
