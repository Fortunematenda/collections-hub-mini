import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse, extractAmount, extractPromiseDate } from './response-classifier.js';
import { INTENTS } from './response-intents.js';

function intent(message) {
  return classifyResponse(message).detectedIntent;
}

test('classifies the required customer response scenarios', () => {
  assert.equal(intent('I paid yesterday.'), INTENTS.PAYMENT_CLAIMED);
  assert.equal(classifyResponse('I paid yesterday.').autoApply, true);

  const promise = classifyResponse('I will pay R500 on Friday.');
  assert.equal(promise.detectedIntent, INTENTS.PROMISE_TO_PAY);
  assert.equal(promise.entities.amount, 500);
  assert.ok(promise.entities.date);
  assert.equal(promise.entities.dateInferred, false);

  const dispute = classifyResponse("Your amount is wrong, I don't owe this.");
  assert.equal(dispute.detectedIntent, INTENTS.BALANCE_DISPUTE);
  assert.equal(dispute.autoApply, true);

  assert.equal(intent('Please cancel my internet.'), INTENTS.CANCELLATION_REQUEST);
  assert.equal(intent('Come collect your antenna.'), INTENTS.EQUIPMENT_COLLECTION_REQUEST);
  assert.equal(intent("My internet hasn't worked for two weeks."), INTENTS.TECHNICAL_SERVICE_ISSUE);
  assert.equal(intent("I lost my job and can't pay at the moment."), INTENTS.FINANCIAL_DIFFICULTY);
  assert.equal(intent('Call me after 4.'), INTENTS.CALLBACK_REQUEST);
  assert.equal(classifyResponse('Call me after 4.').entities.callbackTime, '16:00');
  assert.equal(intent('Wrong number.'), INTENTS.WRONG_CONTACT);
  assert.equal(intent('Please send banking details.'), INTENTS.PAYMENT_DETAILS_REQUEST);
  assert.equal(intent('Send me my statement.'), INTENTS.STATEMENT_REQUEST);

  const ok = classifyResponse('Ok.');
  assert.equal(ok.detectedIntent, INTENTS.NEEDS_REVIEW);
  assert.equal(ok.autoApply, false);
});

test('does not invent a promise date when none is given', () => {
  const classified = classifyResponse('I will pay.');
  assert.equal(classified.detectedIntent, INTENTS.PROMISE_TO_PAY);
  assert.equal(classified.dateRequired, true);
});

test('extracts rand amounts from mixed messages', () => {
  assert.equal(extractAmount('I can pay R500 on Friday.'), 500);
  assert.equal(extractPromiseDate('I will pay on 21 August 2026'), '2026-08-21');
});
