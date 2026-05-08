import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, IsNull, Repository } from "typeorm";
import { TenantUsageMeteringService } from "../../common/billing/tenant-usage-metering.service";
import { TenantEntity as IdentityTenantEntity } from "../identity/entities/tenant.entity";
import { OutboxService } from "../outbox/outbox.service";
import { TourEntity } from "../tours/entities/tour.entity";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../registrations/registration.entity";
import {
  WaitlistItemEntity,
  WaitlistItemStatus
} from "../registrations/waitlist-item.entity";
import { RegistrationsService } from "../registrations/registrations.service";
import { TenantRateLimitService } from "../../common/tenant-abuse/tenant-rate-limit.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import { enforceBackgroundTenantRuntimePolicies } from "../../common/tenant/tenant-runtime-policy";

const TOUR_PAGE_SIZE = 50;
const MAX_PROMOTIONS_PER_TOUR_PER_RUN = 50;

export type ReconciliationRuntimeSnapshot = {
  lastRunAt: string | null;
  lastReconciliationAt: string | null;
  lastRunHadDrift: boolean;
  promotedInLastRun: number;
  totalDriftsDetected: number;
  totalCorrectionsApplied: number;
  totalPromotionsTriggered: number;
};

@Injectable()
export class ReconciliationService {
  private lastRunAt: string | null = null;
  private lastReconciliationAt: string | null = null;
  private lastRunHadDrift = false;
  private promotedInLastRun = 0;
  private totalDriftsDetected = 0;
  private totalCorrectionsApplied = 0;
  private totalPromotionsTriggered = 0;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly registrationsService: RegistrationsService,
    @InjectRepository(IdentityTenantEntity)
    private readonly identityTenantRepository: Repository<IdentityTenantEntity>,
    private readonly tenantRateLimitService: TenantRateLimitService,
    private readonly tenantUsageMeteringService: TenantUsageMeteringService,
    private readonly tenantDbContext: TenantDbContextService
  ) {}

  getSnapshot(): ReconciliationRuntimeSnapshot {
    return {
      lastRunAt: this.lastRunAt,
      lastReconciliationAt: this.lastReconciliationAt,
      lastRunHadDrift: this.lastRunHadDrift,
      promotedInLastRun: this.promotedInLastRun,
      totalDriftsDetected: this.totalDriftsDetected,
      totalCorrectionsApplied: this.totalCorrectionsApplied,
      totalPromotionsTriggered: this.totalPromotionsTriggered
    };
  }

  async runReconciliationCycle(): Promise<void> {
    const tenants = await this.identityTenantRepository.find({
      select: { id: true },
      where: { deletedAt: IsNull() }
    });

    let driftThisRun = false;
    let promotedThisRun = 0;

    for (const { id: tenantId } of tenants) {
      const runtimeAllowed = await enforceBackgroundTenantRuntimePolicies(tenantId, {
        tryConsumeBackgroundJob: async (currentTenantId) =>
          this.tenantUsageMeteringService.tryConsumeBackgroundJob(currentTenantId),
        tryConsumeTenantJobRateLimit: async (currentTenantId) =>
          this.tenantRateLimitService.tryConsumeJobForTenant(currentTenantId)
      });
      if (!runtimeAllowed) {
        continue;
      }

      let skip = 0;
      while (true) {
        const tours = await this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
          return manager.find(TourEntity, {
            where: { tenantId },
            order: { id: "ASC" },
            take: TOUR_PAGE_SIZE,
            skip
          });
        });

        if (tours.length === 0) {
          break;
        }

        for (const tour of tours) {
          const { drift, promotions } = await this.tenantDbContext.runInTenantScope(
            tour.tenantId,
            async (manager) => this.reconcileSingleTour(manager, tour)
          );
          if (drift) {
            driftThisRun = true;
          }
          promotedThisRun += promotions;
        }

        skip += TOUR_PAGE_SIZE;
      }
    }

    const nowIso = new Date().toISOString();
    this.lastRunAt = nowIso;
    this.lastReconciliationAt = nowIso;
    this.lastRunHadDrift = driftThisRun;
    this.promotedInLastRun = promotedThisRun;
  }

  private async reconcileSingleTour(
    manager: EntityManager,
    tour: TourEntity
  ): Promise<{ drift: boolean; promotions: number }> {
    const lockedTour = await this.registrationsService.lockTourRowForUpdate(
      manager,
      tour.id,
      tour.tenantId
    );

    const realCount = await manager.count(RegistrationEntity, {
      where: {
        tourId: tour.id,
        tenantId: tour.tenantId,
        status: In([RegistrationStatus.ACCEPTED, RegistrationStatus.ACCEPTED_PAID])
      }
    });

    let drift = false;
    if (lockedTour.acceptedCount !== realCount) {
      drift = true;
      this.totalDriftsDetected += 1;
      this.totalCorrectionsApplied += 1;

      const oldAcceptedCount = lockedTour.acceptedCount;
      lockedTour.acceptedCount = realCount;
      await manager.save(lockedTour);

      await this.outboxService.addEvent(manager, {
        tenantId: tour.tenantId,
        aggregateType: "Tour",
        aggregateId: tour.id,
        eventType: "tour.capacity.reconciled",
        payload: {
          tourId: tour.id,
          oldAcceptedCount,
          correctedAcceptedCount: realCount,
          detectedAt: new Date().toISOString()
        }
      });
    }

    let promotions = 0;
    for (; promotions < MAX_PROMOTIONS_PER_TOUR_PER_RUN; promotions++) {
      const capacityAvailable =
        lockedTour.totalCapacity - lockedTour.acceptedCount;
      if (capacityAvailable <= 0) {
        break;
      }

      const hasWaiting = await manager.exists(WaitlistItemEntity, {
        where: {
          tourId: tour.id,
          tenantId: tour.tenantId,
          status: WaitlistItemStatus.WAITING
        }
      });
      if (!hasWaiting) {
        break;
      }

      try {
        const promoted =
          await this.registrationsService.promoteNextWaitlistSlotIfEligible(
            manager,
            tour.tenantId,
            tour.id,
            lockedTour
          );
        if (!promoted) {
          break;
        }
      } catch {
        break;
      }
    }

    this.totalPromotionsTriggered += promotions;

    return { drift, promotions };
  }

}
