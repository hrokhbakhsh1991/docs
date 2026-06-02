import type { FindOperator, FindOptionsWhere } from "typeorm";

import { RegistrationEntity } from "../registration.entity";
import type {
  RegistrationReadWhere,
  RegistrationReadWhereClause,
} from "../domain/ports/registrations-read.port";

function mapStatusValue(
  status: RegistrationReadWhereClause["status"] | FindOperator<unknown>
): RegistrationReadWhereClause["status"] | undefined {
  if (status == null) {
    return undefined;
  }
  if (typeof status === "string") {
    return status;
  }
  if (typeof status === "object" && "_type" in status && "_value" in status) {
    const op = status as FindOperator<unknown>;
    if (op.type === "in") {
      const values = op.value;
      if (Array.isArray(values)) {
        return { $in: values.map(String) };
      }
    }
  }
  if (typeof status === "object" && "$in" in status) {
    return status;
  }
  return undefined;
}

function mapClause(clause: FindOptionsWhere<RegistrationEntity>): RegistrationReadWhereClause {
  const mapped: RegistrationReadWhereClause = {};
  if (clause.id != null) mapped.id = String(clause.id);
  if (clause.tenantId != null) mapped.tenantId = String(clause.tenantId);
  if (clause.deletedAt === null) mapped.deletedAt = null;
  if (clause.participantContactPhone != null) {
    mapped.participantContactPhone = String(clause.participantContactPhone);
  }
  if (clause.telegramUserId != null) mapped.telegramUserId = String(clause.telegramUserId);
  if (clause.tourId != null) mapped.tourId = String(clause.tourId);
  const status = mapStatusValue(clause.status as RegistrationReadWhereClause["status"]);
  if (status != null) mapped.status = status;
  return mapped;
}

/** Maps actor-scoped TypeORM where shapes to port read clauses (infra boundary). */
export function toRegistrationReadWhere(
  where:
    | FindOptionsWhere<RegistrationEntity>
    | FindOptionsWhere<RegistrationEntity>[]
): RegistrationReadWhere {
  if (Array.isArray(where)) {
    return where.map((clause) => mapClause(clause));
  }
  return mapClause(where);
}
