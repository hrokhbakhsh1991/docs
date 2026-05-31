import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

import { getIdempotentEntityManager } from "../../idempotency/idempotent-transaction.context";
import {
  TOUR_CAPACITY_RESERVATION_PORT,
  type TourCapacityReservationPort,
} from "../../tours/domain/ports/tour-capacity-reservation.port";
import {
  clearRegistrationCapacityCompensations,
  runWithRegistrationCapacityCompensation,
  takePendingRegistrationCapacityCompensations,
} from "../repositories/registration-capacity-compensation.scope";

/**
 * Runs registration mutations inside the idempotent HTTP transaction when present,
 * otherwise opens a dedicated DB transaction. Rolls back reserved capacity on failure.
 */
@Injectable()
export class RegistrationTransactionRunner {
  private readonly logger = new Logger(RegistrationTransactionRunner.name);

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(TOUR_CAPACITY_RESERVATION_PORT)
    private readonly tourCapacityReservationPort: TourCapacityReservationPort,
  ) {}

  get activeManager(): EntityManager {
    return getIdempotentEntityManager() ?? this.dataSource.manager;
  }

  async runInIdempotentOrOwnTransaction<T>(
    fn: (_manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return runWithRegistrationCapacityCompensation(async () => {
      const em = getIdempotentEntityManager();
      try {
        const result = em ? await fn(em) : await this.dataSource.transaction(fn);
        clearRegistrationCapacityCompensations();
        return result;
      } catch (error) {
        await this.compensatePendingRegistrationCapacitySlots();
        throw error;
      }
    });
  }

  private async compensatePendingRegistrationCapacitySlots(): Promise<void> {
    const pending = takePendingRegistrationCapacityCompensations();
    for (const slot of pending) {
      try {
        await this.tourCapacityReservationPort.releaseTicket(slot);
      } catch (releaseError: unknown) {
        this.logger.warn(
          `registration_capacity_compensation_failed tour=${slot.tourId} tenant=${slot.tenantId}: ${String(releaseError)}`,
        );
      }
    }
  }
}
