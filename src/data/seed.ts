import type {
  Activity,
  Communication,
  Company,
  Customer,
  Equipment,
  FollowUp,
  ImportBatch,
  MessageTemplate,
  Note,
  Payment,
  PaymentPromise,
  RecoveryJob,
} from '../types';

export const initialCompanies: Company[] = [];
export const initialCustomers: Customer[] = [];
export const initialEquipment: Equipment[] = [];
export const initialRecoveries: RecoveryJob[] = [];
export const initialImports: ImportBatch[] = [];
export const initialTemplates: MessageTemplate[] = [];
export const initialPromises: PaymentPromise[] = [];
export const initialPayments: Payment[] = [];
export const initialCommunications: Communication[] = [];
export const initialNotes: Note[] = [];
export const initialFollowUps: FollowUp[] = [];
export const initialActivities: Activity[] = [];
