import { useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { Building2, Mail, MoreHorizontal, Plus } from 'lucide-react';
import { EmptyState, PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { MessageTemplate } from '../types';
import { uid } from '../utils';

export default function Templates() {
  const { company, companyTemplates, saveTemplate } = useApp();
  const [edit, setEdit] = useState<MessageTemplate | null>(null);

  function createNew() {
    setEdit({
      id: uid('t'),
      companyId: company.id,
      name: 'New reminder',
      channel: 'Email',
      stage: 'Payment Due',
      body: 'Hi {{name}},\n\nOur records show account {{account_no}} has an outstanding balance of {{amount}}, due {{due_date}}.\n\nKind regards,\n{{company}} Collections',
    });
  }

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Building2 size={13} />
            {company.name}
          </>
        }
        title="Message templates"
        description="Templates are company-specific, allowing different wording, branding and escalation policies for every client company you manage."
        actions={
          <Button leftSection={<Plus size={15} />} variant="light" onClick={createNew}>
            New template
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {companyTemplates.map((t) => (
          <div className="template-card" key={t.id}>
            <div className="template-head">
              <div>
                <div className="template-title">{t.name}</div>
                <Group gap={6} mt={5}>
                  <Badge size="xs" variant="light" color={t.channel === 'WhatsApp' ? 'green' : 'blue'}>
                    {t.channel}
                  </Badge>
                  <Text size="10px" c="dimmed">
                    {t.stage}
                  </Text>
                </Group>
              </div>
              <ActionIcon variant="subtle" color="gray" onClick={() => setEdit(t)} aria-label="Edit template">
                <MoreHorizontal size={16} />
              </ActionIcon>
            </div>
            <div className="template-text">{t.body}</div>
          </div>
        ))}
      </SimpleGrid>

      {companyTemplates.length === 0 && (
        <Card className="card" radius="lg" p="lg" mt="md">
          <EmptyState
            icon={Mail}
            title={`No templates yet for ${company.name}`}
            description="Create email templates for first reminders, follow-ups and promise reminders. WhatsApp templates can wait until Twilio is upgraded."
            action={
              <Button size="xs" leftSection={<Plus size={14} />} onClick={createNew}>
                New template
              </Button>
            }
          />
        </Card>
      )}

      <Modal
        opened={!!edit}
        onClose={() => setEdit(null)}
        title="Edit message template"
        radius="lg"
        centered
        className="app-modal"
      >
        {edit && (
          <Stack>
            <TextInput
              label="Template name"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.currentTarget.value })}
            />
            <Select
              label="Channel"
              value={edit.channel}
              data={['Email', 'WhatsApp']}
              onChange={(v) => setEdit({ ...edit, channel: (v || 'Email') as 'WhatsApp' | 'Email' })}
            />
            <TextInput
              label="Stage"
              value={edit.stage}
              onChange={(e) => setEdit({ ...edit, stage: e.currentTarget.value })}
            />
            <Textarea
              label="Message"
              minRows={6}
              value={edit.body}
              onChange={(e) => setEdit({ ...edit, body: e.currentTarget.value })}
            />
            <Text size="xs" c="dimmed">
              Variables: {'{{name}}'}, {'{{account_no}}'}, {'{{amount}}'}, {'{{due_date}}'}, {'{{company}}'}
            </Text>
            <Button
              onClick={() => {
                saveTemplate(edit);
                setEdit(null);
              }}
            >
              Save template
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  );
}
