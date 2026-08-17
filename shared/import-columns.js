export function normalize(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function cellFromRow(row, column) {
  if (!row || !column) return '';
  if (Object.prototype.hasOwnProperty.call(row, column)) return row[column];
  const want = normalize(column);
  if (!want) return '';
  const found = Object.keys(row).find((header) => normalize(header) === want);
  return found ? row[found] : '';
}

export const aliases = {
  accountNo: ['account', 'accountno', 'accountnumber', 'clientno', 'customerno', 'customerid', 'id'],
  name: ['client', 'clientname', 'customer', 'customername', 'name', 'fullname'],
  customerReference: ['customerreference', 'reference', 'ref', 'clientref'],
  servicePackage: [
    'service',
    'servicepackage',
    'servicetype',
    'servicedescription',
    'servicename',
    'packagename',
    'packagedescription',
    'package',
    'product',
    'productname',
    'plan',
    'profile',
    'deal',
    'fibrepackage',
  ],
  monthlySubscription: [
    'monthlysubscription',
    'subscription',
    'monthlyfee',
    'monthlycharge',
    'monthlyamount',
    'monthlycost',
    'monthly',
    'recurring',
    'mrc',
    'debitorder',
    'packagefee',
    'subscriptionfee',
  ],
  originalOutstanding: ['originaloutstanding', 'originalbalance', 'originalamount', 'openingbalance', 'openingoutstanding'],
  outstanding: ['outstanding', 'currentoutstanding', 'amountoutstanding', 'balance', 'outstandingamount', 'amountdue', 'arrears'],
  dueDate: ['duedate', 'datedue', 'paymentdate', 'invoicedate', 'billdate', 'due'],
  collectionStage: ['collectionstatus', 'collectionstage', 'status', 'accountstatus'],
  phone: ['phone', 'mobile', 'cell', 'cellphone', 'telephone', 'contactnumber'],
  whatsapp: ['whatsapp', 'whatsappnumber', 'wa'],
  email: ['email', 'emailaddress'],
  preferredContact: ['preferredcontact', 'preferredchannel', 'contactmethod'],
  language: ['language', 'lang', 'locale'],
  address: ['address', 'installationaddress', 'serviceaddress'],
  suburb: ['suburb', 'area', 'township'],
  city: ['city', 'town'],
  province: ['province', 'state', 'region'],
  postalCode: ['postalcode', 'postcode', 'zip', 'zipcode'],
  nextFollowUp: ['nextfollowup', 'followup', 'followupdate', 'nextaction'],
  assignedCollector: ['assignedcollector', 'collector', 'agent', 'assignedto'],
  equipment: ['equipment', 'equipmentsummary', 'device', 'cpe', 'antenna'],
};

function scoreHeader(key, header) {
  const n = normalize(header);
  const wanted = (aliases[key] || [key]).map(normalize).filter(Boolean);
  const keyNorm = normalize(key);
  let score = 0;
  if (keyNorm.length >= 6 && n.includes(keyNorm)) score = keyNorm.length;
  for (const alias of wanted) {
    if (n === alias) score = Math.max(score, alias.length + 20);
    else if (alias.length >= 5 && n.includes(alias)) score = Math.max(score, alias.length);
    else if (alias.length >= 8 && alias.includes(n)) score = Math.max(score, n.length);
  }
  if (key === 'servicePackage') {
    if (n.includes('address') || n.includes('phone') || n.includes('email') || n.includes('account')) return 0;
  }
  if (key === 'monthlySubscription') {
    if (n.includes('outstanding') || n.includes('balance') || n.includes('overdue') || n.includes('original') || n.includes('due')) {
      return 0;
    }
  }
  if (key === 'dueDate') {
    if (n.includes('follow') || n.includes('birth') || n.includes('created') || n.includes('overdue')) return 0;
  }
  if (key === 'outstanding' && n.includes('original')) return 0;
  return score;
}

export function findColumn(headers, key) {
  const list = Array.isArray(headers) ? headers : [];
  const wanted = (aliases[key] || [key]).map(normalize).filter(Boolean);
  const exact = list
    .map((header) => {
      const n = normalize(header);
      const alias = wanted.find((item) => item === n);
      return alias ? { header, score: alias.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  if (exact[0]) return exact[0].header;
  const scored = list
    .map((header) => ({ header, score: scoreHeader(key, header) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.header || '';
}

export function completeMapping(mapping, headers) {
  const next = { ...(mapping || {}) };
  for (const key of Object.keys(aliases)) {
    if (!next[key]) next[key] = findColumn(headers, key);
  }
  return next;
}

export function preferDetectedMapping(detected, saved, rows) {
  const next = { ...detected };
  const first = rows && rows[0] ? rows[0] : {};
  const headers = Object.keys(first);
  for (const [key, col] of Object.entries(saved || {})) {
    if (!col) continue;
    const exists =
      headers.includes(col) ||
      headers.some((header) => normalize(header) === normalize(col));
    if (headers.length && !exists) continue;
    const detectedCol = detected[key];
    const savedVal = String(cellFromRow(first, col) ?? '').trim();
    const detectedVal = String(cellFromRow(first, detectedCol) ?? '').trim();
    if (detectedCol && detectedCol !== col && detectedVal && !savedVal) continue;
    next[key] = col;
  }
  return next;
}
