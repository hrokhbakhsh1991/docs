import type { PublicCatalogTourInput } from "@app-tour/workspace-sdk";
import {
  buildDenaliRelativeTimeTrigger,
  DENALI_EXPOSURE_SURFACE,
  type DenaliReminderOffset,
} from "../exposure/denali-exposure-surfaces";

import { applyDenaliCatalogCardExposure } from "../catalog/denali-catalog-exposure-bindings";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { DenaliExposureResolverPort } from "./ports/exposure-resolver.port";
import type { DenaliReminderFeedPort } from "./ports/reminder-feed.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

export type DenaliReminderFeedEntry = {
  readonly activationId: string;
  readonly tourId: string;
  readonly reminderOffset: DenaliReminderOffset;
  readonly anchorAt: string;
  readonly activatedAt: string;
  readonly card: ReturnType<typeof toDenaliCatalogCard>;
};

function parseReminderOffset(value: string): DenaliReminderOffset | null {
  return value === "-24h" || value === "-48h" ? value : null;
}

export async function listDenaliReminderFeed(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: DenaliTourStorePort;
  readonly reminderPort?: DenaliReminderFeedPort;
  readonly exposurePort?: DenaliExposureResolverPort;
  readonly limit?: number;
}): Promise<readonly DenaliReminderFeedEntry[]> {
  if (params.workspaceType.trim().toLowerCase() !== "denali") {
    throw new DenaliWorkspaceRequiredError();
  }
  if (params.reminderPort === undefined) {
    return Object.freeze([]);
  }

  const activations = await params.reminderPort.listDueActivations({
    tenantId: params.tenantId,
    ...(params.limit === undefined ? {} : { limit: params.limit }),
  });

  const entries: DenaliReminderFeedEntry[] = [];
  for (const activation of activations) {
    const offset = parseReminderOffset(activation.reminderOffset);
    if (offset === null) {
      continue;
    }
    const record = await params.store.findFirst({
      tenantId: params.tenantId,
      id: activation.tourId,
    });
    if (record === null || !isDenaliTourPublished(record.canonical)) {
      continue;
    }
    const tour: PublicCatalogTourInput = {
      id: record.id,
      canonical: record.canonical,
    };
    let card = toDenaliCatalogCard(tour);
    if (params.exposurePort !== undefined) {
      const visibleFieldIds = await params.exposurePort.resolveVisibleFieldIds({
        tenantId: params.tenantId,
        tourId: tour.id,
        canonical: tour.canonical,
        coordinate: {
          surface: DENALI_EXPOSURE_SURFACE.reminderFeed,
          audience: "registered_user",
          trigger: buildDenaliRelativeTimeTrigger(offset),
        },
      });
      card = applyDenaliCatalogCardExposure(card, new Set(visibleFieldIds));
    }
    entries.push(
      Object.freeze({
        activationId: activation.activationId,
        tourId: activation.tourId,
        reminderOffset: offset,
        anchorAt: activation.anchorAt,
        activatedAt: activation.activatedAt,
        card,
      }),
    );
  }
  return Object.freeze(entries);
}
