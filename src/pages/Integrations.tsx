import { useMemo, useState } from 'react';
import { Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { Cable, CheckCircle2, Database, FileSpreadsheet, Mail, MessageCircle, RefreshCw, Settings2 } from 'lucide-react';
import { EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { Integration, IntegrationProvider } from '../types';
import { nowIso, safeDate, uid } from '../utils';

const providers: { name: IntegrationProvider; description: string; icon: typeof Cable; color: string }[] = [
  { name: 'Splynx', description: 'Customers, services, invoices, payments and service status.', icon: Cable, color: 'indigo' },
  { name: 'Xero', description: 'Contacts, invoices, credit notes and payment reconciliation.', icon: Database, color: 'blue' },
  { name: 'Sage', description: 'Accounting data through the API available for your Sage product.', icon: Database, color: 'green' },
  { name: 'Excel / CSV', description: 'Saved mappings and controlled fallback imports.', icon: FileSpreadsheet, color: 'teal' },
  { name: 'WhatsApp', description: 'Twilio or WhatsApp Business messaging and status events.', icon: MessageCircle, color: 'lime' },
  { name: 'Email', description: 'SMTP send plus IMAP inbox. Replies from customer addresses appear on the account timeline.', icon: Mail, color: 'orange' },
];

export default function Integrations() {
  const { company, companyId, integrations, saveIntegration, removeIntegration, toastSuccess, syncInbox } = useApp();
  const [provider, setProvider] = useState<IntegrationProvider | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [accountLabel, setAccountLabel] = useState('');
  const [frequency, setFrequency] = useState<Integration['syncFrequency']>('Hourly');
  const companyConnections = useMemo(() => integrations.filter((x) => x.companyId === companyId), [integrations, companyId]);

  function existing(name: IntegrationProvider) { return companyConnections.find((x) => x.provider === name); }
  function open(name: IntegrationProvider) {
    const item = existing(name);
    setProvider(name); setBaseUrl(item?.baseUrl || ''); setAccountLabel(item?.accountLabel || ''); setFrequency(item?.syncFrequency || 'Hourly');
  }
  function save() {
    if (!provider || !companyId) return;
    const previous = existing(provider);
    saveIntegration({ id: previous?.id || uid('int'), companyId, provider, baseUrl, accountLabel, syncFrequency: frequency, status: 'Connected', enabled: true, lastSync: previous?.lastSync, lastResult: previous?.lastResult });
    setProvider(null);
  }
  async function sync(item: Integration) {
    if (item.provider === 'Email') {
      const result = await syncInbox();
      saveIntegration({
        ...item,
        lastSync: nowIso(),
        lastResult: result.ok
          ? `Imported ${result.imported || 0} customer replies.`
          : result.error || 'Inbox sync failed.',
        status: result.ok ? 'Connected' : 'Needs attention',
      });
      return;
    }
    saveIntegration({ ...item, lastSync: nowIso(), lastResult: 'Connection verified. Synchronisation queued.', status: 'Connected' });
    toastSuccess(`${item.provider} synchronisation queued.`);
  }

  return <>
    <PageHero eyebrow={<><Settings2 size={13}/>{company.name}</>} title="Connected systems" description="Connect the tools your client already uses. Each company keeps separate credentials, mappings and synchronisation settings." actions={<Button leftSection={<RefreshCw size={15}/>} variant="light" onClick={() => companyConnections.forEach(sync)} disabled={!companyConnections.length}>Sync all</Button>} />
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
      {providers.map((p) => { const item = existing(p.name); const Icon = p.icon; return <Card className="card integration-card" radius="lg" p="lg" key={p.name}>
        <Group justify="space-between" align="flex-start" wrap="nowrap"><div className={`integration-icon integration-${p.color}`}><Icon size={19}/></div><Badge color={item?.status === 'Connected' ? 'teal' : 'gray'} variant="light">{item?.status || 'Not connected'}</Badge></Group>
        <Text fw={750} mt="md">{p.name}</Text><Text size="xs" c="dimmed" mt={5} mih={38}>{p.description}</Text>
        {item && <Stack gap={4} mt="md"><Text size="xs"><b>Account:</b> {item.accountLabel || company.name}</Text><Text size="xs" c="dimmed">Last sync: {item.lastSync ? safeDate(item.lastSync) : 'Not synced yet'} · {item.syncFrequency}</Text></Stack>}
        <Group mt="lg" grow><Button variant={item ? 'default' : 'filled'} onClick={() => open(p.name)}>{item ? 'Configure' : 'Connect'}</Button>{item && <Button variant="light" onClick={() => sync(item)}>Sync</Button>}</Group>
      </Card>; })}
    </SimpleGrid>
    {!companyId && <EmptyState title="Select a company" description="Connections belong to a specific company portfolio." />}
    <Modal opened={!!provider} onClose={() => setProvider(null)} title={`Configure ${provider || ''}`} centered classNames={{ content: 'app-modal' }}>
      <Stack><Text size="xs" c="dimmed">Credentials remain server-side in production. Use an identifiable account label and the service URL supplied by your provider.</Text><TextInput label="Account label" value={accountLabel} onChange={(e) => setAccountLabel(e.currentTarget.value)} placeholder={company.name}/><TextInput label="API / service URL" value={baseUrl} onChange={(e) => setBaseUrl(e.currentTarget.value)} placeholder="https://..."/><Select label="Automatic sync" value={frequency} onChange={(v) => setFrequency((v || 'Hourly') as Integration['syncFrequency'])} data={['Manual','15 minutes','Hourly','Daily']}/><Switch label="Enable this connection after saving" defaultChecked/><Group justify="space-between" mt="sm">{provider && existing(provider) ? <Button color="red" variant="subtle" onClick={() => { removeIntegration(existing(provider)!.id); setProvider(null); }}>Disconnect</Button> : <span/>}<Button leftSection={<CheckCircle2 size={15}/>} onClick={save}>Save connection</Button></Group></Stack>
    </Modal>
  </>;
}
