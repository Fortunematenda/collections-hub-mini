import { Button, Card, Progress, Stack, Text } from '@mantine/core';
import {
  Activity,
  Banknote,
  Building2,
  CalendarClock,
  FileSpreadsheet,
  MessageCircle,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CustomerTable } from '../components/CustomerTable';
import { ActivityRow, Metric, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import { money } from '../utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { company, companyCustomers, totalOutstanding, promiseCustomers, recoveryNeeded } = useApp();

  const active = companyCustomers.filter((c) => c.outstanding > 0 && c.status !== 'Paid');
  const followups = companyCustomers.filter((c) =>
    ['Payment Due', 'Follow-up', 'Unresponsive'].includes(c.status),
  ).length;
  const stages: [string, number][] = [
    ['Payment Due', companyCustomers.filter((c) => c.status === 'Payment Due').length],
    ['Follow-up', companyCustomers.filter((c) => c.status === 'Follow-up').length],
    ['Promise', promiseCustomers.length],
    ['Recovery', recoveryNeeded],
  ];
  const progress = companyCustomers.length
    ? Math.min(
        100,
        Math.round(
          (companyCustomers.filter((c) => c.status !== 'Payment Due').length / companyCustomers.length) * 100,
        ),
      )
    : 100;

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Collections overview"
        description="Track unpaid accounts, follow-ups, payment promises and equipment recoveries for this company without mixing data with other portfolios."
        actions={
          <Button leftSection={<FileSpreadsheet size={15} />} variant="light" onClick={() => navigate('/imports')}>
            Upload outstanding file
          </Button>
        }
      />

      <div className="metric-grid">
        <Metric label="Total outstanding" value={money(totalOutstanding)} foot={`${active.length} active accounts`} icon={Banknote} />
        <Metric label="Accounts to follow up" value={String(followups)} foot="Needs action" icon={MessageCircle} />
        <Metric label="Promises to pay" value={String(promiseCustomers.length)} foot="Track promised dates" icon={CalendarClock} />
        <Metric label="Recovery required" value={String(recoveryNeeded)} foot="Equipment collection" icon={Truck} />
      </div>

      <div className="two-col">
        <Card className="card" radius="lg" p="lg">
          <div className="card-title-row">
            <div>
              <div className="card-title">Priority accounts</div>
              <div className="card-subtitle">Highest balances requiring attention</div>
            </div>
            <Button variant="subtle" size="xs" onClick={() => navigate('/accounts')}>
              View all
            </Button>
          </div>
          <CustomerTable
            customers={[...active].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5)}
            onOpen={(c) => navigate('/customers/' + c.id)}
          />
        </Card>

        <Stack gap="md">
          <Card className="card" radius="lg" p="lg">
            <div className="card-title-row">
              <div>
                <div className="card-title">Collections pipeline</div>
                <div className="card-subtitle">Current workload by stage</div>
              </div>
              <Activity size={16} color="#6b7280" />
            </div>
            <div className="pipeline">
              {stages.map(([label, n]) => (
                <div className="pipeline-stage" key={label}>
                  <div className="pipeline-number">{n}</div>
                  <div className="pipeline-label">{label}</div>
                </div>
              ))}
            </div>
            <Progress value={progress} mt="lg" size="sm" radius="xl" />
            <Text size="xs" c="dimmed" mt={8}>
              {progress}% of accounts have moved beyond initial payment-due status.
            </Text>
          </Card>

          <Card className="card" radius="lg" p="lg">
            <div className="card-title-row">
              <div>
                <div className="card-title">Portfolio separation</div>
                <div className="card-subtitle">Company-aware data model</div>
              </div>
              <ShieldCheck size={16} color="#6b7280" />
            </div>
            <ActivityRow icon={Building2} text={`Working in ${company.name}`} time="Active portfolio" />
            <ActivityRow icon={FileSpreadsheet} text="Imports only update this company's clients" time="Company-scoped matching" />
            <ActivityRow icon={MessageCircle} text="Templates and messages stay company-specific" time="Separate communication" />
          </Card>
        </Stack>
      </div>
    </>
  );
}
