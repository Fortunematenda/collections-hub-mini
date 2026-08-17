import { getStoredToken } from './auth';
import { apiUrl } from './base';
import { classifyResponse } from '../../shared/response-classifier.js';

type Classification = ReturnType<typeof classifyResponse>;

export async function classifyViaApi(message: string, options: { hasAttachment?: boolean } = {}): Promise<Classification | null> {
  const token = getStoredToken();
  if (!token) return null;
  const res = await fetch(apiUrl('/api/classify'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      hasAttachment: Boolean(options.hasAttachment),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; classification?: Classification };
  if (!res.ok || !data.ok || !data.classification) return null;
  return data.classification;
}
