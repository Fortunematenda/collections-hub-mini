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
  | 'roles'
  | 'settings';

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
  preferredContact?: PreferredContact;
  language?: string;
  assignedCollector?: string;
  nextFollowUp?: string;
  archived?: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
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
