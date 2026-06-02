import type { RegistrationStatus } from "../../registrations/domain/registration-status";

/** Registration row shape for payment-intent / webhook orchestration (no TypeORM entity). */
export type PaymentRegistrationSnapshot = {
  id: string;
  tenantId: string;
  tourId: string;
  status: RegistrationStatus;
};

/** Where-clause shape for registration lookups (mirrors actor-scoped registration reads). */
export type PaymentRegistrationLookupClause = {
  id?: string;
  tenantId?: string;
  deletedAt?: null;
  participantContactPhone?: string;
  telegramUserId?: string;
};

export type PaymentRegistrationLookup =
  | PaymentRegistrationLookupClause
  | PaymentRegistrationLookupClause[];
