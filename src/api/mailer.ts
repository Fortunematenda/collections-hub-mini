import { getStoredToken } from './auth';
import { apiUrl } from './base';

export type SendMailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  customerName?: string;
  accountNo?: string;
  inReplyTo?: string;
  references?: string;
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
      signal: AbortSignal.timeout(25000),
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
  } catch (error) {
    const timedOut =
      error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      ok: false,
      error: timedOut
        ? 'Email send timed out. The mail server did not respond in time.'
        : 'Mail server is unreachable. Start it with npm run server (or npm run dev).',
    };
  }
}

export async function mailerHealth(): Promise<{ ok: boolean; mailer?: string; imap?: string }> {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) return { ok: false };
    return (await res.json()) as { ok: boolean; mailer?: string; imap?: string };
  } catch {
    return { ok: false };
  }
}

export type InboxSyncResult =
  | {
      ok: true;
      imported: number;
      unmatched?: number;
      reassigned?: number;
      busy?: boolean;
      communications?: Array<{
        id: string;
        companyId: string;
        customerId: string;
        channel: 'Email';
        direction: 'Incoming';
        subject?: string;
        message: string;
        status: string;
        createdAt: string;
        createdBy: string;
        externalId?: string;
        messageId?: string;
        readAt?: string;
        handledAs?: 'promise' | 'none' | 'skipped';
      }>;
      activities?: Array<{
        id: string;
        companyId: string;
        customerId: string;
        user: string;
        action: string;
        description: string;
        createdAt: string;
      }>;
      customers?: Array<{ id: string; lastContact?: string; collectionStage?: string }>;
    }
  | { ok: false; error: string };

export async function syncInboxViaApi(): Promise<InboxSyncResult> {
  try {
    const token = getStoredToken();
    if (!token) return { ok: false, error: 'Please sign in again to check the inbox.' };
    const res = await fetch(apiUrl('/api/mail/inbox/sync'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as InboxSyncResult & { error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Inbox sync failed (${res.status})` };
    }
    return data;
  } catch {
    return { ok: false, error: 'API server is unreachable. Start it with npm run dev.' };
  }
}
