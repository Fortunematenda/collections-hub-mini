import { useMemo, useState } from 'react';
import {
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
  TextInput,
} from '@mantine/core';
import {
  Archive,
  Building2,
  CalendarClock,
  Edit,
  FileSpreadsheet,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Truck,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmModal, CustomerTable } from '../components/CustomerTable';
import { EmptyState, Info, Metric, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CompanyFormModal, CustomerFormModal } from '../modals/CoreModals';
import {
  daysOverdue,
  initials,
  money,
  recoveryColor,
  safeDate,
  safeDateTime,
} from '../utils';

export default function CompanyDetails() {
  const { companyId: routeId } = useParams();
  const navigate = useNavigate();
  const {
    getCompany,
    customers,
    imports,
    promises,
    recoveries,
    communications,
    activities,
    equipment,
    switchCompany,
    companyId,
    archiveCompany,
    loading,
  } = useApp();

  const company = getCompany(routeId || '');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('All statuses');
  const [balanceFilter, setBalanceFilter] = useState<string | null>('All balances');
  const [followFilter, setFollowFilter] = useState<string | null>('All follow-ups');
  const [sortBy, setSortBy] = useState<string | null>('outstanding-desc');
  const [commChannel, setCommChannel] = useState<string | null>('All channels');

  const companyCustomers = useMemo(
    () => customers.filter((c) => c.companyId === company?.id && !c.archived),
    [customers, company?.id],
  );
  const outstanding = companyCustomers.filter((c) => c.outstanding > 0 && c.status !== 'Paid');
  const contacted = companyCustomers.filter((c) => c.lastContact && c.lastContact !== 'Not contacted').length;
  const companyPromises = promises.filter((p) => p.companyId === company?.id);
  const paid = companyCustomers.filter((c) => c.status === 'Paid').length;
  const companyRecoveries = recoveries.filter((r) => r.companyId === company?.id);
  const awaitingEq = equipment.filter(
    (e) => e.companyId === company?.id && (e.recoveryRequired || e.status === 'Awaiting recovery'),
  ).length;
  const companyImports = imports.filter((i) => i.companyId === company?.id);
  const companyComms = communications.filter((c) => c.companyId === company?.id);
  const companyActivities = activities.filter((a) => a.companyId === company?.id);

  const filteredCustomers = useMemo(() => {
    let list = [...companyCustomers];
    const q = search.toLowerCase();
    if (q) list = list.filter((c) => [c.name, c.accountNo, c.phone, c.email].some((v) => (v || '').toLowerCase().includes(q)));
    if (statusFilter && statusFilter !== 'All statuses') list = list.filter((c) => c.status === statusFilter);
    if (balanceFilter === 'Has balance') list = list.filter((c) => c.outstanding > 0);
    if (balanceFilter === 'Cleared') list = list.filter((c) => c.outstanding <= 0);
    if (followFilter === 'Due soon') list = list.filter((c) => !!c.nextFollowUp);
    if (followFilter === 'No follow-up') list = list.filter((c) => !c.nextFollowUp);
    if (sortBy === 'outstanding-desc') list.sort((a, b) => b.outstanding - a.outstanding);
    if (sortBy === 'outstanding-asc') list.sort((a, b) => a.outstanding - b.outstanding);
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'overdue') list.sort((a, b) => daysOverdue(b.dueDate) - daysOverdue(a.dueDate));
    return list;
  }, [companyCustomers, search, statusFilter, balanceFilter, followFilter, sortBy]);

  const collections = companyCustomers.filter((c) =>
    ['Payment Due', 'Follow-up', 'Unresponsive', 'Promise to Pay', 'Recovery Required'].includes(c.status),
  );

  const filteredComms = companyComms.filter((c) => !commChannel || commChannel === 'All channels' || c.channel === commChannel);

  if (!company) {
    return (
      <Card className="card" radius="lg" p="lg">
        <EmptyState title="Company not found" description="This company portfolio does not exist or was removed." />
      </Card>
    );
  }

  if (loading) {
    return (
      <Stack>
        <Skeleton height={80} radius="lg" />
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={100} radius="lg" />
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <>
      <div className="detail-header">
        <Group align="flex-start" gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <div className="company-logo" style={{ width: 56, height: 56, fontSize: 14 }}>
            {company.logoUrl ? <img src={company.logoUrl} alt={`${company.name} logo`} /> : initials(company.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <Group gap={8} wrap="wrap">
              <Text fw={750} size="lg" style={{ letterSpacing: '-0.02em' }}>
                {company.name}
              </Text>
              <Badge variant="light" color={company.status === 'Active' ? 'green' : company.status === 'Archived' ? 'gray' : 'yellow'}>
                {company.status}
              </Badge>
            </Group>
            {company.tradingName && (
              <Text size="xs" c="dimmed" mt={2}>
                Trading as {company.tradingName}
              </Text>
            )}
            <Group gap="md" mt={8} wrap="wrap">
              <Text size="xs" c="dimmed">
                <Phone size={11} style={{ display: 'inline', marginRight: 4 }} />
                {company.phone || '—'}
              </Text>
              <Text size="xs" c="dimmed">
                <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />
                {company.email || '—'}
              </Text>
              <Text size="xs" c="dimmed">
                Contact: {company.primaryContact || '—'}
              </Text>
            </Group>
          </div>
        </Group>
        <Group gap="xs" className="detail-actions">
          {companyId !== company.id && (
            <Button variant="light" size="sm" onClick={() => switchCompany(company.id)}>
              Switch to company
            </Button>
          )}
          <Button size="sm" leftSection={<Edit size={14} />} onClick={() => setEditOpen(true)}>
            Edit Company
          </Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="default" size="sm" leftSection={<MoreHorizontal size={14} />}>
                More
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Archive size={14} />} color="orange" onClick={() => setArchiveOpen(true)}>
                Archive company
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </div>

      <div className="metric-grid metric-grid-7">
        <Metric label="Outstanding customers" value={String(outstanding.length)} foot="Active balances" icon={Users} />
        <Metric label="Total outstanding" value={money(outstanding.reduce((s, c) => s + c.outstanding, 0))} foot="Company portfolio" icon={Building2} />
        <Metric label="Customers contacted" value={String(contacted)} foot="Any contact logged" icon={Phone} />
        <Metric label="Promises to pay" value={String(companyPromises.filter((p) => p.status === 'Pending').length)} foot="Pending" icon={CalendarClock} />
        <Metric label="Payments / cleared" value={String(paid)} foot="Paid accounts" icon={FileSpreadsheet} />
        <Metric label="Recovery cases" value={String(companyRecoveries.filter((r) => !['Recovered', 'Closed', 'Written Off'].includes(r.status)).length)} foot="Open jobs" icon={Truck} />
        <Metric label="Equipment awaiting" value={String(awaitingEq)} foot="Recovery required" icon={Truck} />
      </div>

      <Tabs defaultValue="overview" className="detail-tabs">
        <Tabs.List className="tabs-scroll">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="customers">Customers</Tabs.Tab>
          <Tabs.Tab value="collections">Collections</Tabs.Tab>
          <Tabs.Tab value="promises">Promises to Pay</Tabs.Tab>
          <Tabs.Tab value="recovery">Equipment Recovery</Tabs.Tab>
          <Tabs.Tab value="imports">Imports</Tabs.Tab>
          <Tabs.Tab value="communications">Communications</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Company contact information</div>
              <SimpleGrid cols={2} mt="md">
                <Info label="Primary contact" value={company.primaryContact || '—'} />
                <Info label="Email" value={company.email || '—'} />
                <Info label="Phone" value={company.phone || '—'} />
                <Info label="WhatsApp" value={company.whatsappNumber || company.whatsappSender || '—'} />
                <Info label="Website" value={company.website || '—'} />
                <Info label="Registration" value={company.registrationNumber || '—'} />
                <Info label="VAT" value={company.vatNumber || '—'} />
              </SimpleGrid>
            </Card>
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Address</div>
              <Text size="sm" mt="md">
                {[company.addressLine1, company.addressLine2, company.city, company.province, company.postalCode, company.country]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </Text>
              <div className="card-title" style={{ marginTop: 18 }}>
                Outstanding summary
              </div>
              <Text size="sm" mt="sm">
                {outstanding.length} customers · {money(outstanding.reduce((s, c) => s + c.outstanding, 0))}
              </Text>
            </Card>
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Recent activity</div>
              <Stack gap="xs" mt="md">
                {companyActivities.slice(0, 6).map((a) => (
                  <div key={a.id} className="activity">
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
                {companyActivities.length === 0 && <EmptyState title="No recent activity" description="Actions for this company will appear here." />}
              </Stack>
            </Card>
            <Card className="card" radius="lg" p="lg">
              <div className="card-title">Recent imports & follow-ups</div>
              <Stack gap="sm" mt="md">
                {companyImports.slice(0, 3).map((i) => (
                  <Group key={i.id} justify="space-between">
                    <div>
                      <Text size="xs" fw={650}>
                        {i.file}
                      </Text>
                      <Text size="10px" c="dimmed">
                        {safeDateTime(i.date)}
                      </Text>
                    </div>
                    <Badge size="sm" variant="light">
                      {i.rows} rows
                    </Badge>
                  </Group>
                ))}
                {companyCustomers
                  .filter((c) => c.nextFollowUp)
                  .slice(0, 4)
                  .map((c) => (
                    <Group key={c.id} justify="space-between" style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                      <Text size="xs">{c.name}</Text>
                      <Text size="xs" c="dimmed">
                        {safeDate(c.nextFollowUp)}
                      </Text>
                    </Group>
                  ))}
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="customers" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md" wrap="wrap">
              <div className="toolbar-left" style={{ flex: 1 }}>
                <TextInput className="search-wrap" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
                <Select className="status-filter" data={['All statuses', 'Payment Due', 'Follow-up', 'Promise to Pay', 'Paid', 'Unresponsive', 'Cancelled', 'Recovery Required']} value={statusFilter} onChange={setStatusFilter} />
                <Select data={['All balances', 'Has balance', 'Cleared']} value={balanceFilter} onChange={setBalanceFilter} />
                <Select data={['All follow-ups', 'Due soon', 'No follow-up']} value={followFilter} onChange={setFollowFilter} />
                <Select data={[{ value: 'outstanding-desc', label: 'Highest balance' }, { value: 'outstanding-asc', label: 'Lowest balance' }, { value: 'name', label: 'Name' }, { value: 'overdue', label: 'Most overdue' }]} value={sortBy} onChange={setSortBy} />
              </div>
              <Group>
                <Button variant="light" onClick={() => navigate('/imports')}>
                  Import Customers
                </Button>
                <Button leftSection={<Plus size={14} />} onClick={() => setAddCustomerOpen(true)}>
                  Add Customer
                </Button>
              </Group>
            </Group>
            <CustomerTable
              customers={filteredCustomers}
              onOpen={(c) => navigate(`/customers/${c.id}`)}
              emptyTitle="No customers for this company"
              emptyDescription="Add a customer or import an outstanding spreadsheet."
            />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="collections" pt="md">
          <Card className="card" radius="lg" p="lg">
            <CustomerTable
              customers={collections}
              onOpen={(c) => navigate(`/customers/${c.id}`)}
              emptyTitle="No customers require follow-up right now."
              emptyDescription="When accounts become overdue they will appear in this collections list."
            />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="promises" pt="md">
          <Card className="card" radius="lg" p="lg">
            <div className="desktop-table table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th>Amount promised</Table.Th>
                    <Table.Th>Promise date</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Outstanding</Table.Th>
                    <Table.Th>Last contact</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {companyPromises.map((p) => {
                    const c = companyCustomers.find((x) => x.id === p.customerId);
                    return (
                      <Table.Tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => c && navigate(`/customers/${c.id}`)}>
                        <Table.Td>{c?.name || '—'}</Table.Td>
                        <Table.Td>{money(p.amount)}</Table.Td>
                        <Table.Td>{safeDate(p.promiseDate)}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light">
                            {p.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{money(c?.outstanding || 0)}</Table.Td>
                        <Table.Td>{c?.lastContact || '—'}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
            {companyPromises.length === 0 && <EmptyState title="No promises to pay" description="Record a promise from a customer account to track payment commitments." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="recovery" pt="md">
          <div className="recovery-grid">
            {companyRecoveries.map((r) => {
              const c = companyCustomers.find((x) => x.id === r.customerId) || customers.find((x) => x.id === r.customerId);
              return (
                <div className="recovery-card" key={r.id} onClick={() => navigate(`/customers/${r.customerId}`)} style={{ cursor: 'pointer' }}>
                  <div className="recovery-head">
                    <div>
                      <div className="recovery-client">{c?.name || 'Unknown'}</div>
                      <div className="recovery-id">
                        {r.id} · {c?.accountNo}
                      </div>
                    </div>
                    <Badge variant="light" color={recoveryColor[r.status]} size="sm">
                      {r.status}
                    </Badge>
                  </div>
                  <div className="recovery-meta">
                    <div>
                      <div className="meta-label">Equipment</div>
                      <div className="meta-value">{r.equipment}</div>
                    </div>
                    <div>
                      <div className="meta-label">Technician</div>
                      <div className="meta-value">{r.technician}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {companyRecoveries.length === 0 && (
            <Card className="card" radius="lg">
              <EmptyState title="No recovery jobs" description="Create a recovery job from a customer account when equipment must be collected." />
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="imports" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Group justify="space-between" mb="md">
              <div className="card-title">Import history</div>
              <Button size="xs" variant="light" onClick={() => navigate('/imports')}>
                New import
              </Button>
            </Group>
            <div className="desktop-table table-wrap">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Batch</Table.Th>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Records</Table.Th>
                    <Table.Th>New</Table.Th>
                    <Table.Th>Updated</Table.Th>
                    <Table.Th>Cleared</Table.Th>
                    <Table.Th>Errors</Table.Th>
                    <Table.Th>Uploaded by</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {companyImports.map((i) => (
                    <Table.Tr key={i.id}>
                      <Table.Td>{i.id}</Table.Td>
                      <Table.Td>{i.file}</Table.Td>
                      <Table.Td>{safeDateTime(i.date)}</Table.Td>
                      <Table.Td>{i.rows}</Table.Td>
                      <Table.Td>{i.created}</Table.Td>
                      <Table.Td>{i.updated}</Table.Td>
                      <Table.Td>{i.cleared}</Table.Td>
                      <Table.Td>{i.errors}</Table.Td>
                      <Table.Td>{i.uploadedBy || '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {companyImports.length === 0 && <EmptyState title="No imports yet" description="Upload this company's outstanding spreadsheet to populate accounts." />}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="communications" pt="md">
          <Card className="card" radius="lg" p="lg">
            <Select mb="md" w={220} data={['All channels', 'WhatsApp', 'Email', 'Phone', 'Internal note']} value={commChannel} onChange={setCommChannel} />
            <Stack gap="sm">
              {filteredComms.map((c) => {
                const cust = customers.find((x) => x.id === c.customerId);
                return (
                  <div key={c.id} className="timeline-item" onClick={() => navigate(`/customers/${c.customerId}`)} style={{ cursor: 'pointer' }}>
                    <Badge size="xs" variant="light">
                      {c.channel}
                    </Badge>
                    <Text size="xs" fw={650} mt={4}>
                      {cust?.name || 'Customer'} · {c.direction}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                      {c.message}
                    </Text>
                    <Text size="10px" c="dimmed" mt={4}>
                      {safeDateTime(c.createdAt)} · {c.status}
                    </Text>
                  </div>
                );
              })}
              {filteredComms.length === 0 && <EmptyState title="No messages yet" description="Send WhatsApp/email or log calls from customer accounts." />}
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <Card className="card" radius="lg" p="lg">
            <PageHero title="Company settings" description="Default follow-up intervals, messaging placeholders and recovery behaviour for this portfolio." />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Info label="Default follow-up interval" value={`${company.followUpIntervalDays || 3} days`} />
              <Info label="WhatsApp sender" value={company.whatsappSender || 'Not configured'} />
              <Info label="Email sender" value={company.emailSender || 'Not configured'} />
              <Info label="Default recovery behaviour" value={company.defaultRecoveryBehaviour || 'Create recovery for company-owned equipment'} />
            </SimpleGrid>
            <Text size="sm" mt="md" c="dimmed">
              {company.collectionRules || 'No company-specific collection rules configured yet.'}
            </Text>
            <Button mt="lg" onClick={() => navigate('/settings')}>
              Open full settings
            </Button>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <CompanyFormModal opened={editOpen} onClose={() => setEditOpen(false)} company={company} />
      <CustomerFormModal opened={addCustomerOpen} onClose={() => setAddCustomerOpen(false)} companyId={company.id} />
      <ConfirmModal
        opened={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive company"
        message="Archiving hides this company from the active switcher. Customer history, communications and recovery records are preserved. You can reveal archived companies with Show archived."
        confirmLabel="Archive company"
        confirmColor="orange"
        onConfirm={() => {
          archiveCompany(company.id);
          setArchiveOpen(false);
          navigate('/companies');
        }}
      />
    </>
  );
}
