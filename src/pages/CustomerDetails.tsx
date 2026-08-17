import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  Archive,
  Banknote,
  CalendarClock,
  Edit,
  ExternalLink,
  Inbox,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  Phone,
  Plus,
  Reply,
  Truck,
  Wrench,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConfirmModal, MoreActionsMenu, RowActionsMenu } from '../components/CustomerTable';
import { EmptyState, Info, EmailThreadPreview } from '../components/ui';
import { useApp } from '../context/AppContext';
import {
  AddNoteModal,
  CancelServiceModal,
  CompleteRecoveryModal,
  CreateRecoveryJobModal,
  EquipmentFormModal,
  LogCallModal,
  ScheduleFollowUpModal,
} from '../modals/ActionModals';
import { CustomerFormModal, MarkPaidModal, PromiseToPayModal, SendMessageModal } from '../modals/CoreModals';
import type { Communication, Equipment, FollowUp, Note, NoteType, Payment, PaymentPromise, RecoveryJob } from '../types';
import {
  actorName,
  amountClass,
  hasCreditBalance,
  hasOutstandingBalance,
  daysOverdue,
  fullAddress,
  initials,
  money,
  normalizeTab,
  recoveryColor,
  safeDate,
  safeDateTime,
  statusColor,
  isUnreadCommunication,
  communicationCardClass,
} from '../utils';

type ModalKey =
  | 'edit'
  | 'message'
  | 'call'
  | 'promise'
  | 'payment'
  | 'note'
  | 'followup'
  | 'cancel'
  | 'equipment'
  | 'recovery'
  | 'completeRecovery'
  | 'archive'
  | null;

type PendingDelete = {
  title: string;
  message: string;
  confirmLabel: string;
  run: () => void;
};

const CUSTOMER_TABS = [
  'overview',
  'communications',
  'collections',
  'promises',
  'payments',
  'equipment',
  'recovery',
  'notes',
  'activity',
] as const;

export default function CustomerDetails() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    getCustomer,
    getCompany,
    companyEquipment,
    companyPromises,
    companyPayments,
    companyCommunications,
    companyNotes,
    companyFollowUps,
    companyActivities,
    companyRecoveries,
    archiveCustomer,
    updateEquipment,
    updateRecovery,
    deleteFollowUp,
    deletePromise,
    deletePayment,
    deleteNote,
    deleteEquipment,
    deleteRecovery,
    switchCompany,
    companyId,
    customers,
    loading,
    syncInbox,
    markCommunicationRead,
  } = useApp();

  const customer = customers.find((item) => item.id === customerId) || getCustomer(customerId || '');
  const company = customer ? getCompany(customer.companyId) : undefined;

  useEffect(() => {
    if (customer && customer.companyId !== companyId) switchCompany(customer.companyId);
  }, [customer?.companyId, companyId]);
  const [modal, setModal] = useState<ModalKey>(null);
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null);
  const [editFollowUp, setEditFollowUp] = useState<FollowUp | null>(null);
  const [editPromise, setEditPromise] = useState<PaymentPromise | null>(null);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [editRecovery, setEditRecovery] = useState<RecoveryJob | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [completeJobId, setCompleteJobId] = useState<string | null>(null);
  const [noteFilter, setNoteFilter] = useState<string | null>('All');
  const [expandedComm, setExpandedComm] = useState<string | null>(null);
  const [checkingInbox, setCheckingInbox] = useState(false);
  const [replyComm, setReplyComm] = useState<Communication | null>(null);
  const tab = normalizeTab(searchParams.get('tab'), CUSTOMER_TABS, 'overview');

  function setTab(value: string | null) {
    const next = normalizeTab(value, CUSTOMER_TABS, 'overview');
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  function openMessage(reply?: Communication | null) {
    setReplyComm(reply || null);
    setModal('message');
  }

  function openCreate(key: ModalKey) {
    setEditEquipment(null);
    setEditFollowUp(null);
    setEditPromise(null);
    setEditPayment(null);
    setEditNote(null);
    setEditRecovery(null);
    setModal(key);
  }

  function closeModals() {
    setModal(null);
    setEditEquipment(null);
    setEditFollowUp(null);
    setEditPromise(null);
    setEditPayment(null);
    setEditNote(null);
    setEditRecovery(null);
    setCompleteJobId(null);
    setReplyComm(null);
  }

  function askDelete(item: PendingDelete) {
    setPendingDelete(item);
  }

  const equipment = companyEquipment(customer?.id);
  const promises = companyPromises(customer?.id);
  const payments = companyPayments(customer?.id);
  const communications = companyCommunications(customer?.id);
  const notes = companyNotes(customer?.id);
  const followUps = companyFollowUps(customer?.id);
  const activities = companyActivities(customer?.id);
  const recoveries = companyRecoveries.filter((r) => r.customerId === customer?.id);
  const unreadCount = communications.filter(isUnreadCommunication).length;

  const filteredNotes = useMemo(() => {
    const list = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    if (!noteFilter || noteFilter === 'All') return list;
    return list.filter((n) => n.type === (noteFilter as NoteType));
  }, [notes, noteFilter]);

  const paymentBalances = useMemo(() => {
    const chronological = [...payments].sort((a, b) =>
      String(a.createdAt || a.paymentDate).localeCompare(String(b.createdAt || b.paymentDate)),
    );
    const totalPaid = chronological.reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0);
    let running = Number(customer?.outstanding || 0) - totalPaid;
    const map = new Map<string, number>();
    for (const item of chronological) {
      running += Math.abs(Number(item.amount) || 0);
      map.set(item.id, item.balanceAfter ?? running);
    }
    return map;
  }, [payments, customer?.outstanding]);

  const overdue = customer ? daysOverdue(customer.dueDate) : 0;
  const lastPayment = useMemo(() => {
    return [...payments].sort((a, b) =>
      String(b.createdAt || b.paymentDate).localeCompare(String(a.createdAt || a.paymentDate)),
    )[0];
  }, [payments]);

  if (loading && !customer) {
    return (
      <Stack>
        <Skeleton height={90} radius="lg" />
        <Skeleton height={240} radius="lg" />
      </Stack>
    );
  }

  if (!customer) {
    return (
      <Card className="card" radius="lg" p="lg">
        <EmptyState title="Customer not found" description="This customer may have been archived or does not exist." />
      </Card>
    );
  }

  return (
    <>
      <div className="detail-header customer-detail-header">
        <div className="customer-detail-top">
          <div className="customer-detail-identity">
            <div className="mini-avatar customer-detail-avatar">{initials(customer.name)}</div>
            <div className="customer-detail-copy">
              <div className="customer-detail-title-row">
                <h2 className="customer-detail-name">{customer.name}</h2>
                <Badge variant="light" color={statusColor[customer.status]}>
                  {customer.status}
                </Badge>
              </div>
              <div className="customer-detail-sub">
                {customer.accountNo} · {company?.name || 'Company'}
              </div>
              <div className="customer-detail-meta">
                <span className={`customer-detail-balance ${amountClass(customer.outstanding)}`}>{money(customer.outstanding)}</span>
                {hasOutstandingBalance(customer.outstanding) ? (
                  <Badge size="sm" variant="light" color="red">
                    Outstanding
                  </Badge>
                ) : hasCreditBalance(customer.outstanding) ? (
                  <Badge size="sm" variant="light" color="teal">
                    Credit
                  </Badge>
                ) : null}
                <span className={overdue > 0 ? 'customer-detail-overdue' : 'customer-detail-muted'}>
                  {overdue} days overdue
                </span>
                {customer.nextFollowUp && (
                  <span className="customer-detail-muted">Next follow-up {safeDate(customer.nextFollowUp)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="customer-detail-actions-desktop">
            <Button size="compact-sm" variant="light" color="blue" leftSection={<Mail size={14} />} onClick={() => openMessage()}>
              Email
            </Button>
            <Button size="compact-sm" variant="light" leftSection={<Phone size={14} />} onClick={() => setModal('call')}>
              Call
            </Button>
            <Button size="compact-sm" variant="light" color="teal" leftSection={<Banknote size={14} />} onClick={() => openCreate('payment')}>
              Payment
            </Button>
            <Button size="compact-sm" variant="default" leftSection={<Edit size={14} />} onClick={() => setModal('edit')}>
              Edit
            </Button>
            <MoreActionsMenu
              items={[
                { label: 'Promise to Pay', onClick: () => openCreate('promise'), icon: <CalendarClock size={14} /> },
                { label: 'Add Note', onClick: () => openCreate('note'), icon: <NotebookPen size={14} /> },
                { label: 'Schedule Follow-up', onClick: () => openCreate('followup'), icon: <CalendarClock size={14} /> },
                { label: 'Create Recovery Job', onClick: () => openCreate('recovery'), icon: <Truck size={14} /> },
                { label: 'Cancel Service', onClick: () => setModal('cancel'), icon: <Archive size={14} />, color: 'orange' },
                { label: 'Archive Customer', onClick: () => setModal('archive'), icon: <Archive size={14} />, color: 'red' },
              ]}
            />
          </div>
        </div>

        <div className="customer-detail-actions-bar">
          <Button size="compact-sm" variant="light" color="blue" leftSection={<Mail size={14} />} onClick={() => openMessage()}>
            Send Email
          </Button>
          <Button size="compact-sm" variant="light" leftSection={<Phone size={14} />} onClick={() => setModal('call')}>
            Log Call
          </Button>
          <Button size="compact-sm" variant="light" color="blue" leftSection={<CalendarClock size={14} />} onClick={() => openCreate('promise')}>
            Promise to Pay
          </Button>
          <Button size="compact-sm" variant="light" color="teal" leftSection={<Banknote size={14} />} onClick={() => openCreate('payment')}>
            Record Payment
          </Button>
          <Button size="compact-sm" variant="light" leftSection={<NotebookPen size={14} />} onClick={() => openCreate('note')}>
            Add Note
          </Button>
          <Button size="compact-sm" variant="light" leftSection={<CalendarClock size={14} />} onClick={() => openCreate('followup')}>
            Schedule Follow-up
          </Button>
          <Button size="compact-sm" variant="default" leftSection={<Edit size={14} />} onClick={() => setModal('edit')}>
            Edit Customer
          </Button>
          <MoreActionsMenu
            items={[
              { label: 'Create Recovery Job', onClick: () => openCreate('recovery'), icon: <Truck size={14} /> },
              { label: 'Cancel Service', onClick: () => setModal('cancel'), icon: <Archive size={14} />, color: 'orange' },
              { label: 'Archive Customer', onClick: () => setModal('archive'), icon: <Archive size={14} />, color: 'red' },
            ]}
          />
        </div>

        <div className="mobile-only-actions">
          <Menu shadow="md" width={240}>
            <Menu.Target>
              <Button size="sm" fullWidth leftSection={<MoreHorizontal size={14} />}>
                Actions
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Mail size={14} />} onClick={() => openMessage()}>
                Send Email
              </Menu.Item>
              <Menu.Item leftSection={<Phone size={14} />} onClick={() => setModal('call')}>
                Log Call
              </Menu.Item>
              <Menu.Item leftSection={<CalendarClock size={14} />} onClick={() => openCreate('promise')}>
                Promise to Pay
              </Menu.Item>
              <Menu.Item leftSection={<Banknote size={14} />} onClick={() => openCreate('payment')}>
                Record Payment
              </Menu.Item>
              <Menu.Item leftSection={<NotebookPen size={14} />} onClick={() => openCreate('note')}>
                Add Note
              </Menu.Item>
              <Menu.Item leftSection={<CalendarClock size={14} />} onClick={() => openCreate('followup')}>
                Schedule Follow-up
              </Menu.Item>
              <Menu.Item leftSection={<Edit size={14} />} onClick={() => setModal('edit')}>
                Edit Customer
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<Truck size={14} />} onClick={() => openCreate('recovery')}>
                Create Recovery Job
              </Menu.Item>
              <Menu.Item color="orange" leftSection={<Archive size={14} />} onClick={() => setModal('cancel')}>
                Cancel Service
              </Menu.Item>
              <Menu.Item color="red" leftSection={<Archive size={14} />} onClick={() => setModal('archive')}>
                Archive Customer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} className="detail-tabs">
        <Tabs.List className="tabs-scroll">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab
            value="communications"
            rightSection={
              unreadCount > 0 ? (
                <Badge size="xs" color="orange" variant="filled" circle>
                  {unreadCount}
                </Badge>
              ) : undefined
            }
          >
            Communications
          </Tabs.Tab>
          <Tabs.Tab value="collections">Collections</Tabs.Tab>
          <Tabs.Tab value="promises">Promises</Tabs.Tab>
          <Tabs.Tab value="payments">Payments</Tabs.Tab>
          <Tabs.Tab value="equipment">Equipment</Tabs.Tab>
          <Tabs.Tab value="recovery">Recovery</Tabs.Tab>
          <Tabs.Tab value="notes">Notes</Tabs.Tab>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Account Summary</div>
              <SimpleGrid cols={2} mt="md">
                <Info label="Account number" value={customer.accountNo} />
                <Info label="Customer reference" value={customer.customerReference || '—'} />
                <Info label="Service / package" value={customer.servicePackage || '—'} />
                <Info label="Monthly subscription" value={customer.monthlySubscription == null ? '—' : money(customer.monthlySubscription)} />
                <Info label="Original balance" value={money(customer.originalOutstanding ?? customer.outstanding)} />
                <Info label="Current balance" value={money(customer.outstanding)} />
                <Info label="Due date" value={safeDate(customer.dueDate)} />
                <Info label="Days overdue" value={String(overdue)} />
                <Info label="Collection status" value={customer.collectionStage || customer.status} />
                <Info
                  label="Last payment"
                  value={
                    lastPayment
                      ? `${money(lastPayment.amount)} · ${safeDate(lastPayment.paymentDate)}`
                      : '—'
                  }
                />
              </SimpleGrid>
            </Card>

            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Contact Information</div>
              <Stack gap="sm" mt="md">
                <Group justify="space-between">
                  <Info label="Phone" value={customer.phone || '—'} icon={Phone} />
                  {customer.phone && (
                    <ActionIcon component="a" href={`tel:${customer.phone.replace(/\s/g, '')}`} variant="light" aria-label="Call customer">
                      <Phone size={14} />
                    </ActionIcon>
                  )}
                </Group>
                <Group justify="space-between">
                  <Info label="WhatsApp" value={customer.whatsapp || customer.phone || '—'} icon={MessageCircle} />
                  <ActionIcon variant="light" color="blue" onClick={() => openMessage()} aria-label="Send Email">
                    <MessageCircle size={14} />
                  </ActionIcon>
                </Group>
                <Info label="Email" value={customer.email || '—'} icon={Mail} />
                <Info label="Preferred contact" value={customer.preferredContact || '—'} />
                <Info label="Language" value={customer.language || '—'} />
              </Stack>
            </Card>

            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Installation Address</div>
              <Group mt="md" align="flex-start" justify="space-between">
                <Text size="sm">{fullAddress(customer)}</Text>
                {(customer.latitude != null && customer.longitude != null) && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<MapPin size={12} />}
                    component="a"
                    href={`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open map
                  </Button>
                )}
              </Group>
              {customer.latitude == null && (
                <Button size="xs" variant="subtle" mt="sm" leftSection={<ExternalLink size={12} />} component="a" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(customer))}`} target="_blank" rel="noreferrer">
                  Search address on map
                </Button>
              )}
            </Card>

            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Next Action</div>
              <SimpleGrid cols={1} mt="md">
                <Info label="Next follow-up" value={customer.nextFollowUp ? safeDate(customer.nextFollowUp) : 'Not scheduled'} />
                <Info label="Assigned collector" value={customer.assignedCollector || '—'} />
                <Info
                  label="Recommended action"
                  value={
                    customer.status === 'Promise to Pay'
                      ? 'Confirm promise on due date'
                      : customer.status === 'Recovery Required'
                        ? 'Schedule equipment recovery'
                        : customer.status === 'Paid'
                          ? 'No action required'
                          : 'Contact customer regarding outstanding balance'
                  }
                />
                {customer.promisedDate && (
                  <Info label="Active promise" value={`${money(customer.promisedAmount || customer.outstanding)} by ${safeDate(customer.promisedDate)}`} />
                )}
              </SimpleGrid>
            </Card>

            <Card className="card" radius="lg" p="lg" style={{ gridColumn: '1 / -1' }}>
              <Group justify="space-between">
                <div className="card-title">Equipment Summary</div>
                <Button size="xs" variant="light" leftSection={<Plus size={12} />} onClick={() => openCreate('equipment')}>
                  Add Equipment
                </Button>
              </Group>
              {equipment.length === 0 ? (
                <EmptyState title="No equipment linked" description="Add installed CPE, routers or ONTs for this customer." />
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} mt="md">
                  {equipment.map((e) => (
                    <div key={e.id} className="equipment-chip">
                      <Wrench size={14} />
                      <div>
                        <Text size="xs" fw={650}>
                          {e.type}
                          {e.model ? ` · ${e.model}` : ''}
                        </Text>
                        <Text size="10px" c="dimmed">
                          {e.ownership} · {e.status}
                        </Text>
                      </div>
                    </div>
                  ))}
                </SimpleGrid>
              )}
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="communications" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={700}>
                Timeline
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<Inbox size={14} />}
                loading={checkingInbox}
                onClick={async () => {
                  setCheckingInbox(true);
                  await syncInbox();
                  setCheckingInbox(false);
                }}
              >
                Check inbox
              </Button>
            </Group>
            <Stack gap="sm">
              {communications.map((c) => {
                const unread = isUnreadCommunication(c);
                return (
                <div
                  key={c.id}
                  className={communicationCardClass(c)}
                  onClick={() => {
                    markCommunicationRead(c.id);
                    setExpandedComm(expandedComm === c.id ? null : c.id);
                  }}
                >
                  <Group justify="space-between" wrap="wrap">
                    <Group gap={8}>
                      <ThemeIcon size="sm" variant="light" color={c.direction === 'Incoming' ? (unread ? 'orange' : 'teal') : c.channel === 'WhatsApp' ? 'green' : c.channel === 'Email' ? 'blue' : c.channel === 'Phone' ? 'indigo' : 'gray'}>
                        {c.channel === 'Email' ? <Mail size={12} /> : c.channel === 'Phone' ? <Phone size={12} /> : <MessageCircle size={12} />}
                      </ThemeIcon>
                      <Text size="xs" fw={700}>
                        {c.channel} · {c.direction}
                      </Text>
                      {unread ? (
                        <Badge size="xs" color="orange" variant="filled">
                          New
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="10px" c="dimmed">
                      {safeDateTime(c.createdAt)}
                    </Text>
                  </Group>
                  {c.channel === 'Email' ? (
                    <EmailThreadPreview
                      subject={c.subject}
                      message={c.message}
                      expanded={expandedComm === c.id}
                    />
                  ) : (
                    <Text size="xs" mt={6} lineClamp={expandedComm === c.id ? undefined : 2} style={{ whiteSpace: 'pre-wrap' }}>
                      {c.message}
                    </Text>
                  )}
                  <Group gap="xs" mt={6} justify="space-between" wrap="nowrap">
                    <Group gap="xs">
                      <Badge size="xs" variant="light">
                        {c.status}
                      </Badge>
                      <Text size="10px" c="dimmed">
                        {c.direction === 'Incoming' ? customer.name : c.createdBy}
                        {c.callResult ? ` · ${c.callResult}` : ''}
                      </Text>
                    </Group>
                    {c.channel === 'Email' && (
                      <Button
                        size="compact-xs"
                        variant="light"
                        leftSection={<Reply size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          markCommunicationRead(c.id);
                          openMessage(c);
                        }}
                      >
                        Reply
                      </Button>
                    )}
                  </Group>
                </div>
                );
              })}
              {communications.length === 0 && (
                <EmptyState title="No messages yet" description="Send a WhatsApp/email or log a phone call to start the timeline." action={<Button size="xs" onClick={() => openMessage()}>Send Message</Button>} />
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="collections" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Collection history</div>
              <SimpleGrid cols={2} mt="md">
                <Info label="Became overdue" value={safeDate(customer.dueDate)} />
                <Info label="Current stage" value={customer.collectionStage || customer.status} />
                <Info label="Contact attempts" value={String(communications.filter((c) => c.channel !== 'Internal note').length)} />
                <Info label="Last successful contact" value={customer.lastContact} />
                <Info label="Next action" value={customer.nextFollowUp ? safeDate(customer.nextFollowUp) : '—'} />
                <Info label="Current balance" value={money(customer.outstanding)} />
              </SimpleGrid>
            </Card>
            <Card className="card" radius="lg" p="lg">
              <Group justify="space-between" mb="xs">
                <div className="card-title">Scheduled follow-ups</div>
                <Button size="xs" variant="light" leftSection={<Plus size={12} />} onClick={() => openCreate('followup')}>
                  Schedule
                </Button>
              </Group>
              <Text size="sm" mt="md" fw={650}>
                {customer.collectionStage || customer.status}
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                Stages: New Overdue → Follow-up Due → Contacted → Promise to Pay → Payment Pending → Paid / Escalated / Recovery Required / Closed
              </Text>
              <Stack gap={6} mt="md">
                {followUps.map((f) => (
                  <Group key={f.id} justify="space-between" wrap="nowrap" align="flex-start">
                    <Text size="xs">
                      Follow-up {safeDate(f.followUpDate)} {f.followUpTime || ''} · {f.channel} · {f.assignedUser}
                    </Text>
                    <RowActionsMenu
                      onEdit={() => {
                        setEditFollowUp(f);
                        setModal('followup');
                      }}
                      onDelete={() =>
                        askDelete({
                          title: 'Delete follow-up',
                          message: `Remove the follow-up scheduled for ${safeDate(f.followUpDate)}?`,
                          confirmLabel: 'Delete follow-up',
                          run: () => deleteFollowUp(f.id),
                        })
                      }
                    />
                  </Group>
                ))}
                {followUps.length === 0 && (
                  <Text size="xs" c="dimmed">
                    No follow-ups scheduled.
                  </Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="promises" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div className="card-title">Payment promises</div>
              <Button size="xs" leftSection={<Plus size={12} />} onClick={() => openCreate('promise')}>
                Add promise
              </Button>
            </Group>
            <div className="desktop-table table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Promise date</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th>Outcome</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {promises.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>{safeDate(p.promiseDate)}</Table.Td>
                      <Table.Td>{money(p.amount)}</Table.Td>
                      <Table.Td>{safeDateTime(p.createdAt)}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light">
                          {p.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{p.customerComment || p.internalNote || '—'}</Table.Td>
                      <Table.Td>
                        {p.outcome ||
                          (p.status === 'Pending' ? 'Awaiting payment' : p.status === 'Kept' ? 'Paid' : p.status)}
                      </Table.Td>
                      <Table.Td>
                        <RowActionsMenu
                          onEdit={() => {
                            setEditPromise(p);
                            setModal('promise');
                          }}
                          onDelete={() =>
                            askDelete({
                              title: 'Delete promise',
                              message: `Remove the promise of ${money(p.amount)} due ${safeDate(p.promiseDate)}?`,
                              confirmLabel: 'Delete promise',
                              run: () => deletePromise(p.id),
                            })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            <div className="mobile-account-list">
              {promises.map((p) => (
                <div className="mobile-account-card" key={p.id}>
                  <Group justify="space-between">
                    <Text size="xs" fw={650}>
                      {money(p.amount)}
                    </Text>
                    <Group gap={6}>
                      <Badge size="sm" variant="light">
                        {p.status}
                      </Badge>
                      <RowActionsMenu
                        onEdit={() => {
                          setEditPromise(p);
                          setModal('promise');
                        }}
                        onDelete={() =>
                          askDelete({
                            title: 'Delete promise',
                            message: `Remove the promise of ${money(p.amount)} due ${safeDate(p.promiseDate)}?`,
                            confirmLabel: 'Delete promise',
                            run: () => deletePromise(p.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                  <Text size="xs" c="dimmed" mt={6}>
                    Due {safeDate(p.promiseDate)}
                  </Text>
                </div>
              ))}
            </div>
            {promises.length === 0 && <EmptyState title="No promises recorded" description="Capture a promise to pay when a customer commits to a payment date." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div className="card-title">Payments</div>
              <Button size="xs" leftSection={<Plus size={12} />} onClick={() => openCreate('payment')}>
                Record payment
              </Button>
            </Group>
            <div className="desktop-table table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Payment date</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Balance after</Table.Th>
                    <Table.Th>Recorded by</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Method</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>{safeDate(p.paymentDate)}</Table.Td>
                      <Table.Td>{money(p.amount)}</Table.Td>
                      <Table.Td>
                        <span className={amountClass(paymentBalances.get(p.id) ?? customer.outstanding)}>
                          {money(paymentBalances.get(p.id) ?? customer.outstanding)}
                        </span>
                      </Table.Td>
                      <Table.Td>{p.recordedBy || '—'}</Table.Td>
                      <Table.Td>{p.reference || '—'}</Table.Td>
                      <Table.Td>{p.method || '—'}</Table.Td>
                      <Table.Td>{p.notes || '—'}</Table.Td>
                      <Table.Td>
                        <RowActionsMenu
                          onEdit={() => {
                            setEditPayment(p);
                            setModal('payment');
                          }}
                          onDelete={() =>
                            askDelete({
                              title: 'Delete payment',
                              message: `Remove the payment of ${money(p.amount)} recorded by ${p.recordedBy || 'a user'} on ${safeDate(p.paymentDate)}? The outstanding balance will be restored.`,
                              confirmLabel: 'Delete payment',
                              run: () => deletePayment(p.id),
                            })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            <div className="mobile-account-list">
              {payments.map((p) => (
                <div className="mobile-account-card" key={p.id}>
                  <Group justify="space-between" align="flex-start">
                    <div>
                      <Text size="xs" fw={650}>
                        {money(p.amount)}
                      </Text>
                      <Text size="10px" c="dimmed" mt={4}>
                        {safeDate(p.paymentDate)} · Recorded by {p.recordedBy || '—'}
                      </Text>
                    </div>
                    <Group gap={6} wrap="nowrap">
                      <Text size="xs" className={amountClass(paymentBalances.get(p.id) ?? customer.outstanding)} fw={650}>
                        {money(paymentBalances.get(p.id) ?? customer.outstanding)}
                      </Text>
                      <RowActionsMenu
                        onEdit={() => {
                          setEditPayment(p);
                          setModal('payment');
                        }}
                        onDelete={() =>
                          askDelete({
                            title: 'Delete payment',
                            message: `Remove the payment of ${money(p.amount)} recorded by ${p.recordedBy || 'a user'} on ${safeDate(p.paymentDate)}? The outstanding balance will be restored.`,
                            confirmLabel: 'Delete payment',
                            run: () => deletePayment(p.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                </div>
              ))}
            </div>
            {payments.length === 0 && <EmptyState title="No payments recorded" description="Record a payment when the customer settles part or all of the balance." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="equipment" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div className="card-title">Equipment</div>
              <Button size="xs" leftSection={<Plus size={12} />} onClick={() => openCreate('equipment')}>
                Add Equipment
              </Button>
            </Group>
            <div className="recovery-grid">
              {equipment.map((e) => (
                <div className="recovery-card" key={e.id}>
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {e.type}
                    </Text>
                    <Group gap={6}>
                      <Badge size="sm" variant="light">
                        {e.status}
                      </Badge>
                      <RowActionsMenu
                        onEdit={() => {
                          setEditEquipment(e);
                          setModal('equipment');
                        }}
                        onDelete={() =>
                          askDelete({
                            title: 'Delete equipment',
                            message: `Remove ${e.type}${e.model ? ` (${e.model})` : ''} from this account?`,
                            confirmLabel: 'Delete equipment',
                            run: () => deleteEquipment(e.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                  <div className="recovery-meta">
                    <div>
                      <div className="meta-label">Model</div>
                      <div className="meta-value">{[e.manufacturer, e.model].filter(Boolean).join(' ') || '—'}</div>
                    </div>
                    <div>
                      <div className="meta-label">Serial</div>
                      <div className="meta-value">{e.serialNumber || '—'}</div>
                    </div>
                    <div>
                      <div className="meta-label">Ownership</div>
                      <div className="meta-value">{e.ownership}</div>
                    </div>
                    <div>
                      <div className="meta-label">Installed</div>
                      <div className="meta-value">{safeDate(e.installationDate)}</div>
                    </div>
                  </div>
                  <Group mt="md" gap={6}>
                    <Button size="xs" variant="light" color="teal" onClick={() => updateEquipment({ ...e, status: 'Recovered', recoveryRequired: false })}>
                      Mark recovered
                    </Button>
                    <Button size="xs" variant="light" color="orange" onClick={() => updateEquipment({ ...e, status: 'Damaged', condition: 'Damaged' })}>
                      Mark damaged
                    </Button>
                    {e.ownership === 'Company owned' && (
                      <Button size="xs" variant="light" color="red" onClick={() => openCreate('recovery')}>
                        Recovery job
                      </Button>
                    )}
                  </Group>
                </div>
              ))}
            </div>
            {equipment.length === 0 && <EmptyState title="No equipment" description="Add CPE, routers, ONTs and related assets installed at this premises." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="recovery" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div className="card-title">Recovery cases</div>
              <Button size="xs" leftSection={<Plus size={12} />} onClick={() => openCreate('recovery')}>
                Create recovery job
              </Button>
            </Group>
            <div className="recovery-grid">
              {recoveries.map((r) => (
                <div className="recovery-card" key={r.id}>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={700}>
                        {r.id}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {r.equipment}
                      </Text>
                    </div>
                    <Group gap={6}>
                      <Badge size="sm" variant="light" color={recoveryColor[r.status]}>
                        {r.status}
                      </Badge>
                      <RowActionsMenu
                        onEdit={() => {
                          setEditRecovery(r);
                          setModal('recovery');
                        }}
                        onDelete={() =>
                          askDelete({
                            title: 'Delete recovery job',
                            message: `Remove recovery job ${r.id}? This does not delete the linked equipment.`,
                            confirmLabel: 'Delete job',
                            run: () => deleteRecovery(r.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                  <div className="recovery-meta">
                    <div>
                      <div className="meta-label">Reason</div>
                      <div className="meta-value">{r.reason || '—'}</div>
                    </div>
                    <div>
                      <div className="meta-label">Technician</div>
                      <div className="meta-value">{r.technician}</div>
                    </div>
                    <div>
                      <div className="meta-label">Scheduled</div>
                      <div className="meta-value">{r.scheduledDate ? safeDate(r.scheduledDate) : '—'}</div>
                    </div>
                    <div>
                      <div className="meta-label">Attempts</div>
                      <div className="meta-value">{String(r.attempts || 0)}</div>
                    </div>
                  </div>
                  {!['Recovered', 'Closed', 'Written Off'].includes(r.status) && (
                    <Group mt="md">
                      {r.status === 'Awaiting assignment' && (
                        <Button size="xs" variant="light" onClick={() => updateRecovery({ ...r, status: 'Scheduled', technician: r.technician === 'Unassigned' ? actorName() : r.technician, scheduledDate: r.scheduledDate || new Date().toISOString().slice(0, 10) })}>
                          Assign & schedule
                        </Button>
                      )}
                      <Button
                        size="xs"
                        color="green"
                        variant="light"
                        onClick={() => {
                          setCompleteJobId(r.id);
                          setModal('completeRecovery');
                        }}
                      >
                        Complete / update
                      </Button>
                    </Group>
                  )}
                </div>
              ))}
            </div>
            {recoveries.length === 0 && <EmptyState title="No recovery jobs" description="Create a recovery job when company-owned equipment must be collected." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="notes" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md" wrap="wrap">
              <Select
                data={['All', 'General', 'Collection', 'Billing', 'Technical', 'Recovery', 'Dispute']}
                value={noteFilter}
                onChange={setNoteFilter}
                w={180}
              />
              <Button size="xs" leftSection={<Plus size={12} />} onClick={() => openCreate('note')}>
                Add note
              </Button>
            </Group>
            <Stack gap="sm">
              {filteredNotes.map((n) => (
                <div key={n.id} className="timeline-item">
                  <Group justify="space-between">
                    <Group gap={6}>
                      <Badge size="xs" variant="light">
                        {n.type}
                      </Badge>
                      {n.pinned && (
                        <Badge size="xs" color="yellow" variant="light">
                          Pinned
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6}>
                      <Text size="10px" c="dimmed">
                        {safeDateTime(n.createdAt)}
                      </Text>
                      <RowActionsMenu
                        onEdit={() => {
                          setEditNote(n);
                          setModal('note');
                        }}
                        onDelete={() =>
                          askDelete({
                            title: 'Delete note',
                            message: 'Remove this internal note from the account?',
                            confirmLabel: 'Delete note',
                            run: () => deleteNote(n.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                  <Text size="xs" mt={6}>
                    {n.note}
                  </Text>
                  <Text size="10px" c="dimmed" mt={4}>
                    {n.createdBy}
                  </Text>
                </div>
              ))}
              {filteredNotes.length === 0 && <EmptyState title="No notes" description="Add internal collection, billing or recovery notes for this account." />}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="activity" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Stack gap="sm">
              {activities.map((a) => (
                <div key={a.id} className="activity">
                  <div className="activity-icon">
                    <NotebookPen size={14} />
                  </div>
                  <div>
                    <div className="activity-text">
                      <strong>{a.action}</strong> — {a.description}
                    </div>
                    <div className="activity-time">
                      {a.user} · {safeDateTime(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && <EmptyState title="No activity yet" description="Edits, imports, messages and payments will appear in this audit trail." />}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <CustomerFormModal opened={modal === 'edit'} onClose={closeModals} customer={customer} companyId={customer.companyId} />
      <SendMessageModal
        opened={modal === 'message'}
        onClose={closeModals}
        customer={customer}
        defaultChannel="Email"
        replyTo={replyComm}
      />
      <LogCallModal opened={modal === 'call'} onClose={closeModals} customer={customer} />
      <PromiseToPayModal opened={modal === 'promise'} onClose={closeModals} customer={customer} existing={editPromise} />
      <MarkPaidModal opened={modal === 'payment'} onClose={closeModals} customer={customer} existing={editPayment} />
      <AddNoteModal opened={modal === 'note'} onClose={closeModals} customer={customer} existing={editNote} />
      <ScheduleFollowUpModal opened={modal === 'followup'} onClose={closeModals} customer={customer} existing={editFollowUp} />
      <CancelServiceModal opened={modal === 'cancel'} onClose={closeModals} customer={customer} />
      <EquipmentFormModal
        opened={modal === 'equipment'}
        onClose={closeModals}
        customer={customer}
        equipment={editEquipment}
      />
      <CreateRecoveryJobModal
        opened={modal === 'recovery'}
        onClose={closeModals}
        customer={customer}
        existing={editRecovery}
      />
      <CompleteRecoveryModal
        opened={modal === 'completeRecovery'}
        onClose={closeModals}
        jobId={completeJobId}
      />
      <ConfirmModal
        opened={modal === 'archive'}
        onClose={closeModals}
        title="Archive customer"
        message="Archiving hides this customer from active lists. Communication, payment and recovery history is preserved."
        confirmLabel="Archive customer"
        onConfirm={() => {
          archiveCustomer(customer.id);
          closeModals();
          navigate('/accounts');
        }}
      />
      <ConfirmModal
        opened={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.title || 'Delete'}
        message={pendingDelete?.message || ''}
        confirmLabel={pendingDelete?.confirmLabel || 'Delete'}
        onConfirm={() => {
          pendingDelete?.run();
          setPendingDelete(null);
        }}
      />
    </>
  );
}
