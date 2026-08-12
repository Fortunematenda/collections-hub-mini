import { ActionIcon, Badge, Button, Group, Menu, Modal, Stack, Text } from '@mantine/core';
import { MoreHorizontal } from 'lucide-react';
import type { Customer } from '../types';
import { money, safeDate, statusColor } from '../utils';
import { CustomerIdentity, EmptyState } from './ui';
import { Table } from '@mantine/core';

export function CustomerTable({
  customers,
  onOpen,
  actions,
  emptyTitle = 'No accounts match your filters.',
  emptyDescription,
}: {
  customers: Customer[];
  onOpen: (c: Customer) => void;
  actions?: (c: Customer) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <>
      <div className="desktop-table table-wrap">
        <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Outstanding</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Due</Table.Th>
              <Table.Th>Last contact</Table.Th>
              <Table.Th>Next follow-up</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {customers.map((c) => (
              <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c)}>
                <Table.Td>
                  <CustomerIdentity name={c.name} accountNo={c.accountNo} />
                </Table.Td>
                <Table.Td>
                  <span className="amount">{money(c.outstanding)}</span>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={statusColor[c.status]} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {safeDate(c.dueDate)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {c.lastContact}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {c.nextFollowUp ? safeDate(c.nextFollowUp) : '—'}
                  </Text>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  {actions ? (
                    actions(c)
                  ) : (
                    <ActionIcon variant="subtle" color="gray" onClick={() => onOpen(c)}>
                      <MoreHorizontal size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      <div className="mobile-account-list">
        {customers.map((c) => (
          <div className="mobile-account-card" key={c.id} onClick={() => onOpen(c)}>
            <div className="mobile-account-top">
              <CustomerIdentity name={c.name} accountNo={c.accountNo} />
              <span className="amount">{money(c.outstanding)}</span>
            </div>
            <div className="mobile-account-meta">
              <Badge variant="light" color={statusColor[c.status]} size="sm">
                {c.status}
              </Badge>
              <span>Due {safeDate(c.dueDate)}</span>
            </div>
            <div className="mobile-account-meta" style={{ borderTop: 0, paddingTop: 0, marginTop: 6 }}>
              <span>Next: {c.nextFollowUp ? safeDate(c.nextFollowUp) : '—'}</span>
              <span>{c.lastContact}</span>
            </div>
            {actions && (
              <div className="mobile-actions" onClick={(e) => e.stopPropagation()}>
                {actions(c)}
              </div>
            )}
          </div>
        ))}
      </div>
      {customers.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
    </>
  );
}

export function ConfirmModal({
  opened,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'red',
  onConfirm,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered radius="lg" className="app-modal">
      <Stack>
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color={confirmColor} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function MoreActionsMenu({ items }: { items: { label: string; onClick: () => void; color?: string; icon?: React.ReactNode }[] }) {
  return (
    <Menu shadow="md" width={220}>
      <Menu.Target>
        <ActionIcon variant="default" size="lg" radius="md" aria-label="More actions">
          <MoreHorizontal size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item key={item.label} color={item.color} leftSection={item.icon} onClick={item.onClick}>
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
