import { Inject, Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";

import { DoubleBookingConflictException } from "../../../common/errors/double-booking-conflict.exception";
import {
  TOUR_CAPACITY_RESERVATION_PORT,
  type TourCapacityReservationPort,
} from "../../tours/domain/ports/tour-capacity-reservation.port";
import {
  REGISTRATIONS_TOUR_CATALOG_PORT,
  type RegistrationsTourCatalogPort,
  type TourCatalogSnapshot,
} from "../domain/ports/registrations-tour-catalog.port";
import { RegistrationStatus } from "../registration.entity";
import { isCapacityConsumingRegistrationStatus } from "../domain/registration-outbox-event-type";
import { registerRegistrationCapacityCompensation } from "../repositories/registration-capacity-compensation.scope";

@Injectable()
export class RegistrationCapacityService {
  constructor(
    @Inject(REGISTRATIONS_TOUR_CATALOG_PORT)
    private readonly registrationsTourCatalogPort: RegistrationsTourCatalogPort,
    @Inject(TOUR_CAPACITY_RESERVATION_PORT)
    private readonly tourCapacityReservationPort: TourCapacityReservationPort,
  ) {}

  calculateAcceptedCounterDelta(
    previousStatus: RegistrationStatus,
    targetStatus: RegistrationStatus,
  ): number {
    const wasAccepted = isCapacityConsumingRegistrationStatus(previousStatus);
    const willBeAccepted = isCapacityConsumingRegistrationStatus(targetStatus);
    if (wasAccepted === willBeAccepted) {
      return 0;
    }
    return willBeAccepted ? 1 : -1;
  }

  async consumeAcceptedCapacitySlot(
    manager: EntityManager,
    tour: TourCatalogSnapshot,
  ): Promise<TourCatalogSnapshot> {
    await this.tourCapacityReservationPort.reserveTicket({
      tenantId: tour.tenantId,
      tourId: tour.id,
      totalCapacity: tour.totalCapacity,
      acceptedCount: tour.acceptedCount,
    });
    try {
      const updated = await this.registrationsTourCatalogPort.tryIncrementAcceptedCountAtomic(
        manager,
        tour.id,
        tour.tenantId,
      );
      if (!updated) {
        throw new DoubleBookingConflictException();
      }
      registerRegistrationCapacityCompensation({
        tenantId: tour.tenantId,
        tourId: tour.id,
        totalCapacity: tour.totalCapacity,
      });
      return updated;
    } catch (error) {
      await this.tourCapacityReservationPort.releaseTicket({
        tenantId: tour.tenantId,
        tourId: tour.id,
        totalCapacity: tour.totalCapacity,
      });
      throw error;
    }
  }

  async releaseAcceptedCapacitySlot(
    manager: EntityManager,
    tour: TourCatalogSnapshot,
  ): Promise<TourCatalogSnapshot | null> {
    const updated = await this.registrationsTourCatalogPort.tryDecrementAcceptedCountAtomic(
      manager,
      tour.id,
      tour.tenantId,
    );
    if (updated) {
      await this.tourCapacityReservationPort.releaseTicket({
        tenantId: tour.tenantId,
        tourId: tour.id,
        totalCapacity: tour.totalCapacity,
      });
    }
    return updated;
  }
}
