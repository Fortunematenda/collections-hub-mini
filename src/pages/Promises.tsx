import { useState } from 'react';
import { Badge, Button, Card, Divider, Group, SimpleGrid, Text } from '@mantine/core';
import { Building2, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal, RowActionsMenu } from '../components/CustomerTable';
import { CustomerIdentity, EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { PromiseToPayModal } from '../modals/CoreModals';
import { money, safeDate } from '../utils';
import type { PaymentPromise, PromiseStatus } from '../types';

const promiseColor: Record<PromiseStatus, string> = {
  Pending: 'blue',
  Kept: 'green',
  Broken: 'red',
  Cancelled: 'gray',
};

export default function Promises() {
  const navigate = useNavigate();
  const { company, companyPromises, getCustomer, updatePromiseStatus, deletePromise } = useApp();
  const promises = companyPromises();
  const [editPromise, setEditPromise] = useState<PaymentPromise | null>(null);
  const [deleteItem, setDeleteItem] = useState<PaymentPromise | null>(null);
  const editCustomer = editPromise ? getCustomer(editPromise.customerId) || null : null;

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Promises to pay"
        description="Track commitments and identify promises that need another follow-up."
      />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
        {promises.map((p) => {
          const customer = getCustomer(p.customerId);
          return (
            <Card className="card" radius="lg" p="lg" key={p.id}>
              <Group justify="space-between" align="flex-start">
                <CustomerIdentity
                  name={customer?.name || 'Unknown customer'}
                  accountNo={customer?.accountNo}
                />
                <Group gap={6} wrap="nowrap">
                  <Badge variant="light" color={promiseColor[p.status]}>
                    {p.status}
                  </Badge>
                  <RowActionsMenu
                    onEdit={() => setEditPromise(p)}
                    onDelete={() => setDeleteItem(p)}
                  />
                </Group>
              </Group>
              <Divider my="md" />
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">
                    Amount
                  </Text>
                  <Text fw={750} mt={2}>
                    {money(p.amount)}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="xs" c="dimmed">
                    Promise date
                  </Text>
                  <Text size="sm" fw={650} mt={2}>
                    {safeDate(p.promiseDate)}
                  </Text>
                </div>
              </Group>
              {p.customerComment && (
                <Text size="xs" c="dimmed" mt="md">
                  “{p.customerComment}”
                </Text>
              )}
              {p.status === 'Pending' && (
                <Group mt="md" grow>
                  <Button size="xs" color="teal" variant="light" onClick={() => updatePromiseStatus(p.id, 'Kept', 'Marked kept')}>
                    Kept
                  </Button>
                  <Button size="xs" color="red" variant="light" onClick={() => updatePromiseStatus(p.id, 'Broken', 'Marked broken')}>
                    Broken
                  </Button>
                  <Button size="xs" color="gray" variant="light" onClick={() => updatePromiseStatus(p.id, 'Cancelled', 'Cancelled')}>
                    Cancel
                  </Button>
                </Group>
              )}
              {p.outcome && (
                <Text size="xs" c="dimmed" mt="sm">
                  Outcome: {p.outcome}
                </Text>
              )}
              <Button
                fullWidth
                mt="lg"
                variant="light"
                onClick={() => navigate('/customers/' + p.customerId)}
              >
                Open customer
              </Button>
            </Card>
          );
        })}
      </SimpleGrid>

      {promises.length === 0 && (
        <Card className="card" radius="lg" p="lg" mt="md">
          <EmptyState
            icon={CalendarClock}
            title="No payment promises yet"
            description="Promises recorded from accounts or follow-ups will appear here."
          />
        </Card>
      )}

      <PromiseToPayModal
        opened={!!editPromise}
        onClose={() => setEditPromise(null)}
        customer={editCustomer}
        existing={editPromise}
      />
      <ConfirmModal
        opened={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete promise"
        message={
          deleteItem
            ? `Remove the promise of ${money(deleteItem.amount)} due ${safeDate(deleteItem.promiseDate)}?`
            : ''
        }
        confirmLabel="Delete promise"
        onConfirm={() => {
          if (deleteItem) deletePromise(deleteItem.id);
          setDeleteItem(null);
        }}
      />
    </>
  );
}
