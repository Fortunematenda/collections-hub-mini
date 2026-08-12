import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { AccountStatus, RecoveryStatus } from './types';

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

export const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

export const aliases: Record<string, string[]> = {
  accountNo: ['account', 'accountno', 'accountnumber', 'clientno', 'customerno', 'id'],
  name: ['client', 'clientname', 'customer', 'customername', 'name', 'fullname'],
  phone: ['phone', 'mobile', 'cell', 'cellphone', 'telephone', 'contactnumber'],
  email: ['email', 'emailaddress'],
  outstanding: ['outstanding', 'amountoutstanding', 'balance', 'outstandingamount', 'amountdue', 'arrears'],
  dueDate: ['duedate', 'date due', 'paymentdate', 'due'],
  address: ['address', 'installationaddress', 'serviceaddress'],
  equipment: ['equipment', 'device', 'cpe', 'antenna'],
};

export function findColumn(headers: string[], key: string) {
  const wanted = aliases[key].map(normalize);
  return headers.find((h) => wanted.includes(normalize(h))) || '';
}

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

export function fullAddress(parts: {
  address?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
}) {
  return [parts.address, parts.suburb, parts.city, parts.province, parts.postalCode].filter(Boolean).join(', ') || '—';
}
