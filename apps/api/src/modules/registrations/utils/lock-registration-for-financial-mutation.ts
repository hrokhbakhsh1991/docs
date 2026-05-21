import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { RegistrationEntity } from "../registration.entity";
import type { RegistrationReadWhere } from "../repositories/registrations-read.repository.interface";

/**
 * Loads a registration under `FOR UPDATE` so leader PATCH, receipt approve, and payment capture
 * serialize on the same booking wallet row.
 */
export async function lockRegistrationForFinancialMutation(
  manager: EntityManager,
  where: RegistrationReadWhere
): Promise<RegistrationEntity> {
  const registration = await manager.findOne(RegistrationEntity, {
    where,
    lock: { mode: "pessimistic_write" }
  });
  if (!registration) {
    throw new NotFoundException(tenantScopedResourceNotFoundError());
  }
  return registration;
}

export async function lockRegistrationByTenantAndId(
  manager: EntityManager,
  tenantId: string,
  registrationId: string
): Promise<RegistrationEntity> {
  return lockRegistrationForFinancialMutation(manager, {
    id: registrationId,
    tenantId
  });
}
