import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountStatement, buildPaymentInstructions } from './statement.js';

test('statement includes account, balance and banking details', () => {
  const built = buildAccountStatement({
    today: '2026-08-17',
    customer: {
      id: 'c1',
      name: 'Pat Client',
      accountNo: '876',
      outstanding: -461,
      originalOutstanding: -461,
      dueDate: '2026-08-01',
      servicePackage: 'Fibre 50',
    },
    company: {
      name: 'Acme ISP',
      bankName: 'FNB',
      bankAccountName: 'Acme ISP',
      bankAccountNumber: '123456789',
      bankBranchCode: '250655',
      paymentInstructions: 'Use the account number as reference.',
    },
    payments: [{ customerId: 'c1', paymentDate: '2026-07-01', amount: 100, reference: 'EFT' }],
  });
  assert.match(built.text, /876/);
  assert.match(built.text, /Fibre 50/);
  assert.match(built.text, /FNB/);
  assert.match(built.text, /123456789/);
  assert.equal(built.mime, 'text/html');
});

test('payment instructions stay company-scoped', () => {
  const text = buildPaymentInstructions({
    name: 'Acme ISP',
    bankAccountNumber: '123',
    paymentInstructions: 'Pay by EFT',
  });
  assert.match(text, /Acme ISP/);
  assert.match(text, /123/);
});
