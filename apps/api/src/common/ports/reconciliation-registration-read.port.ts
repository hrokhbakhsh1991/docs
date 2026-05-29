import type { EntityManager } from "typeorm";

import type { ReconciliationRegistrationProjection } from "../contracts/registration-financial.types";

export const RECONCILIATION_REGISTRATION_READ_PORT = Symbol(
  "RECONCILIATION_REGISTRATION_READ_PORT"
);

export interface ReconciliationRegistrationReadPort {
  loadRegistrationProjections(
    _manager: EntityManager,
    _tenantId: string,
    _registrationIds: readonly string[]
  ): Promise<ReconciliationRegistrationProjection[]>;
}
