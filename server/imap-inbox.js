import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { readAppStore, writeAppStore } from './db.js';
import { runCollectionsJobs } from './lib/collections-jobs.js';

function envPass() {
  return String(process.env.SMTP_PASS || process.env.IMAP_PASS || '').replace(/^['"]|['"]$/g, '');
}

function mailIpFamily() {
  const n = Number(process.env.SMTP_FAMILY || process.env.MAIL_FAMILY || '');
  return n === 4 || n === 6 ? n : undefined;
}

export function imapSettings() {
  return {
    host: process.env.IMAP_HOST || '',
    port: Number(process.env.IMAP_PORT || 993),
    user: process.env.IMAP_USER || process.env.SMTP_USER || '',
    pass: envPass(),
  };
}

export function replyImapSettings() {
  const host = String(process.env.IMAP_REPLY_HOST || '').trim();
  const user = String(process.env.IMAP_REPLY_USER || '').trim();
  const pass = String(process.env.IMAP_REPLY_PASS || '').replace(/^['"]|['"]$/g, '');
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(process.env.IMAP_REPLY_PORT || 993),
    user,
    pass,
  };
}

export function imapConfigured() {
  const imap = imapSettings();
  return Boolean((imap.host && imap.user && imap.pass) || replyImapSettings());
}

function normalizeEmail(value) {
  const match = String(value || '')
    .toLowerCase()
    .match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

function customerEmails(customer) {
  return String(customer?.email || '')
    .split(/[,;]+/)
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

function accountNoFromText(value) {
  const match = String(value || '').match(/\baccounts?\s+#?([A-Za-z0-9-]{2,})/i);
  return match ? String(match[1]).trim() : '';
}

function idsFromHeaders(value) {
  return String(value || '')
    .split(/[\s,]+/)
    .map((part) => part.replace(/^<|>$/g, '').trim())
    .filter(Boolean);
}

function findCustomer(store, { from, subject, inReplyTo, references, body }) {
  const customers = (store.customers || []).filter((c) => !c.archived);
  const comms = store.communications || [];

  const replyIds = [...idsFromHeaders(inReplyTo), ...idsFromHeaders(references)];
  if (replyIds.length) {
    const thread = comms.find((c) => {
      const ext = String(c.externalId || '').replace(/^imap:/, '').replace(/^<|>$/g, '');
      const mid = String(c.messageId || '').replace(/^<|>$/g, '');
      return replyIds.some((id) => id === ext || id === mid || `imap:${id}` === c.externalId);
    });
    if (thread) {
      const customer = customers.find((c) => c.id === thread.customerId);
      if (customer) return customer;
    }
  }

  const accountNo = accountNoFromText(subject) || accountNoFromText(body);
  if (accountNo) {
    const byAccount = customers.filter(
      (c) => String(c.accountNo || '').toLowerCase() === accountNo.toLowerCase(),
    );
    if (byAccount.length === 1) return byAccount[0];
    if (byAccount.length > 1) {
      const fromMatch = byAccount.find((c) => customerEmails(c).includes(from));
      return fromMatch || byAccount[0];
    }
  }

  const fromAddr = normalizeEmail(from);
  if (!fromAddr) return null;
  const matches = customers.filter((c) => customerEmails(c).includes(fromAddr));
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];

  const emailed = comms.find(
    (c) =>
      c.channel === 'Email' &&
      c.direction === 'Outgoing' &&
      matches.some((m) => m.id === c.customerId),
  );
  if (emailed) {
    const recent = matches.find((m) => m.id === emailed.customerId);
    if (recent) return recent;
  }
  const withBalance = matches.find((c) => Number(c.outstanding) > 0);
  return withBalance || matches[0];
}

function envelopeAddress(envelope) {
  const first = envelope?.from?.[0];
  if (!first) return { email: '', name: '' };
  const email = normalizeEmail(first.address || '');
  const name = String(first.name || '').trim();
  return { email, name };
}

function stripQuotes(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const next = (lines[i + 1] || '').trim();
    const isGmailOn =
      /^On\s.+/i.test(trimmed) &&
      (/wrote:\s*$/i.test(trimmed) || /<[^>]+@[^>]+>/.test(trimmed) || /^wrote:\s*$/i.test(next));
    if (
      /^>/.test(trimmed) ||
      /^wrote:\s*$/i.test(trimmed) ||
      isGmailOn ||
      /^-{2,} ?Original Message/i.test(trimmed) ||
      (/^From:\s.+/i.test(trimmed) && /^(Sent|Date):/i.test(next))
    ) {
      break;
    }
    kept.push(lines[i]);
  }
  return kept
    .join('\n')
    .replace(/\s+On [A-Z][a-z]{2}, \d{1,2} \w+ \d{4}[\s\S]*$/i, '')
    .trim();
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function bodyFromParsed(parsed) {
  const text = stripQuotes(parsed.text || '');
  if (text) return text.slice(0, 4000);
  return stripQuotes(htmlToText(parsed.html || '')).slice(0, 4000);
}

function isoDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function folderKey(path) {
  return (
    String(path || 'INBOX')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'inbox'
  );
}

function isJunkPath(box) {
  const path = String(box?.path || box?.name || '');
  const special = String(box?.specialUse || '').toLowerCase();
  return special.includes('junk') || special.includes('spam') || /junk|spam/i.test(path);
}

async function foldersToScan(client) {
  const names = ['INBOX'];
  try {
    const list = await client.list();
    for (const box of list || []) {
      if (isJunkPath(box) && box.path && !names.includes(box.path)) names.push(box.path);
    }
  } catch {
    // INBOX only
  }
  return names;
}

async function importFromAccount(settings, store, existingExt) {
  const mailbox = normalizeEmail(settings.user);
  const family = mailIpFamily();
  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: true,
    auth: { user: settings.user, pass: settings.pass },
    logger: false,
    ...(family ? { tls: { family } } : {}),
  });
  const added = [];
  const activities = [];
  const touched = new Map();
  let unmatched = 0;
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  try {
    await client.connect();
    const folders = await foldersToScan(client);
    for (const folder of folders) {
      let lock;
      try {
        lock = await client.getMailboxLock(folder);
      } catch {
        continue;
      }
      try {
        const candidates = [];
        for await (const msg of client.fetch({ since }, { envelope: true, uid: true })) {
          const from = envelopeAddress(msg.envelope);
          if (!from.email || from.email === mailbox) continue;
          const customer = findCustomer(store, {
            from: from.email,
            subject: msg.envelope?.subject || '',
          });
          if (!customer) {
            unmatched += 1;
            continue;
          }
          candidates.push(msg.uid);
        }
        if (!candidates.length) continue;
        for await (const msg of client.fetch(candidates, { envelope: true, source: true, uid: true })) {
          const parsed = await simpleParser(msg.source);
          const messageId = String(
            parsed.messageId || msg.envelope?.messageId || `imap-${folderKey(folder)}-${msg.uid}`,
          ).trim();
          const externalId = `imap:${messageId}`;
          if (existingExt.has(externalId)) continue;

          const from = envelopeAddress(msg.envelope);
          const parsedFrom = normalizeEmail(parsed.from?.value?.[0]?.address);
          const customer = findCustomer(store, {
            from: from.email || parsedFrom,
            subject: parsed.subject || msg.envelope?.subject || '',
            inReplyTo: parsed.inReplyTo,
            references: parsed.references,
            body: parsed.text || '',
          });
          if (!customer) continue;

          existingExt.add(externalId);
          const createdAt = isoDate(parsed.date || msg.envelope?.date);
          const key = `${folderKey(folder)}-${msg.uid}`;
          const comm = {
            id: `cm-imap-${key}`,
            companyId: customer.companyId,
            customerId: customer.id,
            channel: 'Email',
            direction: 'Incoming',
            subject: String(parsed.subject || msg.envelope?.subject || '').trim() || undefined,
            message: bodyFromParsed(parsed) || '(No message text)',
            status: 'Delivered',
            createdAt,
            createdBy: customer.name || from.name || from.email || 'Customer',
            externalId,
            messageId,
          };
          added.push(comm);
          activities.push({
            id: `act-imap-${key}`,
            companyId: customer.companyId,
            customerId: customer.id,
            user: 'Mailbox',
            action: 'Email reply received',
            description: `Incoming email from ${from.email}${comm.subject ? `: ${comm.subject}` : ''}`,
            createdAt,
          });
          touched.set(customer.id, {
            ...customer,
            lastContact: 'Email · reply',
            collectionStage:
              customer.collectionStage === 'New Overdue' || customer.collectionStage === 'Follow-up Due'
                ? 'Contacted'
                : customer.collectionStage,
          });
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // already disconnected
    }
  }
  return { added, activities, touched, unmatched };
}

function inboundFromStore(store) {
  return (store.communications || []).filter((c) => c.channel === 'Email' && c.direction === 'Incoming');
}

let syncing = false;

export async function syncImapInbox() {
  if (!imapConfigured()) {
    return { ok: false, error: 'IMAP is not configured. Set IMAP_HOST and the mailbox password (SMTP_PASS).' };
  }
  if (syncing) {
    try {
      const store = await readAppStore();
      return {
        ok: true,
        imported: 0,
        unmatched: 0,
        busy: true,
        communications: inboundFromStore(store),
        activities: [],
        customers: [],
      };
    } catch {
      return { ok: true, imported: 0, unmatched: 0, busy: true, communications: [], activities: [], customers: [] };
    }
  }

  syncing = true;
  try {
    const store = await readAppStore();
    const existingExt = new Set(
      (store.communications || []).map((c) => String(c.externalId || '')).filter(Boolean),
    );
    const added = [];
    const activities = [];
    const touched = new Map();
    let unmatched = 0;
    const accounts = [];
    const primary = imapSettings();
    if (primary.host && primary.user && primary.pass) accounts.push(primary);
    const reply = replyImapSettings();
    if (reply) accounts.push(reply);

    for (const settings of accounts) {
      try {
        const result = await importFromAccount(settings, store, existingExt);
        added.push(...result.added);
        activities.push(...result.activities);
        unmatched += result.unmatched;
        for (const [id, customer] of result.touched) touched.set(id, customer);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read mailbox.';
        console.error(`[imap] ${settings.host}:`, message);
        if (!added.length && accounts.length === 1) {
          return { ok: false, error: message };
        }
      }
    }

    const inbound = (store.communications || []).filter(
      (c) => c.channel === 'Email' && c.direction === 'Incoming',
    );
    const rehomed = [];
    const nextInbound = inbound.map((c) => {
      const correct = findCustomer(store, {
        from: '',
        subject: c.subject || '',
        body: c.message || '',
      });
      if (correct && correct.id !== c.customerId) {
        const moved = { ...c, customerId: correct.id, companyId: correct.companyId };
        rehomed.push(moved);
        touched.set(correct.id, {
          ...(touched.get(correct.id) || correct),
          lastContact: 'Email · reply',
        });
        return moved;
      }
      return c;
    });
    const others = (store.communications || []).filter(
      (c) => !(c.channel === 'Email' && c.direction === 'Incoming'),
    );
    let nextActivities = store.activities || [];
    if (rehomed.length) {
      const movedById = new Map(rehomed.map((c) => [c.id, c]));
      nextActivities = nextActivities.map((a) => {
        const key = String(a.id || '').replace(/^act-imap-/, 'cm-imap-');
        const moved = movedById.get(key);
        return moved ? { ...a, customerId: moved.customerId, companyId: moved.companyId } : a;
      });
      console.log(
        `[imap] reassigned ${rehomed.length} reply${rehomed.length === 1 ? '' : 'ies'} using account number in subject`,
      );
    }

    if (!added.length && !rehomed.length) {
      return {
        ok: true,
        imported: 0,
        unmatched,
        communications: nextInbound,
        activities: [],
        customers: [],
      };
    }

    const nextCustomers = (store.customers || []).map((c) => touched.get(c.id) || c);
    const withMail = {
      ...store,
      customers: nextCustomers,
      communications: [...added, ...nextInbound, ...others],
      activities: [...activities, ...nextActivities],
    };
    const jobs = runCollectionsJobs(withMail);
    await writeAppStore(jobs.store);

    if (added.length) {
      console.log(`[imap] imported ${added.length} inbound email${added.length === 1 ? '' : 's'}`);
    }
    return {
      ok: true,
      imported: added.length,
      reassigned: rehomed.length,
      unmatched,
      communications: [...added, ...nextInbound],
      activities,
      customers: [...touched.values()],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read mailbox.';
    console.error('[imap]', message);
    return { ok: false, error: message };
  } finally {
    syncing = false;
  }
}

export function startImapPolling() {
  if (!imapConfigured()) {
    console.log('[imap] not configured — set IMAP_HOST and SMTP_PASS to pull replies');
    return;
  }
  const ms = Math.max(15, Number(process.env.IMAP_POLL_SECONDS || 20)) * 1000;
  const reply = replyImapSettings();
  console.log(
    `[imap] polling ${imapSettings().host || 'off'}:${imapSettings().port || ''} every ${ms / 1000}s` +
      (reply ? ` + ${reply.host}` : ''),
  );
  const run = () => {
    void syncImapInbox().then((result) => {
      if (!result.ok) console.error('[imap] sync failed:', result.error);
    });
  };
  setTimeout(run, 3000);
  setInterval(run, ms);
}
