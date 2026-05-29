/**
 * TypeORM adapter for {@link PaymentRepositoryPort}.
 * Sole payments-module site for `@InjectRepository` / payment persistence reads and writes.
 */
import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial, EntityManager } from "typeorm";
import { DataSource, IsNull, Not, Repository } from "typeorm";

import { TenantEntity } from "../../identity/entities/tenant.entity";
import { RegistrationEntity } from "../../registrations/registration.entity";
import { PaymentEntity, PaymentMethod, PaymentStatus } from "../entities/payment.entity";
import type { PaymentRecord } from "../domain/payment-record.types";
import type {
  PaymentRegistrationStatusRow,
  PaymentRepositoryPort
} from "../domain/ports/payment-repository.port";

const asPayment = (row: PaymentEntity | null): PaymentRecord | null => row;
const asPaymentList = (rows: PaymentEntity[]): PaymentRecord[] => rows;

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
  ): Promise<RegistrationEntity | null> {
    return manager.findOne(RegistrationEntity, {
      where: { id: registrationId, tenantId }
    });
  }
}
