import { getStoredToken } from './auth';
import { apiUrl } from './base';

export type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  customerName?: string;
  accountNo?: string;
};

export type SendMailResult =
  | { ok: true; messageId?: string; accepted?: string[] }
  | { ok: false; error: string };

export async function sendMailViaApi(payload: SendMailPayload): Promise<SendMailResult> {
  try {
    const token = getStoredToken();
    if (!token) {
      return { ok: false, error: 'Please sign in again to send email.' };
    }
    const res = await fetch(apiUrl('/api/mail/send'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      messageId?: string;
      accepted?: string[];
    };
    if (res.status === 401) {
      return { ok: false, error: data.error || 'Session expired. Please sign in again.' };
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Email failed (${res.status})` };
    }
    return { ok: true, messageId: data.messageId, accepted: data.accepted };
  } catch {
    return {
      ok: false,
      error: 'Mail server is unreachable. Start it with npm run server (or npm run dev).',
    };
  }
}

export async function mailerHealth(): Promise<{ ok: boolean; mailer?: string }> {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; mailer?: string };
  } catch {
    return { ok: false };
  }
}
