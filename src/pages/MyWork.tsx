import { useMemo, useState } from 'react';
import { Badge, Button, Card, Select, SimpleGrid, Text, TextInput } from '@mantine/core';
import { CalendarClock, ClipboardList, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Metric, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { actorName, INTENT_BADGE_COLOR, INTENT_LABELS, money, safeDate, todayIso, WORK_QUEUES } from '../utils';

export default function MyWork() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workTasks, companies, getCustomer, getCompany, completeWorkTask, companyId } = useApp();
  const [queue, setQueue] = useState<string | null>('My Tasks');
  const [search, setSearch] = useState('');
  const me = user?.name || actorName();
  const today = todayIso();

  const scoped = useMemo(() => {
    return workTasks.filter((task) => {
      const customer = getCustomer(task.customerId);
      if (!customer || customer.archived) return false;
      if (queue === 'My Tasks') return (task.assignedUser || '') === me && task.status !== 'Completed';
      if (queue === 'Unassigned') return !task.assignedUser && task.status !== 'Completed';
      if (queue && queue !== 'All queues') return task.queue === queue && task.status !== 'Completed';
      return task.status !== 'Completed';
    });
  }, [workTasks, queue, me, getCustomer]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return scoped.filter((task) => {
      const customer = getCustomer(task.customerId);
      const company = getCompany(task.companyId);
      const hay = [customer?.name, customer?.accountNo, company?.name, task.title, task.notes].filter(Boolean).join(' ').toLowerCase();
      return !q || hay.includes(q);
    });
  }, [scoped, search, getCustomer, getCompany]);

  const dueToday = filtered.filter((task) => task.dueDate === today);
  const overdue = filtered.filter((task) => task.dueDate && task.dueDate < today);
  const sections = [
    { title: 'Overdue', items: overdue },
    { title: 'Due today', items: dueToday },
    { title: 'Open tasks', items: filtered.filter((task) => !overdue.includes(task) && !dueToday.includes(task)) },
  ];

  return (
    <>
      <PageHero
        eyebrow={<><ClipboardList size={13} />Operational work</>}
        title="My work"
        description="Response-driven tasks across payment verification, promises, disputes, callbacks and recovery. Company is shown on every card."
      />
      <div className="metric-grid">
        <Metric label="Due today" value={String(dueToday.length)} foot={me} icon={CalendarClock} />
        <Metric label="Overdue" value={String(overdue.length)} foot="Needs action" icon={ClipboardList} />
        <Metric label="Open" value={String(filtered.length)} foot={queue || 'All'} icon={ClipboardList} />
        <Metric label="Company queues" value={String(WORK_QUEUES.length)} foot={companies.find((c) => c.id === companyId)?.name || ''} icon={ClipboardList} />
      </div>
      <Card className="card" radius="lg" p="lg">
        <div className="toolbar">
          <div className="toolbar-left" style={{ flexWrap: 'wrap', gap: 8 }}>
            <TextInput className="search-wrap" value={search} onChange={(e) => setSearch(e.currentTarget.value)} placeholder="Search customer, account, task..." leftSection={<Search size={14} />} />
            <Select value={queue} onChange={setQueue} data={['My Tasks', 'Unassigned', 'All queues', ...WORK_QUEUES]} />
          </div>
        </div>
        {sections.map((section) => (
          <div key={section.title} className="work-section">
            <Text fw={700} size="sm" mb="sm">{section.title}</Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {section.items.map((task) => {
                const customer = getCustomer(task.customerId);
                const company = getCompany(task.companyId);
                return (
                  <div className="work-card" key={task.id}>
                    <div className="work-card-top">
                      <div>
                        <Text size="sm" fw={700}>{customer?.name || 'Unknown customer'}</Text>
                        <Text size="10px" c="dimmed">{company?.name} · {customer?.accountNo} · {customer ? money(customer.outstanding) : ''}</Text>
                      </div>
                      <Badge variant="light" color={INTENT_BADGE_COLOR[task.type] || 'gray'}>{INTENT_LABELS[task.type] || task.queue}</Badge>
                    </div>
                    <Text size="xs" mt={6}>{task.title}</Text>
                    <div className="work-card-meta">
                      <span>{task.priority || 'Medium'}</span>
                      <span>{task.dueDate ? safeDate(task.dueDate) : 'No due date'}</span>
                      <span>{task.assignedUser || 'Unassigned'}</span>
                      <span>{task.status}</span>
                    </div>
                    <div className="work-card-actions">
                      <Button size="compact-xs" variant="light" onClick={() => navigate(`/customers/${task.customerId}?tab=communications`)}>Open</Button>
                      <Button size="compact-xs" variant="default" onClick={() => completeWorkTask(task.id)}>Done</Button>
                    </div>
                  </div>
                );
              })}
            </SimpleGrid>
            {!section.items.length ? <Text size="xs" c="dimmed" mb="md">None</Text> : null}
          </div>
        ))}
        {!filtered.length && <EmptyState title="No tasks in this queue" description="Inbound customer responses create tasks here after classification." />}
      </Card>
    </>
  );
}
