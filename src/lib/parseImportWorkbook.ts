import * as XLSX from 'xlsx';
import { aliases, normalize } from '../utils';

function bump(max: { r: number; c: number }, r: number, c: number) {
  if (r > max.r) max.r = r;
  if (c > max.c) max.c = c;
}

function expandSheetRange(ws: XLSX.WorkSheet) {
  const max = { r: 0, c: 0 };
  const takeRef = (ref?: string) => {
    if (!ref) return;
    try {
      const range = XLSX.utils.decode_range(ref);
      bump(max, range.e.r, range.e.c);
    } catch {
      // ignore invalid refs
    }
  };
  takeRef(ws['!ref']);
  takeRef((ws as { '!fullref'?: string })['!fullref']);
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue;
    const cell = XLSX.utils.decode_cell(key);
    bump(max, cell.r, cell.c);
  }
  const dense = (ws as { '!data'?: unknown[][] })['!data'];
  if (Array.isArray(dense) && dense.length) bump(max, dense.length - 1, 0);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: max.r, c: max.c } });
}

function cellText(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return String(value).trim();
}

function isEmptyRow(cells: unknown[]) {
  return cells.every((value) => cellText(value) === '');
}

function uniqueHeaders(cells: unknown[]) {
  const seen = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = cellText(cell) || `Column ${index + 1}`;
    const next = (seen.get(base) || 0) + 1;
    seen.set(base, next);
    return next === 1 ? base : `${base} (${next})`;
  });
}

function headerScore(cells: unknown[]) {
  const labels = cells.map((cell) => normalize(cellText(cell))).filter(Boolean);
  if (!labels.length) return 0;
  let score = 0;
  for (const wanted of Object.values(aliases)) {
    if (labels.some((label) => wanted.includes(label))) score += 1;
  }
  return score;
}

function rowsFromSheet(ws: XLSX.WorkSheet | undefined) {
  if (!ws) return [];
  expandSheetRange(ws);
  const table = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: true,
    raw: false,
  });
  if (!table.length) return [];

  let headerIndex = 0;
  let bestScore = -1;
  const scanTo = Math.min(table.length, 40);
  for (let i = 0; i < scanTo; i += 1) {
    const score = headerScore(table[i] || []);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
    if (score >= 3) break;
  }

  const headers = uniqueHeaders(table[headerIndex] || []);
  const rows: Record<string, unknown>[] = [];
  for (let i = headerIndex + 1; i < table.length; i += 1) {
    const cells = table[i] || [];
    if (isEmptyRow(cells)) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function headerSignature(rows: Record<string, unknown>[]) {
  return Object.keys(rows[0] || {}).join('\0');
}

function readWorkbook(buffer: ArrayBuffer, fileName: string) {
  const bytes = new Uint8Array(buffer);
  const textName = /\.(csv|txt|tsv)$/i.test(fileName);
  if (textName) {
    const utf16 = bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
    const text = new TextDecoder(utf16 ? (bytes[0] === 0xff ? 'utf-16le' : 'utf-16be') : 'utf-8').decode(buffer);
    return XLSX.read(text, { type: 'string', cellDates: true, raw: false });
  }
  return XLSX.read(bytes, { type: 'array', cellDates: true, raw: false });
}

export function parseImportWorkbook(buffer: ArrayBuffer, fileName: string) {
  const wb = readWorkbook(buffer, fileName);
  const sheets = wb.SheetNames.map((name) => ({
    name,
    rows: rowsFromSheet(wb.Sheets[name]),
  })).filter((sheet) => sheet.rows.length);

  if (!sheets.length) {
    return { rows: [] as Record<string, unknown>[], sourceLabel: fileName };
  }

  sheets.sort((a, b) => b.rows.length - a.rows.length);
  const primary = sheets[0];
  const signature = headerSignature(primary.rows);
  const matching = sheets.filter((sheet) => headerSignature(sheet.rows) === signature);
  const rows = matching.flatMap((sheet) => sheet.rows);
  const sourceLabel =
    matching.length > 1
      ? `${fileName} (${matching.length} sheets)`
      : `${fileName} (${primary.name})`;

  return { rows, sourceLabel };
}
