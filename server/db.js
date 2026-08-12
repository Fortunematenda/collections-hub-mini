import pg from 'pg';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_FALLBACK = path.join(__dirname, 'data', 'app-store.json');

/** @type {import('pg').Pool | null} */
let pool = null;
let usingDatabase = false;

export function emptyAppStore() {
  return {
    companies: [],
    companyId: '',
    customers: [],
    recoveries: [],
    imports: [],
    templates: [],
    equipment: [],
    promises: [],
    payments: [],
    communications: [],
    notes: [],
    followUps: [],
    activities: [],
  };
}

function readFileStore() {
  try {
    if (!existsSync(FILE_FALLBACK)) return emptyAppStore();
    const parsed = JSON.parse(readFileSync(FILE_FALLBACK, 'utf8'));
    return { ...emptyAppStore(), ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch (error) {
    console.error('[db] file read failed:', error instanceof Error ? error.message : error);
    return emptyAppStore();
  }
}

function writeFileStore(payload) {
  const dir = path.dirname(FILE_FALLBACK);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const next = { ...emptyAppStore(), ...payload };
  writeFileSync(FILE_FALLBACK, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isUsingDatabase() {
  return usingDatabase;
}

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('[db] DATABASE_URL not set — using local JSON file store');
    usingDatabase = false;
    return { mode: 'file' };
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: String(process.env.DATABASE_SSL || 'false') === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        "group" TEXT NOT NULL DEFAULT 'Custom',
        system BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        permission_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        system BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role_id TEXT NOT NULL REFERENCES roles(id),
        password_hash TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        account_no TEXT NOT NULL,
        data JSONB NOT NULL,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS customers_company_account_uidx
        ON customers (company_id, lower(account_no))
        WHERE archived IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS customers_company_idx ON customers (company_id);
    `);

    const state = await client.query('SELECT id FROM app_state WHERE id = 1');
    if (state.rowCount === 0) {
      const fromFile = readFileStore();
      await client.query('INSERT INTO app_state (id, payload) VALUES (1, $1::jsonb)', [JSON.stringify(fromFile)]);
      if ((fromFile.companies || []).length) {
        for (const company of fromFile.companies) {
          await client.query(
            `INSERT INTO companies (id, data, status) VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, status = EXCLUDED.status, updated_at = NOW()`,
            [company.id, JSON.stringify(company), company.status || 'Active'],
          );
        }
      }
      if ((fromFile.customers || []).length) {
        for (const customer of fromFile.customers) {
          await client.query(
            `INSERT INTO customers (id, company_id, account_no, data, archived)
             VALUES ($1, $2, $3, $4::jsonb, $5)
             ON CONFLICT (id) DO UPDATE SET
               company_id = EXCLUDED.company_id,
               account_no = EXCLUDED.account_no,
               data = EXCLUDED.data,
               archived = EXCLUDED.archived,
               updated_at = NOW()`,
            [
              customer.id,
              customer.companyId,
              customer.accountNo,
              JSON.stringify(customer),
              Boolean(customer.archived),
            ],
          );
        }
      }
    }

    usingDatabase = true;
    console.log('[db] PostgreSQL connected and migrations applied');
    return { mode: 'postgres' };
  } finally {
    client.release();
  }
}

export async function readAppStore() {
  if (!usingDatabase || !pool) return readFileStore();
  const result = await pool.query('SELECT payload FROM app_state WHERE id = 1');
  if (!result.rowCount) return emptyAppStore();
  return { ...emptyAppStore(), ...(result.rows[0].payload || {}) };
}

export async function writeAppStore(payload) {
  const next = { ...emptyAppStore(), ...payload };
  if (!usingDatabase || !pool) return writeFileStore(next);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO app_state (id, payload, updated_at) VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(next)],
    );

    await client.query('DELETE FROM companies');
    for (const company of next.companies || []) {
      if (!company?.id) continue;
      await client.query(
        `INSERT INTO companies (id, data, status, updated_at) VALUES ($1, $2::jsonb, $3, NOW())`,
        [company.id, JSON.stringify(company), company.status || 'Active'],
      );
    }

    await client.query('DELETE FROM customers');
    for (const customer of next.customers || []) {
      if (!customer?.id) continue;
      await client.query(
        `INSERT INTO customers (id, company_id, account_no, data, archived, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW())`,
        [
          customer.id,
          customer.companyId || '',
          customer.accountNo || '',
          JSON.stringify(customer),
          Boolean(customer.archived),
        ],
      );
    }

    await client.query('COMMIT');
    return next;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function loadAuthTables() {
  if (!usingDatabase || !pool) return null;
  const [permissions, roles, users] = await Promise.all([
    pool.query('SELECT id, key, label, description, "group", system FROM permissions ORDER BY key'),
    pool.query('SELECT id, key, name, description, permission_ids, system FROM roles ORDER BY name'),
    pool.query('SELECT id, email, name, role_id, password_hash, active FROM users ORDER BY email'),
  ]);
  if (!permissions.rowCount && !roles.rowCount && !users.rowCount) return null;
  return {
    permissions: permissions.rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      description: r.description,
      group: r.group,
      system: r.system,
    })),
    roles: roles.rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      permissionIds: Array.isArray(r.permission_ids) ? r.permission_ids : [],
      system: r.system,
    })),
    users: users.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      roleId: r.role_id,
      passwordHash: r.password_hash,
      active: r.active,
    })),
  };
}

export async function saveAuthTables({ permissions, roles, users }) {
  if (!usingDatabase || !pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM roles');
    await client.query('DELETE FROM permissions');

    for (const p of permissions) {
      await client.query(
        `INSERT INTO permissions (id, key, label, description, "group", system)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [p.id, p.key, p.label, p.description || '', p.group || 'Custom', Boolean(p.system)],
      );
    }
    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (id, key, name, description, permission_ids, system)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          role.id,
          role.key,
          role.name,
          role.description || '',
          JSON.stringify(role.permissionIds || []),
          Boolean(role.system),
        ],
      );
    }
    for (const user of users) {
      await client.query(
        `INSERT INTO users (id, email, name, role_id, password_hash, active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [user.id, user.email, user.name, user.roleId, user.passwordHash, Boolean(user.active)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
