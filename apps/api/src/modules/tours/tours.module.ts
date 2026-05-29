/**
 * Tours module: sellable capacity and pricing snapshots tie to `tour_departures`; bookings reference it via
 * `registrations.tour_departure_id` (see migrations and RegistrationsModule).
 */
import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { AuthModule } from "../auth/auth.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { IdentityModule } from "../identity/identity.module";
import { SettingsLocationsModule } from "../settings-locations/settings-locations.module";
import { DashboardAggregateController } from "./dashboard-aggregate.controller";
import { ToursController } from "./tours.controller";
import { TourDetails } from "./entities/tour-details.entity";
import { TourEntity } from "./entities/tour.entity";
import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourPriceEntity } from "./entities/tour-price.entity";
import { TourProductEntity } from "./entities/tour-product.entity";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";
import {
  TOURS_WRITE_REPOSITORY_PORT,
} from "./domain/ports/tours-repository.port";
import { TypeOrmToursWriteRepository } from "./repositories/typeorm-tours-write.repository";
import { ToursCatalogModule } from "./tours-catalog.module";
import { ToursCloneService } from "./services/tours-clone.service";
import { ToursService } from "./tours.service";
import { StorageModule } from "../../infra/storage/storage.module";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    DatabaseModule,
    ToursCatalogModule,
    TypeOrmModule.forFeature([
      TourEntity,
      TourDetails,
      TourProductEntity,
      TourDepartureEntity,
      TourPriceEntity,
    ]),
    AuthModule,
    IdempotencyModule,
    forwardRef(() => RegistrationsModule),
    IdentityModule,
    SettingsLocationsModule,
    StorageModule,
  ],
  controllers: [ToursController, DashboardAggregateController],
  providers: [
    {
      provide: TOURS_WRITE_REPOSITORY_PORT,
      useClass: TypeOrmToursWriteRepository,
    },
    ToursCatalogReadApplicationService,
    ToursCloneService,
    ToursService,
    ThrottlerGuard,
  ],
  exports: [ToursCatalogModule],
})
export class ToursModule {}
