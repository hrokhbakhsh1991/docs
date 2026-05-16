/**
 * Tours module: sellable capacity and pricing snapshots tie to `tour_departures`; bookings reference it via
 * `registrations.tour_departure_id` (see migrations and RegistrationsModule).
 */
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { DashboardAggregateController } from "./dashboard-aggregate.controller";
import { ToursController } from "./tours.controller";
import { WorkspaceDestinationEntity } from "../settings-locations/entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "../settings-locations/entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "../settings-locations/entities/workspace-guide-language.entity";
import { WorkspaceTourThemeEntity } from "../settings-locations/entities/workspace-tour-theme.entity";
import { TourDetails } from "./entities/tour-details.entity";
import { TourEntity } from "./entities/tour.entity";
import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourPriceEntity } from "./entities/tour-price.entity";
import { TourProductEntity } from "./entities/tour-product.entity";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";
import { ToursService } from "./tours.service";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TourEntity,
      TourDetails,
      TourProductEntity,
      TourDepartureEntity,
      TourPriceEntity,
      WorkspaceDestinationEntity,
      WorkspaceEquipmentItemEntity,
      WorkspaceTourThemeEntity,
      WorkspaceGuideLanguageEntity,
    ]),
    AuthModule,
    IdempotencyModule,
    RegistrationsModule
  ],
  controllers: [ToursController, DashboardAggregateController],
  providers: [ToursCatalogReadApplicationService, ToursService, ThrottlerGuard]
})
export class ToursModule {}
