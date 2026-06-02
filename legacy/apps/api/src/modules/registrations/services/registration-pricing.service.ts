import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { tryParseWorkspaceUserRole, UserRole } from "../../../common/auth/user-role.enum";
import { createPricingSnapshot } from "../../pricing/repositories/create-pricing-snapshot.repository";
import { BookingPriceSnapshotEntity } from "../../pricing/entities/booking-price-snapshot.entity";
import { PaymentStatus } from "../../payments/domain/payment.types";
import { PaymentEntity } from "../../payments/entities/payment.entity";
import { OutboxService } from "../../outbox/outbox.service";
import {
  BookingFinalizationPhase,
  assertSingleStepBookingFinalizationAdvance,
  bookingFinalizationPhaseFromFacts,
} from "../domain/booking-finalization-pipeline";
import { emitBookingFinalizationPipelineEvent } from "../registrations-effects";
import { RegistrationEntity, RegistrationStatus } from "../registration.entity";
import { PRICING_CATALOG_PORT, type PricingCatalogPort } from "../domain/ports/pricing-catalog.port";

@Injectable()
export class RegistrationPricingService {
  private readonly logger = new Logger(RegistrationPricingService.name);

  constructor(
    @Inject(RequestContextService) private readonly requestContextService: RequestContextService,
    @Inject(PRICING_CATALOG_PORT) private readonly pricingCatalogPort: PricingCatalogPort,
    @Inject(OutboxService) private readonly outboxService: OutboxService,
  ) {}

  async createAndStampSnapshot(
    manager: EntityManager,
    saved: RegistrationEntity,
  ): Promise<RegistrationEntity> {
    if (saved.snapshotId || !saved.id) {
      return saved;
    }

    const listMinor = saved.quotedListPriceMinor ?? saved.quotedTotalMinor;
    if (
      saved.quotedTotalMinor == null ||
      saved.quotedPricingVersion == null ||
      saved.quotedCurrencyCode == null ||
      listMinor == null
    ) {
      this.logger.warn(
        JSON.stringify({
          event: "SNAPSHOT_SKIPPED_INCOMPLETE_QUOTE",
          tenant_id: saved.tenantId,
          registration_id: saved.id,
          message: "Quote columns incomplete; snapshot not created for this registration.",
        }),
      );
      return saved;
    }

    try {
      await this.pricingCatalogPort.quote(
        {
          tenantId: saved.tenantId,
          tourId: saved.tourId,
          departureId: saved.tourDepartureId,
          userRole: tryParseWorkspaceUserRole(this.requestContextService.getRole()) ?? UserRole.Member,
          discountCode: null,
        },
        { financeShadowCompare: true },
      );
    } catch (shadowErr: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: "PRICING_SHADOW_COMPARE_ERROR",
          tenant_id: saved.tenantId,
          registration_id: saved.id,
          message: shadowErr instanceof Error ? shadowErr.message : String(shadowErr),
        }),
      );
    }

    const snapshot = await createPricingSnapshot(manager, {
      tenantId: saved.tenantId,
      bookingId: saved.id,
      listPriceMinor: String(listMinor),
      currency: String(saved.quotedCurrencyCode),
      pricingRuleVersion: String(saved.quotedPricingVersion),
      computedTotalMinor: String(saved.quotedTotalMinor),
    });

    await manager.update(
      RegistrationEntity,
      { id: saved.id, tenantId: saved.tenantId },
      { snapshotId: snapshot.snapshotId },
    );
    saved.snapshotId = snapshot.snapshotId;

    this.logger.log(
      JSON.stringify({
        event: "BOOKING_PRICE_SNAPSHOT_CREATED",
        tenant_id: saved.tenantId,
        registration_id: saved.id,
        snapshot_id: snapshot.snapshotId,
        computed_total_minor: snapshot.computedTotalMinor,
        currency: snapshot.currency,
      }),
    );

    return saved;
  }

  async restoreImmutableRegistrationQuoteColumns(
    manager: EntityManager,
    registration: RegistrationEntity,
  ): Promise<void> {
    if (!registration.id) {
      return;
    }
    const hasSnap = await manager.exists(BookingPriceSnapshotEntity, {
      where: { bookingId: registration.id, tenantId: registration.tenantId },
    });
    if (!hasSnap) {
      return;
    }
    const persisted = await manager.findOne(RegistrationEntity, {
      where: { id: registration.id, tenantId: registration.tenantId },
      select: {
        id: true,
        tenantId: true,
        quotedListPriceMinor: true,
        quotedCurrencyCode: true,
        quotedTotalMinor: true,
        quotedPricingVersion: true,
        quotedLineItemsJson: true,
      },
    });
    if (!persisted) {
      return;
    }
    registration.quotedListPriceMinor = persisted.quotedListPriceMinor;
    registration.quotedCurrencyCode = persisted.quotedCurrencyCode;
    registration.quotedTotalMinor = persisted.quotedTotalMinor;
    registration.quotedPricingVersion = persisted.quotedPricingVersion;
    registration.quotedLineItemsJson = persisted.quotedLineItemsJson;
  }

  async ensureBookingPriceSnapshotLockedAndEmit(
    manager: EntityManager,
    saved: RegistrationEntity,
  ): Promise<void> {
    if (!saved.id || saved.snapshotId) {
      return;
    }
    if (
      await manager.exists(BookingPriceSnapshotEntity, {
        where: { bookingId: saved.id, tenantId: saved.tenantId },
      })
    ) {
      return;
    }

    const hasPending = await manager.exists(PaymentEntity, {
      where: {
        registrationId: saved.id,
        tenantId: saved.tenantId,
        status: PaymentStatus.PENDING,
      },
    });
    const hasPaid = await manager.exists(PaymentEntity, {
      where: {
        registrationId: saved.id,
        tenantId: saved.tenantId,
        status: PaymentStatus.PAID,
      },
    });
    const listMinor = saved.quotedListPriceMinor ?? saved.quotedTotalMinor;
    const quoteComplete =
      saved.quotedTotalMinor != null &&
      saved.quotedPricingVersion != null &&
      saved.quotedCurrencyCode != null &&
      listMinor != null;

    if (!quoteComplete) {
      if (hasPending || hasPaid) {
        throw new ConflictException({
          error: {
            code: "BOOKING_PRICING_SNAPSHOT_INCOMPLETE_WITH_PAYMENT",
            message:
              "Payment rows exist for this booking but the persisted quote columns are incomplete — cannot build or verify an immutable snapshot.",
          },
        });
      }
      return;
    }

    if (hasPending || hasPaid) {
      throw new ConflictException({
        error: {
          code: "BOOKING_PRICE_SNAPSHOT_MISSING_WITH_PAYMENT",
          message:
            "Payment activity exists for this booking without an immutable booking price snapshot — data invariant violated.",
        },
      });
    }

    const phaseBefore = bookingFinalizationPhaseFromFacts({
      hasPriceSnapshot: false,
      hasPendingPayment: hasPending,
      hasCapturedPayment: hasPaid,
      registrationFinanciallyConfirmed: saved.status === RegistrationStatus.ACCEPTED_PAID,
    });
    assertSingleStepBookingFinalizationAdvance(
      phaseBefore,
      BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
      "lockBookingPriceSnapshot",
    );
    const row = await createPricingSnapshot(manager, {
      tenantId: saved.tenantId,
      bookingId: saved.id,
      listPriceMinor: String(listMinor),
      currency: String(saved.quotedCurrencyCode),
      pricingRuleVersion: String(saved.quotedPricingVersion),
      computedTotalMinor: String(saved.quotedTotalMinor),
    });
    await emitBookingFinalizationPipelineEvent({
      manager,
      outboxService: this.outboxService,
      tenantId: saved.tenantId,
      registrationId: saved.id,
      phase: BookingFinalizationPhase.PRICE_SNAPSHOT_LOCKED,
      metadata: { snapshotId: row.snapshotId },
    });
  }
}
