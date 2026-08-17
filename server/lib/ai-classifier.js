import { classifyResponse, extractAmount, extractCallbackTime, extractPromiseDate } from '../../shared/response-classifier.js';
import { DEFAULT_CONFIDENCE_THRESHOLD, HIGH_IMPACT_INTENTS, INTENTS } from '../../shared/response-intents.js';

const ALLOWED = new Set(Object.values(INTENTS));

function compact(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifierConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || process.env.CLASSIFIER_API_KEY || '').trim());
}

export function classifierModel() {
  return String(process.env.OPENAI_MODEL || process.env.CLASSIFIER_MODEL || 'gpt-4o-mini').trim();
}

function classifierEndpoint() {
  const base = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  return `${base}/chat/completions`;
}

function normalizeAiResult(parsed, raw, rule) {
  const detectedIntent = ALLOWED.has(parsed?.intent) ? parsed.intent : INTENTS.NEEDS_REVIEW;
  const confidence = Math.min(1, Math.max(0, Number(parsed?.confidence) || 0.8));
  const body = compact(raw);
  const entities = {
    comment: body,
    amount: parsed?.amount != null ? Number(parsed.amount) : rule.entities?.amount ?? extractAmount(body),
    date: parsed?.date || rule.entities?.date || extractPromiseDate(body),
    dateInferred: Boolean(parsed?.dateInferred || rule.entities?.dateInferred),
    callbackTime: parsed?.callbackTime || rule.entities?.callbackTime || extractCallbackTime(body),
  };
  const below = confidence < DEFAULT_CONFIDENCE_THRESHOLD && HIGH_IMPACT_INTENTS.has(detectedIntent);
  return {
    intent: below ? INTENTS.NEEDS_REVIEW : detectedIntent,
    detectedIntent,
    confidence,
    entities,
    source: 'AI',
    needsReview: detectedIntent === INTENTS.NEEDS_REVIEW || below || Boolean(parsed?.dateRequired),
    autoApply: !below && detectedIntent !== INTENTS.NEEDS_REVIEW,
    dateRequired: Boolean(parsed?.dateRequired || (!entities.date && detectedIntent === INTENTS.PROMISE_TO_PAY)),
    claimedCompleted: Boolean(
      parsed?.claimedCompleted || detectedIntent === INTENTS.PAYMENT_CLAIMED || detectedIntent === INTENTS.PROOF_OF_PAYMENT_RECEIVED,
    ),
  };
}

export async function classifyWithAi(raw, options = {}) {
  const key = String(process.env.OPENAI_API_KEY || process.env.CLASSIFIER_API_KEY || '').trim();
  if (!key) return null;
  const body = compact(raw);
  if (!body) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.CLASSIFIER_TIMEOUT_MS || 8000));
  try {
    const res = await fetch(classifierEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: classifierModel(),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You classify South African ISP collections replies. Return JSON only: {"intent":"ONE_OF_ENUM","confidence":0-1,"amount":number|null,"date":"YYYY-MM-DD"|null,"dateRequired":boolean,"claimedCompleted":boolean,"callbackTime":"HH:MM"|null}. Valid intent values: ' +
              Object.values(INTENTS).join(', ') +
              '. Prefer NEEDS_REVIEW when unsure. Do not invent a promise date.',
          },
          {
            role: 'user',
            content: `Attachment mentioned: ${options.hasAttachment ? 'yes' : 'no'}\n\nMessage:\n${body.slice(0, 4000)}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Rules first. AI is used when rules are unsure, or to confirm low-confidence cases. */
export async function classifyBest(raw, options = {}) {
  const rule = classifyResponse(raw, options);
  if (!classifierConfigured()) return rule;
  if (rule.autoApply && rule.confidence >= 0.92 && rule.detectedIntent !== INTENTS.NEEDS_REVIEW) {
    return rule;
  }
  const parsed = await classifyWithAi(raw, options);
  if (!parsed) return rule;
  return normalizeAiResult(parsed, raw, rule);
}
