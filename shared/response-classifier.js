import { parsePromiseFromReply, splitEmailThread } from './email-promise.js';
import { DEFAULT_CONFIDENCE_THRESHOLD, HIGH_IMPACT_INTENTS, INTENTS } from './response-intents.js';

function compact(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractAmount(raw) {
  const text = compact(raw);
  if (!text) return undefined;
  const match =
    text.match(/\bR\s*([0-9]+(?:[.,][0-9]{1,2})?)\b/i) ||
    text.match(/\b([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:rand|zar)\b/i);
  if (!match) return undefined;
  const value = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

export function extractCallbackTime(raw) {
  const text = compact(raw);
  const match = text.match(/\b(?:after|at|before)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const mer = (match[3] || '').toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (!mer && hour <= 7) hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function hit(text, pattern) {
  return pattern.test(text);
}

function result(intent, confidence, entities = {}, extras = {}) {
  const below = confidence < DEFAULT_CONFIDENCE_THRESHOLD && HIGH_IMPACT_INTENTS.has(intent);
  return {
    intent: below ? INTENTS.NEEDS_REVIEW : intent,
    detectedIntent: intent,
    confidence,
    entities,
    source: 'Rule',
    needsReview: intent === INTENTS.NEEDS_REVIEW || below || Boolean(extras.needsReview),
    autoApply: !below && intent !== INTENTS.NEEDS_REVIEW,
    dateRequired: Boolean(extras.dateRequired),
    claimedCompleted: Boolean(extras.claimedCompleted),
  };
}

/**
 * Rule-based inbound classifier. Works without any AI API.
 * classifyResponse() / detectIntent() / extractPromiseDate() / extractAmount()
 */
export function classifyResponse(raw, options = {}) {
  const body = compact(splitEmailThread(raw).body || raw);
  const text = body.toLowerCase();
  const amount = extractAmount(body);
  const hasAttachment = Boolean(options.hasAttachment) || /\b(pop|proof of payment|attached|attachment|screenshot|slip)\b/i.test(body);

  if (!text || text.length < 2) {
    return result(INTENTS.NEEDS_REVIEW, 0.2, { comment: body });
  }

  if (hit(text, /\b(passed away|deceased|has died|late husband|late wife|the deceased)\b/)) {
    return result(INTENTS.SENSITIVE_ACCOUNT, 0.93, { comment: body });
  }

  if (hit(text, /\b(wrong number|wrong person|not (?:the )?customer|don'?t know this person|this isn'?t|this is not|not .{0,20}\bjohn\b)\b/)) {
    return result(INTENTS.WRONG_CONTACT, 0.96, { comment: body });
  }

  if (hasAttachment && hit(text, /\b(paid|payment|pop|proof|transfer|eft)\b/)) {
    return result(INTENTS.PROOF_OF_PAYMENT_RECEIVED, 0.9, { amount, comment: body }, { claimedCompleted: true });
  }

  if (hit(text, /\b(already paid|i have paid|i paid|have paid|payment has been made|eft done|sent pop|made the transfer|paid yesterday|paid today|paid already)\b/)) {
    const claimedPartial = Boolean(amount) && hit(text, /\b(still owe|the rest|partial|balance left)\b/);
    if (claimedPartial) {
      return result(INTENTS.PARTIAL_PAYMENT, 0.9, { amount, comment: body }, { claimedCompleted: true });
    }
    return result(INTENTS.PAYMENT_CLAIMED, 0.94, { amount, comment: body }, { claimedCompleted: true });
  }

  if (hit(text, /\b(don'?t owe|do not owe|balance is wrong|amount is wrong|charged incorrectly|already cancelled|why do i owe|dispute)\b/)) {
    return result(INTENTS.BALANCE_DISPUTE, 0.93, { amount, comment: body });
  }

  if (hit(text, /\b(cancel my|please cancel|don'?t want the (?:internet|service)|disconnect me|changed providers|i'?m moving|no longer using)\b/)) {
    return result(INTENTS.CANCELLATION_REQUEST, 0.92, { comment: body });
  }

  if (hit(text, /\b(come collect|collect the (?:antenna|router|equipment|onu|ont)|collect your|i have your (?:router|antenna|equipment))\b/)) {
    return result(INTENTS.EQUIPMENT_COLLECTION_REQUEST, 0.94, { comment: body });
  }

  if (hit(text, /\b(i'?ve moved|i have moved|no longer living|moved to)\b/) && !hit(text, /\bcancel\b/)) {
    return result(INTENTS.CUSTOMER_MOVED, 0.88, { comment: body });
  }

  if (hit(text, /\b(internet hasn'?t|no (?:internet|service)|antenna is offline|not been working|no line|outage|why should i pay when)\b/)) {
    return result(INTENTS.TECHNICAL_SERVICE_ISSUE, 0.9, { comment: body });
  }

  if (hit(text, /\b(lost my job|can'?t afford|cannot afford|don'?t have money|no money|can'?t pay|cannot pay|unable to pay)\b/)) {
    return result(INTENTS.FINANCIAL_DIFFICULTY, 0.91, { comment: body });
  }

  if (hit(text, /\b(another week|more time|pay next month|extension|extend)\b/)) {
    return result(INTENTS.PAYMENT_EXTENSION_REQUEST, 0.88, { comment: body });
  }

  if (hit(text, /\b(call me|phone me|give me a call|can someone (?:phone|call)|speak to someone|need to speak)\b/)) {
    return result(INTENTS.CALLBACK_REQUEST, 0.9, {
      comment: body,
      callbackTime: extractCallbackTime(body),
    });
  }

  if (hit(text, /\b(send me (?:the )?invoice|send (?:me )?my (?:statement|account)|need (?:a |the )?statement|need (?:an |the )?invoice)\b/)) {
    return result(INTENTS.STATEMENT_REQUEST, 0.92, { comment: body });
  }

  if (hit(text, /\b(bank(?:ing)? details|where (?:must|do) i pay|account details|payment details)\b/)) {
    return result(INTENTS.PAYMENT_DETAILS_REQUEST, 0.93, { comment: body });
  }

  const promisedPartial = Boolean(amount) && hit(text, /\b(can pay|will pay|i'?ll pay|pay now)\b/) && hit(text, /\b(now|today|partial|this)\b/);
  if (promisedPartial && !hit(text, /\balready paid|i paid|have paid\b/)) {
    const parsed = parsePromiseFromReply(body);
    return result(
      INTENTS.PARTIAL_PAYMENT,
      parsed && !parsed.dateInferred ? 0.9 : 0.86,
      { amount, date: parsed?.date, dateInferred: parsed?.dateInferred, comment: body },
      { dateRequired: !parsed || parsed.dateInferred },
    );
  }

  const parsed = parsePromiseFromReply(body);
  if (parsed) {
    return result(
      INTENTS.PROMISE_TO_PAY,
      parsed.dateInferred ? 0.82 : 0.94,
      { amount, date: parsed.date, dateInferred: parsed.dateInferred, comment: body },
      { dateRequired: parsed.dateInferred, needsReview: parsed.dateInferred },
    );
  }

  if (/^(ok|okay|thanks|thank you|yes|no|hi|hello)[.!]?$/i.test(body)) {
    return result(INTENTS.NEEDS_REVIEW, 0.35, { comment: body });
  }

  return result(INTENTS.NEEDS_REVIEW, 0.4, { comment: body, amount });
}

export function detectIntent(raw, options) {
  return classifyResponse(raw, options).detectedIntent;
}

export function extractPromiseDate(raw) {
  const parsed = parsePromiseFromReply(raw);
  if (!parsed || parsed.dateInferred) return undefined;
  return parsed.date;
}

export { DEFAULT_CONFIDENCE_THRESHOLD };
