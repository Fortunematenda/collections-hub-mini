import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  loginRequest,
  logoutRequest,
  markSessionExpired,
  meRequest,
  storeSession,
  type AuthUser,
} from '../api/auth';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const existing = getStoredToken();
      if (!existing) {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }
      const result = await meRequest(existing);
      if (cancelled) return;
      if (result.ok) {
        setToken(existing);
        setUser(result.user);
        storeSession(existing, result.user, localStorage.getItem('ch_auth_remember') !== '0');
      } else {
        if (result.expired) markSessionExpired();
        clearSession();
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const result = await loginRequest(email, password);
    if (!result.ok) return { ok: false, error: result.error };
    storeSession(result.token, result.user, remember);
    setToken(result.token);
    setUser(result.user);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    const current = getStoredToken();
    clearSession();
    setToken(null);
    setUser(null);
    if (current) void logoutRequest(current);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return (user.permissions || []).includes(permission);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]) => perms.some((p) => hasPermission(p)),
    [hasPermission],
  );

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
    }),
    [user, token, loading, login, logout, hasPermission, hasAnyPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
