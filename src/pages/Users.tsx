import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { UserPlus, Users as UsersIcon } from 'lucide-react';
import { EmptyState, PageHero } from '../components/ui';
import {
  assignUserRole,
  createUser,
  fetchRoles,
  fetchUsers,
  type ManagedUser,
  type Role,
} from '../api/rbac';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { hasPermission, user: currentUser } = useAuth();
  const canManageUsers = hasPermission('users.manage');
  const canManageRoles = hasPermission('roles.manage');
  const canAccess = canManageUsers || canManageRoles || currentUser?.role === 'admin';

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [userList, roleList] = await Promise.all([fetchUsers(), fetchRoles()]);
      setUsers(userList);
      setRoles(roleList);
      setRoleId((prev) => prev || roleList.find((r) => r.key === 'collections_operator')?.id || roleList[0]?.id || null);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Error',
        message: error instanceof Error ? error.message : 'Unable to load users.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canAccess) void load();
    else setLoading(false);
  }, [canAccess]);

  async function saveUser() {
    if (!name.trim() || !email.trim() || !roleId || !password) {
      notifications.show({ color: 'red', message: 'Name, email, role and password are required.' });
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        roleId,
        password,
      });
      setUsers((prev) => [created, ...prev]);
      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      notifications.show({ color: 'teal', message: `${created.name} can now sign in.` });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Unable to create user.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess) {
    return (
      <Card className="card" radius="lg" p="lg">
        <EmptyState title="Access restricted" description="Only admins can manage users." />
      </Card>
    );
  }

  return (
    <>
      <PageHero
        title="Users"
        description="Invite team members and assign a role. They sign in with the email and temporary password you set."
        actions={
          canManageUsers || currentUser?.role === 'admin' ? (
            <Button leftSection={<UserPlus size={15} />} onClick={() => setModalOpen(true)}>
              Add user
            </Button>
          ) : undefined
        }
      />

      <Card className="card" radius="lg" p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <div className="card-title">Team members</div>
            <div className="card-subtitle">{users.length} user{users.length === 1 ? '' : 's'}</div>
          </div>
          <Badge variant="light" leftSection={<UsersIcon size={12} />}>
            {loading ? 'Loading…' : `${users.length} total`}
          </Badge>
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
                w={240}
                size="sm"
                data={roles.map((r) => ({ value: r.id, label: r.name }))}
                value={u.roleId}
                disabled={!canManageUsers && !canManageRoles && currentUser?.role !== 'admin'}
                onChange={async (value) => {
                  if (!value) return;
                  try {
                    const updated = await assignUserRole(u.id, value);
                    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                    notifications.show({ color: 'teal', message: 'User role updated.' });
                  } catch (error) {
                    notifications.show({
                      color: 'red',
                      message: error instanceof Error ? error.message : 'Unable to update role.',
                    });
                  }
                }}
              />
            </Group>
          ))}
          {!loading && users.length === 0 && (
            <EmptyState
              title="No users yet"
              description="Add your first team member so they can sign in."
              action={
                <Button size="xs" leftSection={<UserPlus size={14} />} onClick={() => setModalOpen(true)}>
                  Add user
                </Button>
              }
            />
          )}
        </Stack>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Add user" centered radius="lg" className="app-modal">
        <Stack>
          <TextInput label="Full name" required value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="Jane Collector" />
          <TextInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="jane@company.com"
          />
          <PasswordInput
            label="Temporary password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            placeholder="They can change this later"
          />
          <Select
            label="Role"
            required
            data={roles.map((r) => ({ value: r.id, label: r.name }))}
            value={roleId}
            onChange={setRoleId}
            placeholder="Choose a role"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={saveUser} leftSection={<UserPlus size={14} />}>
              Create user
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
