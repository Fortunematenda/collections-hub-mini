import { amountOwed, hasOutstandingBalance } from './balance.js';

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function diffDays(fromIso, toIso) {
  const from = parseDay(fromIso);
  const to = parseDay(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function paused(customer, today) {
  if (customer?.sensitiveAccount) return true;
  if (!customer?.automationPaused) return false;
  const until = String(customer.automationPausedUntil || '').slice(0, 10);
  return !until || until >= today;
}

function alreadySent(customer, ruleId) {
  return Boolean(customer?.reminderSent && customer.reminderSent[ruleId]);
}

function fill(body, vars) {
  let out = String(body || '');
  const map = {
    '{{customer_name}}': String(vars.name || ''),
    '{{name}}': String(vars.name || ''),
    '{{account_number}}': String(vars.accountNo || ''),
    '{{account_no}}': String(vars.accountNo || ''),
    '{{outstanding_amount}}': String(vars.amount || ''),
    '{{amount}}': String(vars.amount || ''),
    '{{due_date}}': String(vars.dueDate || ''),
    '{{company_name}}': String(vars.company || ''),
    '{{company}}': String(vars.company || ''),
    '{{promise_date}}': String(vars.promiseDate || ''),
  };
  for (const [key, value] of Object.entries(map)) out = out.split(key).join(value);
  return out;
}

function matchesTrigger(rule, customer, today, store) {
  if (!hasOutstandingBalance(customer.outstanding)) return false;
  if (customer.status === 'Cancelled' || customer.status === 'Paid') return false;
  const due = String(customer.dueDate || '').slice(0, 10);
  const offset = Number(rule.daysOffset || 0);
  if (rule.trigger === 'Before due date') {
    const until = diffDays(today, due);
    return until != null && until === offset;
  }
  if (rule.trigger === 'Invoice overdue') {
    const overdue = diffDays(due, today);
    return overdue != null && overdue >= offset;
  }
  if (rule.trigger === 'Promise due') {
    return String(customer.promisedDate || '').slice(0, 10) === today && customer.status === 'Promise to Pay';
  }
  if (rule.trigger === 'Promise broken') {
    return String(customer.lastContact || '').toLowerCase().includes('promise broken');
  }
  if (rule.trigger === 'Communication failed') {
    const last = [...(store.communications || [])]
      .filter((item) => item.customerId === customer.id)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    return last?.status === 'Failed';
  }
  return false;
}

export function planReminderActions(store, today = todayIso()) {
  const actions = [];
  const rules = (store.automationRules || []).filter((rule) => rule.active);
  for (const rule of rules) {
    const company = (store.companies || []).find((item) => item.id === rule.companyId);
    const template = (store.templates || []).find((item) => item.id === rule.templateId) ||
      (store.templates || []).find((item) => item.companyId === rule.companyId && item.channel === (rule.action === 'Send WhatsApp' ? 'WhatsApp' : 'Email'));
    for (const customer of store.customers || []) {
      if (customer.companyId !== rule.companyId || customer.archived) continue;
      if (paused(customer, today)) continue;
      if (alreadySent(customer, rule.id)) continue;
      if (Number(customer.outstanding) && amountOwed(customer.outstanding) < Number(rule.minimumBalance || 0)) continue;
      if (!matchesTrigger(rule, customer, today, store)) continue;
      if (rule.action === 'Send WhatsApp' && customer.contactInvalid) continue;
      const vars = {
        name: customer.name,
        accountNo: customer.accountNo,
        amount: `R ${amountOwed(customer.outstanding).toLocaleString('en-ZA')}`,
        dueDate: customer.dueDate,
        company: company?.name || '',
        promiseDate: customer.promisedDate,
      };
      const body = fill(template?.body || 'Hi {{name}}, this is a reminder from {{company}} about account {{account_no}}. Amount due: {{amount}}.', vars);
      actions.push({
        ruleId: rule.id,
        companyId: rule.companyId,
        customerId: customer.id,
        action: rule.action,
        requiresApproval: Boolean(rule.requiresApproval),
        channel: rule.action === 'Send WhatsApp' ? 'WhatsApp' : rule.action === 'Send email' ? 'Email' : 'Internal',
        to: rule.action === 'Send WhatsApp' ? customer.whatsapp || customer.phone : customer.email,
        subject: company ? `Account ${customer.accountNo} — ${company.name}` : `Account ${customer.accountNo}`,
        body,
        customerName: customer.name,
        accountNo: customer.accountNo,
      });
    }
  }
  return actions;
}

export function markReminderSent(customer, ruleId, today = todayIso()) {
  return {
    ...customer,
    reminderSent: { ...(customer.reminderSent || {}), [ruleId]: today },
  };
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function applyReminderActions(store, options = {}) {
  const today = options.today || todayIso();
  const actions = planReminderActions(store, today);
  const customers = [...(store.customers || [])];
  const communications = [...(store.communications || [])];
  const followUps = [...(store.followUps || [])];
  const workTasks = [...(store.workTasks || [])];
  const activities = [...(store.activities || [])];
  let sent = 0;
  let queued = 0;
  const createdAt = new Date().toISOString();

  for (const action of actions) {
    const index = customers.findIndex((item) => item.id === action.customerId);
    if (index < 0) continue;

    const approval =
      action.requiresApproval ||
      action.action === 'Notify manager' ||
      action.action === 'Request suspension' ||
      action.action === 'Start recovery';

    if (approval) {
      workTasks.unshift({
        id: uid('task'),
        companyId: action.companyId,
        customerId: action.customerId,
        type: 'REMINDER_APPROVAL',
        title: action.requiresApproval ? `Approve: ${action.action}` : action.action,
        queue: action.action === 'Start recovery' ? 'Recovery' : 'Needs Review',
        status: 'Pending',
        priority: 'Medium',
        dueDate: today,
        notes: action.body,
        createdAt,
      });
      customers[index] = markReminderSent(customers[index], action.ruleId, today);
      queued += 1;
      continue;
    }

    if (action.action === 'Create follow-up') {
      followUps.unshift({
        id: uid('fu'),
        companyId: action.companyId,
        customerId: action.customerId,
        followUpDate: today,
        channel: 'Any',
        assignedUser: customers[index].assignedCollector || '',
        notes: action.body,
        createdAt,
      });
      customers[index] = markReminderSent(customers[index], action.ruleId, today);
      queued += 1;
      continue;
    }

    if (action.action === 'Send email') {
      if (!action.to || !String(action.to).includes('@') || !options.sendEmail) continue;
      try {
        await options.sendEmail({
          to: action.to,
          subject: action.subject,
          text: action.body,
          customerName: action.customerName,
          accountNo: action.accountNo,
        });
        communications.unshift({
          id: uid('cm'),
          companyId: action.companyId,
          customerId: action.customerId,
          channel: 'Email',
          direction: 'Outgoing',
          subject: action.subject,
          message: action.body,
          status: 'Sent',
          createdAt,
          createdBy: 'Automation',
          automationRuleId: action.ruleId,
          handledAs: 'classified',
        });
        customers[index] = markReminderSent(customers[index], action.ruleId, today);
        sent += 1;
      } catch {
        communications.unshift({
          id: uid('cm'),
          companyId: action.companyId,
          customerId: action.customerId,
          channel: 'Email',
          direction: 'Outgoing',
          subject: action.subject,
          message: action.body,
          status: 'Failed',
          createdAt,
          createdBy: 'Automation',
          automationRuleId: action.ruleId,
        });
      }
      continue;
    }

    if (action.action === 'Send WhatsApp') {
      if (!action.to || !options.sendWhatsApp) continue;
      try {
        await options.sendWhatsApp({ to: action.to, message: action.body });
        communications.unshift({
          id: uid('cm'),
          companyId: action.companyId,
          customerId: action.customerId,
          channel: 'WhatsApp',
          direction: 'Outgoing',
          message: action.body,
          status: 'Sent',
          createdAt,
          createdBy: 'Automation',
          automationRuleId: action.ruleId,
          handledAs: 'classified',
        });
        customers[index] = markReminderSent(customers[index], action.ruleId, today);
        sent += 1;
      } catch {
        communications.unshift({
          id: uid('cm'),
          companyId: action.companyId,
          customerId: action.customerId,
          channel: 'WhatsApp',
          direction: 'Outgoing',
          message: action.body,
          status: 'Failed',
          createdAt,
          createdBy: 'Automation',
          automationRuleId: action.ruleId,
        });
      }
    }
  }

  return {
    store: { ...store, customers, communications, followUps, workTasks, activities },
    sent,
    queued,
  };
}

export { ymd, todayIso };
