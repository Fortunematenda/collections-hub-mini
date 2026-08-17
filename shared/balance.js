/** Billing sign: negative = customer owes, positive = credit on the account. */

export function balanceValue(n) {
  const value = Number(n || 0);
  return Number.isFinite(value) ? value : 0;
}

export function hasOutstandingBalance(n) {
  return balanceValue(n) < 0;
}

export function hasCreditBalance(n) {
  return balanceValue(n) > 0;
}

/** Amount the customer still owes. Credits and zero return 0. */
export function amountOwed(n) {
  const value = balanceValue(n);
  return value < 0 ? -value : 0;
}

export function isClearedOrCredit(n) {
  return balanceValue(n) >= 0;
}

/** Recorded payments credit the account, so a negative owing balance moves toward zero. */
export function applyPaymentToBalance(outstanding, amount, clearAccount) {
  if (clearAccount) return 0;
  return balanceValue(outstanding) + Math.abs(balanceValue(amount));
}
