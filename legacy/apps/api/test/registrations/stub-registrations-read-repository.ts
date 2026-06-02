import type { EntityManager } from "typeorm";
import { RegistrationEntity } from "../../src/modules/registrations/registration.entity";
import type { RegistrationReadDetailRecord } from "../../src/modules/registrations/domain/registration-read-detail.types";
import type {
  RegistrationReadWhere,
  RegistrationsReadRepositoryPort,
} from "../../src/modules/registrations/domain/ports/registrations-read.port";
import type { RegistrationWriteRecord } from "../../src/modules/registrations/domain/registration-write.types";

type RepoLike = {
  findOne(_opts: { where: unknown }): Promise<RegistrationEntity | null>;
};

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

function toEntityWhere(where: RegistrationReadWhere): unknown {
  if (Array.isArray(where)) {
    return where.map((clause) => {
      if (clause.status && typeof clause.status === "object" && "$in" in clause.status) {
        return { ...clause, status: { _type: "in", _value: clause.status.$in } };
      }
      return clause;
    });
  }
  if (where.status && typeof where.status === "object" && "$in" in where.status) {
    return { ...where, status: { _type: "in", _value: where.status.$in } };
  }
  return where;
}

/**
 * Test double for {@link RegistrationsReadRepositoryPort}: delegates reads to a repository-shaped mock.
 */
export function createRegistrationsReadRepositoryPortTestDouble(
  registrationRepository: RepoLike,
  _manager?: EntityManager
): RegistrationsReadRepositoryPort {
  const findOneInMgr = _manager
    ? (where: RegistrationReadWhere) =>
        _manager
          .findOne(RegistrationEntity, { where: toEntityWhere(where) as never })
          .then((row) => (row ? asRegistrationWriteRecord(row) : null))
    : (where: RegistrationReadWhere) =>
        registrationRepository
          .findOne({ where: toEntityWhere(where) })
          .then((row) => (row ? asRegistrationWriteRecord(row) : null));

  return {
    findOneStandalone(where) {
      return findOneInMgr(where);
    },
    findManyStandalone(where) {
      return registrationRepository
        .findOne({ where: toEntityWhere(where) })
        .then((row) => (row ? [asRegistrationWriteRecord(row)] : []));
    },
    findOneDetailStandalone(where) {
      return registrationRepository
        .findOne({ where: toEntityWhere(where) })
        .then((row) => (row ? asRegistrationReadDetailRecord(row) : null));
    },
    async lockForFinancialMutation(where) {
      const row = await findOneInMgr(where);
      if (!row) {
        throw new Error("registration not found for lockForFinancialMutation test double");
      }
      return row;
    },
  };
}

/** @deprecated Use {@link createRegistrationsReadRepositoryPortTestDouble}. */
export function createRegistrationsReadRepositoryTestDouble(
  registrationRepository: RepoLike
) {
  return createRegistrationsReadRepositoryPortTestDouble(
    registrationRepository,
    {
      findOne: (_entity, opts) =>
        registrationRepository.findOne({ where: (opts as { where?: unknown }).where ?? {} }),
    } as EntityManager
  );
}

/** Use when tests only hit transactional reads. */
export function createNullStandaloneRegistrationsReadTestDouble(
  manager: EntityManager
): RegistrationsReadRepositoryPort {
  return createRegistrationsReadRepositoryPortTestDouble(
    {
      async findOne() {
        return null;
      },
    },
    manager
  );
}

