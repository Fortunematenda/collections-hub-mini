import { useEffect, useMemo, useState } from 'react';
import { Select } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import { fetchUserDirectory, fetchUsers } from '../api/rbac';
import { useAuth } from '../context/AuthContext';

type Option = { value: string; label: string };
type DirectoryUser = { name: string; email: string };

function addOption(options: Option[], seen: Set<string>, name?: string, email?: string) {
  const value = (name || '').trim() || (email || '').trim();
  if (!value) return;
  const key = value.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  options.push({
    value,
    label: name && email ? `${name} · ${email}` : value,
  });
}

export function UserSelect({
  label,
  value,
  onChange,
  includeUnassigned = false,
  placeholder = 'Select a user',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  includeUnassigned?: boolean;
  placeholder?: string;
}) {
  const { user } = useAuth();
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let list: DirectoryUser[] = [];
        try {
          list = (await fetchUserDirectory()).map((item) => ({
            name: item.name || '',
            email: item.email || '',
          }));
        } catch {
          list = (await fetchUsers())
            .filter((item) => item.active !== false)
            .map((item) => ({ name: item.name || '', email: item.email || '' }));
        }
        if (!cancelled) setDirectory(list);
      } catch {
        if (!cancelled) setDirectory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    const options: Option[] = [];
    const seen = new Set<string>();
    if (includeUnassigned) addOption(options, seen, 'Unassigned');
    addOption(options, seen, user?.name, user?.email);
    addOption(options, seen, value);
    directory.forEach((item) => addOption(options, seen, item.name, item.email));
    return options;
  }, [includeUnassigned, user?.name, user?.email, value, directory]);

  return (
    <Select
      label={label}
      placeholder={loading ? 'Loading users…' : placeholder}
      data={data}
      value={value || (includeUnassigned ? 'Unassigned' : null)}
      onChange={(next) => onChange(next || (includeUnassigned ? 'Unassigned' : ''))}
      searchable
      allowDeselect={false}
      nothingFoundMessage="No users found"
      rightSection={<ChevronDown size={16} />}
      rightSectionPointerEvents="none"
      comboboxProps={{ withinPortal: true, zIndex: 500 }}
    />
  );
}
