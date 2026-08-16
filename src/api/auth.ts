import { apiUrl } from './base';

const TOKEN_KEY = 'ch_auth_token';
const USER_KEY = 'ch_auth_user';
const REMEMBER_KEY = 'ch_auth_remember';
const EXPIRED_KEY = 'ch_session_expired';
const GENERIC_LOGIN_ERROR = 'The email or password is incorrect.';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId?: string;
  roleName?: string;
  permissions?: string[];
  active?: boolean;
};

function readStore(key: string) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

export function getStoredToken(): string | null {
  return readStore(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = readStore(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser, remember = true) {
  clearSession();
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
  const store = remember ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function markSessionExpired() {
  sessionStorage.setItem(EXPIRED_KEY, '1');
}

export function consumeSessionExpired() {
  const value = sessionStorage.getItem(EXPIRED_KEY);
  if (value) sessionStorage.removeItem(EXPIRED_KEY);
  return Boolean(value);
}

export async function loginRequest(email: string, password: string) {
  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      token?: string;
      user?: AuthUser;
    };
    if (res.status === 429) {
      return { ok: false as const, error: data.error || 'Too many sign-in attempts. Please try again later.' };
    }
    if (!res.ok || !data.ok || !data.token || !data.user) {
      return { ok: false as const, error: res.status === 401 ? GENERIC_LOGIN_ERROR : data.error || GENERIC_LOGIN_ERROR };
    }
    return { ok: true as const, token: data.token, user: data.user };
  } catch {
    return {
      ok: false as const,
      error: 'Cannot reach the API server. Run npm run dev and ensure the server is on port 8787.',
    };
  }
}

export async function forgotPasswordRequest(email: string) {
  try {
    const res = await fetch(apiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    await res.json().catch(() => ({}));
    return {
      ok: true as const,
      message: 'If that email is on this workspace, reset instructions were sent.',
    };
  } catch {
    return {
      ok: true as const,
      message: 'If that email is on this workspace, reset instructions were sent.',
    };
  }
}

export async function resetPasswordRequest(token: string, password: string) {
  try {
    const res = await fetch(apiUrl('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false as const, error: data.error || 'Unable to reset password.' };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: 'Cannot reach the API server.' };
  }
}

export async function logoutRequest(token: string) {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Client logout still proceeds if the API is down or slow
  }
}

export async function meRequest(token: string) {
  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; user?: AuthUser; error?: string };
    if (!res.ok || !data.ok || !data.user) {
      return { ok: false as const, error: data.error || 'Session expired.', expired: res.status === 401 };
    }
    return { ok: true as const, user: data.user };
  } catch {
    return { ok: false as const, error: 'Auth server unreachable.' };
  }
}
