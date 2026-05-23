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
import { WorkspaceTourCreationPresetEntity } from "../settings-locations/entities/workspace-tour-creation-preset.entity";
import { WorkspaceTourWizardTemplateEntity } from "../settings-locations/entities/workspace-tour-wizard-template.entity";
import { TourDetails } from "./entities/tour-details.entity";
import { TourEntity } from "./entities/tour.entity";
import { TourWizardDraftEntity } from "./entities/tour-wizard-draft.entity";
import { TourDepartureEntity } from "./entities/tour-departure.entity";
import { TourPriceEntity } from "./entities/tour-price.entity";
import { UserTenantEntity } from "../identity/entities/user-tenant.entity";
import { TourProductEntity } from "./entities/tour-product.entity";
import { ToursCatalogReadApplicationService } from "./application/tours-catalog-read.application.service";
import { ToursCloneService } from "./services/tours-clone.service";
import { ToursService } from "./tours.service";
import { ToursDraftsController } from "./tours.drafts.controller";
import { StorageModule } from "../../infra/storage/storage.module";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TourEntity,
      TourDetails,
      TourWizardDraftEntity,
      TourProductEntity,
      TourDepartureEntity,
      TourPriceEntity,
      WorkspaceDestinationEntity,
      WorkspaceEquipmentItemEntity,
      WorkspaceTourThemeEntity,
      WorkspaceTourWizardTemplateEntity,
      WorkspaceTourCreationPresetEntity,
      WorkspaceGuideLanguageEntity,
      UserTenantEntity,
    ]),
    AuthModule,
    IdempotencyModule,
    RegistrationsModule,
    StorageModule
  ],
  controllers: [ToursController, DashboardAggregateController, ToursDraftsController],
  providers: [ToursCatalogReadApplicationService, ToursCloneService, ToursService, ThrottlerGuard]
})
export class ToursModule {}
