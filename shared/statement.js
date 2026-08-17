import { amountOwed } from './balance.js';

export function buildAccountStatement({ customer, company, payments = [], today }) {
  const day = String(today || new Date().toISOString().slice(0, 10));
  const lines = [
    company?.name || 'Collections',
    company?.tradingName ? `Trading as ${company.tradingName}` : '',
    '',
    'ACCOUNT STATEMENT',
    `Date: ${day}`,
    '',
    `Customer: ${customer?.name || ''}`,
    `Account: ${customer?.accountNo || ''}`,
    customer?.customerReference ? `Reference: ${customer.customerReference}` : '',
    customer?.servicePackage ? `Service / package: ${customer.servicePackage}` : '',
    `Due date: ${customer?.dueDate || '—'}`,
    `Original balance: R ${Number(customer?.originalOutstanding ?? customer?.outstanding ?? 0).toLocaleString('en-ZA')}`,
    `Current balance: R ${Number(customer?.outstanding || 0).toLocaleString('en-ZA')}`,
    `Amount owing: R ${amountOwed(customer?.outstanding).toLocaleString('en-ZA')}`,
    '',
    'Recent payments',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '');

  const rows = [...payments]
    .filter((item) => item.customerId === customer?.id)
    .sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || '')))
    .slice(0, 12);
  if (!rows.length) lines.push('None recorded.');
  for (const item of rows) {
    lines.push(`${item.paymentDate || ''}  R ${Number(item.amount || 0).toLocaleString('en-ZA')}  ${item.reference || item.recordedBy || ''}`);
  }

  if (company?.paymentInstructions || company?.bankAccountNumber) {
    lines.push('', 'Payment details');
    if (company.bankName) lines.push(`Bank: ${company.bankName}`);
    if (company.bankAccountName) lines.push(`Account name: ${company.bankAccountName}`);
    if (company.bankAccountNumber) lines.push(`Account number: ${company.bankAccountNumber}`);
    if (company.bankBranchCode) lines.push(`Branch code: ${company.bankBranchCode}`);
    if (company.paymentInstructions) lines.push(company.paymentInstructions);
  }

  const text = lines.filter((line) => line != null).join('\n').trim() + '\n';
  const html = `<!doctype html><html><body style="font-family:Segoe UI,sans-serif;white-space:pre-wrap">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</body></html>`;
  const filename = `statement-${customer?.accountNo || 'account'}-${day}.html`;
  return { filename, mime: 'text/html', text, html };
}

export function buildPaymentInstructions(company) {
  const lines = ['Payment details'];
  if (company?.name) lines.unshift(company.name, '');
  if (company?.bankName) lines.push(`Bank: ${company.bankName}`);
  if (company?.bankAccountName) lines.push(`Account name: ${company.bankAccountName}`);
  if (company?.bankAccountNumber) lines.push(`Account number: ${company.bankAccountNumber}`);
  if (company?.bankBranchCode) lines.push(`Branch code: ${company.bankBranchCode}`);
  if (company?.paymentInstructions) lines.push('', company.paymentInstructions);
  if (lines.length <= 2) lines.push('Ask the assigned collector for this company\'s banking details.');
  return lines.join('\n');
}
