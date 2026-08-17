import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import type { Communication, Company, CompanyStatus, Customer, Equipment, PreferredContact, AccountStatus } from '../types';
import { useApp } from '../context/AppContext';
import {
  collectionEmailSubject,
  fillTemplate,
  isPaidOrZeroBalance,
  money,
  replyEmailSubject,
  rfcMessageId,
  splitEmailThread,
  todayIso,
} from '../utils';

const modalProps = { radius: 'lg' as const, centered: true, className: 'app-modal', size: 'lg' as const };

export function CompanyFormModal({
  opened,
  onClose,
  company,
}: {
  opened: boolean;
  onClose: () => void;
  company?: Company | null;
}) {
  const { addCompany, updateCompany } = useApp();
  const editing = !!company;
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<Company>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (opened) {
      setDraft(
        company || {
          name: '',
          tradingName: '',
          code: '',
          email: '',
          phone: '',
          status: 'Active',
          country: 'South Africa',
          followUpIntervalDays: 3,
        },
      );
      setErrors({});
    }
  }, [opened, company]);

  function set<K extends keyof Company>(key: K, value: Company[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!draft.name?.trim()) next.name = 'Company name is required';
    if (!draft.email?.trim()) next.email = 'Primary contact email is required';
    if (!draft.phone?.trim()) next.phone = 'Primary contact phone is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Company = {
        id: editing && company?.id ? company.id : '',
        name: draft.name!.trim(),
        code: (draft.code || draft.name!.slice(0, 3)).toUpperCase(),
        email: draft.email || '',
        phone: draft.phone || '',
        tradingName: draft.tradingName,
        registrationNumber: draft.registrationNumber,
        vatNumber: draft.vatNumber,
        primaryContact: draft.primaryContact,
        primaryContactEmail: draft.primaryContactEmail || draft.email,
        primaryContactPhone: draft.primaryContactPhone || draft.phone,
        whatsappNumber: draft.whatsappNumber,
        alternativePhone: draft.alternativePhone,
        website: draft.website,
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
        city: draft.city,
        province: draft.province,
        postalCode: draft.postalCode,
        country: draft.country || 'South Africa',
        logoUrl: draft.logoUrl,
        accentColor: draft.accentColor,
        notes: draft.notes,
        status: (draft.status as CompanyStatus) || 'Active',
        whatsappSender: draft.whatsappSender || draft.whatsappNumber,
        emailSender: draft.emailSender || draft.email,
        followUpIntervalDays: draft.followUpIntervalDays || 3,
        defaultRecoveryBehaviour: draft.defaultRecoveryBehaviour,
        collectionRules: draft.collectionRules,
      };
      if (editing && company?.id) updateCompany({ ...company, ...payload, id: company.id });
      else addCompany(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit company' : 'Add company'} {...modalProps} size="xl">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Company name" required value={draft.name || ''} error={errors.name} onChange={(e) => set('name', e.currentTarget.value)} />
          <TextInput label="Trading name" value={draft.tradingName || ''} onChange={(e) => set('tradingName', e.currentTarget.value)} />
          <TextInput label="Company registration number" value={draft.registrationNumber || ''} onChange={(e) => set('registrationNumber', e.currentTarget.value)} />
          <TextInput label="VAT / Tax number" value={draft.vatNumber || ''} onChange={(e) => set('vatNumber', e.currentTarget.value)} />
          <TextInput label="Primary contact person" value={draft.primaryContact || ''} onChange={(e) => set('primaryContact', e.currentTarget.value)} />
          <TextInput label="Primary contact email" required value={draft.email || ''} error={errors.email} onChange={(e) => set('email', e.currentTarget.value)} />
          <TextInput label="Primary contact phone" required value={draft.phone || ''} error={errors.phone} onChange={(e) => set('phone', e.currentTarget.value)} />
          <TextInput label="WhatsApp number" value={draft.whatsappNumber || ''} onChange={(e) => set('whatsappNumber', e.currentTarget.value)} />
          <TextInput label="Alternative phone" value={draft.alternativePhone || ''} onChange={(e) => set('alternativePhone', e.currentTarget.value)} />
          <TextInput label="Website" value={draft.website || ''} onChange={(e) => set('website', e.currentTarget.value)} />
          <TextInput label="Short code" value={draft.code || ''} onChange={(e) => set('code', e.currentTarget.value)} />
          <Select label="Status" data={['Active', 'Inactive']} value={draft.status || 'Active'} onChange={(v) => set('status', (v || 'Active') as CompanyStatus)} />
          <TextInput label="Address line 1" value={draft.addressLine1 || ''} onChange={(e) => set('addressLine1', e.currentTarget.value)} />
          <TextInput label="Address line 2" value={draft.addressLine2 || ''} onChange={(e) => set('addressLine2', e.currentTarget.value)} />
          <TextInput label="City" value={draft.city || ''} onChange={(e) => set('city', e.currentTarget.value)} />
          <TextInput label="Province / State" value={draft.province || ''} onChange={(e) => set('province', e.currentTarget.value)} />
          <TextInput label="Postal code" value={draft.postalCode || ''} onChange={(e) => set('postalCode', e.currentTarget.value)} />
          <TextInput label="Country" value={draft.country || ''} onChange={(e) => set('country', e.currentTarget.value)} />
          <TextInput label="Company colour / accent" placeholder="#6c63ff" value={draft.accentColor || ''} onChange={(e) => set('accentColor', e.currentTarget.value)} />
          <TextInput label="Logo URL" placeholder="https://..." value={draft.logoUrl || ''} onChange={(e) => set('logoUrl', e.currentTarget.value)} />
        </SimpleGrid>
        <Textarea label="Notes" minRows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.currentTarget.value)} />
        <div className="modal-sticky-actions">
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? 'Save Changes' : 'Save Company'}
            </Button>
          </Group>
        </div>
      </Stack>
    </Modal>
  );
}

export function CustomerFormModal({
  opened,
  onClose,
  customer,
  companyId,
}: {
  opened: boolean;
  onClose: () => void;
  customer?: Customer | null;
  companyId: string;
}) {
  const { addCustomer, updateCustomer } = useApp();
  const editing = !!customer;
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<Customer>>({});
  const [eqType, setEqType] = useState<string | null>(null);
  const [eqModel, setEqModel] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (opened) {
      setDraft(
        customer || {
          companyId,
          accountNo: '',
          name: '',
          phone: '',
          email: '',
          outstanding: 0,
          dueDate: todayIso(),
          status: 'Payment Due',
          preferredContact: 'WhatsApp',
          language: 'English',
        },
      );
      setEqType(null);
      setEqModel('');
      setErrors({});
    }
  }, [opened, customer, companyId]);

  function set<K extends keyof Customer>(key: K, value: Customer[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'firstName' || key === 'lastName') {
        const first = key === 'firstName' ? String(value || '') : d.firstName || '';
        const last = key === 'lastName' ? String(value || '') : d.lastName || '';
        if (!editing || !d.name) next.name = [first, last].filter(Boolean).join(' ');
      }
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!draft.accountNo?.trim()) next.accountNo = 'Account number is required';
    if (!draft.name?.trim() && !draft.firstName?.trim()) next.name = 'Customer name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const name = draft.name?.trim() || [draft.firstName, draft.lastName].filter(Boolean).join(' ');
      if (editing && customer) {
        const changes: string[] = [];
        if (customer.outstanding !== Number(draft.outstanding || 0)) {
          changes.push(`Outstanding balance updated from R${customer.outstanding} to R${Number(draft.outstanding || 0)}.`);
        }
        if (customer.phone !== (draft.phone || '')) changes.push('Mobile number updated.');
        if (customer.email !== (draft.email || '')) changes.push('Email updated.');
        updateCustomer(
          {
            ...customer,
            ...draft,
            name,
            outstanding: Number(draft.outstanding || 0),
            monthlySubscription: draft.monthlySubscription ? Number(draft.monthlySubscription) : undefined,
            originalOutstanding: draft.originalOutstanding ? Number(draft.originalOutstanding) : customer.originalOutstanding,
          } as Customer,
          changes,
        );
      } else {
        const equipmentItems =
          eqType
            ? [
                {
                  type: eqType as Equipment['type'],
                  model: eqModel,
                  ownership: 'Company owned' as const,
                  condition: 'Good' as const,
                  status: 'Installed' as const,
                },
              ]
            : undefined;
        addCustomer(
          {
            ...draft,
            companyId,
            accountNo: draft.accountNo!,
            name,
            outstanding: Number(draft.outstanding || 0),
            monthlySubscription: draft.monthlySubscription ? Number(draft.monthlySubscription) : undefined,
            originalOutstanding: draft.originalOutstanding
              ? Number(draft.originalOutstanding)
              : Number(draft.outstanding || 0),
          },
          equipmentItems,
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Edit customer' : 'Add customer'} {...modalProps} size="xl">
      <Stack gap="md">
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          Basic
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="First name" value={draft.firstName || ''} onChange={(e) => set('firstName', e.currentTarget.value)} />
          <TextInput label="Last name" value={draft.lastName || ''} onChange={(e) => set('lastName', e.currentTarget.value)} />
          <TextInput label="Customer / company name" required value={draft.name || ''} error={errors.name} onChange={(e) => set('name', e.currentTarget.value)} />
          <TextInput label="Account number" required value={draft.accountNo || ''} error={errors.accountNo} onChange={(e) => set('accountNo', e.currentTarget.value)} />
          <TextInput label="Customer reference" value={draft.customerReference || ''} onChange={(e) => set('customerReference', e.currentTarget.value)} />
          <Select
            label="Status"
            data={['Payment Due', 'Follow-up', 'Promise to Pay', 'Paid', 'Unresponsive', 'Cancelled', 'Recovery Required']}
            value={draft.status || 'Payment Due'}
            onChange={(v) => set('status', (v || 'Payment Due') as AccountStatus)}
          />
        </SimpleGrid>

        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          Contact
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Mobile number" value={draft.phone || ''} onChange={(e) => set('phone', e.currentTarget.value)} />
          <TextInput label="WhatsApp number" value={draft.whatsapp || ''} onChange={(e) => set('whatsapp', e.currentTarget.value)} />
          <TextInput label="Alternative phone" value={draft.alternativePhone || ''} onChange={(e) => set('alternativePhone', e.currentTarget.value)} />
          <TextInput label="Email" value={draft.email || ''} onChange={(e) => set('email', e.currentTarget.value)} />
          <Select
            label="Preferred contact method"
            data={[
              ...new Set(
                ['WhatsApp', 'Phone', 'Email', draft.preferredContact].filter(Boolean) as string[],
              ),
            ]}
            value={draft.preferredContact || null}
            searchable
            clearable
            onChange={(v) => set('preferredContact', (v || '') as PreferredContact)}
          />
          <TextInput label="Language" value={draft.language || ''} onChange={(e) => set('language', e.currentTarget.value)} />
          <TextInput label="Assigned collector" value={draft.assignedCollector || ''} onChange={(e) => set('assignedCollector', e.currentTarget.value)} />
        </SimpleGrid>

        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          Billing
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Outstanding balance" type="number" value={String(draft.outstanding ?? '')} onChange={(e) => set('outstanding', Number(e.currentTarget.value))} />
          <TextInput label="Original outstanding" type="number" value={String(draft.originalOutstanding ?? '')} onChange={(e) => set('originalOutstanding', Number(e.currentTarget.value))} />
          <TextInput label="Due date" type="date" value={draft.dueDate || ''} onChange={(e) => set('dueDate', e.currentTarget.value)} />
          <TextInput label="Service / package" value={draft.servicePackage || ''} onChange={(e) => set('servicePackage', e.currentTarget.value)} />
          <TextInput label="Monthly subscription" type="number" value={String(draft.monthlySubscription ?? '')} onChange={(e) => set('monthlySubscription', Number(e.currentTarget.value))} />
          <TextInput label="Billing notes" value={draft.billingNotes || ''} onChange={(e) => set('billingNotes', e.currentTarget.value)} />
        </SimpleGrid>

        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          Location
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Installation address" value={draft.address || ''} onChange={(e) => set('address', e.currentTarget.value)} />
          <TextInput label="Suburb" value={draft.suburb || ''} onChange={(e) => set('suburb', e.currentTarget.value)} />
          <TextInput label="City" value={draft.city || ''} onChange={(e) => set('city', e.currentTarget.value)} />
          <TextInput label="Province" value={draft.province || ''} onChange={(e) => set('province', e.currentTarget.value)} />
          <TextInput label="Postal code" value={draft.postalCode || ''} onChange={(e) => set('postalCode', e.currentTarget.value)} />
          <TextInput label="GPS latitude" type="number" value={draft.latitude != null ? String(draft.latitude) : ''} onChange={(e) => set('latitude', Number(e.currentTarget.value))} />
          <TextInput label="GPS longitude" type="number" value={draft.longitude != null ? String(draft.longitude) : ''} onChange={(e) => set('longitude', Number(e.currentTarget.value))} />
        </SimpleGrid>
        <Textarea label="Customer notes" minRows={3} value={draft.notes || ''} onChange={(e) => set('notes', e.currentTarget.value)} />

        {!editing && (
          <>
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Optional equipment
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Equipment type"
                clearable
                data={['CPE / Antenna', 'Router', 'ONU/ONT', 'PoE injector', 'Power supply', 'Switch', 'Other']}
                value={eqType}
                onChange={setEqType}
              />
              <TextInput label="Model" value={eqModel} onChange={(e) => setEqModel(e.currentTarget.value)} />
            </SimpleGrid>
          </>
        )}

        <div className="modal-sticky-actions">
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? 'Save Changes' : 'Save Customer'}
            </Button>
          </Group>
        </div>
      </Stack>
    </Modal>
  );
}

export function MarkPaidModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { recordPayment } = useApp();
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [clearAccount, setClearAccount] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && customer) {
      setAmount(customer.outstanding);
      setPaymentDate(todayIso());
      setReference('');
      setNotes('');
      setClearAccount(true);
    }
  }, [opened, customer]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Record payment" {...modalProps}>
      <Stack>
        <Text size="sm" c="dimmed">
          Current outstanding: <strong>{money(customer.outstanding)}</strong>
        </Text>
        <TextInput label="Payment amount" type="number" value={String(amount)} onChange={(e) => setAmount(Number(e.currentTarget.value))} />
        <TextInput label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.currentTarget.value)} />
        <TextInput label="Reference" value={reference} onChange={(e) => setReference(e.currentTarget.value)} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Checkbox label="Mark account as fully cleared" checked={clearAccount} onChange={(e) => setClearAccount(e.currentTarget.checked)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              recordPayment({ customerId: customer.id, amount, paymentDate, reference, notes, clearAccount });
              setSaving(false);
              onClose();
            }}
          >
            Record Payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function PromiseToPayModal({
  opened,
  onClose,
  customer,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { createPromise } = useApp();
  const [amount, setAmount] = useState(0);
  const [promiseDate, setPromiseDate] = useState(todayIso());
  const [customerComment, setCustomerComment] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened && customer) {
      setAmount(customer.outstanding);
      setPromiseDate(todayIso());
      setCustomerComment('');
      setInternalNote('');
    }
  }, [opened, customer]);

  if (!customer) return null;

  return (
    <Modal opened={opened} onClose={onClose} title="Promise to pay" {...modalProps}>
      <Stack>
        <TextInput label="Promise amount" type="number" value={String(amount)} onChange={(e) => setAmount(Number(e.currentTarget.value))} />
        <TextInput label="Promise date" type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.currentTarget.value)} />
        <Textarea label="Customer comment" value={customerComment} onChange={(e) => setCustomerComment(e.currentTarget.value)} />
        <Textarea label="Internal note" value={internalNote} onChange={(e) => setInternalNote(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              setSaving(true);
              createPromise({ customerId: customer.id, amount, promiseDate, customerComment, internalNote });
              setSaving(false);
              onClose();
            }}
          >
            Save Promise
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SendMessageModal({
  opened,
  onClose,
  customer,
  defaultChannel,
  replyTo,
}: {
  opened: boolean;
  onClose: () => void;
  customer: Customer | null;
  defaultChannel?: 'WhatsApp' | 'Email';
  replyTo?: Communication | null;
}) {
  const { companyTemplates, getCompany, sendMessage } = useApp();
  const [channel, setChannel] = useState<'WhatsApp' | 'Email'>('Email');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const isReply = Boolean(replyTo);

  const company = customer ? getCompany(customer.companyId) : undefined;
  const templates = useMemo(
    () => companyTemplates.filter((t) => t.companyId === customer?.companyId && t.channel === channel),
    [companyTemplates, customer, channel],
  );
  const selected = templates.find((t) => t.id === templateId) || templates[0];

  useEffect(() => {
    if (!opened || !customer) return;
    if (replyTo) {
      setChannel('Email');
      setCustom(true);
      setSubject(replyEmailSubject(replyTo.subject));
      setMessage('');
      setTemplateId(null);
      return;
    }
    const hasEmail = Boolean(customer.email?.includes('@'));
    setChannel(defaultChannel || (hasEmail ? 'Email' : 'WhatsApp'));
    setCustom(false);
    setSubject(collectionEmailSubject(customer.accountNo, getCompany(customer.companyId)?.name));
    setTemplateId(null);
  }, [opened, customer, defaultChannel, replyTo]);

  useEffect(() => {
    if (!customer || custom || isReply) return;
    const body = selected?.body || '';
    setMessage(
      fillTemplate(body, {
        customer_name: customer.name,
        name: customer.name,
        account_number: customer.accountNo,
        account_no: customer.accountNo,
        outstanding_amount: money(customer.outstanding),
        amount: money(customer.outstanding),
        due_date: customer.dueDate,
        company_name: company?.name,
        company: company?.name,
        promise_date: customer.promisedDate,
      }),
    );
  }, [selected, customer, company, custom, isReply]);

  if (!customer) return null;

  const canSendEmail = Boolean(customer.email?.includes('@'));
  const canSendWhatsApp = Boolean((customer.whatsapp || customer.phone || '').trim());
  const paidOrZero = isPaidOrZeroBalance(customer) && !isReply;
  const threadId = rfcMessageId(replyTo?.messageId || replyTo?.externalId);

  return (
    <Modal opened={opened} onClose={onClose} title={isReply ? 'Reply to email' : 'Send message'} {...modalProps}>
      <Stack>
        {!isReply && (
          <>
            <Select
              label="Channel"
              data={['Email', 'WhatsApp']}
              value={channel}
              onChange={(v) => setChannel((v || 'Email') as 'WhatsApp' | 'Email')}
            />
            {!custom && (
              <Select
                label="Template"
                data={templates.map((t) => ({ value: t.id, label: t.name }))}
                value={templateId || selected?.id || null}
                onChange={setTemplateId}
                placeholder={templates.length ? 'Select template' : 'No templates for this channel'}
              />
            )}
            <Checkbox label="Use custom message" checked={custom} onChange={(e) => setCustom(e.currentTarget.checked)} />
          </>
        )}
        {paidOrZero && (
          <Alert color="yellow" title="No balance due">
            Account {customer.accountNo} is paid (R 0). Collection emails are blocked — sending “outstanding
            balance R 0” is a common spam trigger and can cause Gmail replies to bounce with 550.
          </Alert>
        )}
        {channel === 'Email' && (
          <>
            <TextInput label="To" value={customer.email || ''} disabled />
            <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
          </>
        )}
        {channel === 'WhatsApp' && (
          <TextInput label="To" value={customer.whatsapp || customer.phone || ''} disabled />
        )}
        <Textarea
          label={isReply ? 'Reply' : 'Message preview'}
          minRows={isReply ? 5 : 7}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          placeholder={isReply ? 'Write your reply…' : undefined}
        />
        {isReply && replyTo && (
          <div className="email-quote">
            <Text size="10px" tt="uppercase" c="dimmed" fw={700} mb={4}>
              Previous message
            </Text>
            {replyTo.subject ? (
              <Text size="xs" fw={650} mb={4}>
                {replyTo.subject}
              </Text>
            ) : null}
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
              {splitEmailThread(replyTo.message).body || replyTo.message}
            </Text>
          </div>
        )}
        <Text size="xs" c="dimmed">
          {channel === 'Email'
            ? canSendEmail
              ? isReply
                ? 'This reply stays in the same email thread and is logged on the timeline.'
                : 'Email is the day-to-day collections channel. The customer can reply and it will show on this timeline.'
              : 'This customer has no email address — add one before sending.'
            : 'WhatsApp is trial-limited until Twilio is upgraded. Use Email for other customers.'}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={
              paidOrZero ||
              !message.trim() ||
              (channel === 'Email' && (!canSendEmail || !subject.trim())) ||
              (channel === 'WhatsApp' && !canSendWhatsApp)
            }
            onClick={async () => {
              setSaving(true);
              try {
                const result = await sendMessage({
                  customerId: customer.id,
                  channel,
                  message: message.trim(),
                  subject: channel === 'Email' ? subject : undefined,
                  isReply,
                  inReplyTo: threadId || undefined,
                  references: threadId || undefined,
                });
                if (result.ok) onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {isReply ? 'Send reply' : channel === 'Email' ? 'Send Email' : 'Send WhatsApp'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function BulkEmailModal({
  opened,
  onClose,
  customers,
}: {
  opened: boolean;
  onClose: () => void;
  customers: Customer[];
}) {
  const { companyTemplates, sendBulkEmails, company } = useApp();
  const templates = useMemo(
    () => companyTemplates.filter((t) => t.channel === 'Email'),
    [companyTemplates],
  );
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = templates.find((t) => t.id === templateId) || templates[0];
  const withEmail = customers.filter((c) => String(c.email || '').includes('@'));
  const collectable = withEmail.filter((c) => !isPaidOrZeroBalance(c));
  const withoutEmail = customers.length - withEmail.length;
  const skippedPaid = withEmail.length - collectable.length;
  const previewCustomer = collectable[0];
  const preview = previewCustomer
    ? fillTemplate(selected?.body || '', {
        name: previewCustomer.name,
        account_no: previewCustomer.accountNo,
        amount: money(previewCustomer.outstanding),
        due_date: previewCustomer.dueDate,
        company: company.name,
      })
    : '';

  useEffect(() => {
    if (!opened) return;
    setTemplateId(templates[0]?.id || null);
    setSubject(`${company.name} account reminder`);
  }, [opened, templates, company.name]);

  return (
    <Modal opened={opened} onClose={onClose} title="Email selected accounts" {...modalProps}>
      <Stack>
        <Text size="sm">
          {collectable.length} account{collectable.length === 1 ? '' : 's'} with email and a balance due
          {withoutEmail ? ` · ${withoutEmail} skipped (no email)` : ''}
          {skippedPaid ? ` · ${skippedPaid} skipped (paid / R 0)` : ''}
        </Text>
        <Select
          label="Template"
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={templateId || selected?.id || null}
          onChange={setTemplateId}
          placeholder={templates.length ? 'Select template' : 'No email templates'}
        />
        <TextInput label="Subject" value={subject} onChange={(e) => setSubject(e.currentTarget.value)} />
        <Textarea label="Preview (first recipient)" minRows={7} value={preview} readOnly />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!collectable.length || !subject.trim() || !selected}
            onClick={async () => {
              setSaving(true);
              await sendBulkEmails({
                customerIds: collectable.map((c) => c.id),
                subject,
                templateId: selected?.id,
              });
              setSaving(false);
              onClose();
            }}
          >
            Send {collectable.length} email{collectable.length === 1 ? '' : 's'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
