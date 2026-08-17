import { useState } from 'react';
import { ActionIcon, Badge, Card, Group, Tooltip } from '@mantine/core';
import { Building2, CalendarClock, Check, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomerTable } from '../components/CustomerTable';
import { TablePager } from '../components/TablePager';
import { PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useTablePaging } from '../hooks/useTablePaging';
import { MarkPaidModal, PromiseToPayModal, SendMessageModal } from '../modals/CoreModals';
import type { Customer } from '../types';
import { hasOutstandingBalance } from '../utils';

export default function Followups() {
  const navigate = useNavigate();
  const { company, companyCustomers } = useApp();
  const [messageCustomer, setMessageCustomer] = useState<Customer | null>(null);
  const [promiseCustomer, setPromiseCustomer] = useState<Customer | null>(null);
  const [paidCustomer, setPaidCustomer] = useState<Customer | null>(null);

  const list = companyCustomers.filter(
    (c) => ['Payment Due', 'Follow-up', 'Unresponsive'].includes(c.status) && hasOutstandingBalance(c.outstanding),
  );
  const paging = useTablePaging(list, company.id || 'followups');

  const actions = (c: Customer) => (
    <Group gap={5} wrap="nowrap">
      <Tooltip label="Prepare WhatsApp">
        <ActionIcon variant="light" color="green" onClick={() => setMessageCustomer(c)}>
          <MessageCircle size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Promise to pay">
        <ActionIcon variant="light" color="blue" onClick={() => setPromiseCustomer(c)}>
          <CalendarClock size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Mark paid">
        <ActionIcon variant="light" color="teal" onClick={() => setPaidCustomer(c)}>
          <Check size={15} />
        </ActionIcon>
      </Tooltip>
    </Group>
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
        title="Follow-up queue"
        description="Work through customers who need payment communication."
        actions={
          <Badge size="lg" variant="light" color="indigo">
            {list.length} waiting
          </Badge>
        }
      />

      <Card className="card" radius="lg" p="lg">
        <CustomerTable
          customers={paging.paged}
          onOpen={(c) => navigate('/customers/' + c.id)}
          actions={actions}
          emptyTitle="No follow-ups waiting"
          emptyDescription="Accounts in Payment Due, Follow-up or Unresponsive with an outstanding balance will appear here."
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

      <SendMessageModal
        opened={!!messageCustomer}
        onClose={() => setMessageCustomer(null)}
        customer={messageCustomer}
      />
      <PromiseToPayModal
        opened={!!promiseCustomer}
        onClose={() => setPromiseCustomer(null)}
        customer={promiseCustomer}
      />
      <MarkPaidModal opened={!!paidCustomer} onClose={() => setPaidCustomer(null)} customer={paidCustomer} />
    </>
  );
}
