import { getStoredToken } from './auth';
import { apiUrl } from './base';

export type AppDataPayload = {
  companies: unknown[];
  companyId: string;
  customers: unknown[];
  recoveries: unknown[];
  imports: unknown[];
  templates: unknown[];
  equipment: unknown[];
  promises: unknown[];
  payments: unknown[];
  communications: unknown[];
  notes: unknown[];
  followUps: unknown[];
  activities: unknown[];
};

export async function fetchAppData(): Promise<{ ok: true; data: AppDataPayload } | { ok: false; error: string }> {
  try {
    const token = getStoredToken();
    if (!token) return { ok: false, error: 'Not signed in.' };
    const res = await fetch(apiUrl('/api/data'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: AppDataPayload };
    if (!res.ok || !data.ok || !data.data) {
      return { ok: false, error: data.error || `Failed to load data (${res.status})` };
    }
    return { ok: true, data: data.data };
  } catch {
    return { ok: false, error: 'API unreachable while loading shared data.' };
  }
}

export async function saveAppData(
  payload: AppDataPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const token = getStoredToken();
    if (!token) return { ok: false, error: 'Not signed in.' };
    const res = await fetch(apiUrl('/api/data'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to save data (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'API unreachable while saving shared data.' };
  }
}
