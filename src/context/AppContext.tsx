import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { notifyError, notifySuccess, notifyWarning } from '../lib/notify';
import { parseImportWorkbook } from '../lib/parseImportWorkbook';
import {
  initialActivities,
  initialCommunications,
  initialCompanies,
  initialCustomers,
  initialEquipment,
  initialFollowUps,
  initialImports,
  initialNotes,
  initialPayments,
  initialPromises,
  initialRecoveries,
  initialTemplates,
} from '../data/seed';
import type {
  AccountStatus,
  Activity,
  CollectionStage,
  CallResult,
  CommChannel,
  CommDirection,
  Communication,
  Company,
  Customer,
  Equipment,
  FollowUp,
  ImportBatch,
  MessageTemplate,
  PreferredContact,
  Note,
  NoteType,
  Payment,
  PaymentPromise,
  PromiseStatus,
  RecoveryJob,
  RecoveryStatus,
  Integration,
  AutomationRule,
} from '../types';
import {
  actorName,
  compareAccountNo,
  collectionEmailSubject,
  fillTemplate,
  findColumn,
  isPaidOrZeroBalance,
  money,
  normalize,
  nowIso,
  parsePromiseFromReply,
  parseSignedAmount,
  safeDate,
  splitEmailThread,
  todayIso,
  uid,
} from '../utils';
import { getStoredToken } from '../api/auth';
import { fetchAppData, saveAppData } from '../api/data';
import { useAuth } from './AuthContext';
import { normalizeAccountKey } from '../../shared/account-key.js';
import { sendMailViaApi, syncInboxViaApi } from '../api/mailer';
import { defaultEmailTemplates, isLegacyCollectionBody } from '../data/emailTemplates';
import { sendWhatsAppViaApi } from '../api/whatsapp';

type Mapping = Record<string, string>;

const APP_STORAGE_KEY = 'ch_app_data_v1';

type PersistedAppData = {
  companies: Company[];
  companyId: string;
  customers: Customer[];
  recoveries: RecoveryJob[];
  imports: ImportBatch[];
  templates: MessageTemplate[];
  equipment: Equipment[];
  promises: PaymentPromise[];
  payments: Payment[];
  communications: Communication[];
  notes: Note[];
  followUps: FollowUp[];
  activities: Activity[];
  integrations: Integration[];
  automationRules: AutomationRule[];
  importMappings?: Record<string, Mapping>;
  revision?: number;
};

function loadPersistedAppData(): PersistedAppData | null {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAppData;
    if (!parsed || !Array.isArray(parsed.companies)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const persisted = loadPersistedAppData();

const EMPTY_COMPANY: Company = {
  id: '',
  name: 'No company selected',
  code: '',
  email: '',
  phone: '',
  status: 'Active',
};

type AppContextValue = {
  companies: Company[];
  companyId: string;
  company: Company;
  showArchivedCompanies: boolean;
  setShowArchivedCompanies: (v: boolean) => void;
  switchCompany: (id: string | null) => void;
  activeCompanies: Company[];
  customers: Customer[];
  companyCustomers: Customer[];
  recoveries: RecoveryJob[];
  companyRecoveries: RecoveryJob[];
  imports: ImportBatch[];
  companyImports: ImportBatch[];
  templates: MessageTemplate[];
  companyTemplates: MessageTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<MessageTemplate[]>>;
  saveTemplate: (t: MessageTemplate) => void;
  equipment: Equipment[];
  promises: PaymentPromise[];
  payments: Payment[];
  communications: Communication[];
  notes: Note[];
  followUps: FollowUp[];
  activities: Activity[];
  integrations: Integration[];
  automationRules: AutomationRule[];
  saveIntegration: (item: Integration) => void;
  removeIntegration: (id: string) => void;
  saveAutomationRule: (item: AutomationRule) => void;
  removeAutomationRule: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string | null;
  setStatusFilter: (v: string | null) => void;
  filteredCustomers: Customer[];
  outstandingCustomers: Customer[];
  totalOutstanding: number;
  promiseCustomers: Customer[];
  recoveryNeeded: number;
  loading: boolean;
  // company CRUD
  addCompany: (c: Omit<Company, 'id'> & { id?: string }) => Company | null;
  updateCompany: (c: Company) => void;
  archiveCompany: (id: string) => void;
  // customer CRUD
  addCustomer: (c: Partial<Customer> & { companyId: string; accountNo: string; name: string }, equipmentItems?: Partial<Equipment>[]) => Customer | null;
  updateCustomer: (c: Customer, changes?: string[]) => void;
  archiveCustomer: (id: string) => void;
  deleteCustomers: (ids: string[]) => void;
  updateStatus: (customer: Customer, status: AccountStatus) => void;
  // operational
  recordPayment: (input: { customerId: string; amount: number; paymentDate: string; reference?: string; notes?: string; clearAccount: boolean }) => void;
  createPromise: (input: {
    customerId: string;
    amount: number;
    promiseDate: string;
    customerComment?: string;
    internalNote?: string;
    silent?: boolean;
  }) => void;
  updatePromiseStatus: (id: string, status: PromiseStatus, outcome?: string) => void;
  sendMessage: (input: {
    customerId: string;
    channel: 'WhatsApp' | 'Email';
    message: string;
    subject?: string;
    isReply?: boolean;
    inReplyTo?: string;
    references?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  sendBulkEmails: (input: {
    customerIds: string[];
    subject: string;
    templateId?: string;
  }) => Promise<{ sent: number; failed: number; skipped: number }>;
  syncInbox: (opts?: { quiet?: boolean }) => Promise<{ ok: boolean; imported?: number; error?: string }>;
  markCommunicationRead: (id: string) => void;
  logCall: (input: { customerId: string; direction: CommDirection; callResult: CallResult; notes: string; followUpRequired?: boolean; followUpDate?: string }) => void;
  addNote: (input: { customerId: string; note: string; type: NoteType; pinned?: boolean }) => void;
  deleteNote: (id: string) => void;
  scheduleFollowUp: (input: { customerId: string; followUpDate: string; followUpTime?: string; channel: CommChannel | 'Any'; assignedUser: string; notes?: string }) => void;
  cancelService: (input: { customerId: string; cancellationDate: string; reason: string; customerRequested: boolean; recoveryRequired: boolean; notes?: string }) => void;
  // equipment / recovery
  addEquipment: (item: Omit<Equipment, 'id'> & { id?: string }) => void;
  updateEquipment: (item: Equipment) => void;
  createRecoveryJob: (input: {
    customerId: string;
    equipmentIds: string[];
    reason: string;
    priority: 'Low' | 'Medium' | 'High';
    technician: string;
    scheduledDate?: string;
    contactInstructions?: string;
    internalNotes?: string;
  }) => void;
  updateRecovery: (job: RecoveryJob) => void;
  completeRecovery: (input: {
    jobId: string;
    outcome: string;
    condition?: Equipment['condition'];
    notes?: string;
    rescheduleDate?: string;
  }) => void;
  // import
  importRows: Record<string, unknown>[];
  importFile: string;
  mapping: Mapping;
  setMapping: React.Dispatch<React.SetStateAction<Mapping>>;
  importResult: string;
  handleFile: (file: File) => Promise<void>;
  commitImport: () => void;
  deleteImport: (id: string) => void;
  // helpers
  getCustomer: (id: string) => Customer | undefined;
  getCompany: (id: string) => Company | undefined;
  companyEquipment: (customerId?: string) => Equipment[];
  companyPromises: (customerId?: string) => PaymentPromise[];
  companyPayments: (customerId?: string) => Payment[];
  companyCommunications: (customerId?: string) => Communication[];
  companyNotes: (customerId?: string) => Note[];
  companyFollowUps: (customerId?: string) => FollowUp[];
  companyActivities: (customerId?: string) => Activity[];
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
  addActivity: (partial: Omit<Activity, 'id' | 'createdAt' | 'user'> & { user?: string; createdAt?: string }) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const WRITE_PERMISSIONS = [
  'customers.manage',
  'collections.manage',
  'companies.manage',
  'imports.manage',
  'communications.send',
  'recovery.manage',
  'templates.manage',
  'settings.manage',
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user, hasAnyPermission } = useAuth();
  const canWriteData =
    user?.role === 'admin' || WRITE_PERMISSIONS.some((key) => hasAnyPermission(key));
  const [companies, setCompanies] = useState<Company[]>(() => persisted?.companies ?? initialCompanies);
  const [companyId, setCompanyId] = useState(() => {
    const savedId = persisted?.companyId || '';
    const list = persisted?.companies ?? initialCompanies;
    if (savedId && list.some((c) => c.id === savedId)) return savedId;
    return list[0]?.id || '';
  });
  const [showArchivedCompanies, setShowArchivedCompanies] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>(() => persisted?.customers ?? initialCustomers);
  const [recoveries, setRecoveries] = useState<RecoveryJob[]>(() => persisted?.recoveries ?? initialRecoveries);
  const [imports, setImports] = useState<ImportBatch[]>(() => persisted?.imports ?? initialImports);
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => persisted?.templates ?? initialTemplates);
  const [equipment, setEquipment] = useState<Equipment[]>(() => persisted?.equipment ?? initialEquipment);
  const [promises, setPromises] = useState<PaymentPromise[]>(() => persisted?.promises ?? initialPromises);
  const [payments, setPayments] = useState<Payment[]>(() => persisted?.payments ?? initialPayments);
  const [communications, setCommunications] = useState<Communication[]>(
    () => persisted?.communications ?? initialCommunications,
  );
  const [notes, setNotes] = useState<Note[]>(() => persisted?.notes ?? initialNotes);
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => persisted?.followUps ?? initialFollowUps);
  const [activities, setActivities] = useState<Activity[]>(() => persisted?.activities ?? initialActivities);
  const [integrations, setIntegrations] = useState<Integration[]>(() => persisted?.integrations ?? []);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(() => persisted?.automationRules ?? []);
  const [importMappings, setImportMappings] = useState<Record<string, Mapping>>(
    () => persisted?.importMappings ?? {},
  );
  const [revision, setRevision] = useState(() => Number(persisted?.revision || 0));
  const revisionRef = useRef(Number(persisted?.revision || 0));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('All statuses');
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importFile, setImportFile] = useState('');
  const [mapping, setMapping] = useState<Mapping>({});
  const [importResult, setImportResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const skipServerSave = useRef(true);
  const emailPromiseHandled = useRef(new Set<string>());

  function applyPersistedData(data: PersistedAppData) {
    const list = Array.isArray(data.companies) ? data.companies : [];
    setCompanies(list);
    const preferred = data.companyId || '';
    setCompanyId(preferred && list.some((c) => c.id === preferred) ? preferred : list[0]?.id || '');
    setCustomers(Array.isArray(data.customers) ? data.customers : []);
    setRecoveries(Array.isArray(data.recoveries) ? data.recoveries : []);
    setImports(Array.isArray(data.imports) ? data.imports : []);
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
    setEquipment(Array.isArray(data.equipment) ? data.equipment : []);
    setPromises(Array.isArray(data.promises) ? data.promises : []);
    setPayments(Array.isArray(data.payments) ? data.payments : []);
    let comms = Array.isArray(data.communications) ? data.communications : [];
    try {
      if (!localStorage.getItem('ch_inbox_read_seed_v1')) {
        comms = comms.map((item) =>
          item.direction === 'Incoming' && !item.readAt ? { ...item, readAt: item.createdAt } : item,
        );
        localStorage.setItem('ch_inbox_read_seed_v1', '1');
      }
      if (!localStorage.getItem('ch_promise_email_seed_v1')) {
        comms = comms.map((item) =>
          item.direction === 'Incoming' && !item.handledAs ? { ...item, handledAs: 'none' } : item,
        );
        localStorage.setItem('ch_promise_email_seed_v1', '1');
      }
    } catch {
      // private mode
    }
    setCommunications(comms);
    setNotes(Array.isArray(data.notes) ? data.notes : []);
    setFollowUps(Array.isArray(data.followUps) ? data.followUps : []);
    setActivities(Array.isArray(data.activities) ? data.activities : []);
    setIntegrations(Array.isArray(data.integrations) ? data.integrations : []);
    setAutomationRules(Array.isArray(data.automationRules) ? data.automationRules : []);
    setImportMappings(data.importMappings && typeof data.importMappings === 'object' ? data.importMappings : {});
    const nextRevision = Number(data.revision || 0);
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
  }

  useEffect(() => {
    let cancelled = false;
    async function hydrateFromServer() {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
          skipServerSave.current = false;
        }
        return;
      }

      const remote = await fetchAppData();
      if (cancelled) return;

      if (remote.ok) {
        const remoteCompanies = Array.isArray(remote.data.companies) ? remote.data.companies.length : 0;
        const localCompanies = persisted?.companies?.length || 0;
        if (remoteCompanies > 0) {
          applyPersistedData(remote.data as PersistedAppData);
        } else if (localCompanies > 0 && persisted) {
          // First login on this server: publish this browser's data so other browsers can see it
          applyPersistedData(persisted);
          await saveAppData({ ...persisted, revision: Number(remote.data.revision || 0) });
        } else {
          applyPersistedData({
            companies: [],
            companyId: '',
            customers: [],
            recoveries: [],
            imports: [],
            templates: [],
            equipment: [],
            promises: [],
            payments: [],
            communications: [],
            notes: [],
            followUps: [],
            activities: [],
            integrations: [],
            automationRules: [],
            importMappings: {},
            revision: 0,
          });
        }
      }

      setLoading(false);
      setHydrated(true);
      skipServerSave.current = false;
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const payload: PersistedAppData = {
      companies,
      companyId,
      customers,
      recoveries,
      imports,
      templates,
      equipment,
      promises,
      payments,
      communications,
      notes,
      followUps,
      activities,
      integrations,
      automationRules,
      importMappings,
      revision: revisionRef.current,
    };
    try {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ ...payload, revision }));
    } catch {
      // Quota / private mode — keep working in-memory
    }

    if (!hydrated || skipServerSave.current || !getStoredToken() || !canWriteData) return;

    const timer = window.setTimeout(() => {
      void saveAppData(payload).then((result) => {
        if (result.ok) {
          if (typeof result.revision === 'number') {
            revisionRef.current = result.revision;
            setRevision(result.revision);
          }
          return;
        }
        if (result.stale && result.data) {
          skipServerSave.current = true;
          applyPersistedData(result.data as PersistedAppData);
          window.setTimeout(() => {
            skipServerSave.current = false;
          }, 2000);
          return;
        }
        console.warn('[data] server sync failed:', result.error);
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    companies,
    companyId,
    customers,
    recoveries,
    imports,
    templates,
    equipment,
    promises,
    payments,
    communications,
    notes,
    followUps,
    activities,
    integrations,
    automationRules,
    importMappings,
    hydrated,
    canWriteData,
  ]);

  useEffect(() => {
    if (!companyId && companies[0]?.id) {
      setCompanyId(companies[0].id);
      return;
    }
    if (companyId && companies.length > 0 && !companies.some((c) => c.id === companyId)) {
      setCompanyId(companies.find((c) => c.status !== 'Archived')?.id || companies[0].id);
    }
  }, [companies, companyId]);

  useEffect(() => {
    if (!hydrated || !companyId) return;
    setTemplates((prev) => {
      const defaults = defaultEmailTemplates(companyId);
      const byId = new Map(defaults.map((t) => [t.id, t]));
      const next = prev.map((t) => {
        const fresh = byId.get(t.id);
        if (fresh && isLegacyCollectionBody(t.body)) return { ...t, body: fresh.body };
        return t;
      });
      if (next.some((t) => t.companyId === companyId && t.channel === 'Email')) return next;
      return [...defaults, ...next];
    });
  }, [hydrated, companyId]);

  const toastSuccess = useCallback((message: string) => {
    notifySuccess(message);
  }, []);
  const toastError = useCallback((message: string) => {
    notifyError(message);
  }, []);

  const syncInbox = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const result = await syncInboxViaApi();
      if (!result.ok) {
        if (!opts?.quiet) toastError(result.error);
        return result;
      }

      const incoming = result.communications || [];
      if (!result.imported && !result.reassigned) {
        if (!opts?.quiet) toastSuccess('Inbox checked. No new customer replies.');
        return { ok: true as const, imported: 0 };
      }
      if (incoming.length) {
        setCommunications((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]));
          for (const item of incoming) {
            const previous = map.get(item.id);
            map.set(item.id, {
              ...(previous || {}),
              ...item,
              readAt: previous?.readAt || item.readAt,
              handledAs: previous?.handledAs || item.handledAs,
            } as Communication);
          }
          return [...map.values()].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        });
        if (result.activities?.length) {
          setActivities((prev) => {
            const map = new Map(prev.map((a) => [a.id, a]));
            for (const item of result.activities || []) {
              map.set(item.id, { ...(map.get(item.id) || {}), ...item });
            }
            return [...map.values()];
          });
        }
        if (result.customers?.length) {
          const patch = new Map(result.customers.map((c) => [c.id, c]));
          setCustomers((prev) =>
            prev.map((c) => {
              const next = patch.get(c.id);
              return next
                ? {
                    ...c,
                    lastContact: next.lastContact || c.lastContact,
                    collectionStage: (next.collectionStage as Customer['collectionStage']) || c.collectionStage,
                  }
                : c;
            }),
          );
        }
        if (!opts?.quiet && (result.imported || result.reassigned)) {
          toastSuccess(
            result.imported
              ? result.imported === 1
                ? 'Imported 1 email reply.'
                : `Imported ${result.imported} email replies.`
              : 'Placed a reply on the matching account.',
          );
        }
      } else if (!opts?.quiet) {
        toastSuccess('Inbox checked. No new customer replies.');
      }
      return { ok: true as const, imported: result.imported };
    },
    [toastError, toastSuccess],
  );

  useEffect(() => {
    if (!hydrated || !getStoredToken()) return undefined;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void syncInbox({ quiet: true });
    };
    tick();
    const timer = window.setInterval(tick, 20_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [hydrated, syncInbox]);

  function markCommunicationRead(id: string) {
    setCommunications((prev) =>
      prev.map((item) => (item.id === id && !item.readAt && item.direction === 'Incoming' ? { ...item, readAt: nowIso() } : item)),
    );
  }

  const addActivity = useCallback(
    (partial: Omit<Activity, 'id' | 'createdAt' | 'user'> & { user?: string; createdAt?: string }) => {
      setActivities((prev) => [
        {
          id: uid('act'),
          user: partial.user || actorName(),
          createdAt: partial.createdAt || nowIso(),
          companyId: partial.companyId,
          customerId: partial.customerId,
          action: partial.action,
          description: partial.description,
        },
        ...prev,
      ]);
    },
    [],
  );

  const activeCompanies = useMemo(
    () => companies.filter((c) => (showArchivedCompanies ? true : c.status !== 'Archived')),
    [companies, showArchivedCompanies],
  );

  const company = companies.find((c) => c.id === companyId) || companies[0] || EMPTY_COMPANY;
  const companyCustomers = useMemo(
    () => customers.filter((c) => c.companyId === companyId && !c.archived),
    [customers, companyId],
  );
  const companyRecoveries = useMemo(() => recoveries.filter((r) => r.companyId === companyId), [recoveries, companyId]);
  const companyImports = useMemo(() => imports.filter((i) => i.companyId === companyId), [imports, companyId]);
  const companyTemplates = useMemo(() => templates.filter((t) => t.companyId === companyId), [templates, companyId]);
  const outstandingCustomers = companyCustomers.filter((c) => c.outstanding > 0 && c.status !== 'Paid');
  const totalOutstanding = outstandingCustomers.reduce((s, c) => s + c.outstanding, 0);
  const promiseCustomers = companyCustomers.filter((c) => c.status === 'Promise to Pay');
  const recoveryNeeded = companyCustomers.filter((c) => c.status === 'Recovery Required').length;

  const filteredCustomers = useMemo(
    () =>
      companyCustomers
        .filter((c) => {
          const q = search.toLowerCase();
          const matches = !q || [c.name, c.accountNo, c.phone, c.email].some((v) => (v || '').toLowerCase().includes(q));
          const statusMatches = !statusFilter || statusFilter === 'All statuses' || c.status === statusFilter;
          return matches && statusMatches;
        })
        .slice()
        .sort((a, b) => compareAccountNo(a.accountNo, b.accountNo)),
    [companyCustomers, search, statusFilter],
  );

  function switchCompany(id: string | null) {
    if (!id) return;
    setCompanyId(id);
    setSearch('');
    setStatusFilter('All statuses');
    setImportRows([]);
    setImportFile('');
    setImportResult('');
    setMapping(importMappings[id] || {});
  }

  function addCompany(input: Omit<Company, 'id'> & { id?: string }) {
    if (!input.name.trim()) {
      toastError('Company name is required.');
      return null;
    }
    const created: Company = {
      ...input,
      id: input.id || uid('co'),
      code: (input.code || input.name.slice(0, 3)).toUpperCase(),
      status: input.status || 'Active',
      email: input.email || '',
      phone: input.phone || '',
    };
    setCompanies((prev) => [...prev, created]);
    setCompanyId(created.id);
    addActivity({ companyId: created.id, action: 'Company created', description: `${created.name} portfolio created.` });
    toastSuccess('Company saved successfully.');
    return created;
  }

  function updateCompany(updated: Company) {
    if (!updated.id) {
      toastError('No company selected to update. Add a company first.');
      return;
    }
    let found = false;
    setCompanies((prev) => {
      found = prev.some((c) => c.id === updated.id);
      if (!found) return prev;
      return prev.map((c) => (c.id === updated.id ? { ...c, ...updated, id: c.id } : c));
    });
    if (!found) {
      toastError('Company was not found — it may have been cleared. Please add it again.');
      return;
    }
    addActivity({ companyId: updated.id, action: 'Company updated', description: `${updated.name} details updated.` });
    toastSuccess('Company updated successfully.');
  }

  function archiveCompany(id: string) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'Archived' as const } : c)));
    const remaining = companies.filter((c) => c.id !== id && c.status !== 'Archived');
    if (companyId === id && remaining[0]) setCompanyId(remaining[0].id);
    addActivity({ companyId: id, action: 'Company archived', description: 'Company archived and hidden from the active switcher.' });
    toastSuccess('Company archived.');
  }

  function accountExists(companyIdValue: string, accountNo: string, excludeId?: string) {
    return customers.some(
      (c) =>
        c.companyId === companyIdValue &&
        c.accountNo.toLowerCase() === accountNo.toLowerCase() &&
        c.id !== excludeId &&
        !c.archived,
    );
  }

  function addCustomer(
    input: Partial<Customer> & { companyId: string; accountNo: string; name: string },
    equipmentItems?: Partial<Equipment>[],
  ) {
    if (!input.accountNo.trim() || !input.name.trim()) {
      toastError('Account number and customer name are required.');
      return null;
    }
    if (accountExists(input.companyId, input.accountNo)) {
      toastError('Account number already exists for this company.');
      return null;
    }
    const created: Customer = {
      id: uid('c'),
      companyId: input.companyId,
      accountNo: input.accountNo.trim(),
      name: input.name.trim(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || '',
      whatsapp: input.whatsapp,
      alternativePhone: input.alternativePhone,
      email: input.email || '',
      outstanding: input.outstanding || 0,
      originalOutstanding: input.originalOutstanding ?? input.outstanding ?? 0,
      dueDate: input.dueDate || todayIso(),
      status: input.status || (input.outstanding ? 'Payment Due' : 'Paid'),
      collectionStage: input.collectionStage || (input.outstanding ? 'New Overdue' : 'Closed'),
      lastContact: 'Not contacted',
      equipment: input.equipment,
      address: input.address,
      suburb: input.suburb,
      city: input.city,
      province: input.province,
      postalCode: input.postalCode,
      latitude: input.latitude,
      longitude: input.longitude,
      customerReference: input.customerReference,
      servicePackage: input.servicePackage,
      monthlySubscription: input.monthlySubscription,
      billingNotes: input.billingNotes,
      notes: input.notes,
      preferredContact: input.preferredContact,
      language: input.language,
      assignedCollector: input.assignedCollector || actorName(),
      nextFollowUp: input.nextFollowUp,
    };
    setCustomers((prev) => [created, ...prev]);
    if (equipmentItems?.length) {
      setEquipment((prev) => [
        ...equipmentItems.map((e) => ({
          id: uid('eq'),
          companyId: created.companyId,
          customerId: created.id,
          type: e.type || 'Other',
          manufacturer: e.manufacturer,
          model: e.model,
          serialNumber: e.serialNumber,
          macAddress: e.macAddress,
          assetTag: e.assetTag,
          ownership: e.ownership || 'Company owned',
          installationDate: e.installationDate,
          condition: e.condition || 'Good',
          status: e.status || 'Installed',
          notes: e.notes,
          recoveryRequired: e.recoveryRequired,
        })),
        ...prev,
      ]);
    }
    addActivity({
      companyId: created.companyId,
      customerId: created.id,
      action: 'Customer created',
      description: `Customer ${created.name} (${created.accountNo}) created.`,
    });
    toastSuccess('Customer created successfully.');
    return created;
  }

  function updateCustomer(updated: Customer, changes: string[] = []) {
    if (accountExists(updated.companyId, updated.accountNo, updated.id)) {
      toastError('Account number already exists for this company.');
      return;
    }
    const prev = customers.find((c) => c.id === updated.id);
    setCustomers((list) => list.map((c) => (c.id === updated.id ? updated : c)));
    const desc =
      changes.length > 0
        ? changes.join(' ')
        : prev && prev.outstanding !== updated.outstanding
          ? `Outstanding balance updated from ${money(prev.outstanding)} to ${money(updated.outstanding)}.`
          : `Customer ${updated.name} updated.`;
    addActivity({
      companyId: updated.companyId,
      customerId: updated.id,
      action: 'Customer edited',
      description: desc,
    });
    toastSuccess('Customer updated successfully.');
  }

  function archiveCustomer(id: string) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, archived: true, status: 'Cancelled' } : c)));
    addActivity({
      companyId: customer.companyId,
      customerId: id,
      action: 'Customer archived',
      description: `Customer ${customer.name} archived.`,
    });
    toastSuccess('Customer archived.');
  }

  function deleteCustomers(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const removing = new Set(unique);
    const targets = customers.filter((c) => removing.has(c.id));
    if (!targets.length) return;
    setCustomers((prev) => prev.filter((c) => !removing.has(c.id)));
    setPromises((prev) => prev.filter((p) => !removing.has(p.customerId)));
    setPayments((prev) => prev.filter((p) => !removing.has(p.customerId)));
    setCommunications((prev) => prev.filter((c) => !removing.has(c.customerId)));
    setNotes((prev) => prev.filter((n) => !removing.has(n.customerId)));
    setFollowUps((prev) => prev.filter((f) => !removing.has(f.customerId)));
    setEquipment((prev) => prev.filter((e) => !removing.has(e.customerId)));
    setRecoveries((prev) => prev.filter((r) => !removing.has(r.customerId)));
    addActivity({
      companyId: targets[0].companyId,
      action: 'Deleted outstanding accounts',
      description:
        unique.length === 1
          ? `Deleted account ${targets[0].name} (${targets[0].accountNo}).`
          : `Deleted ${unique.length} outstanding accounts.`,
    });
    toastSuccess(unique.length === 1 ? 'Account deleted.' : `${unique.length} accounts deleted.`);
  }

  function updateStatus(customer: Customer, status: AccountStatus) {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              status,
              collectionStage:
                status === 'Paid'
                  ? 'Paid'
                  : status === 'Promise to Pay'
                    ? 'Promise to Pay'
                    : status === 'Recovery Required'
                      ? 'Recovery Required'
                      : status === 'Cancelled'
                        ? 'Service Cancelled'
                        : status === 'Unresponsive'
                          ? 'Unresponsive'
                          : status === 'Follow-up'
                            ? 'Follow-up Due'
                            : 'New Overdue',
              lastContact: `Updated · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            }
          : c,
      ),
    );
    if (status === 'Recovery Required' && !recoveries.some((r) => r.customerId === customer.id && !['Recovered', 'Closed', 'Written Off'].includes(r.status))) {
      const eq = equipment.filter((e) => e.customerId === customer.id && e.ownership === 'Company owned');
      setRecoveries((prev) => [
        {
          id: `REC-${String(282 + prev.length).padStart(5, '0')}`,
          companyId: customer.companyId,
          customerId: customer.id,
          status: 'Awaiting assignment',
          equipment: customer.equipment || eq.map((e) => e.model || e.type).join(' + ') || 'CPE / antenna',
          equipmentIds: eq.map((e) => e.id),
          technician: 'Unassigned',
          reason: 'Recovery required',
          priority: 'Medium',
          attempts: 0,
        },
        ...prev,
      ]);
      setEquipment((prev) =>
        prev.map((e) =>
          e.customerId === customer.id && e.ownership === 'Company owned'
            ? { ...e, recoveryRequired: true, status: 'Awaiting recovery' }
            : e,
        ),
      );
    }
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Status updated',
      description: `Status changed to ${status}.`,
    });
  }

  function recordPayment(input: {
    customerId: string;
    amount: number;
    paymentDate: string;
    reference?: string;
    notes?: string;
    clearAccount: boolean;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    const payment: Payment = {
      id: uid('pay'),
      companyId: customer.companyId,
      customerId: customer.id,
      amount: input.amount,
      paymentDate: input.paymentDate,
      reference: input.reference,
      method: 'Manual',
      notes: input.notes,
      recordedBy: actorName(),
      clearedAccount: input.clearAccount,
      createdAt: nowIso(),
    };
    setPayments((prev) => [payment, ...prev]);
    const nextOutstanding = input.clearAccount ? 0 : Math.max(0, customer.outstanding - input.amount);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              outstanding: nextOutstanding,
              status: nextOutstanding === 0 || input.clearAccount ? 'Paid' : c.status,
              collectionStage: nextOutstanding === 0 || input.clearAccount ? 'Paid' : 'Payment Pending',
              lastContact: `Payment · ${safeDate(input.paymentDate)}`,
            }
          : c,
      ),
    );
    setPromises((prev) =>
      prev.map((p) =>
        p.customerId === customer.id && p.status === 'Pending'
          ? { ...p, status: 'Kept' as const, outcome: 'Payment recorded' }
          : p,
      ),
    );
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Payment recorded',
      description: `Payment of ${money(input.amount)} recorded${input.clearAccount ? '. Account marked as fully cleared.' : '.'}`,
    });
    setCommunications((prev) => [
      {
        id: uid('cm'),
        companyId: customer.companyId,
        customerId: customer.id,
        channel: 'Internal note',
        direction: 'Internal',
        message: `Payment of ${money(input.amount)} recorded${input.reference ? ` (ref ${input.reference})` : ''}.`,
        status: 'Logged',
        createdAt: nowIso(),
        createdBy: actorName(),
      },
      ...prev,
    ]);
    toastSuccess('Payment recorded successfully.');
  }

  function createPromise(input: {
    customerId: string;
    amount: number;
    promiseDate: string;
    customerComment?: string;
    internalNote?: string;
    silent?: boolean;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    const existing = promises.find((p) => p.customerId === customer.id && p.status === 'Pending');
    const promise: PaymentPromise = existing
      ? {
          ...existing,
          amount: input.amount,
          promiseDate: input.promiseDate,
          customerComment: input.customerComment || existing.customerComment,
          internalNote: input.internalNote || existing.internalNote,
        }
      : {
          id: uid('pr'),
          companyId: customer.companyId,
          customerId: customer.id,
          amount: input.amount,
          promiseDate: input.promiseDate,
          createdAt: nowIso(),
          status: 'Pending',
          customerComment: input.customerComment,
          internalNote: input.internalNote,
        };
    setPromises((prev) => (existing ? prev.map((p) => (p.id === existing.id ? promise : p)) : [promise, ...prev]));
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              status: 'Promise to Pay',
              collectionStage: 'Promise to Pay',
              promisedDate: input.promiseDate,
              promisedAmount: input.amount,
              nextFollowUp: input.promiseDate,
              lastContact: `Promise · ${safeDate(input.promiseDate)}`,
            }
          : c,
      ),
    );
    setFollowUps((prev) => {
      const current = prev.find((f) => f.customerId === customer.id && /follow up on promise/i.test(f.notes || ''));
      if (current) {
        return prev.map((f) =>
          f.id === current.id
            ? { ...f, followUpDate: input.promiseDate, notes: `Follow up on promise of ${money(input.amount)}` }
            : f,
        );
      }
      return [
        {
          id: uid('fu'),
          companyId: customer.companyId,
          customerId: customer.id,
          followUpDate: input.promiseDate,
          channel: 'Any',
          assignedUser: customer.assignedCollector || actorName(),
          notes: `Follow up on promise of ${money(input.amount)}`,
          createdAt: nowIso(),
        },
        ...prev,
      ];
    });
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: existing ? 'Promise updated' : 'Promise created',
      description: existing
        ? `Promise date updated to ${safeDate(input.promiseDate)} (${money(input.amount)}).`
        : `Promise to pay ${money(input.amount)} recorded for ${safeDate(input.promiseDate)}.`,
    });
    if (!input.silent) toastSuccess(existing ? 'Promise to pay updated.' : 'Promise to pay recorded.');
  }

  useEffect(() => {
    if (!hydrated) return;
    const pending = communications
      .filter(
        (item) =>
          item.channel === 'Email' &&
          item.direction === 'Incoming' &&
          (!item.handledAs || item.handledAs === 'none') &&
          !emailPromiseHandled.current.has(item.id),
      )
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    if (!pending.length) return;

    const marks = new Map<string, NonNullable<Communication['handledAs']>>();
    const queuedCustomers = new Set<string>();

    for (const comm of pending) {
      emailPromiseHandled.current.add(comm.id);
      const customer = customers.find((item) => item.id === comm.customerId);
      const body = splitEmailThread(comm.message).body || '';
      const parsed = parsePromiseFromReply(body);

      if (!parsed || !customer || isPaidOrZeroBalance(customer) || customer.status === 'Cancelled') {
        marks.set(comm.id, parsed ? 'skipped' : 'none');
        continue;
      }

      marks.set(comm.id, 'promise');
      if (queuedCustomers.has(customer.id)) continue;
      queuedCustomers.add(customer.id);

      createPromise({
        customerId: customer.id,
        amount: customer.outstanding,
        promiseDate: parsed.date,
        customerComment: body.slice(0, 500),
        internalNote: parsed.dateInferred
          ? `Auto from email ${comm.id} — no date given, used ${safeDate(parsed.date)}.`
          : `Auto from email ${comm.id}.`,
        silent: true,
      });
      notifySuccess(`${customer.name} marked Promise to Pay for ${safeDate(parsed.date)}.`, {
        title: 'Promise to Pay',
      });
    }

    setCommunications((prev) => prev.map((item) => (marks.has(item.id) ? { ...item, handledAs: marks.get(item.id) } : item)));
  }, [hydrated, communications, customers, promises]);

  function updatePromiseStatus(id: string, status: PromiseStatus, outcome?: string) {
    const promise = promises.find((p) => p.id === id);
    if (!promise) return;
    setPromises((prev) => prev.map((p) => (p.id === id ? { ...p, status, outcome } : p)));
    if (status === 'Broken') {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === promise.customerId
            ? { ...c, status: 'Follow-up', collectionStage: 'Follow-up Due', lastContact: 'Promise broken' }
            : c,
        ),
      );
      addActivity({
        companyId: promise.companyId,
        customerId: promise.customerId,
        action: 'Promise broken',
        description: `Promise of ${money(promise.amount)} marked as broken.`,
      });
    }
  }

  async function sendMessage(input: {
    customerId: string;
    channel: 'WhatsApp' | 'Email';
    message: string;
    subject?: string;
    isReply?: boolean;
    inReplyTo?: string;
    references?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return { ok: false, error: 'Customer not found.' };

    if (input.channel === 'WhatsApp') {
      const to = (customer.whatsapp || customer.phone || '').trim();
      if (!to) {
        toastError('This customer has no WhatsApp or mobile number.');
        return { ok: false, error: 'Customer WhatsApp number is missing.' };
      }

      const company = companies.find((c) => c.id === customer.companyId);
      const result = await sendWhatsAppViaApi({
        to,
        message: input.message,
        from: company?.whatsappSender || company?.whatsappNumber,
        customerName: customer.name,
        accountNo: customer.accountNo,
        dueDate: customer.dueDate,
        amount: money(customer.outstanding),
      });

      if (!result.ok) {
        setCommunications((prev) => [
          {
            id: uid('cm'),
            companyId: customer.companyId,
            customerId: customer.id,
            channel: 'WhatsApp',
            direction: 'Outgoing',
            message: input.message,
            status: 'Failed',
            createdAt: nowIso(),
            createdBy: actorName(),
          },
          ...prev,
        ]);
        addActivity({
          companyId: customer.companyId,
          customerId: customer.id,
          action: 'Message failed',
          description: `WhatsApp failed: ${result.error}`,
        });
        toastError(result.error);
        return { ok: false, error: result.error };
      }

      setCommunications((prev) => [
        {
          id: uid('cm'),
          companyId: customer.companyId,
          customerId: customer.id,
          channel: 'WhatsApp',
          direction: 'Outgoing',
          message: input.message,
          status: 'Sent',
          createdAt: nowIso(),
          createdBy: actorName(),
        },
        ...prev,
      ]);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id
            ? {
                ...c,
                lastContact: 'WhatsApp · sent',
                status: c.status === 'Payment Due' ? 'Follow-up' : c.status,
                collectionStage: c.collectionStage === 'New Overdue' ? 'Contacted' : c.collectionStage,
              }
            : c,
        ),
      );
      addActivity({
        companyId: customer.companyId,
        customerId: customer.id,
        action: 'Message sent',
        description: 'WhatsApp message sent via Twilio.',
      });
      toastSuccess('WhatsApp message sent.');
      return { ok: true };
    }

    const to = (customer.email || '').trim();
    if (!to || !to.includes('@')) {
      toastError('This customer has no valid email address.');
      return { ok: false, error: 'Customer email is missing.' };
    }

    if (!input.isReply && isPaidOrZeroBalance(customer)) {
      const error =
        'This account is paid (R 0). Collection emails are blocked so they are not flagged as spam.';
      toastError(error);
      return { ok: false, error };
    }

    const companyRow = companies.find((c) => c.id === customer.companyId);
    const result = await sendMailViaApi({
      to,
      subject: input.subject || collectionEmailSubject(customer.accountNo, companyRow?.name),
      text: input.message,
      customerName: customer.name,
      accountNo: customer.accountNo,
      inReplyTo: input.inReplyTo,
      references: input.references,
    });

    if (!result.ok) {
      setCommunications((prev) => [
        {
          id: uid('cm'),
          companyId: customer.companyId,
          customerId: customer.id,
          channel: 'Email',
          direction: 'Outgoing',
          subject: input.subject,
          message: input.message,
          status: 'Failed',
          createdAt: nowIso(),
          createdBy: actorName(),
        },
        ...prev,
      ]);
      addActivity({
        companyId: customer.companyId,
        customerId: customer.id,
        action: 'Message failed',
        description: `Email failed: ${result.error}`,
      });
      toastError(result.error);
      return { ok: false, error: result.error };
    }

    setCommunications((prev) => [
      {
        id: uid('cm'),
        companyId: customer.companyId,
        customerId: customer.id,
        channel: 'Email',
        direction: 'Outgoing',
        subject: input.subject,
        message: input.message,
        status: 'Sent',
        createdAt: nowIso(),
        createdBy: actorName(),
        messageId: result.messageId,
        externalId: result.messageId ? `smtp:${result.messageId}` : undefined,
      },
      ...prev,
    ]);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              lastContact: 'Email · sent',
              status: c.status === 'Payment Due' ? 'Follow-up' : c.status,
              collectionStage: c.collectionStage === 'New Overdue' ? 'Contacted' : c.collectionStage,
            }
          : c,
      ),
    );
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Message sent',
      description: 'Email message sent via SMTP.',
    });
    toastSuccess('Email sent successfully.');
    window.setTimeout(() => {
      void syncInbox({ quiet: true });
    }, 2000);
    return { ok: true };
  }

  async function sendBulkEmails(input: { customerIds: string[]; subject: string; templateId?: string }) {
    const template = templates.find((t) => t.id === input.templateId && t.channel === 'Email');
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const customerId of input.customerIds) {
      const customer = customers.find((c) => c.id === customerId);
      if (!customer || !String(customer.email || '').includes('@') || isPaidOrZeroBalance(customer)) {
        skipped += 1;
        continue;
      }
      const companyRow = companies.find((c) => c.id === customer.companyId);
      const body = fillTemplate(template?.body || '', {
        customer_name: customer.name,
        name: customer.name,
        account_number: customer.accountNo,
        account_no: customer.accountNo,
        outstanding_amount: money(customer.outstanding),
        amount: money(customer.outstanding),
        due_date: safeDate(customer.dueDate),
        company_name: companyRow?.name,
        company: companyRow?.name,
        promise_date: customer.promisedDate,
      });
      const result = await sendMessage({
        customerId: customer.id,
        channel: 'Email',
        message: body,
        subject: input.subject,
      });
      if (result.ok) sent += 1;
      else failed += 1;
    }

    if (sent) toastSuccess(`Emailed ${sent} account${sent === 1 ? '' : 's'}.`);
    if (failed) toastError(`${failed} email${failed === 1 ? '' : 's'} failed.`);
    if (skipped) {
      notifyWarning(`Skipped ${skipped} account${skipped === 1 ? '' : 's'} with no email, paid status, or R 0 balance.`, {
        title: 'Skipped',
      });
    }
    return { sent, failed, skipped };
  }

  function logCall(input: {
    customerId: string;
    direction: CommDirection;
    callResult: CallResult;
    notes: string;
    followUpRequired?: boolean;
    followUpDate?: string;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    setCommunications((prev) => [
      {
        id: uid('cm'),
        companyId: customer.companyId,
        customerId: customer.id,
        channel: 'Phone',
        direction: input.direction,
        message: input.notes || input.callResult,
        status: 'Logged',
        createdAt: nowIso(),
        createdBy: actorName(),
        callResult: input.callResult,
      },
      ...prev,
    ]);
    let nextStatus = customer.status;
    if (input.callResult === 'Promised payment') nextStatus = 'Promise to Pay';
    if (input.callResult === 'No answer' || input.callResult === 'Requested callback') nextStatus = 'Follow-up';
    if (input.callResult === 'Cancelled service') nextStatus = 'Cancelled';
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              status: nextStatus,
              lastContact: `Call · ${input.callResult}`,
              nextFollowUp: input.followUpRequired ? input.followUpDate || c.nextFollowUp : c.nextFollowUp,
              collectionStage: input.callResult === 'No answer' ? 'Unresponsive' : 'Contacted',
            }
          : c,
      ),
    );
    if (input.followUpRequired && input.followUpDate) {
      setFollowUps((prev) => [
        {
          id: uid('fu'),
          companyId: customer.companyId,
          customerId: customer.id,
          followUpDate: input.followUpDate!,
          channel: 'Phone',
          assignedUser: actorName(),
          notes: input.notes,
          createdAt: nowIso(),
        },
        ...prev,
      ]);
    }
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Call logged',
      description: `${input.direction} call logged — ${input.callResult}.`,
    });
    toastSuccess('Phone call logged.');
  }

  function addNote(input: { customerId: string; note: string; type: NoteType; pinned?: boolean }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    setNotes((prev) => [
      {
        id: uid('n'),
        companyId: customer.companyId,
        customerId: customer.id,
        note: input.note,
        type: input.type,
        pinned: !!input.pinned,
        createdAt: nowIso(),
        createdBy: actorName(),
      },
      ...prev,
    ]);
    setCommunications((prev) => [
      {
        id: uid('cm'),
        companyId: customer.companyId,
        customerId: customer.id,
        channel: 'Internal note',
        direction: 'Internal',
        message: input.note,
        status: 'Logged',
        createdAt: nowIso(),
        createdBy: actorName(),
      },
      ...prev,
    ]);
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Note added',
      description: `${input.type} note added.`,
    });
    toastSuccess('Note added.');
  }

  function deleteNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    addActivity({
      companyId: note.companyId,
      customerId: note.customerId,
      action: 'Note deleted',
      description: 'Internal note removed.',
    });
    toastSuccess('Note deleted.');
  }

  function scheduleFollowUp(input: {
    customerId: string;
    followUpDate: string;
    followUpTime?: string;
    channel: CommChannel | 'Any';
    assignedUser: string;
    notes?: string;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    setFollowUps((prev) => [
      {
        id: uid('fu'),
        companyId: customer.companyId,
        customerId: customer.id,
        followUpDate: input.followUpDate,
        followUpTime: input.followUpTime,
        channel: input.channel,
        assignedUser: input.assignedUser,
        notes: input.notes,
        createdAt: nowIso(),
      },
      ...prev,
    ]);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              nextFollowUp: input.followUpDate,
              assignedCollector: input.assignedUser,
              status: c.status === 'Payment Due' ? 'Follow-up' : c.status,
              collectionStage: 'Follow-up Due',
            }
          : c,
      ),
    );
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Follow-up scheduled',
      description: `Follow-up scheduled for ${safeDate(input.followUpDate)}.`,
    });
    toastSuccess('Follow-up scheduled.');
  }

  function cancelService(input: {
    customerId: string;
    cancellationDate: string;
    reason: string;
    customerRequested: boolean;
    recoveryRequired: boolean;
    notes?: string;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              status: input.recoveryRequired ? 'Recovery Required' : 'Cancelled',
              collectionStage: input.recoveryRequired ? 'Recovery Required' : 'Service Cancelled',
              cancelledAt: input.cancellationDate,
              cancellationReason: input.reason,
              lastContact: `Cancelled · ${safeDate(input.cancellationDate)}`,
            }
          : c,
      ),
    );
    if (input.recoveryRequired) {
      const eq = equipment.filter((e) => e.customerId === customer.id && e.ownership === 'Company owned');
      setRecoveries((prev) => [
        {
          id: `REC-${String(282 + prev.length).padStart(5, '0')}`,
          companyId: customer.companyId,
          customerId: customer.id,
          status: 'Awaiting assignment',
          equipment: customer.equipment || eq.map((e) => e.model || e.type).join(' + ') || 'Company equipment',
          equipmentIds: eq.map((e) => e.id),
          technician: 'Unassigned',
          reason: input.reason,
          priority: 'High',
          internalNotes: input.notes,
          attempts: 0,
        },
        ...prev,
      ]);
      setEquipment((prev) =>
        prev.map((e) =>
          e.customerId === customer.id && e.ownership === 'Company owned'
            ? { ...e, recoveryRequired: true, status: 'Awaiting recovery' }
            : e,
        ),
      );
    }
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Service cancelled',
      description: `Service cancelled (${input.reason})${input.recoveryRequired ? '. Recovery case created.' : '.'}`,
    });
    toastSuccess('Service cancellation recorded.');
  }

  function addEquipment(item: Omit<Equipment, 'id'> & { id?: string }) {
    const created: Equipment = { ...item, id: item.id || uid('eq') };
    setEquipment((prev) => [created, ...prev]);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === created.customerId
          ? {
              ...c,
              equipment: [c.equipment, created.model || created.type].filter(Boolean).join(' + '),
            }
          : c,
      ),
    );
    addActivity({
      companyId: created.companyId,
      customerId: created.customerId,
      action: 'Equipment added',
      description: `${created.type}${created.model ? ` (${created.model})` : ''} added.`,
    });
    toastSuccess('Equipment added.');
  }

  function updateEquipment(item: Equipment) {
    setEquipment((prev) => prev.map((e) => (e.id === item.id ? item : e)));
    addActivity({
      companyId: item.companyId,
      customerId: item.customerId,
      action: 'Equipment updated',
      description: `${item.type} details updated.`,
    });
    toastSuccess('Equipment updated.');
  }

  function createRecoveryJob(input: {
    customerId: string;
    equipmentIds: string[];
    reason: string;
    priority: 'Low' | 'Medium' | 'High';
    technician: string;
    scheduledDate?: string;
    contactInstructions?: string;
    internalNotes?: string;
  }) {
    const customer = customers.find((c) => c.id === input.customerId);
    if (!customer) return;
    const selectedEq = equipment.filter((e) => input.equipmentIds.includes(e.id));
    const job: RecoveryJob = {
      id: `REC-${String(282 + recoveries.length).padStart(5, '0')}`,
      companyId: customer.companyId,
      customerId: customer.id,
      status: input.scheduledDate ? 'Scheduled' : 'Awaiting assignment',
      equipment: selectedEq.map((e) => e.model || e.type).join(' + ') || customer.equipment || 'Equipment',
      equipmentIds: input.equipmentIds,
      technician: input.technician || 'Unassigned',
      scheduledDate: input.scheduledDate,
      reason: input.reason,
      priority: input.priority,
      contactInstructions: input.contactInstructions,
      internalNotes: input.internalNotes,
      attempts: 0,
    };
    setRecoveries((prev) => [job, ...prev]);
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id ? { ...c, status: 'Recovery Required', collectionStage: 'Recovery Required' } : c,
      ),
    );
    setEquipment((prev) =>
      prev.map((e) =>
        input.equipmentIds.includes(e.id) ? { ...e, recoveryRequired: true, status: 'Awaiting recovery' } : e,
      ),
    );
    addActivity({
      companyId: customer.companyId,
      customerId: customer.id,
      action: 'Recovery case created',
      description: `Recovery job ${job.id} created.`,
    });
    toastSuccess('Recovery job created.');
  }

  function updateRecovery(job: RecoveryJob) {
    setRecoveries((prev) => prev.map((r) => (r.id === job.id ? job : r)));
  }

  function completeRecovery(input: {
    jobId: string;
    outcome: string;
    condition?: Equipment['condition'];
    notes?: string;
    rescheduleDate?: string;
  }) {
    const job = recoveries.find((r) => r.id === input.jobId);
    if (!job) return;
    let status: RecoveryStatus = 'Closed';
    if (input.outcome === 'Recovered' || input.outcome === 'Partially recovered') status = 'Recovered';
    else if (input.outcome === 'Customer unavailable') status = 'Customer Unavailable';
    else if (input.outcome === 'Equipment not found') status = 'Not Found';
    else if (input.outcome === 'Equipment damaged') status = 'Damaged';
    else if (input.outcome === 'Reschedule required') status = 'Rescheduled';
    else if (input.outcome === 'Written off') status = 'Written Off';

    setRecoveries((prev) =>
      prev.map((r) =>
        r.id === job.id
          ? {
              ...r,
              status,
              outcome: input.outcome,
              internalNotes: [r.internalNotes, input.notes].filter(Boolean).join(' | '),
              completedDate: ['Recovered', 'Written Off', 'Not Found', 'Damaged', 'Closed'].includes(status)
                ? todayIso()
                : r.completedDate,
              scheduledDate: input.rescheduleDate || r.scheduledDate,
              attempts: (r.attempts || 0) + 1,
            }
          : r,
      ),
    );

    if (job.equipmentIds?.length) {
      setEquipment((prev) =>
        prev.map((e) => {
          if (!job.equipmentIds!.includes(e.id)) return e;
          if (input.outcome === 'Recovered' || input.outcome === 'Partially recovered') {
            return { ...e, status: 'Recovered', condition: input.condition || e.condition, recoveryRequired: false };
          }
          if (input.outcome === 'Equipment damaged') {
            return { ...e, status: 'Damaged', condition: 'Damaged', recoveryRequired: false };
          }
          if (input.outcome === 'Written off') {
            return { ...e, status: 'Written Off', recoveryRequired: false };
          }
          return e;
        }),
      );
    }

    addActivity({
      companyId: job.companyId,
      customerId: job.customerId,
      action: 'Recovery updated',
      description: `Recovery ${job.id} outcome: ${input.outcome}.`,
    });
    toastSuccess('Recovery outcome saved.');
  }

  async function handleFile(file: File) {
    const buffer = await file.arrayBuffer();
    const { rows, sourceLabel } = parseImportWorkbook(buffer, file.name);
    if (!rows.length) {
      toastError('No data rows were found in that file.');
      return;
    }
    toastSuccess(
      `Loaded ${rows.length} data row${rows.length === 1 ? '' : 's'} from ${sourceLabel}. Empty formatted rows in Excel are not counted.`,
    );
    const headers = rows.length ? Object.keys(rows[0]) : [];
    setImportRows(rows);
    setImportFile(file.name);
    setImportResult('');
    const detected: Mapping = {
      accountNo: findColumn(headers, 'accountNo'),
      name: findColumn(headers, 'name'),
      customerReference: findColumn(headers, 'customerReference'),
      servicePackage: findColumn(headers, 'servicePackage'),
      monthlySubscription: findColumn(headers, 'monthlySubscription'),
      originalOutstanding: findColumn(headers, 'originalOutstanding'),
      outstanding: findColumn(headers, 'outstanding'),
      dueDate: findColumn(headers, 'dueDate'),
      collectionStage: findColumn(headers, 'collectionStage'),
      phone: findColumn(headers, 'phone'),
      whatsapp: findColumn(headers, 'whatsapp'),
      email: findColumn(headers, 'email'),
      preferredContact: findColumn(headers, 'preferredContact'),
      language: findColumn(headers, 'language'),
      address: findColumn(headers, 'address'),
      suburb: findColumn(headers, 'suburb'),
      city: findColumn(headers, 'city'),
      province: findColumn(headers, 'province'),
      postalCode: findColumn(headers, 'postalCode'),
      nextFollowUp: findColumn(headers, 'nextFollowUp'),
      assignedCollector: findColumn(headers, 'assignedCollector'),
      equipment: findColumn(headers, 'equipment'),
    };
    const saved = importMappings[companyId] || {};
    const next = { ...detected };
    for (const [key, col] of Object.entries(saved)) {
      if (col && headers.includes(col)) next[key] = col;
    }
    setMapping(next);
  }

  function value(row: Record<string, unknown>, key: string) {
    const col = mapping[key];
    return col ? row[col] : '';
  }
  function dateValue(raw: unknown) {
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
    if (typeof raw === 'number') {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const d = new Date(String(raw));
    return isNaN(d.getTime()) ? todayIso() : d.toISOString().slice(0, 10);
  }
  function numberValue(raw: unknown) {
    return parseSignedAmount(raw);
  }
  function mappedText(row: Record<string, unknown>, key: string) {
    if (!mapping[key]) return undefined;
    const text = String(value(row, key) ?? '').trim();
    return text || undefined;
  }
  function mappedNumber(row: Record<string, unknown>, key: string) {
    if (!mapping[key]) return undefined;
    const raw = value(row, key);
    if (raw === '' || raw == null) return undefined;
    return numberValue(raw);
  }
  function mappedDate(row: Record<string, unknown>, key: string) {
    if (!mapping[key]) return undefined;
    const raw = value(row, key);
    if (raw === '' || raw == null) return undefined;
    return dateValue(raw);
  }
  function parsePreferredContact(raw?: string): string | undefined {
    if (!raw) return undefined;
    const n = normalize(raw);
    if (!n) return undefined;
    if (n.includes('whatsapp') || n === 'wa' || n === 'wapp') return 'WhatsApp';
    if (n.includes('email') || n.includes('mail')) return 'Email';
    if (
      n.includes('phone') ||
      n.includes('call') ||
      n.includes('cell') ||
      n.includes('mobile') ||
      n.includes('sms') ||
      n.includes('tel')
    ) {
      return 'Phone';
    }
    if (/^\+?\d[\d\s+.-]{5,}$/.test(raw)) return 'Phone';
    return raw.trim();
  }
  function parseCollectionStage(raw?: string): CollectionStage | undefined {
    if (!raw) return undefined;
    const stages: CollectionStage[] = [
      'New Overdue',
      'Follow-up Due',
      'Contacted',
      'Promise to Pay',
      'Payment Pending',
      'Paid',
      'Unresponsive',
      'Escalated',
      'Service Cancelled',
      'Recovery Required',
      'Closed',
    ];
    return stages.find((stage) => normalize(stage) === normalize(raw));
  }
  function parseAccountStatus(raw?: string): AccountStatus | undefined {
    if (!raw) return undefined;
    const statuses: AccountStatus[] = [
      'Payment Due',
      'Follow-up',
      'Promise to Pay',
      'Paid',
      'Unresponsive',
      'Cancelled',
      'Recovery Required',
    ];
    return statuses.find((status) => normalize(status) === normalize(raw));
  }
  function extrasFromRow(row: Record<string, unknown>): Partial<Customer> {
    const extras: Partial<Customer> = {};
    const customerReference = mappedText(row, 'customerReference');
    const servicePackage = mappedText(row, 'servicePackage');
    const monthlySubscription = mappedNumber(row, 'monthlySubscription');
    const originalOutstanding = mappedNumber(row, 'originalOutstanding');
    const dueDate = mappedDate(row, 'dueDate');
    const phone = mappedText(row, 'phone');
    const whatsapp = mappedText(row, 'whatsapp');
    const email = mappedText(row, 'email');
    const language = mappedText(row, 'language');
    const address = mappedText(row, 'address');
    const suburb = mappedText(row, 'suburb');
    const city = mappedText(row, 'city');
    const province = mappedText(row, 'province');
    const postalCode = mappedText(row, 'postalCode');
    const nextFollowUp = mappedDate(row, 'nextFollowUp');
    const assignedCollector = mappedText(row, 'assignedCollector');
    const equipment = mappedText(row, 'equipment');
    const preferredContact = parsePreferredContact(mappedText(row, 'preferredContact'));
    const stageRaw = mappedText(row, 'collectionStage');
    const collectionStage = parseCollectionStage(stageRaw);
    const status = parseAccountStatus(stageRaw) || (
      collectionStage === 'Paid' || collectionStage === 'Closed'
        ? 'Paid'
        : collectionStage === 'Recovery Required'
          ? 'Recovery Required'
          : collectionStage === 'Unresponsive'
            ? 'Unresponsive'
            : collectionStage === 'Promise to Pay'
              ? 'Promise to Pay'
              : collectionStage === 'Follow-up Due'
                ? 'Follow-up'
                : collectionStage === 'Service Cancelled'
                  ? 'Cancelled'
                  : undefined
    );

    if (customerReference) extras.customerReference = customerReference;
    if (servicePackage) extras.servicePackage = servicePackage;
    if (monthlySubscription != null) extras.monthlySubscription = monthlySubscription;
    if (originalOutstanding != null) extras.originalOutstanding = originalOutstanding;
    if (dueDate) extras.dueDate = dueDate;
    if (phone) extras.phone = phone;
    if (whatsapp) extras.whatsapp = whatsapp;
    if (email) extras.email = email;
    if (language) extras.language = language;
    if (address) extras.address = address;
    if (suburb) extras.suburb = suburb;
    if (city) extras.city = city;
    if (province) extras.province = province;
    if (postalCode) extras.postalCode = postalCode;
    if (nextFollowUp) extras.nextFollowUp = nextFollowUp;
    if (assignedCollector) extras.assignedCollector = assignedCollector;
    if (equipment) extras.equipment = equipment;
    if (preferredContact) extras.preferredContact = preferredContact;
    if (collectionStage) extras.collectionStage = collectionStage;
    if (status) extras.status = status;
    return extras;
  }

  function commitImport() {
    if (!mapping.accountNo || !mapping.name || !mapping.outstanding) {
      setImportResult('Please map Account Number, Client Name and Outstanding Amount before importing.');
      toastError('Please map required columns before importing.');
      return;
    }
    if (!companyId) {
      toastError('Select or add a company before importing.');
      return;
    }

    let created = 0;
    let updated = 0;
    let errors = 0;
    const seen = new Set<string>();
    let next = [...customers];
    const batchId = `IMP-${105 + imports.length}`;
    const activityBuffer: Activity[] = [];

    // Last row wins when the same account appears more than once in the file
    const dedupedRows: Record<string, unknown>[] = [];
    const rowByAccount = new Map<string, Record<string, unknown>>();
    for (const row of importRows) {
      const key = normalizeAccountKey(value(row, 'accountNo'));
      const name = String(value(row, 'name')).trim();
      if (!key || !name) {
        errors++;
        continue;
      }
      rowByAccount.set(key, row);
    }
    for (const row of rowByAccount.values()) dedupedRows.push(row);

    for (const row of dedupedRows) {
      const accountRaw = value(row, 'accountNo');
      const accountKey = normalizeAccountKey(accountRaw);
      const account = String(accountRaw).trim();
      const name = String(value(row, 'name')).trim();
      if (!accountKey || !name) {
        errors++;
        continue;
      }
      seen.add(accountKey);

      const amount = numberValue(value(row, 'outstanding'));
      // Prefer an active match; fall back to archived so we update instead of duplicating
      let ix = next.findIndex(
        (c) =>
          c.companyId === companyId &&
          !c.archived &&
          normalizeAccountKey(c.accountNo) === accountKey,
      );
      if (ix < 0) {
        ix = next.findIndex(
          (c) => c.companyId === companyId && normalizeAccountKey(c.accountNo) === accountKey,
        );
      }

      const extras = extrasFromRow(row);
      if (ix >= 0) {
        const prev = next[ix];
        const prevAmount = prev.outstanding;
        next[ix] = {
          ...prev,
          ...extras,
          outstanding: amount,
          archived: false,
          status:
            extras.status ||
            (amount === 0 ? 'Paid' : prev.status === 'Paid' && amount !== 0 ? 'Payment Due' : prev.status),
          collectionStage: extras.collectionStage || (amount === 0 ? 'Paid' : prev.collectionStage),
        };
        updated++;
        if (prevAmount !== amount) {
          activityBuffer.push({
            id: uid('act'),
            companyId,
            customerId: prev.id,
            user: actorName(),
            action: 'Imported from Excel',
            description: `Balance updated by Excel Import #${batchId} from ${money(prevAmount)} to ${money(amount)}.`,
            createdAt: nowIso(),
          });
        }
      } else {
        const newId = uid('c');
        next.unshift({
          id: newId,
          companyId,
          accountNo: account,
          name,
          phone: extras.phone || '',
          whatsapp: extras.whatsapp || extras.phone || '',
          email: extras.email || '',
          outstanding: amount,
          originalOutstanding: extras.originalOutstanding ?? amount,
          dueDate: extras.dueDate || todayIso(),
          status: extras.status || (amount === 0 ? 'Paid' : 'Payment Due'),
          collectionStage: extras.collectionStage || (amount === 0 ? 'Closed' : 'New Overdue'),
          lastContact: 'Not contacted',
          address: extras.address || '',
          suburb: extras.suburb,
          city: extras.city,
          province: extras.province,
          postalCode: extras.postalCode,
          customerReference: extras.customerReference,
          servicePackage: extras.servicePackage,
          monthlySubscription: extras.monthlySubscription,
          preferredContact: extras.preferredContact,
          language: extras.language,
          nextFollowUp: extras.nextFollowUp,
          equipment: extras.equipment || '',
          assignedCollector: extras.assignedCollector || actorName(),
        });
        created++;
        activityBuffer.push({
          id: uid('act'),
          companyId,
          customerId: newId,
          user: actorName(),
          action: 'Imported from Excel',
          description: `Customer created by Excel Import #${batchId}.`,
          createdAt: nowIso(),
        });
      }
    }

    const cleared = customers.filter(
      (c) =>
        c.companyId === companyId &&
        !c.archived &&
        c.outstanding > 0 &&
        !seen.has(normalizeAccountKey(c.accountNo)),
    ).length;
    setCustomers(next);
    setImports((prev) => [
      {
        id: batchId,
        companyId,
        file: importFile,
        date: nowIso(),
        rows: importRows.length,
        created,
        updated,
        cleared,
        errors,
        uploadedBy: actorName(),
      },
      ...prev,
    ]);
    if (activityBuffer.length) setActivities((prev) => [...activityBuffer, ...prev]);
    setImportResult(
      `Imported into ${company.name}: ${created} new, ${updated} balances updated, ${cleared} not in this file, ${errors} skipped.`,
    );
    setImportMappings((prev) => ({ ...prev, [companyId]: mapping }));
    toastSuccess(
      updated && !created
        ? `Updated ${updated} existing account balance${updated === 1 ? '' : 's'}.`
        : 'Import completed successfully.',
    );
  }

  function deleteImport(id: string) {
    const batch = imports.find((item) => item.id === id);
    if (!batch) return;
    setImports((prev) => prev.filter((item) => item.id !== id));
    setActivities((prev) => [
      {
        id: uid('act'),
        companyId: batch.companyId,
        user: actorName(),
        action: 'Deleted import file',
        description: `Removed import batch ${batch.id} (${batch.file}). Customer accounts were left unchanged.`,
        createdAt: nowIso(),
      },
      ...prev,
    ]);
    toastSuccess(`Deleted ${batch.file}.`);
  }

  const valueCtx: AppContextValue = {
    companies,
    companyId,
    company,
    showArchivedCompanies,
    setShowArchivedCompanies,
    switchCompany,
    activeCompanies,
    customers,
    companyCustomers,
    recoveries,
    companyRecoveries,
    imports,
    companyImports,
    templates,
    companyTemplates,
    setTemplates,
    saveTemplate: (t) => {
      setTemplates((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]));
      toastSuccess('Template saved.');
    },
    equipment,
    promises,
    payments,
    communications,
    notes,
    followUps,
    activities,
    integrations,
    automationRules,
    saveIntegration: (item) => {
      setIntegrations((prev) => prev.some((x) => x.id === item.id) ? prev.map((x) => x.id === item.id ? item : x) : [item, ...prev]);
      toastSuccess(`${item.provider} connection saved.`);
    },
    removeIntegration: (id) => setIntegrations((prev) => prev.filter((x) => x.id !== id)),
    saveAutomationRule: (item) => {
      setAutomationRules((prev) => prev.some((x) => x.id === item.id) ? prev.map((x) => x.id === item.id ? item : x) : [item, ...prev]);
      toastSuccess('Automation rule saved.');
    },
    removeAutomationRule: (id) => setAutomationRules((prev) => prev.filter((x) => x.id !== id)),
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filteredCustomers,
    outstandingCustomers,
    totalOutstanding,
    promiseCustomers,
    recoveryNeeded,
    loading,
    addCompany,
    updateCompany,
    archiveCompany,
    addCustomer,
    updateCustomer,
    archiveCustomer,
    deleteCustomers,
    updateStatus,
    recordPayment,
    createPromise,
    updatePromiseStatus,
    sendMessage,
    sendBulkEmails,
    syncInbox,
    markCommunicationRead,
    logCall,
    addNote,
    deleteNote,
    scheduleFollowUp,
    cancelService,
    addEquipment,
    updateEquipment,
    createRecoveryJob,
    updateRecovery,
    completeRecovery,
    importRows,
    importFile,
    mapping,
    setMapping,
    importResult,
    handleFile,
    commitImport,
    deleteImport,
    getCustomer: (id) => customers.find((c) => c.id === id),
    getCompany: (id) => companies.find((c) => c.id === id),
    companyEquipment: (customerId) =>
      equipment.filter((e) => e.companyId === companyId && (!customerId || e.customerId === customerId)),
    companyPromises: (customerId) =>
      promises.filter((p) => p.companyId === companyId && (!customerId || p.customerId === customerId)),
    companyPayments: (customerId) =>
      payments.filter((p) => p.companyId === companyId && (!customerId || p.customerId === customerId)),
    companyCommunications: (customerId) =>
      communications
        .filter((c) => c.companyId === companyId && (!customerId || c.customerId === customerId))
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    companyNotes: (customerId) =>
      notes.filter((n) => n.companyId === companyId && (!customerId || n.customerId === customerId)),
    companyFollowUps: (customerId) =>
      followUps.filter((f) => f.companyId === companyId && (!customerId || f.customerId === customerId)),
    companyActivities: (customerId) =>
      activities.filter((a) => a.companyId === companyId && (!customerId || a.customerId === customerId)),
    toastSuccess,
    toastError,
    addActivity,
  };

  return <AppContext.Provider value={valueCtx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { fillTemplate };
