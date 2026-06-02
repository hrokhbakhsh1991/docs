import type { FindOptionsWhere } from "typeorm";

import type {
  PaymentRegistrationLookup,
  PaymentRegistrationLookupClause,
} from "../domain/payment-registration.types";

/** Maps actor-scoped registration where shapes to port lookup clauses (no entity import). */
export function toPaymentRegistrationLookup(
  where: FindOptionsWhere<Record<string, unknown>> | FindOptionsWhere<Record<string, unknown>>[]
): PaymentRegistrationLookup {
  if (Array.isArray(where)) {
    return where.map(toPaymentRegistrationLookupClause);
  }
  return toPaymentRegistrationLookupClause(where);
}

function toPaymentRegistrationLookupClause(
  clause: FindOptionsWhere<Record<string, unknown>>
): PaymentRegistrationLookupClause {
  return {
    id: typeof clause.id === "string" ? clause.id : undefined,
    tenantId: typeof clause.tenantId === "string" ? clause.tenantId : undefined,
    deletedAt: clause.deletedAt === null ? null : undefined,
    participantContactPhone:
      typeof clause.participantContactPhone === "string"
        ? clause.participantContactPhone
        : undefined,
    telegramUserId:
      typeof clause.telegramUserId === "string" ? clause.telegramUserId : undefined,
  };
}
