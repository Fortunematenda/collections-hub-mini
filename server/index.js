import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { randomUUID } from 'crypto';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.MAILER_PORT || process.env.PORT || 8787);
const JWT_SECRET = process.env.JWT_SECRET || 'collections-hub-dev-secret-change-me';
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
const adminPasswordPlain = process.env.ADMIN_PASSWORD || 'Admin123!';
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

const smtp = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  fromName: process.env.SMTP_FROM_NAME || 'Debt Collections',
};

function smtpConfigured() {
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.from);
}

function createTransport() {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || '',
  authToken: process.env.TWILIO_AUTH_TOKEN || '',
  from: process.env.TWILIO_WHATSAPP_FROM || '',
  defaultCountry: process.env.TWILIO_DEFAULT_COUNTRY || '27',
};

function twilioConfigured() {
  return Boolean(twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.from);
}

function createTwilioClient() {
  return twilio(twilioConfig.accountSid, twilioConfig.authToken);
}

/** Normalize to E.164 digits with leading +, then Twilio WhatsApp address. */
function toWhatsAppAddress(raw, fallbackCountry = twilioConfig.defaultCountry) {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (value.toLowerCase().startsWith('whatsapp:')) {
    const rest = value.slice('whatsapp:'.length).trim();
    const nested = toWhatsAppAddress(rest, fallbackCountry);
    return nested;
  }

  let digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    const only = digits.replace(/\D/g, '');
    if (only.startsWith(fallbackCountry)) digits = `+${only}`;
    else if (only.startsWith('0') && only.length >= 9) digits = `+${fallbackCountry}${only.slice(1)}`;
    else if (only.length >= 9) digits = `+${fallbackCountry}${only}`;
    else return null;
  }

  const e164 = `+${digits.replace(/\D/g, '')}`;
  if (e164.length < 11) return null;
  return `whatsapp:${e164}`;
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
    const owned = new Set(req.user?.permissions || []);
    const allowed = keys.some((k) => owned.has(k) || owned.has('roles.manage'));
    // Admin role key always allowed for admin APIs
    if (req.user?.role === 'admin' || allowed) return next();
    return res.status(403).json({ ok: false, error: 'You do not have permission for this action.' });
  };
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '10mb' }));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

async function persistAuth() {
  try {
    await saveAuthTables({ permissions, roles, users });
  } catch (error) {
    console.error('[db] auth persist failed:', error instanceof Error ? error.message : error);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mailer: smtpConfigured() ? 'configured' : 'missing-env',
    whatsapp: twilioConfigured() ? 'twilio' : 'missing-env',
    auth: 'jwt',
    roles: roles.length,
    permissions: permissions.length,
    host: smtp.host || null,
    from: smtp.from || null,
    twilioFrom: twilioConfigured() ? twilioConfig.from : null,
    database: isUsingDatabase() ? 'postgres' : 'file-fallback',
  });
});

app.get('/api/data', authRequired, async (_req, res) => {
  try {
    const data = await readAppStore();
    return res.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load app data.';
    return res.status(500).json({ ok: false, error: message });
  }
});

app.put('/api/data', authRequired, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!Array.isArray(body.companies)) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: companies must be an array.' });
    }
    const saved = await writeAppStore({
      companies: body.companies || [],
      companyId: String(body.companyId || ''),
      customers: Array.isArray(body.customers) ? body.customers : [],
      recoveries: Array.isArray(body.recoveries) ? body.recoveries : [],
      imports: Array.isArray(body.imports) ? body.imports : [],
      templates: Array.isArray(body.templates) ? body.templates : [],
      equipment: Array.isArray(body.equipment) ? body.equipment : [],
      promises: Array.isArray(body.promises) ? body.promises : [],
      payments: Array.isArray(body.payments) ? body.payments : [],
      communications: Array.isArray(body.communications) ? body.communications : [],
      notes: Array.isArray(body.notes) ? body.notes : [],
      followUps: Array.isArray(body.followUps) ? body.followUps : [],
      activities: Array.isArray(body.activities) ? body.activities : [],
    });
    return res.json({ ok: true, data: saved });
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

    const user = users.find((u) => u.email === email && u.active);
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });

    const pub = publicUser(user);
    const token = signToken(user);
    return res.json({ ok: true, token, user: pub, expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    console.error('[auth]', message);
    return res.status(500).json({ ok: false, error: message });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  revokedTokens.add(req.token);
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

    const { to, subject, text, html, customerName, accountNo } = req.body || {};
    const recipient = String(to || '').trim();
    const mailSubject = String(subject || '').trim();
    const bodyText = String(text || html || '').trim();

    if (!recipient || !recipient.includes('@')) {
      return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' });
    }
    if (!mailSubject) return res.status(400).json({ ok: false, error: 'Subject is required.' });
    if (!bodyText) return res.status(400).json({ ok: false, error: 'Message body is required.' });

    const transporter = createTransport();
    const info = await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.from}>`,
      to: recipient,
      subject: mailSubject,
      text: bodyText,
      html: html ? String(html) : undefined,
      headers: {
        'X-Collections-Customer': customerName ? String(customerName) : '',
        'X-Collections-Account': accountNo ? String(accountNo) : '',
        'X-Collections-Sent-By': req.user?.email || '',
      },
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

app.post('/api/whatsapp/send', authRequired, requirePermission('communications.send'), async (req, res) => {
  try {
    if (!twilioConfigured()) {
      return res.status(503).json({
        ok: false,
        error: 'Twilio WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM in .env.',
      });
    }

    const { to, message, from, customerName, accountNo } = req.body || {};
    const bodyText = String(message || '').trim();
    if (!bodyText) return res.status(400).json({ ok: false, error: 'Message body is required.' });

    const toAddress = toWhatsAppAddress(to);
    if (!toAddress) {
      return res.status(400).json({
        ok: false,
        error: 'A valid WhatsApp / mobile number is required (E.164, e.g. +27821234567).',
      });
    }

    const fromAddress =
      toWhatsAppAddress(from) ||
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
    const result = await client.messages.create({
      from: fromAddress,
      to: toAddress,
      body: bodyText,
    });

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
    const message = error instanceof Error ? error.message : 'Unable to send WhatsApp message.';
    console.error('[whatsapp]', message);
    return res.status(500).json({ ok: false, error: message });
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
      console.log('[db] loaded users/roles/permissions from PostgreSQL');
    } else if (isUsingDatabase()) {
      await saveAuthTables({ permissions, roles, users });
      console.log('[db] seeded users/roles/permissions into PostgreSQL');
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
    console.log(`[rbac] ${roles.length} roles · ${permissions.length} permissions`);
    console.log(`[db] mode → ${isUsingDatabase() ? 'PostgreSQL' : 'JSON file fallback'}`);
    if (twilioConfigured()) {
      console.log(`[whatsapp] Twilio ready · from ${twilioConfig.from}`);
    } else {
      console.log('[whatsapp] Twilio NOT configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env');
    }
    if (!smtpConfigured()) {
      console.log('[mailer] smtp NOT configured — set SMTP_* in .env');
      return;
    }
    console.log(`[mailer] smtp target ${smtp.host}:${smtp.port} as ${smtp.from}`);
    createTransport()
      .verify()
      .then(() => console.log('[mailer] smtp credentials verified'))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[mailer] smtp verify failed:', message);
      });
  });

  server.ref();
}

start();

process.on('uncaughtException', (error) => {
  console.error('[server] uncaughtException:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason);
});
