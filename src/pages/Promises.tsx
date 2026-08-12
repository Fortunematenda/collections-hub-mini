import { Badge, Button, Card, Divider, Group, SimpleGrid, Text } from '@mantine/core';
import { Building2, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomerIdentity, EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { money, safeDate } from '../utils';
import type { PromiseStatus } from '../types';

const promiseColor: Record<PromiseStatus, string> = {
  Pending: 'blue',
  Kept: 'green',
  Broken: 'red',
  Cancelled: 'gray',
};

export default function Promises() {
  const navigate = useNavigate();
  const { company, companyPromises, getCustomer } = useApp();
  const promises = companyPromises();

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
                <Badge variant="light" color={promiseColor[p.status]}>
                  {p.status}
                </Badge>
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
    </>
  );
}
