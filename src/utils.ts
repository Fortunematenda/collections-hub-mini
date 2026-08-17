import { addDays, differenceInCalendarDays, format, isValid, lastDayOfMonth, nextDay, parse, parseISO, startOfDay } from 'date-fns';
import type { AccountStatus, RecoveryStatus } from './types';
import { amountOwed, applyPaymentToBalance, hasCreditBalance, hasOutstandingBalance, isClearedOrCredit } from '../shared/balance.js';

export { amountOwed, applyPaymentToBalance, hasCreditBalance, hasOutstandingBalance, isClearedOrCredit };

export const statusColor: Record<AccountStatus, string> = {
  'Payment Due': 'yellow',
  'Follow-up': 'indigo',
  'Promise to Pay': 'blue',
  Paid: 'green',
  Unresponsive: 'red',
  Cancelled: 'gray',
  'Recovery Required': 'orange',
};

export const recoveryColor: Record<RecoveryStatus, string> = {
  'Awaiting assignment': 'yellow',
  Scheduled: 'blue',
  Recovered: 'green',
  'Unable to recover': 'red',
  'Recovery Required': 'orange',
  'Technician Assigned': 'cyan',
  Attempted: 'grape',
  'Customer Unavailable': 'pink',
  Rescheduled: 'violet',
  Damaged: 'red',
  'Not Found': 'gray',
  'Written Off': 'dark',
  Closed: 'gray',
};

export const money = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n || 0);

export const amountClass = (n: number) => {
  if (n < 0) return 'amount amount-negative';
  if (n > 0) return 'amount amount-credit';
  return 'amount';
};

export function compareAccountNo(a?: string, b?: string) {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

/** Parse Excel/CSV money, keeping the file's sign: negative = owing, positive = credit. */
export function parseSignedAmount(raw: unknown) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  const parenNegative = /^\(.*\)$/.test(text);
  const trailingNegative = /-$/.test(text.replace(/\s/g, ''));
  const normalized = text.replace(/[()]/g, '').replace(/[−–]/g, '-').replace(/[^0-9.-]/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;
  return parenNegative || trailingNegative ? -Math.abs(value) : value;
}

export const initials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const safeDate = (date?: string) => {
  if (!date) return '—';
  try {
    return format(parseISO(date.slice(0, 10)), 'dd MMM yyyy');
  } catch {
    return date;
  }
};

export const safeDateTime = (date?: string) => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy · HH:mm');
  } catch {
    return date;
  }
};

export const daysOverdue = (dueDate?: string) => {
  if (!dueDate) return 0;
  try {
    const days = differenceInCalendarDays(new Date(), parseISO(dueDate.slice(0, 10)));
    return Math.max(0, days);
  } catch {
    return 0;
  }
};

export { aliases, cellFromRow, completeMapping, findColumn, normalize, preferDetectedMapping } from '../shared/import-columns.js';

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const CURRENT_USER = 'System';

export function actorName() {
  try {
    const raw = localStorage.getItem('ch_auth_user');
    if (!raw) return CURRENT_USER;
    const user = JSON.parse(raw) as { name?: string; email?: string };
    return user.name || user.email || CURRENT_USER;
  } catch {
    return CURRENT_USER;
  }
}

export function fillTemplate(
  body: string,
  vars: Record<string, string | number | undefined>,
) {
  let out = body;
  const map: Record<string, string> = {
    '{{customer_name}}': String(vars.customer_name ?? vars.name ?? ''),
    '{{name}}': String(vars.name ?? vars.customer_name ?? ''),
    '{{account_number}}': String(vars.account_number ?? vars.account_no ?? ''),
    '{{account_no}}': String(vars.account_no ?? vars.account_number ?? ''),
    '{{outstanding_amount}}': String(vars.outstanding_amount ?? vars.amount ?? ''),
    '{{amount}}': String(vars.amount ?? vars.outstanding_amount ?? ''),
    '{{due_date}}': String(vars.due_date ?? ''),
    '{{company_name}}': String(vars.company_name ?? vars.company ?? ''),
    '{{company}}': String(vars.company ?? vars.company_name ?? ''),
    '{{promise_date}}': String(vars.promise_date ?? ''),
  };
  for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
  return out;
}

/** Paid, credit, or R 0 accounts must not get collection emails. Negative balances are outstanding. */
export function isPaidOrZeroBalance(customer: { outstanding?: number; status?: string }) {
  if (customer.status === 'Cancelled') return true;
  return !hasOutstandingBalance(customer.outstanding);
}

export function collectionEmailSubject(accountNo: string, companyName?: string) {
  const account = String(accountNo || '').trim() || 'account';
  const company = String(companyName || '').trim();
  return company ? `Account ${account} — ${company}` : `Account ${account}`;
}

export function normalizeTab(value: string | null | undefined, allowed: readonly string[], fallback: string) {
  const tab = String(value || '').trim();
  return allowed.includes(tab) ? tab : fallback;
}

export function replyEmailSubject(subject?: string) {
  const value = String(subject || '').trim() || 'your email';
  return /^re\s*:/i.test(value) ? value : `Re: ${value}`;
}

export function rfcMessageId(value?: string) {
  const raw = String(value || '')
    .replace(/^imap:/i, '')
    .replace(/^smtp:/i, '')
    .trim()
    .replace(/^<|>$/g, '');
  return raw ? `<${raw}>` : '';
}

export function isUnreadCommunication(item: { direction?: string; readAt?: string }) {
  return item.direction === 'Incoming' && !item.readAt;
}

export function communicationCardClass(item: { direction?: string; readAt?: string }) {
  const unread = isUnreadCommunication(item) ? ' timeline-item-unread' : '';
  if (item.direction === 'Incoming') return `timeline-item timeline-item-in${unread}`;
  if (item.direction === 'Outgoing') return 'timeline-item timeline-item-out';
  return 'timeline-item timeline-item-internal';
}

export function communicationRowClass(item: { direction?: string; readAt?: string }) {
  if (isUnreadCommunication(item)) return 'comm-row-in comm-row-unread';
  if (item.direction === 'Incoming') return 'comm-row-in';
  if (item.direction === 'Outgoing') return 'comm-row-out';
  return 'comm-row-internal';
}

export function splitEmailThread(raw?: string) {
  const text = String(raw || '').replace(/\r/g, '');
  if (!text.trim()) return { body: '', quote: '' };

  const lines = text.split('\n');
  const bodyLines: string[] = [];
  let cut = lines.length;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const next = (lines[i + 1] || '').trim();
    const isGmailOn =
      /^On\s.+/i.test(trimmed) &&
      (/wrote:\s*$/i.test(trimmed) || /<[^>]+@[^>]+>/.test(trimmed) || /^wrote:\s*$/i.test(next));
    if (
      /^>/.test(trimmed) ||
      /^wrote:\s*$/i.test(trimmed) ||
      isGmailOn ||
      /^-{2,} ?Original Message/i.test(trimmed) ||
      (/^From:\s.+/i.test(trimmed) && /^(Sent|Date):/i.test(next))
    ) {
      cut = i;
      break;
    }
    bodyLines.push(lines[i]);
  }

  return {
    body: bodyLines
      .join('\n')
      .replace(/\s+On [A-Z][a-z]{2}, \d{1,2} \w+ \d{4}[\s\S]*$/i, '')
      .trim(),
    quote: lines.slice(cut).join('\n').trim(),
  };
}

export function cleanEmailBody(raw?: string) {
  const { body } = splitEmailThread(raw);
  return body;
}

const PROMISE_NO =
  /\b(already paid|i have paid|i paid|have paid|not interested|no longer|cancel(?:ling|led)?|can'?t pay|cannot pay|won'?t pay|will not pay|unable to pay)\b/i;
const PROMISE_YES =
  /\b(promise[sd]? to pay|i(?:'| a)?m going to pay|i(?:'?ll| will) pay|will pay|can pay|pay (?:on|by|before)|payment (?:on|by)|settle (?:on|by)|make (?:a )?payment|send (?:the )?payment|give me until|pay you)\b/i;
const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function isoDay(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function upcoming(date: Date) {
  const today = startOfDay(new Date());
  const value = startOfDay(date);
  if (value < today) value.setFullYear(value.getFullYear() + 1);
  return value;
}

function parseMonthNameDate(day: string, monthRaw: string, year: string, now: Date) {
  const month = monthRaw.toLowerCase() === 'sept' ? 'sep' : monthRaw;
  for (const fmt of ['d MMMM yyyy', 'd MMM yyyy']) {
    const value = parse(`${day} ${month} ${year}`, fmt, now);
    if (isValid(value)) return value;
  }
  return null;
}

export function parsePromiseFromReply(raw?: string): { date: string; dateInferred: boolean } | null {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text || PROMISE_NO.test(text) || !PROMISE_YES.test(text)) return null;

  const now = new Date();
  const lower = text.toLowerCase();

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    const date = parseISO(iso[1]);
    if (isValid(date)) return { date: isoDay(upcoming(date)), dateInferred: false };
  }

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : now.getFullYear();
    const date = new Date(year, month - 1, day);
    if (isValid(date) && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: isoDay(upcoming(date)), dateInferred: false };
    }
  }

  const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})(?:\\s+(\\d{4}))?\\b`, 'i'));
  if (dayMonth) {
    const value = parseMonthNameDate(dayMonth[1], dayMonth[2], dayMonth[3] || String(now.getFullYear()), now);
    if (value) return { date: isoDay(upcoming(value)), dateInferred: false };
  }

  const monthDay = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, 'i'));
  if (monthDay) {
    const value = parseMonthNameDate(monthDay[2], monthDay[1], monthDay[3] || String(now.getFullYear()), now);
    if (value) return { date: isoDay(upcoming(value)), dateInferred: false };
  }

  if (/\btomorrow\b/i.test(text)) return { date: isoDay(addDays(now, 1)), dateInferred: false };
  if (/\btoday\b/i.test(text)) return { date: isoDay(now), dateInferred: false };
  if (/\bnext week\b/i.test(text)) return { date: isoDay(addDays(now, 7)), dateInferred: false };
  if (/\bend of (the )?month\b/i.test(text) || /\bmonth end\b/i.test(text)) {
    return { date: isoDay(lastDayOfMonth(now)), dateInferred: false };
  }

  const ordinal = text.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinal) {
    const day = Number(ordinal[1]);
    if (day >= 1 && day <= 31) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (startOfDay(date) < startOfDay(now)) date.setMonth(date.getMonth() + 1);
      return { date: isoDay(date), dateInferred: false };
    }
  }

  for (let i = 0; i < WEEKDAYS.length; i += 1) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`, 'i').test(lower)) {
      const date = now.getDay() === i ? startOfDay(now) : nextDay(now, i as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      return { date: isoDay(date), dateInferred: false };
    }
  }

  return { date: isoDay(addDays(now, 7)), dateInferred: true };
}

export function fullAddress(parts: {
  address?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}) {
  return [parts.address, parts.suburb, parts.city, parts.province, parts.postalCode].filter(Boolean).join(', ') || '—';
}
