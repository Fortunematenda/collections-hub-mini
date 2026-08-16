/** Stable account key so Excel formatting (spaces, dashes, trailing .0) still matches. */
export function normalizeAccountKey(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  let s = String(raw).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  if (/e/i.test(s) && !Number.isNaN(Number(s))) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return s.replace(/[\s\-_/]/g, '').toLowerCase();
}
