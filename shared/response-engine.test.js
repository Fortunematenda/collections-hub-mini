import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse } from './response-classifier.js';
import { applyClassifiedResponse, applyInboundResponses, resolveAssignee } from './response-engine.js';
import { INTENTS } from './response-intents.js';

const customer = {
  id: 'c1',
  companyId: 'co1',
  accountNo: '876',
  name: 'Test Client',
  outstanding: -461,
  status: 'Payment Due',
  collectionStage: 'New Overdue',
  assignedCollector: 'Ada',
};

function run(message, extras = {}) {
  const classification = classifyResponse(message);
  return applyClassifiedResponse({
    customer: { ...customer, ...extras.customer },
    classification,
    communication: { id: 'cm1', channel: 'WhatsApp', direction: 'Incoming', message, customerId: 'c1', companyId: 'co1' },
    actor: 'System',
  });
}

test('payment claimed goes to verification and does not clear the balance', () => {
  const result = run('I paid yesterday.');
  assert.equal(result.customer.collectionStage, 'Payment Verification');
  assert.equal(result.customer.outstanding, -461);
  assert.equal(result.customer.automationPaused, true);
  assert.equal(result.task.queue, 'Payment Verification');
  assert.equal(result.promise, null);
});

test('dispute pauses automation and opens a case', () => {
  const result = run("Your amount is wrong, I don't owe this.");
  assert.equal(result.customer.collectionStage, 'Dispute');
  assert.equal(result.customer.automationPaused, true);
  assert.equal(result.dispute.status, 'Open');
});

test('round robin uses dedicated team members', () => {
  const team = { id: 't1', companyId: 'co1', name: 'Collections', memberNames: ['Ada', 'Bob'], active: true };
  const rule = { assignmentType: 'Round Robin', assigneeTeamId: 't1', companyId: 'co1', roundRobinIndex: 1 };
  assert.equal(resolveAssignee(customer, rule, [], [team]), 'Bob');
});

test('applyInboundResponses still creates a dated email promise', () => {
  const result = applyInboundResponses({
    customers: [{ ...customer }],
    communications: [
      {
        id: 'cm-new',
        channel: 'Email',
        direction: 'Incoming',
        customerId: 'c1',
        message: 'I will pay on 20 August 2026',
      },
    ],
    promises: [],
    followUps: [],
    activities: [],
    workTasks: [],
    classifiedResponses: [],
    disputeCases: [],
    recoveries: [],
    equipment: [],
  });
  assert.equal(result.created, 1);
  assert.equal(result.store.promises[0].promiseDate, '2026-08-20');
  assert.equal(result.store.customers[0].status, 'Promise to Pay');
  assert.equal(result.store.communications[0].handledAs, 'promise');
});
