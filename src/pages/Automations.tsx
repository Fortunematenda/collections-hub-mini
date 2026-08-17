import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Table, TagsInput, Text, TextInput } from '@mantine/core';
import { CalendarClock, Pause, Play, Plus, ShieldCheck, Trash2, Users, Workflow } from 'lucide-react';
import { EmptyState, Metric, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { AssignmentRule, AssignmentType, AutomationAction, AutomationRule, AutomationTrigger, Team } from '../types';
import { amountOwed, hasOutstandingBalance, money, nowIso, uid } from '../utils';

const triggers: AutomationTrigger[] = ['Before due date','Invoice overdue','Promise due','Promise broken','Payment received','Communication failed'];
const actions: AutomationAction[] = ['Send WhatsApp','Send email','Create follow-up','Notify manager','Request suspension','Start recovery'];
const assignmentTypes: AssignmentType[] = ['Existing Account Owner', 'Round Robin', 'Team', 'Specific User', 'Queue', 'Manual Assignment'];
const blank = (companyId: string): AutomationRule => ({ id: uid('rule'), companyId, name: '', trigger: 'Invoice overdue', daysOffset: 7, minimumBalance: 0, action: 'Send WhatsApp', active: true, requiresApproval: false, createdAt: nowIso() });
const blankTeam = (companyId: string): Team => ({ id: uid('team'), companyId, name: '', memberNames: [], active: true, createdAt: nowIso() });

export default function Automations() {
  const {
    company,
    companyId,
    companyCustomers,
    companyTemplates,
    automationRules,
    saveAutomationRule,
    removeAutomationRule,
    responseRules,
    saveResponseRule,
    assignmentRules,
    saveAssignmentRule,
    teams,
    saveTeam,
    removeTeam,
  } = useApp();
  const rules = useMemo(() => automationRules.filter((x) => x.companyId === companyId), [automationRules, companyId]);
  const companyTeams = useMemo(() => teams.filter((item) => item.companyId === companyId), [teams, companyId]);
  const companyAssignments = useMemo(() => assignmentRules.filter((item) => item.companyId === companyId), [assignmentRules, companyId]);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingAssign, setEditingAssign] = useState<AssignmentRule | null>(null);
  const eligible = companyCustomers.filter((x) => hasOutstandingBalance(x.outstanding));
  const protectedActions = rules.filter((x) => x.active && x.requiresApproval).length;
  const paused = companyCustomers.filter((x) => x.automationPaused).length;
  function set<K extends keyof AutomationRule>(key: K, value: AutomationRule[K]) { setEditing((x) => x ? { ...x, [key]: value } : x); }
  function save() { if (!editing || !editing.name.trim()) return; saveAutomationRule(editing); setEditing(null); }

  return <>
    <PageHero eyebrow={<><Workflow size={13}/>{company.name}</>} title="Collection automations" description="Inbound replies are classified by rules first, then optional AI when a key is configured. Active reminder rules are sent by the server job, and paused accounts are skipped." actions={<Button leftSection={<Plus size={15}/>} onClick={() => setEditing(blank(companyId))} disabled={!companyId}>New reminder rule</Button>} />
    <div className="metric-grid">
      <Metric label="Active rules" value={String(rules.filter((x) => x.active).length)} foot={`${rules.length} saved`} icon={Play}/>
      <Metric label="Eligible accounts" value={String(eligible.length)} foot={money(eligible.reduce((s,x)=>s+amountOwed(x.outstanding),0))} icon={Workflow}/>
      <Metric label="Approval gated" value={String(protectedActions)} foot="Creates a task instead of sending" icon={ShieldCheck}/>
      <Metric label="Paused accounts" value={String(paused)} foot="Reminders skipped until resume" icon={CalendarClock}/>
    </div>
    <Card className="card" radius="lg" p={0}>
      <div className="automation-table-wrap"><Table striped highlightOnHover verticalSpacing="md"><Table.Thead><Table.Tr><Table.Th>Rule</Table.Th><Table.Th>Trigger</Table.Th><Table.Th>Action</Table.Th><Table.Th>Minimum balance</Table.Th><Table.Th>Protection</Table.Th><Table.Th>Status</Table.Th><Table.Th/></Table.Tr></Table.Thead><Table.Tbody>{rules.map((r)=><Table.Tr key={r.id}><Table.Td><Text fw={650} size="sm">{r.name}</Text><Text size="xs" c="dimmed">{Math.abs(r.daysOffset)} day offset</Text></Table.Td><Table.Td>{r.trigger}</Table.Td><Table.Td>{r.action}</Table.Td><Table.Td>{money(r.minimumBalance)}</Table.Td><Table.Td><Badge color={r.requiresApproval?'orange':'gray'} variant="light">{r.requiresApproval?'Approval':'Automatic'}</Badge></Table.Td><Table.Td><Badge color={r.active?'teal':'gray'}>{r.active?'Active':'Paused'}</Badge></Table.Td><Table.Td><Group gap={4} justify="flex-end"><ActionIcon variant="subtle" aria-label={r.active?'Pause':'Activate'} onClick={()=>saveAutomationRule({...r,active:!r.active})}>{r.active?<Pause size={15}/>:<Play size={15}/>}</ActionIcon><Button size="compact-xs" variant="subtle" onClick={()=>setEditing(r)}>Edit</Button><ActionIcon color="red" variant="subtle" aria-label="Delete" onClick={()=>removeAutomationRule(r.id)}><Trash2 size={15}/></ActionIcon></Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></div>
      {!rules.length && <EmptyState title="No reminder rules" description="Create a WhatsApp or email reminder. The collections job will send it when the trigger matches." />}
    </Card>
    <Card className="card" radius="lg" p={0} mt="md">
      <Group justify="space-between" px="md" pt="md">
        <div className="card-title" style={{ padding: 0 }}>Teams</div>
        <Button size="compact-xs" leftSection={<Plus size={12} />} onClick={() => setEditingTeam(blankTeam(companyId))} disabled={!companyId}>New team</Button>
      </Group>
      <div className="automation-table-wrap">
        <Table striped highlightOnHover verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Team</Table.Th>
              <Table.Th>Members</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {companyTeams.map((team) => (
              <Table.Tr key={team.id}>
                <Table.Td><Text size="sm" fw={650}>{team.name}</Text></Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{team.memberNames.length ? team.memberNames.join(', ') : 'Add members for round-robin'}</Text></Table.Td>
                <Table.Td><Badge color={team.active ? 'teal' : 'gray'}>{team.active ? 'Active' : 'Paused'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <Button size="compact-xs" variant="subtle" onClick={() => setEditingTeam(team)}>Edit</Button>
                    <ActionIcon color="red" variant="subtle" aria-label="Delete team" onClick={() => removeTeam(team.id)}><Trash2 size={15} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
      {!companyTeams.length && <EmptyState title="No teams" description="Create Collections, Verification and other queues, then attach them to assignment rules." />}
    </Card>
    <Card className="card" radius="lg" p={0} mt="md">
      <div className="card-title" style={{ padding: '16px 16px 0' }}>Assignment rules</div>
      <div className="automation-table-wrap">
        <Table striped highlightOnHover verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Intent</Table.Th>
              <Table.Th>Assign by</Table.Th>
              <Table.Th>Team / people</Table.Th>
              <Table.Th>Queue</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {companyAssignments.map((rule) => {
              const team = companyTeams.find((item) => item.id === rule.assigneeTeamId);
              return (
                <Table.Tr key={rule.id}>
                  <Table.Td><Text size="sm" fw={650}>{rule.name}</Text></Table.Td>
                  <Table.Td>{rule.assignmentType}</Table.Td>
                  <Table.Td><Text size="xs">{team?.name || (rule.assigneeNames || []).join(', ') || rule.assigneeName || 'Account owner'}</Text></Table.Td>
                  <Table.Td>{rule.queue || '—'}</Table.Td>
                  <Table.Td><Button size="compact-xs" variant="subtle" onClick={() => setEditingAssign(rule)}>Edit</Button></Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
    <Card className="card" radius="lg" p={0} mt="md">
      <div className="card-title" style={{ padding: '16px 16px 0' }}>Response rules</div>
      <div className="automation-table-wrap">
        <Table striped highlightOnHover verticalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Intent</Table.Th>
              <Table.Th>Stage</Table.Th>
              <Table.Th>Pause reminders</Table.Th>
              <Table.Th>Task</Table.Th>
              <Table.Th>Assign to</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {responseRules.filter((rule) => rule.companyId === companyId).map((rule) => {
              const assign = assignmentRules.find((item) => item.companyId === companyId && item.triggerIntent === rule.intent);
              return (
                <Table.Tr key={rule.id}>
                  <Table.Td><Text size="sm" fw={650}>{rule.name}</Text></Table.Td>
                  <Table.Td>{rule.changeStage || 'No stage change'}</Table.Td>
                  <Table.Td>{rule.pauseReminders ? 'Yes' : 'No'}</Table.Td>
                  <Table.Td>{rule.taskTitle || '—'}</Table.Td>
                  <Table.Td>{assign?.assignmentType || 'Account owner'}</Table.Td>
                  <Table.Td>
                    <Badge color={rule.active ? 'teal' : 'gray'}>{rule.active ? 'Active' : 'Paused'}</Badge>
                    <ActionIcon ml={6} variant="subtle" aria-label={rule.active ? 'Pause' : 'Activate'} onClick={() => saveResponseRule({ ...rule, active: !rule.active })}>
                      {rule.active ? <Pause size={15} /> : <Play size={15} />}
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Card>
    <SimpleGrid cols={{base:1,md:2,lg:4}} mt="md">
      <Card className="card" radius="lg">
        <Text fw={700}>Response classification</Text>
        <Text size="xs" c="dimmed" mt={6}>Rules always run. Set OPENAI_API_KEY on the server to classify unclear replies as AI, with manual review still available.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Reminder sender</Text>
        <Text size="xs" c="dimmed" mt={6}>Active email and WhatsApp rules are executed by the collections job. Paused, sensitive, paid and invalid-contact accounts are skipped.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Teams</Text>
        <Text size="xs" c="dimmed" mt={6}>Round-robin and team assignment use the member list on the team record, not a hard-coded name list.</Text>
      </Card>
      <Card className="card" radius="lg">
        <Text fw={700}>Statements & POP</Text>
        <Text size="xs" c="dimmed" mt={6}>Statement requests generate a stored file. Proof-of-payment images can be uploaded on the customer record.</Text>
      </Card>
    </SimpleGrid>
    <Modal opened={!!editing} onClose={()=>setEditing(null)} title={editing?.name?'Edit reminder rule':'New reminder rule'} centered size="lg">
      <Stack>
        {editing && (
          <>
            <TextInput label="Rule name" required value={editing.name} onChange={(e)=>set('name',e.currentTarget.value)} placeholder="7-day overdue WhatsApp reminder"/>
            <SimpleGrid cols={{base:1,sm:2}}>
              <Select label="Trigger" data={triggers} value={editing.trigger} onChange={(v)=>set('trigger',(v||'Invoice overdue') as AutomationTrigger)}/>
              <NumberInput label="Day offset" value={editing.daysOffset} onChange={(v)=>set('daysOffset',Number(v)||0)}/>
              <Select label="Action" data={actions} value={editing.action} onChange={(v)=>set('action',(v||'Create follow-up') as AutomationAction)}/>
              <NumberInput label="Minimum balance" min={0} prefix="R " value={editing.minimumBalance} onChange={(v)=>set('minimumBalance',Number(v)||0)}/>
            </SimpleGrid>
            <Select
              label="Message template"
              placeholder="Optional — otherwise a default reminder is used"
              clearable
              data={companyTemplates.map((item) => ({ value: item.id, label: `${item.name} (${item.channel})` }))}
              value={editing.templateId || null}
              onChange={(v) => set('templateId', v || undefined)}
            />
            <Switch label="Rule active" checked={editing.active} onChange={(e)=>set('active',e.currentTarget.checked)}/>
            <Switch label="Require manager approval before sending" checked={editing.requiresApproval} onChange={(e)=>set('requiresApproval',e.currentTarget.checked)}/>
            <Group justify="flex-end">
              <Button variant="default" onClick={()=>setEditing(null)}>Cancel</Button>
              <Button onClick={save} disabled={!editing.name.trim()}>Save rule</Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
    <Modal opened={!!editingTeam} onClose={() => setEditingTeam(null)} title={editingTeam?.name ? 'Edit team' : 'New team'} centered>
      <Stack>
        {editingTeam && (
          <>
            <TextInput label="Team name" value={editingTeam.name} onChange={(e) => setEditingTeam({ ...editingTeam, name: e.currentTarget.value })} placeholder="Payment Verification"/>
            <TagsInput label="Members" description="Names used for round-robin. Match the collector names on user accounts." value={editingTeam.memberNames} onChange={(value) => setEditingTeam({ ...editingTeam, memberNames: value })} placeholder="Add a name and press Enter"/>
            <Switch label="Team active" checked={editingTeam.active} onChange={(e) => setEditingTeam({ ...editingTeam, active: e.currentTarget.checked })}/>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingTeam(null)}>Cancel</Button>
              <Button
                leftSection={<Users size={14} />}
                disabled={!editingTeam.name.trim()}
                onClick={() => {
                  saveTeam(editingTeam);
                  setEditingTeam(null);
                }}
              >
                Save team
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
    <Modal opened={!!editingAssign} onClose={() => setEditingAssign(null)} title="Edit assignment" centered>
      <Stack>
        {editingAssign && (
          <>
            <Text size="sm" fw={650}>{editingAssign.name}</Text>
            <Select label="Assignment type" data={assignmentTypes} value={editingAssign.assignmentType} onChange={(v) => setEditingAssign({ ...editingAssign, assignmentType: (v || 'Existing Account Owner') as AssignmentType })}/>
            <Select
              label="Team"
              clearable
              data={companyTeams.map((item) => ({ value: item.id, label: item.name }))}
              value={editingAssign.assigneeTeamId || null}
              onChange={(v) => setEditingAssign({ ...editingAssign, assigneeTeamId: v || undefined })}
            />
            <TagsInput label="Fallback names" value={editingAssign.assigneeNames || []} onChange={(value) => setEditingAssign({ ...editingAssign, assigneeNames: value })}/>
            <TextInput label="Specific user" value={editingAssign.assigneeName || ''} onChange={(e) => setEditingAssign({ ...editingAssign, assigneeName: e.currentTarget.value })}/>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditingAssign(null)}>Cancel</Button>
              <Button onClick={() => { saveAssignmentRule({ ...editingAssign, updatedAt: nowIso() }); setEditingAssign(null); }}>Save assignment</Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  </>;
}
