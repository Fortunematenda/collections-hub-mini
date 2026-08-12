import { useState } from 'react';
import { Badge, Button, Card, Group, TextInput, Select } from '@mantine/core';
import {
  Building2,
  CalendarClock,
  Check,
  Filter,
  Import,
  MessageCircle,
  Plus,
  Search,
  Truck,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomerTable, MoreActionsMenu } from '../components/CustomerTable';
import { PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CustomerFormModal, MarkPaidModal, PromiseToPayModal } from '../modals/CoreModals';
import type { Customer } from '../types';

export default function Accounts() {
  const navigate = useNavigate();
  const {
    company,
    companyId,
    filteredCustomers,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    updateStatus,
  } = useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [promiseCustomer, setPromiseCustomer] = useState<Customer | null>(null);
  const [paidCustomer, setPaidCustomer] = useState<Customer | null>(null);

  const actions = (c: Customer) => (
    <MoreActionsMenu
      items={[
        {
          label: 'Open account',
          icon: <UserRound size={14} />,
          onClick: () => navigate('/customers/' + c.id),
        },
        {
          label: 'Move to follow-up',
          icon: <MessageCircle size={14} />,
          onClick: () => updateStatus(c, 'Follow-up'),
        },
        {
          label: 'Promise to pay',
          icon: <CalendarClock size={14} />,
          onClick: () => setPromiseCustomer(c),
        },
        {
          label: 'Mark paid',
          icon: <Check size={14} />,
          color: 'green',
          onClick: () => setPaidCustomer(c),
        },
        {
          label: 'Recovery required',
          icon: <Truck size={14} />,
          color: 'orange',
          onClick: () => updateStatus(c, 'Recovery Required'),
        },
      ]}
    />
  );

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Outstanding accounts"
        description="All imported clients and current collection statuses for this company."
        actions={
          <Group gap="sm">
            <Button variant="default" leftSection={<Import size={15} />} onClick={() => navigate('/imports')}>
              Import
            </Button>
            <Button leftSection={<Plus size={15} />} onClick={() => setAddOpen(true)}>
              Add customer
            </Button>
          </Group>
        }
      />

      <Card className="card" radius="lg" p="lg">
        <div className="toolbar">
          <div className="toolbar-left">
            <TextInput
              className="search-wrap"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search name, account, phone..."
              leftSection={<Search size={14} />}
            />
            <Select
              className="status-filter"
              value={statusFilter}
              onChange={setStatusFilter}
              data={[
                'All statuses',
                'Payment Due',
                'Follow-up',
                'Promise to Pay',
                'Paid',
                'Unresponsive',
                'Cancelled',
                'Recovery Required',
              ]}
              leftSection={<Filter size={13} />}
            />
          </div>
          <Badge variant="light" color="gray" size="lg">
            {filteredCustomers.length} accounts
          </Badge>
        </div>
        <CustomerTable
          customers={filteredCustomers}
          onOpen={(c) => navigate('/customers/' + c.id)}
          actions={actions}
        />
      </Card>

      <CustomerFormModal opened={addOpen} onClose={() => setAddOpen(false)} companyId={companyId} />
      <PromiseToPayModal
        opened={!!promiseCustomer}
        onClose={() => setPromiseCustomer(null)}
        customer={promiseCustomer}
      />
      <MarkPaidModal opened={!!paidCustomer} onClose={() => setPaidCustomer(null)} customer={paidCustomer} />
    </>
  );
}
