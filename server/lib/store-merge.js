const PROMISE_RANK = { Pending: 0, Kept: 2, Broken: 2, Cancelled: 3 };

export function mergeById(serverItems = [], clientItems = [], prefer, { keepServerOnly = false } = {}) {
  const serverMap = new Map();
  for (const item of serverItems) {
    if (item?.id) serverMap.set(item.id, item);
  }
  const merged = [];
  const seen = new Set();
  for (const item of clientItems) {
    if (!item?.id) continue;
    const existing = serverMap.get(item.id);
    merged.push(existing && prefer ? prefer(existing, item) : item);
    seen.add(item.id);
  }
  if (keepServerOnly) {
    for (const item of serverItems) {
      if (item?.id && !seen.has(item.id)) merged.push(item);
    }
  }
  return merged;
}

export function preferPromise(server, client) {
  const serverRank = PROMISE_RANK[server.status] || 0;
  const clientRank = PROMISE_RANK[client.status] || 0;
  if (serverRank > clientRank) {
    return { ...client, ...server, status: server.status, outcome: server.outcome || client.outcome };
  }
  return { ...server, ...client };
}

export function preferCustomer(server, client) {
  const serverAuto = server.status === 'Promise to Pay' && String(server.lastContact || '').startsWith('Promise ·');
  const clientOlder = client.status !== 'Promise to Pay' && client.status !== 'Paid' && client.status !== 'Cancelled';
  if (serverAuto && clientOlder) {
    return {
      ...client,
      status: server.status,
      collectionStage: server.collectionStage || client.collectionStage,
      promisedDate: server.promisedDate || client.promisedDate,
      promisedAmount: server.promisedAmount ?? client.promisedAmount,
      nextFollowUp: server.nextFollowUp || client.nextFollowUp,
      lastContact: server.lastContact,
    };
  }
  if (server.lastContact === 'Promise broken' && client.status === 'Promise to Pay') {
    return {
      ...client,
      status: server.status,
      collectionStage: server.collectionStage || client.collectionStage,
      lastContact: server.lastContact,
    };
  }
  return { ...server, ...client };
}
