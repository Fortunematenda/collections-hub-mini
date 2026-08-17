import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { buildAccountStatement, buildPaymentInstructions } from '../../shared/statement.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '..', 'data', 'uploads');
const MAX_BYTES = 8 * 1024 * 1024;

export function uploadsRoot() {
  return UPLOAD_ROOT;
}

export function saveDocumentBuffer(id, buffer) {
  if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
  writeFileSync(path.join(UPLOAD_ROOT, id), buffer);
}

export function readDocumentBuffer(id) {
  const dest = path.join(UPLOAD_ROOT, id);
  if (!existsSync(dest)) return null;
  return readFileSync(dest);
}

function meta({ companyId, customerId, kind, filename, mime, size, uploadedBy, communicationId, taskId }) {
  return {
    id: randomUUID(),
    companyId,
    customerId,
    kind,
    filename,
    mime,
    size,
    uploadedBy: uploadedBy || 'System',
    communicationId,
    taskId,
    createdAt: new Date().toISOString(),
  };
}

export function createStatementDocument(store, { customerId, uploadedBy = 'System', communicationId, taskId }) {
  const customer = (store.customers || []).find((item) => item.id === customerId);
  if (!customer) return null;
  const today = new Date().toISOString().slice(0, 10);
  const already = (store.documents || []).find(
    (item) => item.customerId === customerId && item.kind === 'statement' && String(item.createdAt || '').slice(0, 10) === today,
  );
  if (already) return { document: already, text: null, html: null, reused: true };
  const company = (store.companies || []).find((item) => item.id === customer.companyId);
  const built = buildAccountStatement({
    customer,
    company,
    payments: store.payments || [],
    today,
  });
  const buffer = Buffer.from(built.html, 'utf8');
  const document = meta({
    companyId: customer.companyId,
    customerId: customer.id,
    kind: 'statement',
    filename: built.filename,
    mime: built.mime,
    size: buffer.length,
    uploadedBy,
    communicationId,
    taskId,
  });
  saveDocumentBuffer(document.id, buffer);
  return { document, text: built.text, html: built.html, reused: false };
}

export function createPaymentDetailsDocument(store, { customerId, uploadedBy = 'System', communicationId, taskId }) {
  const customer = (store.customers || []).find((item) => item.id === customerId);
  if (!customer) return null;
  const company = (store.companies || []).find((item) => item.id === customer.companyId);
  const text = buildPaymentInstructions(company);
  const filename = `payment-details-${customer.accountNo || 'account'}.txt`;
  const buffer = Buffer.from(text, 'utf8');
  const document = meta({
    companyId: customer.companyId,
    customerId: customer.id,
    kind: 'payment-details',
    filename,
    mime: 'text/plain',
    size: buffer.length,
    uploadedBy,
    communicationId,
    taskId,
  });
  saveDocumentBuffer(document.id, buffer);
  return { document, text, html: null, reused: false };
}

export function createUploadedDocument({ companyId, customerId, kind, filename, mime, buffer, uploadedBy, communicationId, taskId }) {
  if (!buffer || !buffer.length) throw new Error('File is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('File is larger than 8 MB.');
  const document = meta({
    companyId,
    customerId,
    kind: kind || 'other',
    filename: filename || 'upload.bin',
    mime: mime || 'application/octet-stream',
    size: buffer.length,
    uploadedBy,
    communicationId,
    taskId,
  });
  saveDocumentBuffer(document.id, buffer);
  return document;
}

export { MAX_BYTES };
