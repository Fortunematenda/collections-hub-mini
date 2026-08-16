import { getStoredToken } from './auth';
import { apiUrl } from './base';

export type SendWhatsAppPayload = {
  to: string;
  message: string;
  from?: string;
  customerName?: string;
  accountNo?: string;
  dueDate?: string;
  amount?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
};

export type SendWhatsAppResult =
  | { ok: true; sid?: string; status?: string; to?: string; from?: string }
  | { ok: false; error: string };

export async function sendWhatsAppViaApi(payload: SendWhatsAppPayload): Promise<SendWhatsAppResult> {
  try {
    const token = getStoredToken();
    if (!token) {
      return { ok: false, error: 'Please sign in again to send WhatsApp.' };
    }
    const res = await fetch(apiUrl('/api/whatsapp/send'), {
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
      sid?: string;
      status?: string;
      to?: string;
      from?: string;
    };
    if (res.status === 401) {
      return { ok: false, error: data.error || 'Session expired. Please sign in again.' };
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `WhatsApp failed (${res.status})` };
    }
    return { ok: true, sid: data.sid, status: data.status, to: data.to, from: data.from };
  } catch {
    return {
      ok: false,
      error: 'API server is unreachable. Start it with npm run server (or npm run dev).',
    };
  }
}
