import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EquipmentSettingsService } from "./equipment-settings.service";
import { WorkspaceDestinationEntity } from "./entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "./entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "./entities/workspace-guide-language.entity";
import { WorkspaceRegionEntity } from "./entities/workspace-region.entity";
import { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";
import { SettingsDestinationsController } from "./settings-destinations.controller";
import { SettingsDestinationsService } from "./settings-destinations.service";
import { GuideLanguagesSettingsService } from "./guide-languages-settings.service";
import { SettingsEquipmentController } from "./settings-equipment.controller";
import { SettingsGuideLanguagesController } from "./settings-guide-languages.controller";
import { SettingsTourThemesController } from "./settings-tour-themes.controller";
import { SettingsRegionsController } from "./settings-regions.controller";
import { SettingsRegionsService } from "./settings-regions.service";
import { TourThemesSettingsService } from "./tour-themes-settings.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceRegionEntity,
      WorkspaceDestinationEntity,
      WorkspaceEquipmentItemEntity,
      WorkspaceGuideLanguageEntity,
      WorkspaceTourThemeEntity
    ])
  ],
  controllers: [
    SettingsRegionsController,
    SettingsDestinationsController,
    SettingsEquipmentController,
    SettingsGuideLanguagesController,
    SettingsTourThemesController
  ],
  providers: [
    SettingsRegionsService,
    SettingsDestinationsService,
    EquipmentSettingsService,
    GuideLanguagesSettingsService,
    TourThemesSettingsService
  ]
})
export class SettingsLocationsModule {}
