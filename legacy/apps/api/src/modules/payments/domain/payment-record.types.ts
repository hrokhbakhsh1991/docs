import type { PaymentMethod, PaymentStatus } from "./payment.types";

/** Domain payment row (infra {@link PaymentEntity} satisfies this shape). */
export type PaymentRecord = {
  id: string;
  tenantId: string;
  registrationId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  provider: string;
  providerPaymentId: string | null;
  status: PaymentStatus;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  ledgerJournalId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
};

export type PaymentRegistrationRef = {
  id: string;
  tenantId: string;
};
