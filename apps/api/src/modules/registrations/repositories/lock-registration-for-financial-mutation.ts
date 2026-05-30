import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { RegistrationEntity } from "../registration.entity";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import type { RegistrationReadWhere } from "../domain/ports/registrations-read.port";

const asRegistrationWriteRecord = (row: RegistrationEntity): RegistrationWriteRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  tourId: row.tourId,
  tourDepartureId: row.tourDepartureId ?? null,
  status: row.status,
  paymentStatus: row.paymentStatus,
  participantContactPhone: row.participantContactPhone ?? null,
  telegramUserId: row.telegramUserId ?? null,
  quotedTotalMinor: row.quotedTotalMinor ?? null,
  quotedCurrencyCode: row.quotedCurrencyCode ?? null,
  paidAmount: row.paidAmount ?? null,
  rowVersion: row.rowVersion ?? null,
  deletedAt: row.deletedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function toEntityWhere(
  where: RegistrationReadWhere
): Parameters<EntityManager["findOne"]>[1] extends { where?: infer W } ? W : never {
  return where as never;
}

/** Infra-only: returns the ORM entity for transactional mutation paths inside repositories. */
export async function lockRegistrationEntityForFinancialMutation(
  manager: EntityManager,
  where: RegistrationReadWhere
): Promise<RegistrationEntity> {
  const registration = await manager.findOne<RegistrationEntity>(RegistrationEntity, {
    where: toEntityWhere(where),
    lock: { mode: "pessimistic_write" },
  });
  if (!registration) {
    throw new NotFoundException(tenantScopedResourceNotFoundError());
  }
  return registration;
}

/**
 * Loads a registration under `FOR UPDATE` so leader PATCH, receipt approve, and payment capture
 * serialize on the same booking wallet row.
 */
export async function lockRegistrationForFinancialMutation(
  manager: EntityManager,
  where: RegistrationReadWhere
): Promise<RegistrationWriteRecord> {
  const registration = await manager.findOne<RegistrationEntity>(RegistrationEntity, {
    where: toEntityWhere(where),
    lock: { mode: "pessimistic_write" },
  });
  if (!registration) {
    throw new NotFoundException(tenantScopedResourceNotFoundError());
  }
  return asRegistrationWriteRecord(registration);
}

export async function lockRegistrationByTenantAndId(
  manager: EntityManager,
  tenantId: string,
  registrationId: string
): Promise<RegistrationWriteRecord> {
  return lockRegistrationForFinancialMutation(manager, {
    id: registrationId,
    tenantId,
  });
}
