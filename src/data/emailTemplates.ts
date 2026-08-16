import type { MessageTemplate } from '../types';

export const EMAIL_TEMPLATE_BODIES = {
  first: `Hi {{name}},

This is an account update from {{company}} for account {{account_no}}.

Amount due: {{amount}}
Due date: {{due_date}}

If you would like a payment plan, reply to this message.

Kind regards
{{company}}`,
  followup: `Hi {{name}},

A reminder from {{company}} about account {{account_no}}.

Amount due: {{amount}}

Reply to this message if you need a payment date or a plan.

Kind regards
{{company}}`,
  promise: `Hi {{name}},

A reminder that {{amount}} for account {{account_no}} is expected. If this is already paid, no action is needed.

Kind regards
{{company}}`,
};

export function isLegacyCollectionBody(body?: string) {
  return /outstanding balance|arrange payment at your earliest|{{company}} Collections|still unpaid|settle this account/i.test(
    String(body || ''),
  );
}

export function defaultEmailTemplates(companyId: string): MessageTemplate[] {
  return [
    {
      id: `t-email-first-${companyId}`,
      companyId,
      name: 'First reminder',
      channel: 'Email',
      stage: 'Payment Due',
      body: EMAIL_TEMPLATE_BODIES.first,
    },
    {
      id: `t-email-followup-${companyId}`,
      companyId,
      name: 'Follow-up',
      channel: 'Email',
      stage: 'Follow-up',
      body: EMAIL_TEMPLATE_BODIES.followup,
    },
    {
      id: `t-email-promise-${companyId}`,
      companyId,
      name: 'Promise reminder',
      channel: 'Email',
      stage: 'Promise to Pay',
      body: EMAIL_TEMPLATE_BODIES.promise,
    },
  ];
}
