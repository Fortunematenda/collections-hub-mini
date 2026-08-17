const PROMISE_NO =
  /\b(already paid|i have paid|i paid|have paid|not interested|no longer|cancel(?:ling|led)?|can'?t pay|cannot pay|won'?t pay|will not pay|unable to pay)\b/i;
const PROMISE_YES =
  /\b(promise[sd]? to pay|i(?:'| a)?m going to pay|i(?:'?ll| will) pay|will pay|can pay|pay (?:on|by|before)|payment (?:on|by)|settle (?:on|by)|make (?:a )?payment|send (?:the )?payment|give me until|pay you)\b/i;
const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function upcoming(date) {
  const today = startOfDay(new Date());
  const value = startOfDay(date);
  if (value < today) value.setFullYear(value.getFullYear() + 1);
  return value;
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function nextWeekday(from, dayIndex) {
  const date = startOfDay(from);
  const delta = (dayIndex - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function nextWeekMonday(from) {
  const date = startOfDay(from);
  const untilMonday = (8 - date.getDay()) % 7 || 7;
  return addDays(date, untilMonday);
}

function weekdayInNextWeek(from, dayIndex) {
  const monday = nextWeekMonday(from);
  if (dayIndex === 0) return addDays(monday, 6);
  return addDays(monday, dayIndex - 1);
}

function weekdayIndexIn(text) {
  const lower = String(text || '').toLowerCase();
  return WEEKDAYS.findIndex((day) => new RegExp(`\\b${day}\\b`, 'i').test(lower));
}

function isShortDateOnlyReply(text) {
  if (text.length > 80) return false;
  if (text.split(/\s+/).filter(Boolean).length > 12) return false;
  if (/\blast\b/i.test(text)) return false;
  return Boolean(
    /\b(next week|tomorrow|today|end of (the )?month|month end)\b/i.test(text) ||
      weekdayIndexIn(text) >= 0 ||
      /\b(20\d{2}-\d{2}-\d{2})\b/.test(text) ||
      new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})\\b`, 'i').test(text) ||
      new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i').test(text),
  );
}

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function namedDate(day, monthRaw, year) {
  const month = MONTH_INDEX[String(monthRaw || '').toLowerCase()];
  if (month == null) return null;
  const date = new Date(Number(year), month, Number(day));
  if (date.getMonth() !== month || date.getDate() !== Number(day)) return null;
  return date;
}

export function splitEmailThread(raw) {
  const text = String(raw || '').replace(/\r/g, '');
  if (!text.trim()) return { body: '', quote: '' };
  const lines = text.split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (
      /^on .+wrote:$/i.test(trimmed) ||
      /^on .+, .+ at .+ wrote:$/i.test(trimmed) ||
      /^-{2,} ?original message/i.test(trimmed) ||
      /^>+/.test(trimmed)
    ) {
      cut = i;
      break;
    }
    if (/^on [A-Z][a-z]{2},/i.test(trimmed) && i + 1 < lines.length && /wrote:$/i.test(lines[i + 1].trim())) {
      cut = i;
      break;
    }
  }
  return {
    body: lines.slice(0, cut).join('\n').trim(),
    quote: lines.slice(cut).join('\n').trim(),
  };
}

export function parsePromiseFromReply(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text || PROMISE_NO.test(text)) return null;
  if (!PROMISE_YES.test(text) && !isShortDateOnlyReply(text)) return null;

  const now = new Date();
  const lower = text.toLowerCase();
  const mentionedWeekday = weekdayIndexIn(lower);
  const saysNextWeek = /\bnext week\b/i.test(text);

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    const date = new Date(`${iso[1]}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return { date: isoDay(upcoming(date)), dateInferred: false };
  }

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : now.getFullYear();
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime()) && day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { date: isoDay(upcoming(date)), dateInferred: false };
    }
  }

  const dayMonth = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTHS})(?:\\s+(\\d{4}))?\\b`, 'i'));
  if (dayMonth) {
    const value = namedDate(dayMonth[1], dayMonth[2], dayMonth[3] || now.getFullYear());
    if (value) return { date: isoDay(upcoming(value)), dateInferred: false };
  }

  const monthDay = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, 'i'));
  if (monthDay) {
    const value = namedDate(monthDay[2], monthDay[1], monthDay[3] || now.getFullYear());
    if (value) return { date: isoDay(upcoming(value)), dateInferred: false };
  }

  if (saysNextWeek && mentionedWeekday >= 0) {
    return { date: isoDay(weekdayInNextWeek(now, mentionedWeekday)), dateInferred: false };
  }
  if (/\btomorrow\b/i.test(text)) return { date: isoDay(addDays(now, 1)), dateInferred: false };
  if (/\btoday\b/i.test(text)) return { date: isoDay(now), dateInferred: false };
  if (saysNextWeek) return { date: isoDay(addDays(now, 7)), dateInferred: false };
  if (/\bend of (the )?month\b/i.test(text) || /\bmonth end\b/i.test(text)) {
    return { date: isoDay(lastDayOfMonth(now)), dateInferred: false };
  }

  const ordinal = text.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinal) {
    const day = Number(ordinal[1]);
    if (day >= 1 && day <= 31) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (startOfDay(date) < startOfDay(now)) date.setMonth(date.getMonth() + 1);
      return { date: isoDay(date), dateInferred: false };
    }
  }

  if (mentionedWeekday >= 0) {
    const date = now.getDay() === mentionedWeekday ? startOfDay(now) : nextWeekday(now, mentionedWeekday);
    return { date: isoDay(date), dateInferred: false };
  }

  return { date: isoDay(addDays(now, 7)), dateInferred: true };
}

export function todayIso(now = new Date()) {
  return isoDay(now);
}
