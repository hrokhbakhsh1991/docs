import type { PublicCatalogTourInput } from "@app-tour/workspace-sdk";
import {
  applyWorkspaceCatalogCardExposure,
  assertWorkspaceTypeOrThrow,
  loadWorkspaceTourIfPublished,
  normalizeWorkspaceTypeKey,
} from "@app-tour/workspace-sdk";
import {
  DENALI_EXPOSURE_SURFACE,
  resolveDenaliExposureCoordinate,
} from "../exposure/denali-exposure-surfaces";

import { applyDenaliCatalogCardExposure } from "../catalog/denali-catalog-exposure-bindings";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";
import { collectItinerarySegmentDestinationIds } from "../catalog/project-denali-catalog-itinerary";
import { DENALI_WORKSPACE_TYPE } from "../denali-identity";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { DenaliExposureResolverPort } from "./ports/exposure-resolver.port";
import type { DenaliPublicDestinationPort } from "./ports/public-destination.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function resolveDestinationNameById(params: {
  readonly tenantId: string;
  readonly tour: PublicCatalogTourInput;
  readonly destinationPort?: DenaliPublicDestinationPort;
}): Promise<ReadonlyMap<string, string> | undefined> {
  if (params.destinationPort === undefined) {
    return undefined;
  }
  const data = params.tour.canonical.data;
  if (!isRecord(data)) {
    return undefined;
  }
  const destinationIds = collectItinerarySegmentDestinationIds(data);
  if (destinationIds.length === 0) {
    return undefined;
  }
  const names = await params.destinationPort.getDestinationNamesByIds(
    params.tenantId,
    destinationIds,
  );
  const entries = Object.entries(names).filter(
    ([, name]) => typeof name === "string" && name.trim().length > 0,
  );
  return entries.length > 0 ? new Map(entries) : undefined;
}

export async function getDenaliDashboardTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: DenaliTourStorePort;
  readonly destinationPort?: DenaliPublicDestinationPort;
  readonly exposurePort?: DenaliExposureResolverPort;
  readonly tourId: string;
}) {
  assertWorkspaceTypeOrThrow(
    normalizeWorkspaceTypeKey(params.workspaceType),
    DENALI_WORKSPACE_TYPE,
    () => new DenaliWorkspaceRequiredError(),
  );

  const record = await loadWorkspaceTourIfPublished({
    findFirst: () =>
      params.store.findFirst({
        tenantId: params.tenantId,
        id: params.tourId,
      }),
    isPublished: isDenaliTourPublished,
    getCanonical: (row) => row.canonical,
  });
  if (record === null) {
    return null;
  }

  const tour: PublicCatalogTourInput = {
    id: record.id,
    canonical: record.canonical,
  };
  const destinationNameById = await resolveDestinationNameById({
    tenantId: params.tenantId,
    tour,
    destinationPort: params.destinationPort,
  });
  const card = toDenaliCatalogCard(
    tour,
    destinationNameById === undefined ? undefined : { destinationNameById },
  );

  return applyWorkspaceCatalogCardExposure({
    tenantId: params.tenantId,
    tourId: tour.id,
    canonical: tour.canonical,
    card,
    exposurePort: params.exposurePort,
    resolveCoordinate: () =>
      resolveDenaliExposureCoordinate({ surface: DENALI_EXPOSURE_SURFACE.userDashboard }),
    applyExposure: applyDenaliCatalogCardExposure,
  });
}
