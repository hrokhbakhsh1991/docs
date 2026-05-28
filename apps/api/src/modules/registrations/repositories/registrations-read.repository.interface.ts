import type { EntityManager } from "typeorm";
import type { FindOptionsWhere } from "typeorm";
import type { RegistrationEntity } from "../registration.entity";

/** Where shapes produced by `registrationWhereForActor` (may be `OR` clause arrays). */
export type RegistrationReadWhere =
  | FindOptionsWhere<RegistrationEntity>
  | FindOptionsWhere<RegistrationEntity>[];

/**
 * **Persistence only** — read helpers for `RegistrationEntity`.
 * Where-clauses (including actor-scoped shapes) are built by services / policies.
 */
export interface IRegistrationsReadRepository {
  findOneStandalone(_where: RegistrationReadWhere): Promise<RegistrationEntity | null>;
  findOneInManager(_manager: EntityManager, _where: RegistrationReadWhere): Promise<RegistrationEntity | null>;
}
