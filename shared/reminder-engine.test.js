import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReminderActions, planReminderActions } from './reminder-engine.js';

const store = {
  automationRules: [
    {
      id: 'r1',
      companyId: 'co1',
      active: true,
      trigger: 'Invoice overdue',
      daysOffset: 7,
      minimumBalance: 0,
      action: 'Send email',
      requiresApproval: false,
    },
  ],
  companies: [{ id: 'co1', name: 'Acme ISP' }],
  templates: [],
  customers: [
    {
      id: 'c1',
      companyId: 'co1',
      name: 'Pat Client',
      accountNo: '876',
      outstanding: -250,
      dueDate: '2026-08-01',
      email: 'pat@example.com',
      status: 'Payment Due',
    },
  ],
};

test('paused accounts are not reminded', () => {
  const actions = planReminderActions(
    {
      ...store,
      customers: [{ ...store.customers[0], automationPaused: true, automationPausedUntil: '2026-09-01' }],
    },
    '2026-08-17',
  );
  assert.equal(actions.length, 0);
});

test('invalid WhatsApp contact is skipped', () => {
  const actions = planReminderActions(
    {
      ...store,
      automationRules: [{ ...store.automationRules[0], action: 'Send WhatsApp' }],
      customers: [{ ...store.customers[0], contactInvalid: true, whatsapp: '+27821234567' }],
    },
    '2026-08-17',
  );
  assert.equal(actions.length, 0);
});

test('invoice overdue matches after the offset', () => {
  const actions = planReminderActions(store, '2026-08-17');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].channel, 'Email');
  assert.match(actions[0].body, /Pat Client/);
});

test('already sent rules are not selected again', () => {
  const actions = planReminderActions(
    {
      ...store,
      customers: [{ ...store.customers[0], reminderSent: { r1: '2026-08-10' } }],
    },
    '2026-08-17',
  );
  assert.equal(actions.length, 0);
});

test('applyReminderActions sends mail and marks the customer', async () => {
  const sent = [];
  const result = await applyReminderActions(store, {
    today: '2026-08-17',
    sendEmail: async (payload) => {
      sent.push(payload);
    },
  });
  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(result.store.customers[0].reminderSent.r1, '2026-08-17');
  assert.equal(result.store.communications[0].status, 'Sent');
});

test('approval flagged rules create a task instead of sending', async () => {
  const result = await applyReminderActions(
    {
      ...store,
      automationRules: [{ ...store.automationRules[0], requiresApproval: true }],
    },
    { today: '2026-08-17', sendEmail: async () => {} },
  );
  assert.equal(result.sent, 0);
  assert.equal(result.queued, 1);
  assert.equal(result.store.workTasks[0].title.includes('Approve'), true);
});
