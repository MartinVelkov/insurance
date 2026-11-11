export type Currency = "EUR" | "BGN";
export type PaymentStatus = "pending" | "paid";
export type EffectiveInstallmentStatus = "upcoming" | "overdue" | "paid";
export type SyncStatus = "not_synced" | "synced" | "error";

export interface Employee {
  uid: string;
  email: string;
  displayName?: string;
  active: boolean;
  role: "owner" | "employee";
  locationId: string;
  calendarSettings?: {
    calendarId?: string;
    reminderMinutes?: number[];
  };
}

export interface CustomerAccount {
  uid: string;
  clientId: string;
  locationId: string;
  email: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Client {
  id: string;
  phone: string;
  email?: string;
  phoneNormalized: string;
  locationId: string;
  employeeId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Vehicle {
  id: string;
  clientId: string;
  registrationNumber: string;
  normalizedRegistrationNumber: string;
  gtpStartDate?: string;
  gtpEndDate?: string;
  vignetteStartDate?: string;
  vignetteEndDate?: string;
  registrationCertificateNumber?: string;
  locationId: string;
  employeeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Policy {
  id: string;
  clientId: string;
  vehicleId: string;
  policyNumber: string;
  policyNumberNormalized: string;
  locationId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  currency: Currency;
  installmentCount: number;
  periodMonths: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Installment {
  id: string;
  policyId: string;
  clientId: string;
  vehicleId: string;
  sequence: number;
  totalCount: number;
  dueDate: string;
  amount: number;
  currency: Currency;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  googleEventId: string | null;
  googleCalendarId?: string | null;
  calendarSyncStatus: SyncStatus;
  calendarSyncError?: string | null;
  locationId: string;
  employeeId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  subjectClientId?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
  locationId: string;
  employeeId: string;
  createdBy: string;
}

export interface CustomerPortalData {
  client: {
    id: string;
    phone: string;
    email: string;
  };
  vehicles: Array<Pick<Vehicle,
    "id" | "registrationNumber" | "gtpStartDate" | "gtpEndDate" |
    "vignetteStartDate" | "vignetteEndDate" | "registrationCertificateNumber"
  >>;
  policies: Array<Pick<Policy,
    "id" | "vehicleId" | "policyNumber" | "startDate" | "endDate" |
    "totalAmount" | "currency"
  >>;
  installments: Array<Pick<Installment,
    "id" | "policyId" | "sequence" | "totalCount" | "dueDate" | "amount" |
    "currency" | "paymentStatus" | "paidAt"
  >>;
}
