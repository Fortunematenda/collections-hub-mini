import { useEffect, useState } from 'react';
import { Badge, Button, Card, Group, TextInput, Select } from '@mantine/core';
import {
  Building2,
  CalendarClock,
  Check,
  Filter,
  Import,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ConfirmModal, CustomerTable, MoreActionsMenu } from '../components/CustomerTable';
import { TablePager } from '../components/TablePager';
import { PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTablePaging } from '../hooks/useTablePaging';
import { BulkEmailModal, CustomerFormModal, MarkPaidModal, PromiseToPayModal, SendMessageModal } from '../modals/CoreModals';
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
    deleteCustomers,
  } = useApp();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [addOpen, setAddOpen] = useState(false);
  const [promiseCustomer, setPromiseCustomer] = useState<Customer | null>(null);
  const [paidCustomer, setPaidCustomer] = useState<Customer | null>(null);
  const [emailCustomer, setEmailCustomer] = useState<Customer | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const paging = useTablePaging(filteredCustomers, `${companyId}:${search}:${statusFilter}`);

  useEffect(() => {
    setSelectedIds([]);
  }, [companyId]);

  function toggleAccount(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    const visible = paging.paged.map((c) => c.id);
    const allSelected = visible.length > 0 && visible.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !visible.includes(id)) : [...new Set([...selectedIds, ...visible])]);
  }

  const actions = (c: Customer) => (
    <MoreActionsMenu
      items={[
        {
          label: 'Email customer',
          icon: <Mail size={14} />,
          onClick: () => setEmailCustomer(c),
        },
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
        ...(isAdmin
          ? [
              {
                label: 'Delete account',
                icon: <Trash2 size={14} />,
                color: 'red',
                onClick: () => {
                  setSelectedIds([c.id]);
                  setConfirmBulkDelete(true);
                },
              },
            ]
          : []),
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
        description="Email is the day-to-day collections channel until WhatsApp is upgraded. Select accounts to send a reminder in bulk."
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
          <Group gap="sm">
            {selectedIds.length > 0 && (
              <Button
                color="blue"
                variant="light"
                leftSection={<Mail size={14} />}
                onClick={() => setBulkEmailOpen(true)}
              >
                Email {selectedIds.length} selected
              </Button>
            )}
            {isAdmin && selectedIds.length > 0 && (
              <Button
                color="red"
                variant="light"
                leftSection={<Trash2 size={14} />}
                onClick={() => setConfirmBulkDelete(true)}
              >
                Delete {selectedIds.length} selected
              </Button>
            )}
            <Badge variant="light" color="gray" size="lg">
              {filteredCustomers.length} accounts
            </Badge>
          </Group>
        </div>
        <CustomerTable
          customers={paging.paged}
          onOpen={(c) => navigate('/customers/' + c.id)}
          actions={actions}
          selectable
          selectedIds={selectedIds}
          onToggle={toggleAccount}
          onToggleAll={toggleAllVisible}
        />
        <TablePager
          total={paging.total}
          from={paging.from}
          to={paging.to}
          page={paging.page}
          pageCount={paging.pageCount}
          pageSize={paging.pageSize}
          onPageChange={paging.setPage}
          onPageSizeChange={paging.changePageSize}
        />
      </Card>

      <CustomerFormModal opened={addOpen} onClose={() => setAddOpen(false)} companyId={companyId} />
      <SendMessageModal
        opened={!!emailCustomer}
        onClose={() => setEmailCustomer(null)}
        customer={emailCustomer}
        defaultChannel="Email"
      />
      <BulkEmailModal
        opened={bulkEmailOpen}
        onClose={() => setBulkEmailOpen(false)}
        customers={filteredCustomers.filter((c) => selectedIds.includes(c.id))}
      />
      <PromiseToPayModal
        opened={!!promiseCustomer}
        onClose={() => setPromiseCustomer(null)}
        customer={promiseCustomer}
      />
      <MarkPaidModal opened={!!paidCustomer} onClose={() => setPaidCustomer(null)} customer={paidCustomer} />
      <ConfirmModal
        opened={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={selectedIds.length === 1 ? 'Delete account' : 'Delete selected accounts'}
        message={
          selectedIds.length === 1
            ? 'This permanently removes the account and its related collections records. This cannot be undone.'
            : `This permanently removes ${selectedIds.length} accounts and their related collections records. This cannot be undone.`
        }
        confirmLabel={selectedIds.length === 1 ? 'Delete account' : `Delete ${selectedIds.length} accounts`}
        onConfirm={() => {
          deleteCustomers(selectedIds);
          setSelectedIds([]);
          setConfirmBulkDelete(false);
        }}
      />
    </>
  );
}
