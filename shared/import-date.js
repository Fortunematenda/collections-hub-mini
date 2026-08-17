const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function ymd(year, month, day) {
  let y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fromLocalDate(date) {
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Parse spreadsheet dates without defaulting to today. Prefers SA day/month order. */
export function parseImportDate(raw) {
  if (raw == null || raw === '') return undefined;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return fromLocalDate(raw);
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
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    let day = first;
    let month = second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      day = second;
      month = first;
    }
    return ymd(parts[3], month, day);
  }

  const named = text.match(/^(\d{1,2})[/.\- ]+([A-Za-z]+)[/.\- ]+(\d{2,4})$/);
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    if (month) return ymd(named[3], month, named[1]);
  }
  const namedUs = text.match(/^([A-Za-z]+)[/.\- ]+(\d{1,2}),?[/.\- ]+(\d{2,4})$/);
  if (namedUs) {
    const month = MONTHS[namedUs[1].toLowerCase()];
    if (month) return ymd(namedUs[3], month, namedUs[2]);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return fromLocalDate(parsed);
  return undefined;
}
