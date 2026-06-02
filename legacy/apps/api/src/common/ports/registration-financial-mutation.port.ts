import type { EntityManager } from "typeorm";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import type { RegistrationFinancialRecord } from "../contracts/registration-financial.types";

export const REGISTRATION_FINANCIAL_MUTATION_PORT = Symbol(
  "REGISTRATION_FINANCIAL_MUTATION_PORT"
);

export interface RegistrationFinancialMutationPort {
  findRegistrationForReceipt(
    _manager: EntityManager,
    _tenantId: string,
    _registrationId: string
  ): Promise<RegistrationFinancialRecord | null>;

  findRegistrationPeekForReceipt(
    _manager: EntityManager,
    _tenantId: string,
    _registrationId: string
  ): Promise<Pick<RegistrationFinancialRecord, "id" | "tourId" | "tenantId"> | null>;

  lockRegistrationByTenantAndId(
    _manager: EntityManager,
    _tenantId: string,
    _registrationId: string
  ): Promise<RegistrationFinancialRecord>;

  validatePaymentTransition(
    _registrationStatus: RegistrationStatus,
    _currentPaymentStatus: RegistrationPaymentStatus,
    _nextPaymentStatus: RegistrationPaymentStatus
  ): void;

  saveRegistrationFinancialRecord(
    _manager: EntityManager,
    _record: RegistrationFinancialRecord
  ): Promise<RegistrationFinancialRecord>;
}
