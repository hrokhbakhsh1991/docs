import type { RegistrationWriteRecord } from "../registration-write.types";
import type { RegistrationReadDetailRecord } from "../registration-read-detail.types";

/** Where-clause shape for registration reads (mirrors actor-scoped registration reads). */
export type RegistrationReadWhereClause = {
  id?: string;
  tenantId?: string;
  deletedAt?: null;
  participantContactPhone?: string;
  telegramUserId?: string;
  tourId?: string;
  status?: string | { $in?: readonly string[] };
};

export type RegistrationReadWhere =
  | RegistrationReadWhereClause
  | RegistrationReadWhereClause[];

export const REGISTRATIONS_READ_REPOSITORY_PORT = Symbol("REGISTRATIONS_READ_REPOSITORY_PORT");

/**
 * **Persistence only** — read helpers for registrations.
 * Where-clauses are built by services / policies.
 */
export interface RegistrationsReadRepositoryPort {
  findOneStandalone(_where: RegistrationReadWhere): Promise<RegistrationWriteRecord | null>;

  findManyStandalone(
    _where: RegistrationReadWhere,
    _order?: { createdAt: "ASC" | "DESC" }
  ): Promise<RegistrationWriteRecord[]>;

  findOneDetailStandalone(_where: RegistrationReadWhere): Promise<RegistrationReadDetailRecord | null>;

  lockForFinancialMutation(
    _where: RegistrationReadWhere
  ): Promise<RegistrationWriteRecord>;
}

