import { getStoredToken } from './auth';
import { apiUrl } from './base';
import type { CustomerDocument } from '../types';

async function authJson(path: string, init?: RequestInit) {
  const token = getStoredToken();
  if (!token) throw new Error('Not signed in.');
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; document?: CustomerDocument };
  if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function uploadDocumentFile(input: {
  customerId: string;
  kind: CustomerDocument['kind'];
  file: File;
  communicationId?: string;
  taskId?: string;
}) {
  const dataBase64 = await fileToBase64(input.file);
  const data = await authJson('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      customerId: input.customerId,
      kind: input.kind,
      filename: input.file.name,
      mime: input.file.type || 'application/octet-stream',
      dataBase64,
      communicationId: input.communicationId,
      taskId: input.taskId,
    }),
  });
  return data.document as CustomerDocument;
}

export async function generateStatementDocument(customerId: string) {
  const data = await authJson('/api/documents/statement', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
  return data.document as CustomerDocument;
}

export async function generatePaymentDetailsDocument(customerId: string) {
  const data = await authJson('/api/documents/payment-details', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  });
  return data.document as CustomerDocument;
}

export async function downloadDocument(doc: Pick<CustomerDocument, 'id' | 'filename' | 'mime'>) {
  const token = getStoredToken();
  if (!token) throw new Error('Not signed in.');
  const res = await fetch(apiUrl(`/api/documents/${doc.id}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unable to download file.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.filename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}
