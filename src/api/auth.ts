import { apiUrl } from './base';

const TOKEN_KEY = 'ch_auth_token';
const USER_KEY = 'ch_auth_user';

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

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
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
    if (!res.ok || !data.ok || !data.token || !data.user) {
      return { ok: false as const, error: data.error || 'Unable to sign in.' };
    }
    return { ok: true as const, token: data.token, user: data.user };
  } catch {
    return {
      ok: false as const,
      error: 'Cannot reach the API server. Run npm run dev and ensure the server is on port 8787.',
    };
  }
}

export async function logoutRequest(token: string) {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Client logout still proceeds if network fails
  }
}

export async function meRequest(token: string) {
  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; user?: AuthUser; error?: string };
    if (!res.ok || !data.ok || !data.user) {
      return { ok: false as const, error: data.error || 'Session expired.' };
    }
    return { ok: true as const, user: data.user };
  } catch {
    return { ok: false as const, error: 'Auth server unreachable.' };
  }
}
