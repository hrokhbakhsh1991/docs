import {
  DENALI_CREATE_DRAFT_KEY,
  migrateDenaliCreateDraftData,
  type DraftMigratorRegistry,
} from "@repo/shared-contracts";

/** Registers tour-wizard draft migrators on the shared registry (no ToursModule import). */
export function registerTourDraftMigrators(registry: DraftMigratorRegistry): void {
  registry.register(DENALI_CREATE_DRAFT_KEY, migrateDenaliCreateDraftData);
}
