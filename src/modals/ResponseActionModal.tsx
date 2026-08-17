import { Badge, Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Communication, Customer } from '../types';
import { INTENT_BADGE_COLOR, INTENT_LABELS, INTENTS, money, safeDate, safeDateTime } from '../utils';

const intentOptions = Object.entries(INTENTS).map(([value, intent]) => ({
  value: intent,
  label: INTENT_LABELS[intent] || value,
}));

export function ResponseActionModal({
  opened,
  onClose,
  communication,
  customer,
  onCreatePromise,
  onVerifyPayment,
  onCreateDispute,
  onScheduleCallback,
  onCreateRecovery,
  onAddNote,
}: {
  opened: boolean;
  onClose: () => void;
  communication?: Communication | null;
  customer?: Customer | null;
  onCreatePromise?: () => void;
  onVerifyPayment?: () => void;
  onCreateDispute?: () => void;
  onScheduleCallback?: () => void;
  onCreateRecovery?: () => void;
  onAddNote?: () => void;
}) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const { classifiedResponses, overrideClassification, completeWorkTask, workTasks, company } = useApp();
  const [nextIntent, setNextIntent] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [changing, setChanging] = useState(false);

  const classified = useMemo(
    () =>
      classifiedResponses.find((item) => item.communicationId && item.communicationId === communication?.id) ||
      classifiedResponses.find((item) => item.customerId === customer?.id && item.rawMessage === communication?.message),
    [classifiedResponses, communication, customer],
  );

  if (!communication || !customer) return null;
  const intent = String(classified?.detectedIntent || communication.detectedIntent || '');
  const confidence = classified?.confidence != null ? Math.round(classified.confidence * 100) : null;
  const amount = classified?.detectedEntities?.amount as number | undefined;
  const date = classified?.detectedEntities?.date as string | undefined;

  function confirm() {
    const task = workTasks.find((item) => item.communicationId === communication?.id && item.status !== 'Completed');
    if (task) completeWorkTask(task.id, 'Completed');
    onClose();
  }

  function saveOverride() {
    if (!classified || !nextIntent || !reason.trim()) return;
    overrideClassification(classified.id, nextIntent, reason.trim());
    setChanging(false);
    setReason('');
    setNextIntent(null);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Customer response"
      centered
      radius="lg"
      className="app-modal"
      size="lg"
      fullScreen={Boolean(isMobile)}
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          {company.name} · {customer.name} · {customer.accountNo}
        </Text>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {communication.message}
        </Text>
        <Group gap="xs">
          <Badge variant="light">{communication.channel}</Badge>
          {intent ? (
            <Badge variant="light" color={INTENT_BADGE_COLOR[intent] || 'gray'}>
              {INTENT_LABELS[intent] || intent}
            </Badge>
          ) : null}
          {confidence != null ? (
            <Badge variant="outline" color={confidence >= 80 ? 'teal' : 'yellow'}>
              {confidence}%
            </Badge>
          ) : null}
        </Group>
        <Text size="xs" c="dimmed">
          {safeDateTime(communication.createdAt)}
          {date ? ` · Detected date ${safeDate(String(date))}` : ''}
          {amount != null ? ` · Detected amount ${money(amount)}` : ''}
        </Text>
        <Text size="sm">
          Current stage: {customer.collectionStage || customer.status}
        </Text>
        <Text size="sm">
          Recommended action: {customer.nextAction || 'Review customer response'}
          {customer.nextActionAssignee ? ` · ${customer.nextActionAssignee}` : ''}
        </Text>
        {classified?.needsReview ? (
          <Text size="xs" c="orange">
            Needs review before high-impact changes.
          </Text>
        ) : null}
        {classified?.dateRequired ? (
          <Text size="xs" c="orange">
            Promise date required — confirm with the customer before creating a promise.
          </Text>
        ) : null}

        {changing ? (
          <Stack gap="xs">
            <Select label="New classification" data={intentOptions} value={nextIntent} onChange={setNextIntent} searchable />
            <Textarea label="Reason for override" value={reason} onChange={(e) => setReason(e.currentTarget.value)} minRows={2} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setChanging(false)}>
                Cancel
              </Button>
              <Button onClick={saveOverride} disabled={!nextIntent || !reason.trim()}>
                Save classification
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group gap="xs" wrap="wrap">
            <Button size="xs" onClick={confirm}>
              Confirm
            </Button>
            <Button size="xs" variant="light" onClick={() => setChanging(true)} disabled={!classified}>
              Change classification
            </Button>
            <Button size="xs" variant="light" onClick={onCreatePromise}>
              Create promise
            </Button>
            <Button size="xs" variant="light" onClick={onVerifyPayment}>
              Verify payment
            </Button>
            <Button size="xs" variant="light" onClick={onCreateDispute}>
              Create dispute
            </Button>
            <Button size="xs" variant="light" onClick={onScheduleCallback}>
              Schedule callback
            </Button>
            <Button size="xs" variant="light" onClick={onCreateRecovery}>
              Create recovery
            </Button>
            <Button size="xs" variant="light" onClick={onAddNote}>
              Add note
            </Button>
            <Button size="xs" variant="default" onClick={onClose}>
              Close
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
