/** Parse spreadsheet dates without defaulting to today. Prefers SA day/month order. */
export function parseImportDate(raw) {
  if (raw == null || raw === '') return undefined;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 20000 && raw < 80000) {
      const utc = Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000;
      const date = new Date(utc);
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
    return undefined;
  }

  const text = String(raw).trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const parts = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (parts) {
    let first = Number(parts[1]);
    let second = Number(parts[2]);
    let year = Number(parts[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    let day = first;
    let month = second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      day = second;
      month = first;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}
