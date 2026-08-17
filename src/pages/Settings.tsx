import { useEffect, useState } from 'react';
import { Button, Card, Group, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { Building2, Check, Mail, Settings as SettingsIcon, Smartphone } from 'lucide-react';
import { PageHero } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { Company } from '../types';

export default function Settings() {
  const { company, updateCompany } = useApp();
  const [draft, setDraft] = useState<Company>(company);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(company);
  }, [company]);

  function save() {
    if (!draft.id) {
      return;
    }
    updateCompany(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
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
        title="Company settings"
        description="Each company can have its own contact details, WhatsApp sender override, follow-up cadence and recovery behaviour. Twilio and SMTP secrets stay in server `.env`."
      />

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Company profile</div>
          <Stack mt="lg">
            <TextInput
              label="Company name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
            />
            <TextInput
              label="Trading name"
              value={draft.tradingName || ''}
              onChange={(e) => setDraft({ ...draft, tradingName: e.currentTarget.value })}
            />
            <TextInput
              label="Short code"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.currentTarget.value })}
            />
            <TextInput
              label="Accounts email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.currentTarget.value })}
            />
            <TextInput
              label="Contact phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.currentTarget.value })}
            />
            <TextInput
              label="Primary contact"
              value={draft.primaryContact || ''}
              onChange={(e) => setDraft({ ...draft, primaryContact: e.currentTarget.value })}
            />
          </Stack>
        </Card>

        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Communication identity</div>
          <Stack mt="lg">
            <TextInput
              label="WhatsApp sender / business number"
              placeholder="whatsapp:+27… (optional override; default from Twilio .env)"
              value={draft.whatsappSender || draft.whatsappNumber || ''}
              onChange={(e) => setDraft({ ...draft, whatsappSender: e.currentTarget.value })}
              leftSection={<Smartphone size={14} />}
            />
            <TextInput
              label="Email sender"
              placeholder="collections@company.com"
              value={draft.emailSender || ''}
              onChange={(e) => setDraft({ ...draft, emailSender: e.currentTarget.value })}
              leftSection={<Mail size={14} />}
            />
            <Select
              label="WhatsApp provider"
              data={['Twilio']}
              value="Twilio"
              disabled
            />
            <Text size="xs" c="dimmed">
              Twilio credentials live in server `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`).
            </Text>
            <Select label="Default currency" data={['ZAR - South African Rand']} defaultValue="ZAR - South African Rand" />
          </Stack>
        </Card>

        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Follow-up & recovery</div>
          <Stack mt="lg">
            <TextInput
              label="Default follow-up interval (days)"
              type="number"
              value={String(draft.followUpIntervalDays ?? 3)}
              onChange={(e) => setDraft({ ...draft, followUpIntervalDays: Number(e.currentTarget.value) || 0 })}
            />
            <Select
              label="Default recovery behaviour"
              data={[
                'Create recovery job on cancellation',
                'Prompt operator first',
                'Do not auto-create recovery',
              ]}
              value={draft.defaultRecoveryBehaviour || 'Create recovery job on cancellation'}
              onChange={(v) => setDraft({ ...draft, defaultRecoveryBehaviour: v || undefined })}
              placeholder="Choose behaviour"
            />
            <Textarea
              label="Collection rules / notes"
              minRows={4}
              placeholder="Internal guidance for collectors working this portfolio…"
              value={draft.collectionRules || ''}
              onChange={(e) => setDraft({ ...draft, collectionRules: e.currentTarget.value })}
            />
          </Stack>
        </Card>

        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Payment details</div>
          <Stack mt="lg">
            <TextInput
              label="Bank name"
              value={draft.bankName || ''}
              onChange={(e) => setDraft({ ...draft, bankName: e.currentTarget.value })}
            />
            <TextInput
              label="Account name"
              value={draft.bankAccountName || ''}
              onChange={(e) => setDraft({ ...draft, bankAccountName: e.currentTarget.value })}
            />
            <TextInput
              label="Account number"
              value={draft.bankAccountNumber || ''}
              onChange={(e) => setDraft({ ...draft, bankAccountNumber: e.currentTarget.value })}
            />
            <TextInput
              label="Branch code"
              value={draft.bankBranchCode || ''}
              onChange={(e) => setDraft({ ...draft, bankBranchCode: e.currentTarget.value })}
            />
            <Textarea
              label="Payment instructions"
              minRows={3}
              placeholder="Use this account number as the payment reference…"
              value={draft.paymentInstructions || ''}
              onChange={(e) => setDraft({ ...draft, paymentInstructions: e.currentTarget.value })}
            />
          </Stack>
        </Card>

        <Card className="card" radius="lg" p="lg">
          <div className="card-title">Address</div>
          <Stack mt="lg">
            <TextInput
              label="Address line 1"
              value={draft.addressLine1 || ''}
              onChange={(e) => setDraft({ ...draft, addressLine1: e.currentTarget.value })}
            />
            <TextInput
              label="City"
              value={draft.city || ''}
              onChange={(e) => setDraft({ ...draft, city: e.currentTarget.value })}
            />
            <TextInput
              label="Province"
              value={draft.province || ''}
              onChange={(e) => setDraft({ ...draft, province: e.currentTarget.value })}
            />
            <TextInput
              label="Postal code"
              value={draft.postalCode || ''}
              onChange={(e) => setDraft({ ...draft, postalCode: e.currentTarget.value })}
            />
            <TextInput
              label="Country"
              value={draft.country || ''}
              onChange={(e) => setDraft({ ...draft, country: e.currentTarget.value })}
            />
          </Stack>
        </Card>
      </SimpleGrid>

      <Group mt="lg">
        <Button
          leftSection={saved ? <Check size={14} /> : <SettingsIcon size={14} />}
          color={saved ? 'green' : 'indigo'}
          disabled={!draft.id}
          onClick={save}
        >
          {saved ? 'Settings saved' : 'Save company settings'}
        </Button>
      </Group>
    </>
  );
}
