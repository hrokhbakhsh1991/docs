/**
 * Ambient module declarations for codegen dynamic-import dispatch targets (CW9).
 * Runtime loads workspace packages; compile-time uses these shims to avoid
 * circular workspace-sdk ↔ workspace package build ordering.
 */
declare module "@app-tour/workspace-denali/catalog/denali-catalog-transport-intake" {
  import type { WorkspaceCatalogIntakeTransportSurface } from "../catalog/catalog-intake-transport-surface";

  export const denaliCatalogTransportIntakeSurface: WorkspaceCatalogIntakeTransportSurface;
}

declare module "@app-tour/workspace-denali/catalog/read-denali-catalog-transport" {
  export function readDenaliCatalogTransportSnapshot(
    data: Readonly<Record<string, unknown>>
  ): import("../tour/public-catalog-transport").PublicCatalogTransportSnapshot | undefined;
}

declare module "@app-tour/workspace-denali/marketing/denali-difficulty-fitness-filter-presentation" {
  import type { WorkspaceDifficultyFitnessFilterPresentation } from "../tour/public-catalog-difficulty-fitness";

  export const denaliDifficultyFitnessFilterPresentation: WorkspaceDifficultyFitnessFilterPresentation;
}

declare module "@app-tour/workspace-cert-club/host/transport/catalog-transport-snapshot" {
  export function readCertClubCatalogTransportSnapshot(
    canonical: Readonly<Record<string, unknown>>
  ): import("../tour/public-catalog-transport").PublicCatalogTransportSnapshot | undefined;
}
