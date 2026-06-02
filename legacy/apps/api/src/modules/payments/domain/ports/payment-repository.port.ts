import type { DeepPartial, EntityManager } from "typeorm";

import type { BookingPriceSnapshotRecord } from "../booking-price-snapshot.types";
import type { PaymentRecord, PaymentRegistrationRef } from "../payment-record.types";
import type {
  PaymentRegistrationLookup,
  PaymentRegistrationSnapshot,
} from "../payment-registration.types";
import type { PaymentMethod, PaymentStatus } from "../payment.types";

export const PAYMENT_REPOSITORY_PORT = Symbol("PAYMENT_REPOSITORY_PORT");

export type PaymentRegistrationStatusRow = Pick<PaymentRecord, "status">;

/**
 * Persistence port for payment reads/writes and transactional payment mutations.
 * Application services depend on this interface; TypeORM lives only in adapters.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces
 * for {@link EntityManager}, {@link DeepPartial}, etc. — see MAP §61.
 *
 * @see MAP §57 — `PaymentRepositoryPort`
 */
export interface PaymentRepositoryPort {
  /** Default manager for actor-scoped reads outside an explicit transaction. */
  getDefaultEntityManager(): EntityManager;

  /** Escape hatch for webhook and other multi-entity transactional flows. */
  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>;

  listByTenant(tenantId: string, limit?: number): Promise<PaymentRecord[]>;

  listManualByTenant(tenantId: string, limit?: number): Promise<PaymentRecord[]>;

  findLatestByRegistration(registrationId: string, tenantId: string): Promise<PaymentRecord | null>;

  findByProviderPaymentId(providerPaymentId: string, tenantId: string): Promise<PaymentRecord | null>;

  findByProviderPaymentIdWithManager(
    manager: EntityManager,
    providerPaymentId: string,
    tenantId: string
  ): Promise<PaymentRecord | null>;

  findPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRecord | null>;

  findPaidForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRecord | null>;

  findStatusesByRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRegistrationStatusRow[]>;

  existsPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<boolean>;

  existsPaidForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<boolean>;

  existsOtherPendingForRegistration(
    manager: EntityManager,
    registrationId: string,
    tenantId: string,
    excludePaymentId: string
  ): Promise<boolean>;

  createPayment(manager: EntityManager, data: DeepPartial<PaymentRecord>): PaymentRecord;

  savePayment(manager: EntityManager, payment: PaymentRecord): Promise<PaymentRecord>;

  listActiveTenantIds(): Promise<string[]>;

  findLockedTimedOutPending(
    manager: EntityManager,
    tenantId: string,
    threshold: Date,
    batch: number
  ): Promise<PaymentRecord[]>;

  findRegistrationByTenantAndId(
    manager: EntityManager,
    registrationId: string,
    tenantId: string
  ): Promise<PaymentRegistrationRef | null>;

  findRegistrationSnapshot(
    manager: EntityManager,
    lookup: PaymentRegistrationLookup
  ): Promise<PaymentRegistrationSnapshot | null>;

  lockRegistrationSnapshot(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<PaymentRegistrationSnapshot>;

  findRegistrationPeek(
    manager: EntityManager,
    tenantId: string,
    registrationId: string
  ): Promise<Pick<PaymentRegistrationSnapshot, "id" | "tenantId" | "tourId"> | null>;

  existsBookingPriceSnapshot(
    manager: EntityManager,
    tenantId: string,
    bookingId: string
  ): Promise<boolean>;

  findCanonicalBookingPriceSnapshot(
    manager: EntityManager,
    tenantId: string,
    bookingId: string
  ): Promise<BookingPriceSnapshotRecord | null>;
}

export type { PaymentMethod, PaymentRecord, PaymentStatus };
