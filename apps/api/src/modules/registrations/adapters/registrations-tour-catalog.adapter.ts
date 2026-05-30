import { Injectable, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { In } from "typeorm";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import { RegistrationsTourCatalogPort, TourCatalogSnapshot } from "../domain/ports/registrations-tour-catalog.port";
import { TourEntity } from "../../tours/entities/tour.entity";
import { TourDetails } from "../../tours/entities/tour-details.entity";
import { TourDepartureEntity } from "../../tours/entities/tour-departure.entity";

type TourCapacityRow = {
  id: string;
  tenant_id: string;
  title: string | null;
  lifecycle_status: string;
  accepted_count: number;
  total_capacity: number;
  auto_accept_registrations: boolean | null;
  cost_context: Record<string, unknown> | null;
  tour_departure_id: string | null;
  transport_modes: string[] | null;
};

@Injectable()
export class RegistrationsTourCatalogAdapter implements RegistrationsTourCatalogPort {
  private async loadDetails(
    manager: EntityManager,
    tourId: string,
    tour: TourEntity
  ): Promise<TourCatalogSnapshot["details"]> {
    const details = await manager.findOne(TourDetails, { where: { tourId } });
    if (details) {
      return { tripDetails: details.tripDetails as Record<string, unknown> | null };
    }
    if (tour.details) {
      return { tripDetails: tour.details.tripDetails as Record<string, unknown> | null };
    }
    return null;
  }

  private rowToSnapshot(row: TourCapacityRow, details: TourCatalogSnapshot["details"]): TourCatalogSnapshot {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title ?? undefined,
      lifecycleStatus: row.lifecycle_status,
      acceptedCount: Number(row.accepted_count),
      totalCapacity: Number(row.total_capacity),
      autoAcceptRegistrations: row.auto_accept_registrations ?? null,
      costContext: row.cost_context,
      details,
      tourDepartureId: row.tour_departure_id ?? null,
      transportModes: row.transport_modes ?? undefined,
    };
  }

  private async snapshotFromEntity(
    manager: EntityManager,
    tour: TourEntity
  ): Promise<TourCatalogSnapshot> {
    const details = await this.loadDetails(manager, tour.id, tour);
    return {
      id: tour.id,
      tenantId: tour.tenantId,
      title: tour.title,
      lifecycleStatus: tour.lifecycleStatus,
      acceptedCount: tour.acceptedCount,
      totalCapacity: tour.totalCapacity,
      autoAcceptRegistrations: tour.autoAcceptRegistrations ?? null,
      costContext: tour.costContext as Record<string, unknown> | null,
      details,
      tourDepartureId: tour.tourDepartureId ?? null,
      transportModes: tour.transportModes,
    };
  }

  async getTourSnapshot(manager: EntityManager, tourId: string): Promise<TourCatalogSnapshot | null> {
    const tour = await manager.findOne(TourEntity, { where: { id: tourId } });
    if (!tour) return null;
    return this.snapshotFromEntity(manager, tour);
  }

  async lockTourSnapshot(manager: EntityManager, tourId: string, tenantId: string): Promise<TourCatalogSnapshot | null> {
    const tour = await manager
      .getRepository(TourEntity)
      .createQueryBuilder("tour")
      .setLock("pessimistic_write")
      .where("tour.id = :tourId", { tourId })
      .andWhere("tour.tenant_id = :tenantId", { tenantId })
      .getOne();

    if (!tour) return null;
    return this.snapshotFromEntity(manager, tour);
  }

  async getTourTitles(manager: EntityManager, tourIds: string[], tenantId: string): Promise<Map<string, string>> {
    const tours = await manager.find(TourEntity, {
      where: { id: In(tourIds), tenantId },
      select: ["id", "title"],
    });

    return new Map(tours.map((t) => [t.id, t.title?.trim() || t.id]));
  }

  async tryIncrementAcceptedCountAtomic(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourCatalogSnapshot | null> {
    const rows = (await manager.query(
      `
      UPDATE tours
      SET accepted_count = accepted_count + 1, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND accepted_count < total_capacity
      RETURNING
        id,
        tenant_id,
        title,
        lifecycle_status,
        accepted_count,
        total_capacity,
        auto_accept_registrations,
        cost_context,
        tour_departure_id,
        transport_modes
      `,
      [tourId, tenantId]
    )) as TourCapacityRow[];

    if (!rows?.length) {
      return null;
    }

    const tour = await manager.findOne(TourEntity, { where: { id: tourId, tenantId } });
    if (!tour) {
      return null;
    }
    const details = await this.loadDetails(manager, tourId, tour);
    const snapshot = this.rowToSnapshot(rows[0], details);
    await this.syncTourDepartureCapacity(
      manager,
      snapshot.id,
      snapshot.tenantId,
      snapshot.acceptedCount,
      snapshot.totalCapacity,
      snapshot.lifecycleStatus
    );
    return snapshot;
  }

  async tryDecrementAcceptedCountAtomic(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourCatalogSnapshot | null> {
    const rows = (await manager.query(
      `
      UPDATE tours
      SET accepted_count = accepted_count - 1, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND accepted_count > 0
      RETURNING
        id,
        tenant_id,
        title,
        lifecycle_status,
        accepted_count,
        total_capacity,
        auto_accept_registrations,
        cost_context,
        tour_departure_id,
        transport_modes
      `,
      [tourId, tenantId]
    )) as TourCapacityRow[];

    if (!rows?.length) {
      return null;
    }

    const tour = await manager.findOne(TourEntity, { where: { id: tourId, tenantId } });
    if (!tour) {
      return null;
    }
    const details = await this.loadDetails(manager, tourId, tour);
    const snapshot = this.rowToSnapshot(rows[0], details);
    await this.syncTourDepartureCapacity(
      manager,
      snapshot.id,
      snapshot.tenantId,
      snapshot.acceptedCount,
      snapshot.totalCapacity,
      snapshot.lifecycleStatus
    );
    return snapshot;
  }

  async applyAcceptedCounterDelta(
    manager: EntityManager,
    tourId: string,
    tenantId: string,
    delta: number
  ): Promise<void> {
    if (delta > 0) {
      const updated = await this.tryIncrementAcceptedCountAtomic(manager, tourId, tenantId);
      if (!updated) {
        throw new NotFoundException("Tour capacity increment failed");
      }
      return;
    }
    if (delta < 0) {
      const steps = Math.abs(delta);
      for (let i = 0; i < steps; i += 1) {
        const updated = await this.tryDecrementAcceptedCountAtomic(manager, tourId, tenantId);
        if (!updated) {
          throw new NotFoundException("Tour capacity decrement failed");
        }
      }
    }
  }

  async syncTourDepartureCapacity(
    manager: EntityManager,
    tourId: string,
    tenantId: string,
    acceptedCount: number,
    totalCapacity: number,
    lifecycleStatus: string
  ): Promise<void> {
    await manager.update(
      TourDepartureEntity,
      { id: tourId, tenantId },
      {
        soldCount: acceptedCount,
        capacityTotal: totalCapacity,
        lifecycleStatus: lifecycleStatus as TourLifecycleStatus,
      }
    );
  }
}
