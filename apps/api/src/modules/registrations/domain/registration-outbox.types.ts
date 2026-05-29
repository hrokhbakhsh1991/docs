import type { RegistrationPaymentStatus, RegistrationStatus } from "./registration-status";

/** Registration fields required for outbox event payloads (no TypeORM entity). */
export type RegistrationOutboxSnapshot = {
  id: string;
  tenantId: string;
  tourId: string;
  status: RegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  paidAmount?: string | null;
};

/** Waitlist item fields required for outbox event payloads (no TypeORM entity). */
export type WaitlistOutboxSnapshot = {
  id: string;
  tenantId: string;
  tourId: string;
  cancelReason?: string | null;
};
