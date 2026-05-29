/**
 * TypeORM adapter for {@link PaymentRepositoryPort}.
 * Sole payments-module site for `@InjectRepository` / payment persistence reads and writes.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial, EntityManager, FindOptionsWhere } from "typeorm";
import { DataSource, IsNull, Not, Repository } from "typeorm";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";

import { TenantEntity } from "../../identity/entities/tenant.entity";
import { BookingPriceSnapshotEntity } from "../../pricing/entities/booking-price-snapshot.entity";
import { RegistrationEntity } from "../../registrations/registration.entity";
import { PaymentEntity, PaymentMethod, PaymentStatus } from "../entities/payment.entity";
import type { BookingPriceSnapshotRecord } from "../domain/booking-price-snapshot.types";
import type { PaymentRecord, PaymentRegistrationRef } from "../domain/payment-record.types";
import type {
  PaymentRegistrationLookup,
  PaymentRegistrationSnapshot,
} from "../domain/payment-registration.types";
import type {
  PaymentRegistrationStatusRow,
  PaymentRepositoryPort
} from "../domain/ports/payment-repository.port";

const asPayment = (row: PaymentEntity | null): PaymentRecord | null => row;
const asPaymentList = (rows: PaymentEntity[]): PaymentRecord[] => rows;

const asRegistrationSnapshot = (row: RegistrationEntity | null): PaymentRegistrationSnapshot | null =>
  row
    ? {
        id: row.id,
        tenantId: row.tenantId,
        tourId: row.tourId,
        status: row.status,
      }
    : null;

function toRegistrationEntityWhere(
  lookup: PaymentRegistrationLookup
): FindOptionsWhere<RegistrationEntity> | FindOptionsWhere<RegistrationEntity>[] {
  return lookup as FindOptionsWhere<RegistrationEntity> | FindOptionsWhere<RegistrationEntity>[];
}

@Injectable()
export class TypeOrmPaymentRepository implements PaymentRepositoryPort {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  getDefaultEntityManager(): EntityManager {
    return this.paymentRepository.manager;
  }

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }

  async listByTenant(tenantId: string, limit = 100): Promise<PaymentRecord[]> {
    return asPaymentList(await this.paymentRepository.find({
      where: { tenantId, deletedAt: IsNull() },
      order: { createdAt: "DESC" },
      take: limit
    }));
  }

  async listManualByTenant(tenantId: string, limit = 100): Promise<PaymentRecord[]> {
    return asPaymentList(await this.paymentRepository.find({
      where: { tenantId, method: PaymentMethod.MANUAL },
      order: { createdAt: "DESC" },
      take: limit
    }));
  }

  async findLatestByRegistration(
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    return asPayment(await this.paymentRepository.findOne({
      where: {
        registrationId,
        tenantId,
        deletedAt: IsNull()
      },
      order: { createdAt: "DESC" }
    }));
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    return asPayment(
      await this.paymentRepository.findOne({
        where: {
          providerPaymentId,
          tenantId
        }
      })
    );
  }

  async findByProviderPaymentIdWithManager(
    manager: EntityManager,
    providerPaymentId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    return asPayment(
      await manager.findOne(PaymentEntity, {
        where: {
          providerPaymentId,
          tenantId
        }
      })
    );
  }

  async findPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    return asPayment(
      await manager.findOne(PaymentEntity, {
        where: {
          registrationId,
          tenantId,
          status: PaymentStatus.PENDING
        }
      })
    );
  }

  async findPaidForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    return asPayment(
      await manager.findOne(PaymentEntity, {
        where: {
          registrationId,
          tenantId,
          status: PaymentStatus.PAID
        }
      })
    );
  }

  findStatusesByRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRegistrationStatusRow[]> {
    return manager.find(PaymentEntity, {
      where: {
        registrationId,
        tenantId
      },
      select: { status: true }
    });
  }

  existsPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<boolean> {
    return manager.exists(PaymentEntity, {
      where: {
        registrationId,
        tenantId,
        status: PaymentStatus.PENDING
      }
    });
  }

  existsPaidForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<boolean> {
    return manager.exists(PaymentEntity, {
      where: {
        registrationId,
        tenantId,
        status: PaymentStatus.PAID
      }
    });
  }

  existsOtherPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string,
    excludePaymentId: string
  ): Promise<boolean> {
    return manager.exists(PaymentEntity, {
      where: {
        registrationId,
        tenantId,
        status: PaymentStatus.PENDING,
        id: Not(excludePaymentId)
      }
    });
  }

  createPayment(manager: EntityManager, data: DeepPartial<PaymentRecord>): PaymentRecord {
    return asPayment(manager.create(PaymentEntity, data as DeepPartial<PaymentEntity>))!;
  }

  async savePayment(manager: EntityManager, payment: PaymentRecord): Promise<PaymentRecord> {
    const saved = await manager.save(payment as PaymentEntity);
    return asPayment(saved)!;
  }

  async listActiveTenantIds(): Promise<string[]> {
    const tenants = await this.tenantRepository.find({
      select: { id: true },
      where: { deletedAt: IsNull() }
    });
    return tenants.map((tenant) => tenant.id);
  }

  async findLockedTimedOutPending(
    manager: EntityManager,
    tenantId: string,
    threshold: Date,
    batch: number
  ): Promise<PaymentRecord[]> {
    const rows = await manager
      .getRepository(PaymentEntity)
      .createQueryBuilder("p")
      .where("p.tenant_id = :tenantId", { tenantId })
      .andWhere("p.status = :status", { status: PaymentStatus.PENDING })
      .andWhere("p.created_at <= :threshold", { threshold })
      .orderBy("p.created_at", "ASC")
      .take(batch)
      .setLock("pessimistic_write")
      .setOnLocked("skip_locked")
      .getMany();
    return asPaymentList(rows);
  }

  findRegistrationByTenantAndId(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRegistrationRef | null> {
    return manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId },
      select: { id: true, tenantId: true },
    });
  }

  async findRegistrationSnapshot(
    manager: EntityManager,
    lookup: PaymentRegistrationLookup
  ): Promise<PaymentRegistrationSnapshot | null> {
    return asRegistrationSnapshot(
      await manager.findOne(RegistrationEntity, {
        where: toRegistrationEntityWhere(lookup),
      })
    );
  }

  async lockRegistrationSnapshot(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<PaymentRegistrationSnapshot> {
    const row = await manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId },
      lock: { mode: "pessimistic_write" },
    });
    const snapshot = asRegistrationSnapshot(row);
    if (!snapshot) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return snapshot;
  }

  async findRegistrationPeek(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<Pick<PaymentRegistrationSnapshot, "id" | "tenantId" | "tourId"> | null> {
    const row = await manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId },
      select: { id: true, tourId: true, tenantId: true },
    });
    if (!row) {
      return null;
    }
    return { id: row.id, tenantId: row.tenantId, tourId: row.tourId };
  }

  existsBookingPriceSnapshot(
    manager: EntityManager,
    tenantId: string,
    bookingId: string
  ): Promise<boolean> {
    return manager.exists(BookingPriceSnapshotEntity, {
      where: { bookingId, tenantId },
    });
  }

  async findCanonicalBookingPriceSnapshot(
    manager: EntityManager,
    tenantId: string,
    bookingId: string
  ): Promise<BookingPriceSnapshotRecord | null> {
    const row = await manager.getRepository(BookingPriceSnapshotEntity).findOne({
      where: {
        tenantId: tenantId.trim(),
        bookingId: bookingId.trim(),
      },
      order: { createdAt: "ASC" },
      select: { computedTotalMinor: true, currency: true },
    });
    if (!row) {
      return null;
    }
    return {
      computedTotalMinor: row.computedTotalMinor,
      currency: row.currency,
    };
  }
}
