import { useMemo, useState } from 'react';
import { Badge, Card, Table, Text, TextInput, Select } from '@mantine/core';
import { Building2, Filter, MessagesSquare, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { safeDateTime } from '../utils';
import type { CommChannel, CommDirection, CommStatus } from '../types';

const channelColor: Record<CommChannel, string> = {
  WhatsApp: 'green',
  Email: 'blue',
  Phone: 'indigo',
  'Internal note': 'gray',
  SMS: 'teal',
};

export default function Communications() {
  const navigate = useNavigate();
  const { company, companyCommunications, getCustomer } = useApp();
  const all = companyCommunications();

  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<string | null>('All channels');
  const [direction, setDirection] = useState<string | null>('All directions');
  const [status, setStatus] = useState<string | null>('All statuses');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return all.filter((c) => {
      const customer = getCustomer(c.customerId);
      const hay = [c.message, c.subject, c.createdBy, customer?.name, customer?.accountNo]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (channel && channel !== 'All channels' && c.channel !== channel) return false;
      if (direction && direction !== 'All directions' && c.direction !== direction) return false;
      if (status && status !== 'All statuses' && c.status !== status) return false;
      const day = c.createdAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [all, search, channel, direction, status, dateFrom, dateTo, getCustomer]);

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Communication centre"
        description="Review WhatsApp, email, phone and internal notes logged for this company's collection activity."
        actions={
          <Badge size="lg" variant="light" color="indigo">
            {filtered.length} messages
          </Badge>
        }
      />

      <Card className="card" radius="lg" p="lg">
        <div className="toolbar">
          <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 8 }}>
            <TextInput
              className="search-wrap"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search message, customer, subject..."
              leftSection={<Search size={14} />}
            />
            <Select
              className="status-filter"
              value={channel}
              onChange={setChannel}
              data={['All channels', 'WhatsApp', 'Email', 'Phone', 'Internal note', 'SMS']}
              leftSection={<Filter size={13} />}
            />
            <Select
              className="status-filter"
              value={direction}
              onChange={setDirection}
              data={['All directions', 'Incoming', 'Outgoing', 'Internal']}
            />
            <Select
              className="status-filter"
              value={status}
              onChange={setStatus}
              data={['All statuses', 'Queued', 'Sent', 'Delivered', 'Failed', 'Logged']}
            />
            <TextInput
              type="date"
              label=""
              aria-label="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.currentTarget.value)}
              style={{ width: 150 }}
            />
            <TextInput
              type="date"
              aria-label="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.currentTarget.value)}
              style={{ width: 150 }}
            />
          </div>
        </div>

        <div className="desktop-table table-wrap">
          <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Channel</Table.Th>
                <Table.Th>Direction</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Message</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((c) => {
                const customer = getCustomer(c.customerId);
                return (
                  <Table.Tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/customers/' + c.customerId)}
                  >
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {safeDateTime(c.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={650}>
                        {customer?.name || 'Unknown'}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {customer?.accountNo || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={channelColor[c.channel]} size="sm">
                        {c.channel}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{c.direction as CommDirection}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" size="sm" color="gray">
                        {c.status as CommStatus}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" lineClamp={2}>
                        {c.subject ? `${c.subject} — ` : ''}
                        {c.message}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>

        <div className="mobile-account-list">
          {filtered.map((c) => {
            const customer = getCustomer(c.customerId);
            return (
              <div
                className="mobile-account-card"
                key={c.id}
                onClick={() => navigate('/customers/' + c.customerId)}
              >
                <div className="mobile-account-top">
                  <div>
                    <Text size="sm" fw={650}>
                      {customer?.name || 'Unknown'}
                    </Text>
                    <Text size="10px" c="dimmed">
                      {safeDateTime(c.createdAt)}
                    </Text>
                  </div>
                  <Badge variant="light" color={channelColor[c.channel]} size="sm">
                    {c.channel}
                  </Badge>
                </div>
                <div className="mobile-account-meta">
                  <span>{c.direction}</span>
                  <span>{c.status}</span>
                </div>
                <Text size="xs" c="dimmed" mt={8} lineClamp={3}>
                  {c.message}
                </Text>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <EmptyState
            icon={MessagesSquare}
            title="No communications match your filters"
            description="Adjust search, channel, direction, status or date range — or send a message from a customer account."
          />
        )}
      </Card>
    </>
  );
}
