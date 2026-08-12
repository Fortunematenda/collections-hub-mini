import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Shield, Trash2, UserPlus } from 'lucide-react';
import { EmptyState, PageHero } from '../components/ui';
import {
  assignUserRole,
  createPermission,
  createRole,
  createUser,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  fetchUsers,
  updateRole,
  type ManagedUser,
  type Permission,
  type Role,
} from '../api/rbac';
import { useAuth } from '../context/AuthContext';

export default function RolesPermissions() {
  const { hasPermission, user: currentUser } = useAuth();
  const canManageRoles = hasPermission('roles.manage');
  const canManageUsers = hasPermission('users.manage');

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissionIds, setRolePermissionIds] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permLabel, setPermLabel] = useState('');
  const [permGroup, setPermGroup] = useState('Custom');
  const [permDescription, setPermDescription] = useState('');
  const [savingPerm, setSavingPerm] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRoleId, setUserRoleId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0] || null;

  const permissionsByGroup = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.group) || [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  async function load() {
    setLoading(true);
    try {
      const [perms, roleList] = await Promise.all([fetchPermissions(), fetchRoles()]);
      setPermissions(perms);
      setRoles(roleList);
      setSelectedRoleId((prev) => prev || roleList[0]?.id || null);
      if (canManageUsers || canManageRoles) {
        const userList = await fetchUsers();
        setUsers(userList);
      }
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unable to load roles.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManageRoles) void load();
    else setLoading(false);
  }, [canManageRoles]);

  function openCreateRole() {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRolePermissionIds([]);
    setRoleModalOpen(true);
  }

  function openEditRole(role: Role) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRolePermissionIds([...(role.permissionIds || [])]);
    setRoleModalOpen(true);
  }

  async function saveRole() {
    if (!roleName.trim()) return;
    setSavingRole(true);
    try {
      if (editingRole) {
        const updated = await updateRole(editingRole.id, {
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissionIds: rolePermissionIds,
        });
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        notifications.show({ color: 'teal', message: 'Role updated successfully.' });
      } else {
        const created = await createRole({
          name: roleName.trim(),
          description: roleDescription.trim(),
          permissionIds: rolePermissionIds,
        });
        setRoles((prev) => [created, ...prev]);
        setSelectedRoleId(created.id);
        notifications.show({ color: 'teal', message: 'Role created successfully.' });
      }
      setRoleModalOpen(false);
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to save role.',
      });
    } finally {
      setSavingRole(false);
    }
  }

  async function removeRole(role: Role) {
    try {
      await deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selectedRoleId === role.id) setSelectedRoleId(roles.find((r) => r.id !== role.id)?.id || null);
      notifications.show({ color: 'teal', message: 'Role deleted.' });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to delete role.',
      });
    }
  }

  async function savePermission() {
    if (!permLabel.trim()) return;
    setSavingPerm(true);
    try {
      const created = await createPermission({
        label: permLabel.trim(),
        description: permDescription.trim(),
        group: permGroup.trim() || 'Custom',
      });
      setPermissions((prev) => [...prev, created]);
      setPermModalOpen(false);
      setPermLabel('');
      setPermDescription('');
      setPermGroup('Custom');
      notifications.show({ color: 'teal', message: 'Permission added.' });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to add permission.',
      });
    } finally {
      setSavingPerm(false);
    }
  }

  async function saveUser() {
    if (!userName.trim() || !userEmail.trim() || !userRoleId || !userPassword) return;
    setSavingUser(true);
    try {
      const created = await createUser({
        name: userName.trim(),
        email: userEmail.trim(),
        roleId: userRoleId,
        password: userPassword,
      });
      setUsers((prev) => [created, ...prev]);
      setUserModalOpen(false);
      setUserName('');
      setUserEmail('');
      setUserPassword('');
      setUserRoleId(null);
      notifications.show({ color: 'teal', message: 'User created successfully.' });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to create user.',
      });
    } finally {
      setSavingUser(false);
    }
  }

  if (!canManageRoles) {
    return (
      <Card className="card" radius="lg" p="lg">
        <EmptyState
          title="Access restricted"
          description="You need the Manage roles permission to configure roles and permissions."
        />
      </Card>
    );
  }

  return (
    <>
      <PageHero
        title="Roles & permissions"
        description="Define what each team role can do across collections, communications, imports and administration."
        actions={
          <Group gap="xs">
            <Button variant="light" leftSection={<Plus size={14} />} onClick={() => setPermModalOpen(true)}>
              Add permission
            </Button>
            <Button leftSection={<Plus size={14} />} onClick={openCreateRole}>
              Add role
            </Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Card className="card" radius="lg" p="lg" style={{ gridColumn: 'span 1' }}>
          <Group justify="space-between" mb="md">
            <div className="card-title">Roles</div>
            <Badge variant="light">{roles.length}</Badge>
          </Group>
          <Stack gap="xs">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`timeline-item ${selectedRole?.id === role.id ? 'role-item-active' : ''}`}
                onClick={() => setSelectedRoleId(role.id)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Text size="sm" fw={700}>
                      {role.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {role.permissionIds?.length || 0} permissions
                      {role.system ? ' · system' : ''}
                    </Text>
                  </div>
                  <Shield size={14} color="#6b7280" />
                </Group>
              </button>
            ))}
            {!loading && roles.length === 0 && <EmptyState title="No roles yet" description="Create a role to start assigning permissions." />}
          </Stack>
        </Card>

        <Card className="card" radius="lg" p="lg" style={{ gridColumn: 'span 2' }}>
          {selectedRole ? (
            <>
              <Group justify="space-between" align="flex-start" mb="md" wrap="wrap">
                <div>
                  <Group gap={8}>
                    <div className="card-title">{selectedRole.name}</div>
                    {selectedRole.system && (
                      <Badge size="sm" variant="light">
                        System
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {selectedRole.description || 'No description'}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Key: {selectedRole.key}
                  </Text>
                </div>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => openEditRole(selectedRole)}>
                    Edit role
                  </Button>
                  {!selectedRole.system && (
                    <Button size="xs" color="red" variant="light" leftSection={<Trash2 size={12} />} onClick={() => removeRole(selectedRole)}>
                      Delete
                    </Button>
                  )}
                </Group>
              </Group>

              <Stack gap="md">
                {permissionsByGroup.map(([group, items]) => (
                  <div key={group}>
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={8}>
                      {group}
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      {items.map((p) => {
                        const enabled = selectedRole.permissionIds?.includes(p.id);
                        return (
                          <div key={p.id} className={`permission-chip ${enabled ? 'permission-chip-on' : ''}`}>
                            <Text size="xs" fw={650}>
                              {p.label}
                            </Text>
                            <Text size="10px" c="dimmed">
                              {p.key}
                            </Text>
                          </div>
                        );
                      })}
                    </SimpleGrid>
                  </div>
                ))}
              </Stack>
            </>
          ) : (
            <EmptyState title="Select a role" description="Choose a role on the left to review its permissions." />
          )}
        </Card>
      </SimpleGrid>

      <Card className="card" radius="lg" p="lg" mt="md">
        <Group justify="space-between" mb="md" wrap="wrap">
          <div>
            <div className="card-title">Users</div>
            <div className="card-subtitle">Assign roles to people who can sign in</div>
          </div>
          {canManageUsers && (
            <Button size="sm" leftSection={<UserPlus size={14} />} onClick={() => setUserModalOpen(true)}>
              Add user
            </Button>
          )}
        </Group>
        <Stack gap="sm">
          {users.map((u) => (
            <Group key={u.id} justify="space-between" className="timeline-item" wrap="wrap">
              <div>
                <Text size="sm" fw={700}>
                  {u.name} {u.id === currentUser?.id ? '(you)' : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {u.email}
                </Text>
              </div>
              <Select
                w={220}
                size="xs"
                data={roles.map((r) => ({ value: r.id, label: r.name }))}
                value={u.roleId}
                disabled={!canManageUsers && !canManageRoles}
                onChange={async (value) => {
                  if (!value) return;
                  try {
                    const updated = await assignUserRole(u.id, value);
                    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    notifications.show({ color: 'teal', message: 'User role updated.' });
                  } catch (error) {
                    notifications.show({
                      color: 'red',
                      message: error instanceof Error ? error.message : 'Unable to update user role.',
                    });
                  }
                }}
              />
            </Group>
          ))}
          {users.length === 0 && <EmptyState title="No users loaded" description="Users will appear here once roles access is available." />}
        </Stack>
      </Card>

      <Modal opened={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? 'Edit role' : 'Add role'} centered radius="lg" size="lg" className="app-modal">
        <Stack>
          <TextInput label="Role name" required value={roleName} onChange={(e) => setRoleName(e.currentTarget.value)} />
          <Textarea label="Description" value={roleDescription} onChange={(e) => setRoleDescription(e.currentTarget.value)} />
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            Permissions
          </Text>
          <div className="role-permission-scroll">
            {permissionsByGroup.map(([group, items]) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <Text size="xs" fw={700} mb={6}>
                  {group}
                </Text>
                <Stack gap={6}>
                  {items.map((p) => (
                    <Checkbox
                      key={p.id}
                      label={`${p.label} (${p.key})`}
                      checked={rolePermissionIds.includes(p.id)}
                      onChange={(e) => {
                        const checked = e.currentTarget.checked;
                        setRolePermissionIds((prev) => (checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)));
                      }}
                    />
                  ))}
                </Stack>
              </div>
            ))}
          </div>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingRole} onClick={saveRole}>
              {editingRole ? 'Save changes' : 'Create role'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={permModalOpen} onClose={() => setPermModalOpen(false)} title="Add permission" centered radius="lg" className="app-modal">
        <Stack>
          <TextInput label="Permission label" required value={permLabel} onChange={(e) => setPermLabel(e.currentTarget.value)} placeholder="e.g. Export reports" />
          <TextInput label="Group" value={permGroup} onChange={(e) => setPermGroup(e.currentTarget.value)} />
          <Textarea label="Description" value={permDescription} onChange={(e) => setPermDescription(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPermModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingPerm} onClick={savePermission}>
              Save permission
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={userModalOpen} onClose={() => setUserModalOpen(false)} title="Add user" centered radius="lg" className="app-modal">
        <Stack>
          <TextInput label="Full name" required value={userName} onChange={(e) => setUserName(e.currentTarget.value)} />
          <TextInput label="Email" type="email" required value={userEmail} onChange={(e) => setUserEmail(e.currentTarget.value)} />
          <PasswordInput label="Temporary password" required value={userPassword} onChange={(e) => setUserPassword(e.currentTarget.value)} />
          <Select
            label="Role"
            required
            data={roles.map((r) => ({ value: r.id, label: r.name }))}
            value={userRoleId}
            onChange={setUserRoleId}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setUserModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={savingUser} onClick={saveUser}>
              Create user
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
