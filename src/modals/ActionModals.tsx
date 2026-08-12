import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import type {
  CallResult,
  CommChannel,
  CommDirection,
  Customer,
  Equipment,
  EquipmentCondition,
  NoteType,
} from '../types';
import { useApp } from '../context/AppContext';
import { todayIso, actorName } from '../utils';

const modalProps = { radius: 'lg' as const, centered: true, className: 'app-modal', size: 'lg' as const };

export function LogCallModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { logCall } = useApp();
  const [direction, setDirection] = useState<CommDirection>('Outgoing');
  const [callResult, setCallResult] = useState<CallResult>('Customer answered');
  const [notes, setNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setDirection('Outgoing');
      setCallResult('Customer answered');
      setNotes('');
      setFollowUpRequired(false);
      setFollowUpDate(todayIso());
    }
  }, [opened]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Log phone call" {...modalProps}>
      <Stack>
        <Select label="Call direction" data={['Incoming', 'Outgoing']} value={direction} onChange={(v) => setDirection((v || 'Outgoing') as CommDirection)} />
        <Select
          label="Call result"
          data={[
            'No answer',
            'Customer answered',
            'Promised payment',
            'Disputed balance',
            'Requested callback',
            'Cancelled service',
            'Wrong number',
            'Other',
          ]}
          value={callResult}
          onChange={(v) => setCallResult((v || 'Other') as CallResult)}
        />
        <Textarea label="Notes" minRows={4} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Checkbox label="Follow-up required?" checked={followUpRequired} onChange={(e) => setFollowUpRequired(e.currentTarget.checked)} />
        {followUpRequired && (
          <TextInput label="Follow-up date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.currentTarget.value)} />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              logCall({ customerId: customer.id, direction, callResult, notes, followUpRequired, followUpDate });
              setSaving(false);
              onClose();
            }}
          >
            Save Call Log
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function AddNoteModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { addNote } = useApp();
  const [note, setNote] = useState('');
  const [type, setType] = useState<NoteType>('General');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setNote('');
      setType('General');
      setPinned(false);
    }
  }, [opened]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Add note" {...modalProps}>
      <Stack>
        <Select
          label="Note type"
          data={['General', 'Collection', 'Billing', 'Technical', 'Recovery', 'Dispute']}
          value={type}
          onChange={(v) => setType((v || 'General') as NoteType)}
        />
        <Textarea label="Note" required minRows={5} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Checkbox label="Pin note" checked={pinned} onChange={(e) => setPinned(e.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!note.trim()}
            onClick={() => {
              setSaving(true);
              addNote({ customerId: customer.id, note, type, pinned });
              setSaving(false);
              onClose();
            }}
          >
            Save Note
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ScheduleFollowUpModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { scheduleFollowUp } = useApp();
  const [followUpDate, setFollowUpDate] = useState(todayIso());
  const [followUpTime, setFollowUpTime] = useState('09:00');
  const [channel, setChannel] = useState<CommChannel | 'Any'>('WhatsApp');
  const [assignedUser, setAssignedUser] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && customer) {
      setFollowUpDate(customer.nextFollowUp || todayIso());
      setFollowUpTime('09:00');
      setChannel('WhatsApp');
      setAssignedUser(customer.assignedCollector || actorName());
      setNotes('');
    }
  }, [opened, customer]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Schedule follow-up" {...modalProps}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Follow-up date" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.currentTarget.value)} />
          <TextInput label="Follow-up time" type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.currentTarget.value)} />
        </SimpleGrid>
        <Select
          label="Channel"
          data={['WhatsApp', 'Email', 'Phone', 'Any']}
          value={channel}
          onChange={(v) => setChannel((v || 'Any') as CommChannel | 'Any')}
        />
        <TextInput label="Assigned user" value={assignedUser} onChange={(e) => setAssignedUser(e.currentTarget.value)} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              scheduleFollowUp({ customerId: customer.id, followUpDate, followUpTime, channel, assignedUser, notes });
              setSaving(false);
              onClose();
            }}
          >
            Schedule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function CancelServiceModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { cancelService } = useApp();
  const [cancellationDate, setCancellationDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [customerRequested, setCustomerRequested] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && customer) {
      setCancellationDate(todayIso());
      setReason('');
      setCustomerRequested(false);
      setRecoveryRequired(true);
      setNotes('');
    }
  }, [opened, customer]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Cancel service" {...modalProps}>
      <Stack>
        <Text size="sm" c="dimmed">
          Outstanding balance remains {customer.outstanding}. This action archives the service status — history is preserved.
        </Text>
        <TextInput label="Cancellation date" type="date" value={cancellationDate} onChange={(e) => setCancellationDate(e.currentTarget.value)} />
        <TextInput label="Cancellation reason" required value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Checkbox label="Customer requested cancellation?" checked={customerRequested} onChange={(e) => setCustomerRequested(e.currentTarget.checked)} />
        <TextInput label="Outstanding balance" value={String(customer.outstanding)} disabled />
        <Checkbox label="Equipment recovery required?" checked={recoveryRequired} onChange={(e) => setRecoveryRequired(e.currentTarget.checked)} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={saving}
            disabled={!reason.trim()}
            onClick={() => {
              setSaving(true);
              cancelService({
                customerId: customer.id,
                cancellationDate,
                reason,
                customerRequested,
                recoveryRequired,
                notes,
              });
              setSaving(false);
              onClose();
            }}
          >
            Confirm Cancellation
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function EquipmentFormModal({
  opened,
  onClose,
  customer,
  equipment,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
  equipment?: Equipment | null;
}) {
  const { addEquipment, updateEquipment } = useApp();
  const editing = !!equipment;
  const [draft, setDraft] = useState<Partial<Equipment>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && customer) {
      setDraft(
        equipment || {
          companyId: customer.companyId,
          customerId: customer.id,
          type: 'CPE / Antenna',
          ownership: 'Company owned',
          condition: 'Good',
          status: 'Installed',
          installationDate: todayIso(),
        },
      );
    }
  }, [opened, customer, equipment]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit equipment' : 'Add equipment'} {...modalProps}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Equipment type"
            data={['CPE / Antenna', 'Router', 'ONU/ONT', 'PoE injector', 'Power supply', 'Switch', 'Other']}
            value={draft.type || 'Other'}
            onChange={(v) => setDraft((d) => ({ ...d, type: (v || 'Other') as Equipment['type'] }))}
          />
          <TextInput label="Manufacturer" value={draft.manufacturer || ''} onChange={(e) => setDraft((d) => ({ ...d, manufacturer: e.currentTarget.value }))} />
          <TextInput label="Model" value={draft.model || ''} onChange={(e) => setDraft((d) => ({ ...d, model: e.currentTarget.value }))} />
          <TextInput label="Serial number" value={draft.serialNumber || ''} onChange={(e) => setDraft((d) => ({ ...d, serialNumber: e.currentTarget.value }))} />
          <TextInput label="MAC address" value={draft.macAddress || ''} onChange={(e) => setDraft((d) => ({ ...d, macAddress: e.currentTarget.value }))} />
          <TextInput label="Asset tag" value={draft.assetTag || ''} onChange={(e) => setDraft((d) => ({ ...d, assetTag: e.currentTarget.value }))} />
          <Select
            label="Ownership"
            data={['Company owned', 'Customer owned']}
            value={draft.ownership || 'Company owned'}
            onChange={(v) => setDraft((d) => ({ ...d, ownership: (v || 'Company owned') as Equipment['ownership'] }))}
          />
          <TextInput label="Installation date" type="date" value={draft.installationDate || ''} onChange={(e) => setDraft((d) => ({ ...d, installationDate: e.currentTarget.value }))} />
          <Select
            label="Condition"
            data={['Good', 'Needs testing', 'Damaged', 'Scrap', 'Unknown']}
            value={draft.condition || 'Good'}
            onChange={(v) => setDraft((d) => ({ ...d, condition: (v || 'Good') as EquipmentCondition }))}
          />
        </SimpleGrid>
        <Textarea label="Notes" value={draft.notes || ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.currentTarget.value }))} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              if (editing && equipment) updateEquipment({ ...equipment, ...draft } as Equipment);
              else
                addEquipment({
                  companyId: customer.companyId,
                  customerId: customer.id,
                  type: (draft.type || 'Other') as Equipment['type'],
                  manufacturer: draft.manufacturer,
                  model: draft.model,
                  serialNumber: draft.serialNumber,
                  macAddress: draft.macAddress,
                  assetTag: draft.assetTag,
                  ownership: (draft.ownership || 'Company owned') as Equipment['ownership'],
                  installationDate: draft.installationDate,
                  condition: (draft.condition || 'Good') as EquipmentCondition,
                  status: (draft.status || 'Installed') as Equipment['status'],
                  notes: draft.notes,
                });
              setSaving(false);
              onClose();
            }}
          >
            {editing ? 'Save Changes' : 'Add Equipment'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function CreateRecoveryJobModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { equipment, createRecoveryJob } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('Service cancelled / unpaid');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [technician, setTechnician] = useState('Unassigned');
  const [scheduledDate, setScheduledDate] = useState('');
  const [contactInstructions, setContactInstructions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const available = equipment.filter(
    (e) => e.customerId === customer?.id && e.ownership === 'Company owned' && e.status !== 'Recovered' && e.status !== 'Written Off',
  );

  useEffect(() => {
    if (opened && customer) {
      setSelected(available.map((e) => e.id));
      setReason('Service cancelled / unpaid');
      setPriority('Medium');
      setTechnician('Unassigned');
      setScheduledDate('');
      setContactInstructions('');
      setInternalNotes('');
    }
  }, [opened, customer?.id]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Create recovery job" {...modalProps}>
      <Stack>
        <Text size="sm" fw={600}>
          {customer.name} · {customer.accountNo}
        </Text>
        <Text size="xs" c="dimmed">
          Select company-owned equipment to recover
        </Text>
        {available.length === 0 ? (
          <Text size="sm" c="dimmed">
            No company-owned equipment on this account. A recovery job can still be created with the account equipment summary.
          </Text>
        ) : (
          available.map((e) => (
            <Checkbox
              key={e.id}
              label={`${e.type}${e.model ? ` · ${e.model}` : ''}${e.serialNumber ? ` · ${e.serialNumber}` : ''}`}
              checked={selected.includes(e.id)}
              onChange={(ev) =>
                setSelected((prev) => (ev.currentTarget.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id)))
              }
            />
          ))
        )}
        <TextInput label="Recovery reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Select label="Priority" data={['Low', 'Medium', 'High']} value={priority} onChange={(v) => setPriority((v || 'Medium') as 'Low' | 'Medium' | 'High')} />
        <TextInput label="Technician" value={technician} onChange={(e) => setTechnician(e.currentTarget.value)} />
        <TextInput label="Scheduled date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.currentTarget.value)} />
        <Textarea label="Customer contact instructions" value={contactInstructions} onChange={(e) => setContactInstructions(e.currentTarget.value)} />
        <Textarea label="Internal notes" value={internalNotes} onChange={(e) => setInternalNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              createRecoveryJob({
                customerId: customer.id,
                equipmentIds: selected,
                reason,
                priority,
                technician,
                scheduledDate: scheduledDate || undefined,
                contactInstructions,
                internalNotes,
              });
              setSaving(false);
              onClose();
            }}
          >
            Create Recovery Job
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function CompleteRecoveryModal({
  opened,
  onClose,
  jobId,
}: {
  opened: boolean;
  onClose: () => void;
  jobId: string | null;
}) {
  const { completeRecovery } = useApp();
  const [outcome, setOutcome] = useState('Recovered');
  const [condition, setCondition] = useState<EquipmentCondition>('Good');
  const [notes, setNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) {
      setOutcome('Recovered');
      setCondition('Good');
      setNotes('');
      setRescheduleDate('');
    }
  }, [opened]);

  if (!jobId) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Complete recovery" {...modalProps}>
      <Stack>
        <Select
          label="Outcome"
          data={[
            'Recovered',
            'Partially recovered',
            'Customer unavailable',
            'Equipment not found',
            'Equipment damaged',
            'Reschedule required',
            'Written off',
          ]}
          value={outcome}
          onChange={(v) => setOutcome(v || 'Recovered')}
        />
        {(outcome === 'Recovered' || outcome === 'Partially recovered') && (
          <Select
            label="Equipment condition"
            data={['Good', 'Needs testing', 'Damaged', 'Scrap']}
            value={condition}
            onChange={(v) => setCondition((v || 'Good') as EquipmentCondition)}
          />
        )}
        {outcome === 'Reschedule required' && (
          <TextInput label="Reschedule date" type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.currentTarget.value)} />
        )}
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              completeRecovery({ jobId, outcome, condition, notes, rescheduleDate: rescheduleDate || undefined });
              setSaving(false);
              onClose();
            }}
          >
            Save Outcome
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
