import { parsePromiseFromReply, splitEmailThread, todayIso } from '../../shared/email-promise.js';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function money(amount) {
  return `R ${Number(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isPaidOrZero(customer) {
  return customer?.status === 'Paid' || customer?.status === 'Cancelled' || Number(customer?.outstanding || 0) <= 0;
}

export function applyEmailPromises(store) {
  const customers = [...(store.customers || [])];
  const promises = [...(store.promises || [])];
  const followUps = [...(store.followUps || [])];
  const activities = [...(store.activities || [])];
  const communications = [...(store.communications || [])];
  const queued = new Set();
  let created = 0;

  const pending = communications
    .filter(
      (item) =>
        item.channel === 'Email' &&
        item.direction === 'Incoming' &&
        (!item.handledAs || item.handledAs === 'none'),
    )
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  for (const comm of pending) {
    const customerIndex = customers.findIndex((item) => item.id === comm.customerId);
    const customer = customers[customerIndex];
    const body = splitEmailThread(comm.message).body || '';
    const parsed = parsePromiseFromReply(body);

    if (!parsed || !customer || isPaidOrZero(customer)) {
      comm.handledAs = parsed ? 'skipped' : 'none';
      continue;
    }

    comm.handledAs = 'promise';
    if (queued.has(customer.id)) continue;
    queued.add(customer.id);

    const existingIndex = promises.findIndex((p) => p.customerId === customer.id && p.status === 'Pending');
    const record = {
      id: existingIndex >= 0 ? promises[existingIndex].id : uid('pr'),
      companyId: customer.companyId,
      customerId: customer.id,
      amount: customer.outstanding,
      promiseDate: parsed.date,
      createdAt: existingIndex >= 0 ? promises[existingIndex].createdAt : new Date().toISOString(),
      status: 'Pending',
      customerComment: body.slice(0, 500),
      internalNote: parsed.dateInferred
        ? `Auto from email ${comm.id} — no date given, used ${safeDate(parsed.date)}.`
        : `Auto from email ${comm.id}.`,
    };
    if (existingIndex >= 0) promises[existingIndex] = { ...promises[existingIndex], ...record };
    else promises.unshift(record);

    customers[customerIndex] = {
      ...customer,
      status: 'Promise to Pay',
      collectionStage: 'Promise to Pay',
      promisedDate: parsed.date,
      promisedAmount: customer.outstanding,
      nextFollowUp: parsed.date,
      lastContact: `Promise · ${safeDate(parsed.date)}`,
    };

    const followIndex = followUps.findIndex(
      (f) => f.customerId === customer.id && /follow up on promise/i.test(f.notes || ''),
    );
    const follow = {
      id: followIndex >= 0 ? followUps[followIndex].id : uid('fu'),
      companyId: customer.companyId,
      customerId: customer.id,
      followUpDate: parsed.date,
      channel: 'Any',
      assignedUser: customer.assignedCollector || 'System',
      notes: `Follow up on promise of ${money(customer.outstanding)}`,
      createdAt: followIndex >= 0 ? followUps[followIndex].createdAt : new Date().toISOString(),
    };
    if (followIndex >= 0) followUps[followIndex] = { ...followUps[followIndex], ...follow };
    else followUps.unshift(follow);

    activities.unshift({
      id: uid('act'),
      companyId: customer.companyId,
      customerId: customer.id,
      user: 'System',
      action: existingIndex >= 0 ? 'Promise updated' : 'Promise created',
      description: `Promise to pay ${money(customer.outstanding)} recorded for ${safeDate(parsed.date)}.`,
      createdAt: new Date().toISOString(),
    });
    created += 1;
  }

  return {
    store: { ...store, customers, promises, followUps, activities, communications },
    created,
  };
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

export function runCollectionsJobs(store) {
  const seeded = seedHistoricalEmailPromises(store);
  const promised = applyEmailPromises(seeded.store);
  const overdue = breakOverduePromises(promised.store);
  return {
    store: overdue.store,
    promisesCreated: promised.created,
    promisesBroken: overdue.broken,
    seeded: seeded.seeded,
  };
}
