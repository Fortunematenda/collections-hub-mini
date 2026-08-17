import { todayIso } from '../../shared/email-promise.js';
import { applyInboundResponses, applyInboundResponsesAsync } from '../../shared/response-engine.js';
import { applyReminderActions } from '../../shared/reminder-engine.js';
import { classifyBest } from './ai-classifier.js';
import { createPaymentDetailsDocument, createStatementDocument } from './documents.js';
import { sendOutboundEmail, sendOutboundWhatsApp, smtpConfigured, twilioConfigured } from './outbound.js';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function money(amount) {
  return `R ${Number(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function applyEmailPromises(store) {
  return applyInboundResponses(store);
}

export function breakOverduePromises(store, today = todayIso()) {
  const promises = [...(store.promises || [])];
  const customers = [...(store.customers || [])];
  const activities = [...(store.activities || [])];
  let broken = 0;

  for (let i = 0; i < promises.length; i += 1) {
    const item = promises[i];
    if (item.status !== 'Pending') continue;
    const due = String(item.promiseDate || '').slice(0, 10);
    if (!due || due >= today) continue;
    promises[i] = { ...item, status: 'Broken', outcome: 'Date passed with no payment' };
    const customerIndex = customers.findIndex((c) => c.id === item.customerId);
    if (customerIndex >= 0) {
      customers[customerIndex] = {
        ...customers[customerIndex],
        status: 'Follow-up',
        collectionStage: 'Follow-up Due',
        lastContact: 'Promise broken',
      };
    }
    activities.unshift({
      id: uid('act'),
      companyId: item.companyId,
      customerId: item.customerId,
      user: 'System',
      action: 'Promise broken',
      description: `Promise of ${money(item.amount)} marked as broken after ${due}.`,
      createdAt: new Date().toISOString(),
    });
    broken += 1;
  }

  return { store: { ...store, promises, customers, activities }, broken };
}

export function seedHistoricalEmailPromises(store) {
  if (store.promiseEmailSeeded) {
    return { store, seeded: false };
  }
  const communications = (store.communications || []).map((item) =>
    item.channel === 'Email' && item.direction === 'Incoming' && !item.handledAs
      ? { ...item, handledAs: 'seeded' }
      : item,
  );
  return {
    store: { ...store, communications, promiseEmailSeeded: true },
    seeded: true,
  };
}

export async function fulfillDocumentRequests(store, requests = []) {
  let documents = [...(store.documents || [])];
  const communications = [...(store.communications || [])];
  const activities = [...(store.activities || [])];
  let created = 0;

  for (const request of requests) {
    const customer = (store.customers || []).find((item) => item.id === request.customerId);
    const company = (store.companies || []).find((item) => item.id === request.companyId);
    if (!customer) continue;
    const built =
      request.kind === 'statement'
        ? createStatementDocument({ ...store, documents }, request)
        : createPaymentDetailsDocument({ ...store, documents }, request);
    if (!built?.document) continue;
    if (!built.reused) {
      documents = [built.document, ...documents];
      created += 1;
    }
    const to = customer.email;
    if (to && to.includes('@') && smtpConfigured() && built.text) {
      try {
        await sendOutboundEmail({
          to,
          subject:
            request.kind === 'statement'
              ? `Account statement ${customer.accountNo}${company?.name ? ` — ${company.name}` : ''}`
              : `Payment details ${customer.accountNo}${company?.name ? ` — ${company.name}` : ''}`,
          text: built.text,
          html: built.html || undefined,
          customerName: customer.name,
          accountNo: customer.accountNo,
        });
        communications.unshift({
          id: uid('cm'),
          companyId: customer.companyId,
          customerId: customer.id,
          channel: 'Email',
          direction: 'Outgoing',
          subject: request.kind === 'statement' ? 'Account statement' : 'Payment details',
          message: built.text,
          status: 'Sent',
          createdAt: new Date().toISOString(),
          createdBy: 'System',
          handledAs: 'classified',
        });
      } catch {
        communications.unshift({
          id: uid('cm'),
          companyId: customer.companyId,
          customerId: customer.id,
          channel: 'Email',
          direction: 'Outgoing',
          subject: request.kind === 'statement' ? 'Account statement' : 'Payment details',
          message: built.text,
          status: 'Failed',
          createdAt: new Date().toISOString(),
          createdBy: 'System',
        });
      }
    }
    activities.unshift({
      id: uid('act'),
      companyId: customer.companyId,
      customerId: customer.id,
      user: 'System',
      action: request.kind === 'statement' ? 'Statement generated' : 'Payment details prepared',
      description:
        request.kind === 'statement'
          ? `Account statement stored as ${built.document.filename}.`
          : `Payment instructions stored as ${built.document.filename}.`,
      createdAt: new Date().toISOString(),
    });
  }

  return { store: { ...store, documents, communications, activities }, created };
}

export async function runCollectionsJobs(store, options = {}) {
  const seeded = seedHistoricalEmailPromises(store);
  const promised = await applyInboundResponsesAsync(seeded.store, {
    classify: options.classify || classifyBest,
    teams: seeded.store.teams || [],
  });
  const withDocs = await fulfillDocumentRequests(promised.store, promised.documentRequests || []);
  const overdue = breakOverduePromises(withDocs.store);
  const reminded = await applyReminderActions(overdue.store, {
    sendEmail: options.sendEmail || (smtpConfigured() ? sendOutboundEmail : undefined),
    sendWhatsApp: options.sendWhatsApp || (twilioConfigured() ? sendOutboundWhatsApp : undefined),
  });
  return {
    store: reminded.store,
    promisesCreated: promised.created,
    promisesBroken: overdue.broken,
    classified: promised.classified,
    remindersSent: reminded.sent,
    remindersQueued: reminded.queued,
    documentsCreated: withDocs.created,
    seeded: seeded.seeded,
  };
}
