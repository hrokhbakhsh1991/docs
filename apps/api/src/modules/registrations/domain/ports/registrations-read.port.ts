import type { EntityManager, FindOptionsWhere } from "typeorm";

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
  status?: string | { $in?: string[] };
};

export type RegistrationReadWhere =
  | RegistrationReadWhereClause
  | RegistrationReadWhereClause[];

/** @deprecated Use {@link RegistrationReadWhere}; kept for adapter mapping. */
export type RegistrationReadWhereLegacy =
  | FindOptionsWhere<Record<string, unknown>>
  | FindOptionsWhere<Record<string, unknown>>[];

export const REGISTRATIONS_READ_REPOSITORY_PORT = Symbol("REGISTRATIONS_READ_REPOSITORY_PORT");

/**
 * **Persistence only** — read helpers for registrations.
 * Where-clauses are built by services / policies.
 */
export interface RegistrationsReadRepositoryPort {
  getDefaultManager(): EntityManager;

  findOneStandalone(_where: RegistrationReadWhere): Promise<RegistrationWriteRecord | null>;

  findManyStandalone(
    _where: RegistrationReadWhere,
    _order?: { createdAt: "ASC" | "DESC" }
  ): Promise<RegistrationWriteRecord[]>;

  findOneInManager(
    _manager: EntityManager,
    _where: RegistrationReadWhere
  ): Promise<RegistrationWriteRecord | null>;

  findOneDetailStandalone(_where: RegistrationReadWhere): Promise<RegistrationReadDetailRecord | null>;

  lockForFinancialMutation(
    _manager: EntityManager,
    _where: RegistrationReadWhere
  ): Promise<RegistrationWriteRecord>;
}
