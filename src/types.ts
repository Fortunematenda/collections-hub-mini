export type NavKey =
  | 'dashboard'
  | 'companies'
  | 'accounts'
  | 'followups'
  | 'promises'
  | 'recovery'
  | 'imports'
  | 'templates'
  | 'communications'
  | 'mywork'
  | 'integrations'
  | 'automations'
  | 'users'
  | 'roles'
  | 'settings';

export type IntegrationProvider = 'Splynx' | 'Xero' | 'Sage' | 'Excel / CSV' | 'WhatsApp' | 'Email';
export type IntegrationStatus = 'Connected' | 'Needs attention' | 'Disconnected';

export type Integration = {
  id: string;
  companyId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  syncFrequency: 'Manual' | '15 minutes' | 'Hourly' | 'Daily';
  lastSync?: string;
  lastResult?: string;
  baseUrl?: string;
  accountLabel?: string;
  enabled: boolean;
};

export type AutomationTrigger = 'Before due date' | 'Invoice overdue' | 'Promise due' | 'Promise broken' | 'Payment received' | 'Communication failed';
export type AutomationAction = 'Send WhatsApp' | 'Send email' | 'Create follow-up' | 'Notify manager' | 'Request suspension' | 'Start recovery';

export type AutomationRule = {
  id: string;
  companyId: string;
  name: string;
  trigger: AutomationTrigger;
  daysOffset: number;
  minimumBalance: number;
  action: AutomationAction;
  templateId?: string;
  active: boolean;
  requiresApproval: boolean;
  createdAt: string;
};

export type AccountStatus =
  | 'Payment Due'
  | 'Follow-up'
  | 'Promise to Pay'
  | 'Paid'
  | 'Unresponsive'
  | 'Cancelled'
  | 'Recovery Required';

export type CollectionStage =
  | 'New Overdue'
  | 'Follow-up Due'
  | 'Contacted'
  | 'Promise to Pay'
  | 'Payment Pending'
  | 'Payment Verification'
  | 'Extension Requested'
  | 'Dispute'
  | 'Cancellation Requested'
  | 'Payment Arrangement Review'
  | 'Paid'
  | 'Unresponsive'
  | 'Escalated'
  | 'Service Cancelled'
  | 'Recovery Required'
  | 'Closed';

export type CompanyStatus = 'Active' | 'Inactive' | 'Archived';

export type RecoveryStatus =
  | 'Awaiting assignment'
  | 'Scheduled'
  | 'Recovered'
  | 'Unable to recover'
  | 'Recovery Required'
  | 'Technician Assigned'
  | 'Attempted'
  | 'Customer Unavailable'
  | 'Rescheduled'
  | 'Damaged'
  | 'Not Found'
  | 'Written Off'
  | 'Closed';

export type PromiseStatus = 'Pending' | 'Kept' | 'Broken' | 'Cancelled';
export type CommChannel = 'WhatsApp' | 'Email' | 'Phone' | 'Internal note' | 'SMS';
export type CommDirection = 'Incoming' | 'Outgoing' | 'Internal';
export type CommStatus = 'Queued' | 'Sent' | 'Delivered' | 'Failed' | 'Logged';
export type NoteType = 'General' | 'Collection' | 'Billing' | 'Technical' | 'Recovery' | 'Dispute';
export type EquipmentType = 'CPE / Antenna' | 'Router' | 'ONU/ONT' | 'PoE injector' | 'Power supply' | 'Switch' | 'Other';
export type EquipmentOwnership = 'Company owned' | 'Customer owned';
export type EquipmentCondition = 'Good' | 'Needs testing' | 'Damaged' | 'Scrap' | 'Unknown';
export type EquipmentStatus = 'Installed' | 'Recovered' | 'Damaged' | 'Written Off' | 'Awaiting recovery';
export type PreferredContact = 'WhatsApp' | 'Phone' | 'Email';
export type CallResult =
  | 'No answer'
  | 'Customer answered'
  | 'Promised payment'
  | 'Disputed balance'
  | 'Requested callback'
  | 'Cancelled service'
  | 'Wrong number'
  | 'Other';

export type Company = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  whatsappSender?: string;
  emailSender?: string;
  tradingName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  primaryContact?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  whatsappNumber?: string;
  alternativePhone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  logoUrl?: string;
  accentColor?: string;
  notes?: string;
  status: CompanyStatus;
  followUpIntervalDays?: number;
  defaultRecoveryBehaviour?: string;
  collectionRules?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranchCode?: string;
  paymentInstructions?: string;
};

export type Customer = {
  id: string;
  companyId: string;
  accountNo: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  whatsapp?: string;
  alternativePhone?: string;
  email: string;
  outstanding: number;
  originalOutstanding?: number;
  dueDate: string;
  status: AccountStatus;
  collectionStage?: CollectionStage;
  lastContact: string;
  promisedDate?: string;
  promisedAmount?: number;
  equipment?: string;
  address?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  customerReference?: string;
  servicePackage?: string;
  monthlySubscription?: number;
  billingNotes?: string;
  notes?: string;
  preferredContact?: PreferredContact | string;
  language?: string;
  assignedCollector?: string;
  nextFollowUp?: string;
  archived?: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  automationPaused?: boolean;
  automationPausedReason?: string;
  automationPausedUntil?: string;
  reminderSent?: Record<string, string>;
  nextAction?: string;
  nextActionDue?: string;
  nextActionAssignee?: string;
  nextActionPriority?: 'Low' | 'Medium' | 'High';
  technicalIssuePending?: boolean;
  contactInvalid?: boolean;
  sensitiveAccount?: boolean;
  lastResponseIntent?: string;
};

export type Equipment = {
  id: string;
  companyId: string;
  customerId: string;
  type: EquipmentType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  assetTag?: string;
  ownership: EquipmentOwnership;
  installationDate?: string;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  notes?: string;
  recoveryRequired?: boolean;
};

export type RecoveryJob = {
  id: string;
  companyId: string;
  customerId: string;
  status: RecoveryStatus;
  equipment: string;
  equipmentIds?: string[];
  technician: string;
  scheduledDate?: string;
  reason?: string;
  priority?: 'Low' | 'Medium' | 'High';
  contactInstructions?: string;
  internalNotes?: string;
  attempts?: number;
  completedDate?: string;
  outcome?: string;
};

export type ImportBatch = {
  id: string;
  companyId: string;
  file: string;
  date: string;
  rows: number;
  created: number;
  updated: number;
  cleared: number;
  errors: number;
  uploadedBy?: string;
};

export type MessageTemplate = {
  id: string;
  companyId: string;
  name: string;
  channel: 'WhatsApp' | 'Email';
  stage: string;
  body: string;
};

export type PaymentPromise = {
  id: string;
  companyId: string;
  customerId: string;
  amount: number;
  promiseDate: string;
  createdAt: string;
  status: PromiseStatus;
  customerComment?: string;
  internalNote?: string;
  outcome?: string;
};

export type Payment = {
  id: string;
  companyId: string;
  customerId: string;
  amount: number;
  paymentDate: string;
  reference?: string;
  method?: string;
  notes?: string;
  recordedBy: string;
  clearedAccount?: boolean;
  balanceAfter?: number;
  createdAt: string;
};

export type Communication = {
  id: string;
  companyId: string;
  customerId: string;
  channel: CommChannel;
  direction: CommDirection;
  subject?: string;
  message: string;
  status: CommStatus;
  createdAt: string;
  createdBy: string;
  callResult?: CallResult;
  externalId?: string;
  messageId?: string;
  readAt?: string;
  handledAs?: 'promise' | 'none' | 'skipped' | 'seeded' | 'classified';
  detectedIntent?: string;
  classificationId?: string;
  hasAttachment?: boolean;
  automationRuleId?: string;
};

export type Note = {
  id: string;
  companyId: string;
  customerId: string;
  note: string;
  type: NoteType;
  pinned: boolean;
  createdAt: string;
  createdBy: string;
};

export type FollowUp = {
  id: string;
  companyId: string;
  customerId: string;
  followUpDate: string;
  followUpTime?: string;
  channel: CommChannel | 'Any';
  assignedUser: string;
  notes?: string;
  completed?: boolean;
  createdAt: string;
};

export type Activity = {
  id: string;
  companyId: string;
  customerId?: string;
  user: string;
  action: string;
  description: string;
  createdAt: string;
};

export type AppToast = {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
};

export type ResponseIntent =
  | 'PAYMENT_CLAIMED'
  | 'PROOF_OF_PAYMENT_RECEIVED'
  | 'PROMISE_TO_PAY'
  | 'PAYMENT_EXTENSION_REQUEST'
  | 'PARTIAL_PAYMENT'
  | 'BALANCE_DISPUTE'
  | 'CANCELLATION_REQUEST'
  | 'EQUIPMENT_COLLECTION_REQUEST'
  | 'CUSTOMER_MOVED'
  | 'TECHNICAL_SERVICE_ISSUE'
  | 'FINANCIAL_DIFFICULTY'
  | 'CALLBACK_REQUEST'
  | 'WRONG_CONTACT'
  | 'SENSITIVE_ACCOUNT'
  | 'STATEMENT_REQUEST'
  | 'PAYMENT_DETAILS_REQUEST'
  | 'NEEDS_REVIEW';

export type ClassifiedResponse = {
  id: string;
  companyId: string;
  customerId: string;
  communicationId?: string;
  channel: CommChannel | 'Manual';
  direction: CommDirection;
  rawMessage: string;
  detectedIntent: ResponseIntent | string;
  appliedIntent?: ResponseIntent | string;
  confidence: number;
  detectedEntities: Record<string, unknown>;
  classificationSource: 'Rule' | 'AI' | 'Manual';
  originalIntent?: string;
  overrideReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  actionsApplied?: string[];
  previousStage?: string;
  newStage?: string;
  assignedUser?: string;
  needsReview?: boolean;
  dateRequired?: boolean;
  createdAt: string;
};

export type WorkTaskStatus = 'Pending' | 'Attempted' | 'Completed' | 'Rescheduled' | 'Awaiting Verification' | 'Verified' | 'Partially Verified' | 'Rejected' | 'Invalid POP' | 'Open';

export type WorkTask = {
  id: string;
  companyId: string;
  customerId: string;
  communicationId?: string;
  responseId?: string;
  type: string;
  title: string;
  queue: string;
  status: WorkTaskStatus | string;
  priority?: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  dueTime?: string;
  assignedUser?: string;
  notes?: string;
  verificationStatus?: string;
  createdAt: string;
  completedAt?: string;
};

export type DisputeCase = {
  id: string;
  companyId: string;
  customerId: string;
  responseId?: string;
  communicationId?: string;
  reason: string;
  amountDisputed?: number;
  dateRaised: string;
  assignedUser?: string;
  investigationNotes?: string;
  resolution?: string;
  dateResolved?: string;
  outcome?: string;
  status:
    | 'Open'
    | 'Under Review'
    | 'Waiting for Customer'
    | 'Waiting for Company'
    | 'Resolved — Customer Correct'
    | 'Resolved — Balance Correct'
    | 'Partially Resolved'
    | 'Closed';
  createdAt: string;
};

export type AssignmentType = 'Specific User' | 'Team' | 'Queue' | 'Round Robin' | 'Existing Account Owner' | 'Manual Assignment';

export type AssignmentRule = {
  id: string;
  companyId: string;
  name: string;
  triggerIntent: string;
  triggerStage?: string;
  assignmentType: AssignmentType;
  assigneeUserId?: string;
  assigneeName?: string;
  assigneeTeamId?: string;
  assigneeNames?: string[];
  queue?: string;
  priority?: 'Low' | 'Medium' | 'High';
  autoAssign?: boolean;
  active: boolean;
  roundRobinIndex?: number;
  createdAt: string;
  updatedAt: string;
};

export type ResponseRule = {
  id: string;
  companyId: string;
  name: string;
  intent: string;
  changeStage?: CollectionStage | string;
  createPromise?: boolean;
  pauseReminders?: boolean;
  createTask?: boolean;
  taskTitle?: string;
  createDispute?: boolean;
  createRecovery?: boolean;
  followUpDaysAfterPromise?: number;
  active: boolean;
};

export type Team = {
  id: string;
  companyId: string;
  name: string;
  memberNames: string[];
  memberUserIds?: string[];
  active: boolean;
  createdAt: string;
};

export type CustomerDocument = {
  id: string;
  companyId: string;
  customerId: string;
  kind: 'statement' | 'invoice' | 'pop' | 'payment-details' | 'other';
  filename: string;
  mime: string;
  size: number;
  uploadedBy: string;
  communicationId?: string;
  taskId?: string;
  createdAt: string;
};
