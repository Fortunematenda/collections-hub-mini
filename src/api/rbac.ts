import { apiUrl } from './base';
import { getStoredToken } from './auth';

export type Permission = {
  id: string;
  key: string;
  label: string;
  description: string;
  group: string;
  system?: boolean;
};

export type Role = {
  id: string;
  key: string;
  name: string;
  description: string;
  permissionIds: string[];
  system?: boolean;
  permissions?: Pick<Permission, 'id' | 'key' | 'label' | 'group'>[];
};

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  active: boolean;
};

function authHeaders() {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
}

export async function fetchPermissions() {
  const res = await fetch(apiUrl('/api/permissions'), { headers: authHeaders() });
  const data = await parse<{ permissions?: Permission[] }>(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load permissions.');
  return data.permissions || [];
}

export async function createPermission(input: { label: string; key?: string; description?: string; group?: string }) {
  const res = await fetch(apiUrl('/api/permissions'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parse<{ permission?: Permission }>(res);
  if (!res.ok || !data.ok || !data.permission) throw new Error(data.error || 'Unable to create permission.');
  return data.permission;
}

export async function fetchRoles() {
  const res = await fetch(apiUrl('/api/roles'), { headers: authHeaders() });
  const data = await parse<{ roles?: Role[] }>(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load roles.');
  return data.roles || [];
}

export async function createRole(input: { name: string; key?: string; description?: string; permissionIds: string[] }) {
  const res = await fetch(apiUrl('/api/roles'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parse<{ role?: Role }>(res);
  if (!res.ok || !data.ok || !data.role) throw new Error(data.error || 'Unable to create role.');
  return data.role;
}

export async function updateRole(id: string, input: { name: string; description?: string; permissionIds: string[] }) {
  const res = await fetch(apiUrl(`/api/roles/${id}`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parse<{ role?: Role }>(res);
  if (!res.ok || !data.ok || !data.role) throw new Error(data.error || 'Unable to update role.');
  return data.role;
}

export async function deleteRole(id: string) {
  const res = await fetch(apiUrl(`/api/roles/${id}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await parse(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to delete role.');
}

export async function fetchUsers() {
  const res = await fetch(apiUrl('/api/users'), { headers: authHeaders() });
  const data = await parse<{ users?: ManagedUser[] }>(res);
  if (!res.ok || !data.ok) throw new Error(data.error || 'Unable to load users.');
  return data.users || [];
}

export async function createUser(input: { name: string; email: string; roleId: string; password: string }) {
  const res = await fetch(apiUrl('/api/users'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parse<{ user?: ManagedUser }>(res);
  if (!res.ok || !data.ok || !data.user) throw new Error(data.error || 'Unable to create user.');
  return data.user;
}

export async function assignUserRole(userId: string, roleId: string) {
  const res = await fetch(apiUrl(`/api/users/${userId}/role`), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ roleId }),
  });
  const data = await parse<{ user?: ManagedUser }>(res);
  if (!res.ok || !data.ok || !data.user) throw new Error(data.error || 'Unable to assign role.');
  return data.user;
}
