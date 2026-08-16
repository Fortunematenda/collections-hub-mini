import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { CalendarClock, Pause, Play, Plus, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import { EmptyState, Metric, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { AutomationAction, AutomationRule, AutomationTrigger } from '../types';
import { money, nowIso, uid } from '../utils';

const triggers: AutomationTrigger[] = ['Before due date','Invoice overdue','Promise due','Promise broken','Payment received','Communication failed'];
const actions: AutomationAction[] = ['Send WhatsApp','Send email','Create follow-up','Notify manager','Request suspension','Start recovery'];
const blank = (companyId: string): AutomationRule => ({ id: uid('rule'), companyId, name: '', trigger: 'Invoice overdue', daysOffset: 7, minimumBalance: 0, action: 'Send WhatsApp', active: true, requiresApproval: false, createdAt: nowIso() });

export default function Automations() {
  const { company, companyId, companyCustomers, automationRules, saveAutomationRule, removeAutomationRule } = useApp();
  const rules = useMemo(() => automationRules.filter((x) => x.companyId === companyId), [automationRules, companyId]);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const eligible = companyCustomers.filter((x) => x.outstanding > 0);
  const protectedActions = rules.filter((x) => x.active && x.requiresApproval).length;
  function set<K extends keyof AutomationRule>(key: K, value: AutomationRule[K]) { setEditing((x) => x ? { ...x, [key]: value } : x); }
  function save() { if (!editing || !editing.name.trim()) return; saveAutomationRule(editing); setEditing(null); }

  return <>
    <PageHero eyebrow={<><Workflow size={13}/>{company.name}</>} title="Collection automations" description="Built-in server jobs already create Promise to Pay from email replies and mark overdue promises as broken. Saved rules below are a draft catalogue — they are not executed yet." actions={<Button leftSection={<Plus size={15}/>} onClick={() => setEditing(blank(companyId))} disabled={!companyId}>New draft rule</Button>} />
    <div className="metric-grid">
      <Metric label="Draft rules" value={String(rules.filter((x) => x.active).length)} foot={`${rules.length} saved`} icon={Play}/><Metric label="Eligible accounts" value={String(eligible.length)} foot={money(eligible.reduce((s,x)=>s+x.outstanding,0))} icon={Workflow}/><Metric label="Approval flagged" value={String(protectedActions)} foot="Not yet enforced" icon={ShieldCheck}/><Metric label="Built-in jobs" value="2 min" foot="Email PTP + overdue promises" icon={CalendarClock}/>
    </div>
    <Card className="card" radius="lg" p={0}>
      <div className="automation-table-wrap"><Table striped highlightOnHover verticalSpacing="md"><Table.Thead><Table.Tr><Table.Th>Rule</Table.Th><Table.Th>Trigger</Table.Th><Table.Th>Action</Table.Th><Table.Th>Minimum balance</Table.Th><Table.Th>Protection</Table.Th><Table.Th>Status</Table.Th><Table.Th/></Table.Tr></Table.Thead><Table.Tbody>{rules.map((r)=><Table.Tr key={r.id}><Table.Td><Text fw={650} size="sm">{r.name}</Text><Text size="xs" c="dimmed">{Math.abs(r.daysOffset)} day offset</Text></Table.Td><Table.Td>{r.trigger}</Table.Td><Table.Td>{r.action}</Table.Td><Table.Td>{money(r.minimumBalance)}</Table.Td><Table.Td><Badge color={r.requiresApproval?'orange':'gray'} variant="light">{r.requiresApproval?'Approval':'Automatic'}</Badge></Table.Td><Table.Td><Badge color={r.active?'teal':'gray'}>{r.active?'Active':'Paused'}</Badge></Table.Td><Table.Td><Group gap={4} justify="flex-end"><ActionIcon variant="subtle" aria-label={r.active?'Pause':'Activate'} onClick={()=>saveAutomationRule({...r,active:!r.active})}>{r.active?<Pause size={15}/>:<Play size={15}/>}</ActionIcon><Button size="compact-xs" variant="subtle" onClick={()=>setEditing(r)}>Edit</Button><ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={()=>removeAutomationRule(r.id)}><Trash2 size={15}/></ActionIcon></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
      {!rules.length && <EmptyState title="No automation rules" description="Create your first controlled reminder or follow-up rule for this company." />}
    </Card>
    <SimpleGrid cols={{base:1,md:2,lg:4}} mt="md">
      <Card className="card" radius="lg">
        <Text fw={700}>Email promise to pay</Text>
        <Text size="xs" c="dimmed" mt={6}>Always on. If a client replies that they will pay, the account is marked Promise to Pay using the date they named, or 7 days if they did not.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Recommended first rules</Text>
        <Text size="xs" c="dimmed" mt={6}>Friendly reminder on due date, WhatsApp at 7 days overdue, and a human call task after 14 days.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Automatic stop conditions</Text>
        <Text size="xs" c="dimmed" mt={6}>Payment, dispute, opt-out or an active payment arrangement should pause reminders immediately.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Safe ISP actions</Text>
        <Text size="xs" c="dimmed" mt={6}>Keep suspension and equipment recovery behind manager approval until the workflow is proven.</Text>
      </Card>
    </SimpleGrid>
    <Modal opened={!!editing} onClose={()=>setEditing(null)} title={editing?.name?'Edit automation':'New automation'} centered size="lg"><Stack>{editing&&<><TextInput label="Rule name" required value={editing.name} onChange={(e)=>set('name',e.currentTarget.value)} placeholder="7-day overdue WhatsApp reminder"/><SimpleGrid cols={{base:1,sm:2}}><Select label="Trigger" data={triggers} value={editing.trigger} onChange={(v)=>set('trigger',(v||'Invoice overdue') as AutomationTrigger)}/><NumberInput label="Day offset" value={editing.daysOffset} onChange={(v)=>set('daysOffset',Number(v)||0)}/><Select label="Action" data={actions} value={editing.action} onChange={(v)=>set('action',(v||'Create follow-up') as AutomationAction)}/><NumberInput label="Minimum balance" min={0} prefix="R " value={editing.minimumBalance} onChange={(v)=>set('minimumBalance',Number(v)||0)}/></SimpleGrid><Switch label="Rule active" checked={editing.active} onChange={(e)=>set('active',e.currentTarget.checked)}/><Switch label="Require manager approval before action" checked={editing.requiresApproval} onChange={(e)=>set('requiresApproval',e.currentTarget.checked)}/><Group justify="flex-end"><Button variant="default" onClick={()=>setEditing(null)}>Cancel</Button><Button onClick={save} disabled={!editing.name.trim()}>Save automation</Button></Group></>}</Stack></Modal>
  </>;
}
