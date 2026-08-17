import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { randomUUID, randomBytes, createHash } from 'crypto';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  initDb,
  isUsingDatabase,
  loadAuthTables,
  readAppStore,
  saveAuthTables,
  writeAppStore,
} from './db.js';
import { imapConfigured, imapSettings, startImapPolling, syncImapInbox } from './imap-inbox.js';
import { toWhatsAppAddress as formatWhatsAppAddress } from '../shared/phone.js';
import { checkRateLimit, recordFailure, recordSuccess } from './lib/rate-limit.js';
import { runCollectionsJobs } from './lib/collections-jobs.js';
import { mergeById, preferCustomer, preferPromise } from './lib/store-merge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

function isProductionLike() {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.DATABASE_URL);
}

function resolveJwtSecret() {
  const value = String(process.env.JWT_SECRET || '').trim();
  const weak = !value || /^(change-me|collections-hub-dev-secret-change-me)$/i.test(value);
  if (weak && isProductionLike()) {
    console.error('[auth] Refusing to start: JWT_SECRET is missing or still the default. Set a long random value in server/.env');
    process.exit(1);
  }
  if (weak) {
    console.warn('[auth] JWT_SECRET is still the default. Set a random secret in server/.env before deploying.');
    return 'collections-hub-dev-secret-change-me';
  }
  return value;
}

function resolveAdminPassword() {
  const value = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!value && isProductionLike()) {
    console.error('[auth] Refusing to start: ADMIN_PASSWORD is not set.');
    process.exit(1);
  }
  if (!value) {
    console.warn('[auth] ADMIN_PASSWORD is not set. Using a development-only default. Do not deploy like this.');
    return 'Admin123!';
  }
  return value;
}

const PORT = Number(process.env.MAILER_PORT || process.env.PORT || 8787);
const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

/** @typedef {{ id: string; key: string; label: string; description: string; group: string; system?: boolean }} Permission */
/** @typedef {{ id: string; key: string; name: string; description: string; permissionIds: string[]; system?: boolean }} Role */
/** @typedef {{ id: string; email: string; name: string; roleId: string; passwordHash: string; active: boolean }} AppUser */

const permissionSeed = [
  ['companies.view', 'View companies', 'Open company portfolios and details', 'Companies'],
  ['companies.manage', 'Manage companies', 'Create, edit and archive companies', 'Companies'],
  ['customers.view', 'View customers', 'Open customer accounts and history', 'Customers'],
  ['customers.manage', 'Manage customers', 'Create and edit customers, notes and follow-ups', 'Customers'],
  ['collections.manage', 'Manage collections', 'Promises, payments, follow-ups and status changes', 'Collections'],
  ['communications.send', 'Send communications', 'Send email/WhatsApp and log calls', 'Communications'],
  ['imports.manage', 'Manage imports', 'Upload and commit Excel import batches', 'Imports'],
  ['recovery.manage', 'Manage recovery', 'Create and complete equipment recovery jobs', 'Recovery'],
  ['templates.manage', 'Manage templates', 'Create and edit message templates', 'Templates'],
  ['settings.manage', 'Manage settings', 'Edit company settings and defaults', 'Settings'],
  ['roles.manage', 'Manage roles', 'Create roles and assign permissions', 'Administration'],
  ['users.manage', 'Manage users', 'Invite users and assign roles', 'Administration'],
];

/** @type {Permission[]} */
let permissions = permissionSeed.map(([key, label, description, group]) => ({
  id: `perm-${key}`,
  key,
  label,
  description,
  group,
  system: true,
}));

/** @type {Role[]} */
let roles = [
  {
    id: 'role-admin',
    key: 'admin',
    name: 'Administrator',
    description: 'Full access to every Collections Hub capability.',
    permissionIds: permissions.map((p) => p.id),
    system: true,
  },
  {
    id: 'role-operator',
    key: 'collections_operator',
    name: 'Collections Operator',
    description: 'Day-to-day collections work without admin configuration.',
    permissionIds: permissions
      .filter((p) =>
        [
          'companies.view',
          'customers.view',
          'customers.manage',
          'collections.manage',
          'communications.send',
          'imports.manage',
          'recovery.manage',
          'templates.manage',
          'settings.manage',
        ].includes(p.key),
      )
      .map((p) => p.id),
    system: true,
  },
  {
    id: 'role-viewer',
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to companies and customer accounts.',
    permissionIds: permissions.filter((p) => ['companies.view', 'customers.view'].includes(p.key)).map((p) => p.id),
    system: true,
  },
];

const adminEmail = (process.env.ADMIN_EMAIL || 'admin@collections.local').toLowerCase();
const adminPasswordPlain = resolveAdminPassword();
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(adminPasswordPlain, 10);

/** @type {AppUser[]} */
let users = [
  {
    id: 'admin-1',
    email: adminEmail,
    name: process.env.ADMIN_NAME || 'Collections Admin',
    roleId: 'role-admin',
    passwordHash: adminPasswordHash,
    active: true,
  },
];

const revokedTokens = new Set();
/** @type {{ tokenHash: string; userId: string; expiresAt: number }[]} */
let resetTokens = [];

function mailIpFamily() {
  const n = Number(String(process.env.SMTP_FAMILY || process.env.MAIL_FAMILY || '').trim());
  if (n === 4 || n === 6) return n;
  if (process.env.NODE_ENV === 'production' && /cp69\.domains\.co\.za/i.test(process.env.SMTP_HOST || '')) {
    return 6;
  }
  return undefined;
}

function smtpSettings() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: String(process.env.SMTP_PASS || '').replace(/^['"]|['"]$/g, ''),
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    fromName: process.env.SMTP_FROM_NAME || 'BretuneTech',
    replyTo: String(process.env.SMTP_REPLY_TO || '').trim(),
    family: mailIpFamily(),
  };
}

function smtpConfigured() {
  const smtp = smtpSettings();
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.from);
}

function createTransport() {
  const smtp = smtpSettings();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.family ? { family: smtp.family } : {}),
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 25000,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  apiKey: process.env.TWILIO_API_KEY || '',
  apiSecret: process.env.TWILIO_API_SECRET || '',
  from: process.env.TWILIO_WHATSAPP_FROM || '',
  contentSid: process.env.TWILIO_CONTENT_SID || '',
  defaultCountry: process.env.TWILIO_DEFAULT_COUNTRY || '27',
};

function twilioConfigured() {
  const hasToken = Boolean(twilioConfig.accountSid && twilioConfig.authToken);
  const hasKey = Boolean(twilioConfig.accountSid && twilioConfig.apiKey && twilioConfig.apiSecret);
  return Boolean((hasToken || hasKey) && twilioConfig.from);
}

function createTwilioClient() {
  if (twilioConfig.accountSid && twilioConfig.authToken) {
    return twilio(twilioConfig.accountSid, twilioConfig.authToken);
  }
  return twilio(twilioConfig.apiKey, twilioConfig.apiSecret, { accountSid: twilioConfig.accountSid });
}

function toWhatsAppAddress(raw, fallbackCountry = twilioConfig.defaultCountry) {
  return formatWhatsAppAddress(raw, fallbackCountry);
}

function getRole(roleId) {
  return roles.find((r) => r.id === roleId);
}

function permissionsForRole(role) {
  if (!role) return [];
  return permissions.filter((p) => role.permissionIds.includes(p.id));
}

function publicUser(user) {
  const role = getRole(user.roleId);
  const perms = permissionsForRole(role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: role?.key || 'unknown',
    roleId: user.roleId,
    roleName: role?.name || 'Unknown',
    permissions: perms.map((p) => p.key),
    active: user.active,
  };
}

function signToken(user) {
  const pub = publicUser(user);
  return jwt.sign(
    {
      sub: pub.id,
      email: pub.email,
      name: pub.name,
      role: pub.role,
      roleId: pub.roleId,
      permissions: pub.permissions,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Authentication required.' });
  if (revokedTokens.has(token)) {
    return res.status(401).json({ ok: false, error: 'Session has ended. Please sign in again.' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const dbUser = users.find((u) => u.id === payload.sub);
    if (!dbUser || !dbUser.active) {
      return res.status(401).json({ ok: false, error: 'User account is inactive or missing.' });
    }
    req.user = publicUser(dbUser);
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token.' });
  }
}

function requirePermission(...keys) {
  return (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    const owned = new Set(req.user?.permissions || []);
    if (keys.some((k) => owned.has(k))) return next();
    return res.status(403).json({ ok: false, error: 'You do not have permission for this action.' });
  };
}

const WRITE_PERMISSIONS = [
  'customers.manage',
  'collections.manage',
  'companies.manage',
  'imports.manage',
  'communications.send',
  'recovery.manage',
  'templates.manage',
  'settings.manage',
];

function ensureSystemAuth() {
  let changed = false;
  const seed = permissionSeed.map(([key, label, description, group]) => ({
    id: `perm-${key}`,
    key,
    label,
    description,
    group,
    system: true,
  }));
  for (const perm of seed) {
    if (!permissions.some((item) => item.key === perm.key)) {
      permissions = [...permissions, perm];
      changed = true;
    }
  }
  const settingsId = permissions.find((p) => p.key === 'settings.manage')?.id;
  roles = roles.map((role) => {
    if (role.key !== 'collections_operator' || !settingsId || role.permissionIds.includes(settingsId)) {
      return role;
    }
    changed = true;
    return { ...role, permissionIds: [...role.permissionIds, settingsId] };
  });
  const admin = roles.find((role) => role.key === 'admin');
  if (admin) {
    const allIds = permissions.map((p) => p.id);
    if (allIds.some((id) => !admin.permissionIds.includes(id))) {
      roles = roles.map((role) => (role.id === admin.id ? { ...role, permissionIds: allIds } : role));
      changed = true;
    }
  }
  return changed;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

function allowedOrigins() {
  return String(process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) return true;
  const allowed = allowedOrigins();
  if (allowed.includes(origin)) return true;
  try {
    if (hostHeader && new URL(origin).host === hostHeader) return true;
  } catch {
    // ignore invalid Origin
  }
  return !isProductionLike() && allowed.length === 0;
}

const app = express();
app.use((req, res, next) => {
  cors({
    origin: isAllowedOrigin(req.headers.origin, req.headers.host),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })(req, res, next);
});
app.use(express.json({ limit: '10mb' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

function revokedList() {
  return [...revokedTokens].map((token) => ({ token, at: Date.now() }));
}

async function persistAuth() {
  try {
    await saveAuthTables({ permissions, roles, users, revokedTokens: revokedList(), resetTokens });
  } catch (error) {
    console.error('[db] auth persist failed:', error instanceof Error ? error.message : error);
  }
}

app.get('/api/health', (_req, res) => {
  const smtp = smtpSettings();
  const imap = imapSettings();
  res.json({
    ok: true,
    mailer: smtpConfigured() ? 'configured' : 'missing-env',
    imap: imapConfigured() ? 'configured' : 'missing-env',
    whatsapp: twilioConfigured() ? 'twilio' : 'missing-env',
    auth: 'jwt',
    roles: roles.length,
    permissions: permissions.length,
    host: smtp.host || null,
    from: smtp.from || null,
    imapHost: imap.host || null,
    twilioFrom: twilioConfigured() ? twilioConfig.from : null,
    database: isUsingDatabase() ? 'postgres' : 'file-fallback',
  });
});

app.get('/api/data', authRequired, requirePermission('companies.view', 'customers.view'), async (_req, res) => {
  try {
    const data = await readAppStore();
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load app data.';
    return res.status(500).json({ ok: false, error: message });
  }
});

function mergeServerOwned(serverItems = [], clientItems = [], isOwned) {
  const clientIds = new Set((clientItems || []).map((item) => item?.id).filter(Boolean));
  const extra = (serverItems || []).filter((item) => item?.id && isOwned(item) && !clientIds.has(item.id));
  return extra.length ? [...(clientItems || []), ...extra] : clientItems || [];
}

function mergeInboundCommunications(serverItems = [], clientItems = []) {
  const isOwned = (item) =>
    Boolean(item?.externalId) ||
    String(item?.id || '').startsWith('cm-imap-') ||
    String(item?.id || '').startsWith('act-imap-');
  const serverOwned = new Map((serverItems || []).filter(isOwned).map((item) => [item.id, item]));
  const merged = (clientItems || []).map((item) => {
    const server = serverOwned.get(item.id);
    if (!server) return item;
    return {
      ...item,
      ...server,
      readAt: item.readAt || server.readAt,
      handledAs: item.handledAs || server.handledAs,
    };
  });
  const seen = new Set(merged.map((item) => item.id));
  const extra = [...serverOwned.values()].filter((item) => !seen.has(item.id));
  return extra.length ? [...merged, ...extra] : merged;
}

function mergeCustomersKeepInbox(serverCustomers = [], clientCustomers = []) {
  const serverById = new Map((serverCustomers || []).map((c) => [c.id, c]));
  return (clientCustomers || []).map((client) => {
    const server = serverById.get(client.id);
    if (!server) return client;
    if (server.lastContact === 'Email · reply' && client.lastContact !== 'Email · reply') {
      return {
        ...client,
        lastContact: server.lastContact,
        collectionStage: server.collectionStage || client.collectionStage,
      };
    }
    return client;
  });
}

app.put('/api/data', authRequired, requirePermission(...WRITE_PERMISSIONS), async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!Array.isArray(body.companies)) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: companies must be an array.' });
    }
    const current = await readAppStore();
    if (body.revision != null && Number(body.revision) !== Number(current.revision || 0)) {
      return res.status(409).json({
        ok: false,
        stale: true,
        error: 'This workspace was updated in another session. Reloaded the latest data.',
        data: current,
      });
    }
    const saved = await writeAppStore({
      companies: body.companies || [],
      companyId: String(body.companyId || ''),
      customers: mergeById(
        current.customers,
        mergeCustomersKeepInbox(current.customers, Array.isArray(body.customers) ? body.customers : []),
        preferCustomer,
      ),
      recoveries: Array.isArray(body.recoveries) ? body.recoveries : [],
      imports: Array.isArray(body.imports) ? body.imports : [],
      templates: Array.isArray(body.templates) ? body.templates : [],
      equipment: Array.isArray(body.equipment) ? body.equipment : [],
      promises: mergeById(current.promises, Array.isArray(body.promises) ? body.promises : [], preferPromise, {
        keepServerOnly: true,
      }),
      payments: Array.isArray(body.payments) ? body.payments : [],
      communications: mergeInboundCommunications(
        current.communications,
        Array.isArray(body.communications) ? body.communications : [],
      ),
      notes: Array.isArray(body.notes) ? body.notes : [],
      followUps: Array.isArray(body.followUps) ? body.followUps : [],
      activities: mergeInboundCommunications(
        current.activities,
        Array.isArray(body.activities) ? body.activities : [],
      ),
      integrations: Array.isArray(body.integrations) ? body.integrations : [],
      automationRules: Array.isArray(body.automationRules) ? body.automationRules : [],
      importMappings: body.importMappings && typeof body.importMappings === 'object' ? body.importMappings : current.importMappings || {},
      promiseEmailSeeded: Boolean(current.promiseEmailSeeded || body.promiseEmailSeeded),
      revision: Number(current.revision || 0),
    });
    return res.json({ ok: true, data: saved, revision: saved.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save app data.';
    console.error('[data]', message);
    return res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required.' });
    }

    const limitKey = `${req.ip || 'local'}:${email}`;
    const limit = checkRateLimit(limitKey);
    if (!limit.ok) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({
        ok: false,
        error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
      });
    }

    const user = users.find((u) => u.email === email && u.active);
    if (!user) {
      recordFailure(limitKey);
      return res.status(401).json({ ok: false, error: 'The email or password is incorrect.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordFailure(limitKey);
      return res.status(401).json({ ok: false, error: 'The email or password is incorrect.' });
    }
    recordSuccess(limitKey);

    const pub = publicUser(user);
    const token = signToken(user);
    return res.json({ ok: true, token, user: pub, expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    console.error('[auth]', message);
    return res.status(500).json({ ok: false, error: message });
  }
});

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function publicAppOrigin(req) {
  const configured = String(process.env.APP_PUBLIC_URL || process.env.ALLOWED_ORIGIN || '')
    .split(',')[0]
    .trim();
  if (configured) return configured.replace(/\/$/, '');
  const origin = String(req.headers.origin || '').trim();
  if (origin) return origin.replace(/\/$/, '');
  return `http://127.0.0.1:${process.env.VITE_DEV_PORT || 5173}`;
}

app.post('/api/auth/forgot-password', async (req, res) => {
  const generic = { ok: true, message: 'If that email is on this workspace, reset instructions were sent.' };
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!email || !email.includes('@')) return res.json(generic);

    const user = users.find((u) => u.email === email && u.active);
    if (!user) return res.json(generic);

    const token = randomBytes(32).toString('hex');
    resetTokens = resetTokens.filter((item) => item.userId !== user.id && item.expiresAt > Date.now());
    resetTokens.push({
      tokenHash: hashResetToken(token),
      userId: user.id,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });
    void persistAuth();

    const resetUrl = `${publicAppOrigin(req)}/login?reset=${token}`;
    if (smtpConfigured()) {
      const smtp = smtpSettings();
      await createTransport().sendMail({
        from: `"${smtp.fromName}" <${smtp.from}>`,
        to: user.email,
        subject: 'Collections Hub password reset',
        text: `Reset your Collections Hub password using this link (valid for 30 minutes):\n\n${resetUrl}\n\nIf you did not ask for this, you can ignore the email.`,
      });
    } else if (!isProductionLike()) {
      console.log('[auth] password reset link (dev only):', resetUrl);
    }
    return res.json(generic);
  } catch (error) {
    console.error('[auth] forgot-password', error instanceof Error ? error.message : error);
    return res.json(generic);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token || password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Enter a new password of at least 8 characters.' });
    }
    const tokenHash = hashResetToken(token);
    const now = Date.now();
    resetTokens = resetTokens.filter((item) => item.expiresAt > now);
    const found = resetTokens.find((item) => item.tokenHash === tokenHash);
    if (!found) {
      return res.status(400).json({ ok: false, error: 'This reset link is invalid or has expired. Request a new one.' });
    }
    const user = users.find((u) => u.id === found.userId && u.active);
    if (!user) {
      return res.status(400).json({ ok: false, error: 'This reset link is invalid or has expired. Request a new one.' });
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    users = users.map((item) => (item.id === user.id ? user : item));
    resetTokens = resetTokens.filter((item) => item.tokenHash !== tokenHash);
    void persistAuth();
    return res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password.';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  revokedTokens.add(req.token);
  void persistAuth();
  return res.json({ ok: true });
});

app.get('/api/permissions', authRequired, requirePermission('roles.manage'), (_req, res) => {
  res.json({ ok: true, permissions });
});

app.post('/api/permissions', authRequired, requirePermission('roles.manage'), (req, res) => {
  const label = String(req.body?.label || '').trim();
  const description = String(req.body?.description || '').trim();
  const group = String(req.body?.group || 'Custom').trim() || 'Custom';
  const key = slugify(req.body?.key || label);
  if (!label || !key) return res.status(400).json({ ok: false, error: 'Permission label is required.' });
  if (permissions.some((p) => p.key === key)) {
    return res.status(409).json({ ok: false, error: 'A permission with this key already exists.' });
  }
  const created = {
    id: `perm-${randomUUID()}`,
    key,
    label,
    description: description || label,
    group,
    system: false,
  };
  permissions = [...permissions, created];
  void persistAuth();
  return res.status(201).json({ ok: true, permission: created });
});

app.get('/api/roles', authRequired, requirePermission('roles.manage', 'users.manage'), (_req, res) => {
  const enriched = roles.map((role) => ({
    ...role,
    permissions: permissionsForRole(role).map((p) => ({ id: p.id, key: p.key, label: p.label, group: p.group })),
  }));
  res.json({ ok: true, roles: enriched });
});

app.post('/api/roles', authRequired, requirePermission('roles.manage'), (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const key = slugify(req.body?.key || name);
  const permissionIds = Array.isArray(req.body?.permissionIds) ? req.body.permissionIds.map(String) : [];
  if (!name || !key) return res.status(400).json({ ok: false, error: 'Role name is required.' });
  if (roles.some((r) => r.key === key)) {
    return res.status(409).json({ ok: false, error: 'A role with this key already exists.' });
  }
  const validIds = permissionIds.filter((id) => permissions.some((p) => p.id === id));
  const created = {
    id: `role-${randomUUID()}`,
    key,
    name,
    description,
    permissionIds: validIds,
    system: false,
  };
  roles = [created, ...roles];
  void persistAuth();
  return res.status(201).json({
    ok: true,
    role: { ...created, permissions: permissionsForRole(created) },
  });
});

app.put('/api/roles/:id', authRequired, requirePermission('roles.manage'), (req, res) => {
  const role = roles.find((r) => r.id === req.params.id);
  if (!role) return res.status(404).json({ ok: false, error: 'Role not found.' });

  const name = String(req.body?.name ?? role.name).trim();
  const description = String(req.body?.description ?? role.description).trim();
  const permissionIds = Array.isArray(req.body?.permissionIds)
    ? req.body.permissionIds.map(String).filter((id) => permissions.some((p) => p.id === id))
    : role.permissionIds;

  if (!name) return res.status(400).json({ ok: false, error: 'Role name is required.' });

  // Keep admin role fully privileged if somehow stripped
  const nextIds =
    role.key === 'admin' ? Array.from(new Set([...permissionIds, ...permissions.map((p) => p.id)])) : permissionIds;

  const updated = { ...role, name, description, permissionIds: nextIds };
  roles = roles.map((r) => (r.id === role.id ? updated : r));
  void persistAuth();
  return res.json({ ok: true, role: { ...updated, permissions: permissionsForRole(updated) } });
});

app.delete('/api/roles/:id', authRequired, requirePermission('roles.manage'), (req, res) => {
  const role = roles.find((r) => r.id === req.params.id);
  if (!role) return res.status(404).json({ ok: false, error: 'Role not found.' });
  if (role.system) return res.status(400).json({ ok: false, error: 'System roles cannot be deleted.' });
  if (users.some((u) => u.roleId === role.id)) {
    return res.status(400).json({ ok: false, error: 'Reassign users before deleting this role.' });
  }
  roles = roles.filter((r) => r.id !== role.id);
  void persistAuth();
  return res.json({ ok: true });
});

app.get('/api/users', authRequired, requirePermission('users.manage', 'roles.manage'), (_req, res) => {
  res.json({
    ok: true,
    users: users.map((u) => {
      const pub = publicUser(u);
      return { ...pub, hasPassword: true };
    }),
  });
});

app.post('/api/users', authRequired, requirePermission('users.manage', 'roles.manage'), async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const name = String(req.body?.name || '').trim();
    const roleId = String(req.body?.roleId || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !name || !roleId || !password) {
      return res.status(400).json({ ok: false, error: 'Name, email, role and password are required.' });
    }
    if (!getRole(roleId)) return res.status(400).json({ ok: false, error: 'Selected role was not found.' });
    if (users.some((u) => u.email === email)) {
      return res.status(409).json({ ok: false, error: 'A user with this email already exists.' });
    }
    const created = {
      id: `user-${randomUUID()}`,
      email,
      name,
      roleId,
      passwordHash: await bcrypt.hash(password, 10),
      active: true,
    };
    users = [created, ...users];
    void persistAuth();
    return res.status(201).json({ ok: true, user: publicUser(created) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create user.';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.put('/api/users/:id/role', authRequired, requirePermission('users.manage', 'roles.manage'), (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
  const roleId = String(req.body?.roleId || '').trim();
  if (!getRole(roleId)) return res.status(400).json({ ok: false, error: 'Selected role was not found.' });
  user.roleId = roleId;
  users = users.map((u) => (u.id === user.id ? user : u));
  void persistAuth();
  return res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/mail/send', authRequired, requirePermission('communications.send'), async (req, res) => {
  try {
    if (!smtpConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'SMTP is not configured. Check SMTP_* values in .env.',
      });
    }

    const { to, subject, text, html, customerName, accountNo, inReplyTo, references } = req.body || {};
    const recipient = String(to || '').trim();
    const mailSubject = String(subject || '').trim();
    const bodyText = String(text || html || '').trim();

    if (!recipient || !recipient.includes('@')) {
      return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' });
    }
    if (!mailSubject) return res.status(400).json({ ok: false, error: 'Subject is required.' });
    if (!bodyText) return res.status(400).json({ ok: false, error: 'Message body is required.' });

    const transporter = createTransport();
    const smtp = smtpSettings();
    console.log(`[mailer] sending to ${recipient} via ${smtp.host}`);
    const headers = {};
    if (customerName) headers['X-Collections-Customer'] = String(customerName);
    if (accountNo) headers['X-Collections-Account'] = String(accountNo);
    const info = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.from}>`,
      replyTo: smtp.replyTo || smtp.from,
      to: recipient,
      subject: mailSubject,
      text: bodyText,
      html: html ? String(html) : undefined,
      inReplyTo: inReplyTo ? String(inReplyTo) : undefined,
      references: references ? String(references) : undefined,
      headers,
    });

    return res.json({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send email.';
    console.error('[mailer]', message);
    return res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/mail/inbox/sync', authRequired, requirePermission('communications.send', 'customers.view', 'collections.manage'), async (_req, res) => {
  const result = await syncImapInbox();
  if (!result.ok) {
    return res.status(result.error?.includes('not configured') ? 503 : 500).json(result);
  }
  return res.json(result);
});

app.post('/api/whatsapp/send', authRequired, requirePermission('communications.send'), async (req, res) => {
  try {
    if (!twilioConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Twilio WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM in .env.',
      });
    }

    const { to, message, customerName, accountNo, contentSid: requestSid, contentVariables } = req.body || {};
    const bodyText = String(message || '').trim();
    const contentSid = String(requestSid || twilioConfig.contentSid || '').trim();
    if (!bodyText && !contentSid) return res.status(400).json({ ok: false, error: 'Message body is required.' });

    const toAddress = toWhatsAppAddress(to);
    if (!toAddress) {
      return res.status(400).json({
        ok: false,
        error: 'A valid WhatsApp / mobile number is required (E.164, e.g. +27821234567).',
      });
    }

    const fromAddress =
      toWhatsAppAddress(twilioConfig.from) ||
      (String(twilioConfig.from || '').toLowerCase().startsWith('whatsapp:')
        ? String(twilioConfig.from).trim()
        : null);

    if (!fromAddress) {
      return res.status(503).json({
        ok: false,
        error: 'TWILIO_WHATSAPP_FROM must be a WhatsApp-enabled Twilio number (e.g. whatsapp:+14155238886).',
      });
    }

    const client = createTwilioClient();
    const payload = contentSid
      ? {
          contentSid,
          from: fromAddress,
          to: toAddress,
          ...(contentVariables && typeof contentVariables === 'object'
            ? { contentVariables: JSON.stringify(contentVariables) }
            : {}),
        }
      : {
          body: bodyText,
          from: fromAddress,
          to: toAddress,
        };
    const result = await client.messages.create(payload);

    console.log(
      `[whatsapp] sid=${result.sid} to=${toAddress} status=${result.status}` +
        (customerName ? ` customer=${customerName}` : '') +
        (accountNo ? ` account=${accountNo}` : ''),
    );

    return res.json({
      ok: true,
      sid: result.sid,
      status: result.status,
      to: toAddress,
      from: fromAddress,
    });
  } catch (error) {
    const code = error?.code;
    const raw = error instanceof Error ? error.message : 'Unable to send WhatsApp message.';
    const message =
      code === 20003 || raw === 'Authenticate'
        ? 'Twilio rejected the Account SID or Auth Token. Copy the Auth Token again from the Twilio console into TWILIO_AUTH_TOKEN, then restart npm run dev.'
        : code === 21654 || code === 21655
          ? 'Twilio trial WhatsApp requires a template. Open Messaging → Try out WhatsApp, copy the ContentSid (starts with HX) from the code sample into TWILIO_CONTENT_SID, then restart npm run dev.'
          : code === 63016 || code === 63007
          ? 'This WhatsApp number has not joined the Twilio trial sender. Ask the recipient to send join twilio-trial to +1 737 221 2163.'
          : code
            ? `${raw} (Twilio ${code})`
            : raw;
    console.error('[whatsapp]', code || '', raw);
    return res.status(code === 20003 ? 401 : 500).json({ ok: false, error: message });
  }
});

// Production: serve Vite build from ../dist (same origin as /api)
const distDir = path.resolve(__dirname, '../dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[web] serving static UI from ${distDir}`);
}

async function start() {
  try {
    await initDb();
    const authFromDb = await loadAuthTables();
    if (authFromDb?.permissions?.length && authFromDb?.roles?.length && authFromDb?.users?.length) {
      permissions = authFromDb.permissions;
      roles = authFromDb.roles;
      users = authFromDb.users;
      for (const item of authFromDb.revokedTokens || []) {
        if (item?.token) revokedTokens.add(item.token);
      }
      resetTokens = Array.isArray(authFromDb.resetTokens) ? authFromDb.resetTokens : [];
      console.log(`[db] loaded users/roles/permissions (${isUsingDatabase() ? 'PostgreSQL' : 'file'})`);
      if (ensureSystemAuth()) {
        await persistAuth();
        console.log('[db] synced system permissions onto existing roles');
      }
    } else {
      await saveAuthTables({ permissions, roles, users, revokedTokens: [], resetTokens: [] });
      console.log(`[db] seeded users/roles/permissions (${isUsingDatabase() ? 'PostgreSQL' : 'file'})`);
    }
  } catch (error) {
    console.error('[db] startup failed:', error instanceof Error ? error.message : error);
    if (process.env.DATABASE_URL) {
      process.exit(1);
    }
  }

  const server = app.listen(PORT);

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`[server] port ${PORT} is already in use. Stop the other process or change MAILER_PORT in .env.`);
      process.exit(1);
    }
    console.error('[server] failed to start:', error);
    process.exit(1);
  });

  server.on('listening', () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[auth] admin login → ${adminEmail}`);
    console.log('[auth] JWT_SECRET is set');
    console.log(`[rbac] ${roles.length} roles · ${permissions.length} permissions`);
    console.log(`[db] mode → ${isUsingDatabase() ? 'PostgreSQL' : 'JSON file fallback'}`);
    if (twilioConfigured()) {
      console.log(`[whatsapp] Twilio ready · from ${twilioConfig.from}`);
    } else {
      console.log('[whatsapp] Twilio NOT configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env');
    }
    if (!smtpConfigured()) {
      console.log('[mailer] smtp NOT configured — set SMTP_* in .env');
    } else {
      const smtp = smtpSettings();
      console.log(`[mailer] smtp target ${smtp.host}:${smtp.port} as ${smtp.from}${smtp.family ? ` ipv${smtp.family}` : ''}`);
      createTransport()
        .verify()
        .then(() => console.log('[mailer] smtp credentials verified'))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[mailer] smtp verify failed:', message);
        });
    }
    startImapPolling();
    startCollectionsJobs();
  });

function startCollectionsJobs() {
  const ms = Math.max(60, Number(process.env.COLLECTIONS_JOB_SECONDS || 120)) * 1000;
  const run = async () => {
    try {
      const store = await readAppStore();
      const result = runCollectionsJobs(store);
      if (result.promisesCreated || result.promisesBroken || result.seeded) {
        await writeAppStore({ ...result.store, revision: Number(result.store.revision || 0) });
        if (result.promisesCreated || result.promisesBroken) {
          console.log(
            `[jobs] email promises ${result.promisesCreated} · overdue broken ${result.promisesBroken}`,
          );
        }
      }
    } catch (error) {
      console.error('[jobs]', error instanceof Error ? error.message : error);
    }
  };
  setTimeout(run, 8000);
  setInterval(run, ms);
  console.log(`[jobs] collections jobs every ${ms / 1000}s (email PTP + overdue promises)`);
}

  server.ref();
}

start();

process.on('uncaughtException', (error) => {
  console.error('[server] uncaughtException:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});
