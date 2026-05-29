import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, FindOptionsWhere } from "typeorm";
import { In, Repository } from "typeorm";

import { RegistrationEntity } from "../registration.entity";
import type { RegistrationWriteRecord } from "../domain/registration-write.types";
import type { RegistrationReadDetailRecord } from "../domain/registration-read-detail.types";
import type {
  RegistrationReadWhere,
  RegistrationReadWhereClause,
  RegistrationsReadRepositoryPort,
} from "../domain/ports/registrations-read.port";
import { lockRegistrationForFinancialMutation } from "./lock-registration-for-financial-mutation";

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

const asRegistrationReadDetailRecord = (row: RegistrationEntity): RegistrationReadDetailRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  tourId: row.tourId,
  participantFullName: row.participantFullName,
  participantContactPhone: row.participantContactPhone,
  bookingTarget: row.bookingTarget,
  participantNationalId: row.participantNationalId ?? null,
  transportMode: row.transportMode,
  entryMode: row.entryMode,
  telegramUserId: row.telegramUserId ?? null,
  telegramUsername: row.telegramUsername ?? null,
  vehicleSeatCapacity: row.vehicleSeatCapacity ?? null,
  participantNote: row.participantNote ?? null,
  participantMetadata: (row.participantMetadata as Record<string, unknown> | null) ?? null,
  status: row.status,
  rowVersion: row.rowVersion ?? null,
  paymentStatus: row.paymentStatus,
  paidAmount: row.paidAmount ?? null,
  paymentMetadata: (row.paymentMetadata as Record<string, unknown> | null) ?? null,
  quotedTotalMinor: row.quotedTotalMinor ?? null,
  quotedListPriceMinor: row.quotedListPriceMinor ?? null,
  quotedCurrencyCode: row.quotedCurrencyCode ?? null,
  quotedPricingVersion: row.quotedPricingVersion ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

function mapClauseToEntityWhere(
  clause: RegistrationReadWhereClause
): FindOptionsWhere<RegistrationEntity> {
  const where: FindOptionsWhere<RegistrationEntity> = {};
  if (clause.id != null) where.id = clause.id;
  if (clause.tenantId != null) where.tenantId = clause.tenantId;
  if (clause.deletedAt === null) where.deletedAt = null as never;
  if (clause.participantContactPhone != null) {
    where.participantContactPhone = clause.participantContactPhone;
  }
  if (clause.telegramUserId != null) where.telegramUserId = clause.telegramUserId;
  if (clause.tourId != null) where.tourId = clause.tourId;
  if (clause.status != null) {
    where.status =
      typeof clause.status === "object" && "$in" in clause.status
        ? In(clause.status.$in as never)
        : (clause.status as never);
  }
  return where;
}

function toEntityWhere(
  where: RegistrationReadWhere
): FindOptionsWhere<RegistrationEntity> | FindOptionsWhere<RegistrationEntity>[] {
  if (Array.isArray(where)) {
    return where.map(mapClauseToEntityWhere);
  }
  return mapClauseToEntityWhere(where);
}

@Injectable()
export class TypeOrmRegistrationsReadRepository implements RegistrationsReadRepositoryPort {
  constructor(
    @InjectRepository(RegistrationEntity)
    private readonly registrations: Repository<RegistrationEntity>
  ) {}

  getDefaultManager(): EntityManager {
    return this.registrations.manager;
  }

  findOneStandalone(where: RegistrationReadWhere): Promise<RegistrationWriteRecord | null> {
    return this.registrations
      .findOne({ where: toEntityWhere(where) })
      .then((row) => (row ? asRegistrationWriteRecord(row) : null));
  }

  findManyStandalone(
    where: RegistrationReadWhere,
    order?: { createdAt: "ASC" | "DESC" }
  ): Promise<RegistrationWriteRecord[]> {
    return this.registrations
      .find({
        where: toEntityWhere(where),
        order: order ? { createdAt: order.createdAt } : undefined,
      })
      .then((rows) => rows.map(asRegistrationWriteRecord));
  }

  findOneInManager(
    manager: EntityManager,
    where: RegistrationReadWhere
  ): Promise<RegistrationWriteRecord | null> {
    return manager
      .findOne(RegistrationEntity, { where: toEntityWhere(where) })
      .then((row) => (row ? asRegistrationWriteRecord(row) : null));
  }

  findOneDetailStandalone(where: RegistrationReadWhere): Promise<RegistrationReadDetailRecord | null> {
    return this.registrations
      .findOne({ where: toEntityWhere(where) })
      .then((row) => (row ? asRegistrationReadDetailRecord(row) : null));
  }

  lockForFinancialMutation(
    manager: EntityManager,
    where: RegistrationReadWhere
  ): Promise<RegistrationWriteRecord> {
    return lockRegistrationForFinancialMutation(manager, where);
  }
}
