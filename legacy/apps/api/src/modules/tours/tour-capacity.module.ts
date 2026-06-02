/**
 * Redis-backed tour capacity reservation port without pulling in RegistrationsModule.
 */
import { Module } from "@nestjs/common";
import { RedisInfraModule } from "../../infra/redis/redis.module";
import { TOUR_CAPACITY_RESERVATION_PORT } from "./domain/ports/tour-capacity-reservation.port";
import { RedisTourCapacityReservationService } from "./infrastructure/redis-tour-capacity-reservation.service";

@Module({
  imports: [RedisInfraModule],
  providers: [
    RedisTourCapacityReservationService,
    {
      provide: TOUR_CAPACITY_RESERVATION_PORT,
      useExisting: RedisTourCapacityReservationService,
    },
  ],
  exports: [TOUR_CAPACITY_RESERVATION_PORT],
})
export class TourCapacityModule {}
