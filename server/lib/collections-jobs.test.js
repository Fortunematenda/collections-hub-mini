import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEmailPromises, breakOverduePromises, runCollectionsJobs } from './collections-jobs.js';

test('first run seeds historical mail and does not create promises', () => {
  const result = runCollectionsJobs({
    promiseEmailSeeded: false,
    customers: [
      {
        id: 'c1',
        companyId: 'co1',
        status: 'Overdue',
        outstanding: 100,
        assignedCollector: 'Ada',
      },
    ],
    communications: [
      {
        id: 'cm-old',
        channel: 'Email',
        direction: 'Incoming',
        customerId: 'c1',
        message: 'I will pay on Friday',
      },
    ],
    promises: [],
    followUps: [],
    activities: [],
  });
  assert.equal(result.seeded, true);
  assert.equal(result.promisesCreated, 0);
  assert.equal(result.store.promiseEmailSeeded, true);
  assert.equal(result.store.communications[0].handledAs, 'none');
  assert.equal(result.store.promises.length, 0);
});

test('creates a promise from a new email after seed', () => {
  const result = applyEmailPromises({
    promiseEmailSeeded: true,
    customers: [
      {
        id: 'c1',
        companyId: 'co1',
        status: 'Overdue',
        outstanding: 250,
        assignedCollector: 'Ada',
      },
    ],
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
  });
  assert.equal(result.created, 1);
  assert.equal(result.store.promises[0].status, 'Pending');
  assert.equal(result.store.promises[0].promiseDate, '2026-08-20');
  assert.equal(result.store.customers[0].status, 'Promise to Pay');
  assert.equal(result.store.communications[0].handledAs, 'promise');
});

test('marks overdue pending promises as broken', () => {
  const result = breakOverduePromises(
    {
      promises: [{ id: 'p1', customerId: 'c1', companyId: 'co1', status: 'Pending', promiseDate: '2026-08-01', amount: 50 }],
      customers: [{ id: 'c1', companyId: 'co1', status: 'Promise to Pay', outstanding: 50 }],
      activities: [],
    },
    '2026-08-16',
  );
  assert.equal(result.broken, 1);
  assert.equal(result.store.promises[0].status, 'Broken');
  assert.equal(result.store.customers[0].status, 'Follow-up');
});
