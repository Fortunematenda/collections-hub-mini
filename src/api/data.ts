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
  integrations: unknown[];
  automationRules: unknown[];
  assignmentRules?: unknown[];
  responseRules?: unknown[];
  classifiedResponses?: unknown[];
  workTasks?: unknown[];
  disputeCases?: unknown[];
  teams?: unknown[];
  documents?: unknown[];
  importMappings?: Record<string, Record<string, string>>;
  revision?: number;
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
): Promise<
  | { ok: true; revision?: number }
  | { ok: false; error: string; stale?: boolean; data?: AppDataPayload }
> {
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
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      stale?: boolean;
      revision?: number;
      data?: AppDataPayload;
    };
    if (res.status === 409 || data.stale) {
      return { ok: false, stale: true, error: data.error || 'Workspace was updated elsewhere.', data: data.data };
    }
    if (res.status === 403) {
      return { ok: false, error: data.error || 'You do not have permission to save changes.' };
    }
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Failed to save data (${res.status})` };
    }
    return { ok: true, revision: data.revision };
  } catch {
    return { ok: false, error: 'API unreachable while saving shared data.' };
  }
}
