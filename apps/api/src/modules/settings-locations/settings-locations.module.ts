import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { IdempotencyModule } from "../idempotency/idempotency.module";
import { EquipmentSettingsService } from "./equipment-settings.service";
import { WorkspaceDestinationEntity } from "./entities/workspace-destination.entity";
import { WorkspaceEquipmentItemEntity } from "./entities/workspace-equipment-item.entity";
import { WorkspaceGuideLanguageEntity } from "./entities/workspace-guide-language.entity";
import { WorkspaceRegionEntity } from "./entities/workspace-region.entity";
import { WorkspaceTourCreationPresetEntity } from "./entities/workspace-tour-creation-preset.entity";
import { WorkspaceTourThemeEntity } from "./entities/workspace-tour-theme.entity";
import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";
import { SettingsDestinationsController } from "./settings-destinations.controller";
import { SettingsDestinationsService } from "./settings-destinations.service";
import { GuideLanguagesSettingsService } from "./guide-languages-settings.service";
import { SettingsEquipmentController } from "./settings-equipment.controller";
import { SettingsGuideLanguagesController } from "./settings-guide-languages.controller";
import { SettingsTourCreationPresetsController } from "./settings-tour-creation-presets.controller";
import { SettingsTourWizardTemplateController } from "./settings-tour-wizard-template.controller";
import { SettingsTourThemesController } from "./settings-tour-themes.controller";
import { SettingsRegionsController } from "./settings-regions.controller";
import { SettingsRegionsService } from "./settings-regions.service";
import { TourCreationPresetsSettingsService } from "./tour-creation-presets-settings.service";
import { TourWizardTemplateSettingsService } from "./tour-wizard-template-settings.service";
import { TourThemesSettingsService } from "./tour-themes-settings.service";
import { WORKSPACE_SETTINGS_REPOSITORY_PORT } from "./domain/ports/workspace-settings-repository.port";
import { TypeOrmWorkspaceSettingsRepository } from "./repositories/typeorm-workspace-settings.repository";

@Module({
  imports: [
    IdempotencyModule,
    TypeOrmModule.forFeature([
      WorkspaceRegionEntity,
      WorkspaceDestinationEntity,
      WorkspaceEquipmentItemEntity,
      WorkspaceGuideLanguageEntity,
      WorkspaceTourThemeEntity,
      WorkspaceTourCreationPresetEntity,
      WorkspaceTourWizardTemplateEntity,
    ])
  ],
  controllers: [
    SettingsRegionsController,
    SettingsDestinationsController,
    SettingsEquipmentController,
    SettingsGuideLanguagesController,
    SettingsTourThemesController,
    SettingsTourCreationPresetsController,
    SettingsTourWizardTemplateController,
  ],
  providers: [
    {
      provide: WORKSPACE_SETTINGS_REPOSITORY_PORT,
      useClass: TypeOrmWorkspaceSettingsRepository,
    },
    SettingsRegionsService,
    SettingsDestinationsService,
    EquipmentSettingsService,
    GuideLanguagesSettingsService,
    TourThemesSettingsService,
    TourCreationPresetsSettingsService,
    TourWizardTemplateSettingsService,
  ],
  exports: [WORKSPACE_SETTINGS_REPOSITORY_PORT],
})
export class SettingsLocationsModule {}
