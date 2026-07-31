import type { CanonicalDocument, TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  mapUrbanExposureSurfaceToFieldPolicySurface,
  resolveUrbanSurfaceDefaultFieldIds,
  type UrbanExposureCoordinate,
} from "./workspace-exposure-host-bindings.generated.ts";

import { buildFieldExposureEngineDecisionMap } from "./build-field-exposure-engine-input";
import { resolveSeededExposureProfile } from "./exposure-profile";
import { createExposureIntentRepository } from "./prisma-exposure-intent.repository";
import { resolvePersistedExposureProfileForContext } from "./resolve-persisted-exposure-profile";

export type ResolveUrbanSurfaceExposureInput = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly coordinate: UrbanExposureCoordinate;
};

function canonicalPayload(canonical: CanonicalDocument): Readonly<Record<string, unknown>> {
  const data = canonical.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Readonly<Record<string, unknown>>;
  }
  return {};
}

function resolveUrbanSurfaceExposureProfile(input: {
  readonly workspaceType: string;
  readonly coordinate: UrbanExposureCoordinate;
}) {
  const defaultFieldIds = resolveUrbanSurfaceDefaultFieldIds({
    surface: input.coordinate.surface,
  });

  return resolveSeededExposureProfile({
    workspaceType: input.workspaceType,
    entityType: "tour",
    surface: input.coordinate.surface,
    audience: input.coordinate.audience,
    trigger: "always",
    defaultFieldIds,
  });
}

async function tryResolvePersistedExposureProfile(input: {
  readonly tenantId: string;
  readonly context: {
    readonly workspaceType: string;
    readonly entityType: string;
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
  };
}) {
  try {
    return await resolvePersistedExposureProfileForContext(input);
  } catch {
    return null;
  }
}

async function tryFindExposureIntent(input: {
  readonly tenantId: string;
  readonly profileId: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly scope: { readonly tourSurface: string };
}) {
  try {
    return await createExposureIntentRepository().findForContext(input);
  } catch {
    return null;
  }
}

export async function resolveUrbanSurfaceVisibleFieldIds(
  auth: TenantAuthContext,
  input: ResolveUrbanSurfaceExposureInput,
): Promise<readonly string[]> {
  const payload = canonicalPayload(input.canonical);
  const seededProfile = resolveUrbanSurfaceExposureProfile({
    workspaceType: input.workspaceType,
    coordinate: input.coordinate,
  });
  const persistedProfile =
    seededProfile === null
      ? null
      : await tryResolvePersistedExposureProfile({
          tenantId: auth.tenantId,
          context: {
            workspaceType: input.workspaceType,
            entityType: seededProfile.entityType,
            surface: seededProfile.surface,
            audience: seededProfile.audience,
            trigger: seededProfile.trigger,
          },
        });
  const profile = persistedProfile ?? seededProfile;

  const nativeIntent =
    profile === null
      ? null
      : await tryFindExposureIntent({
          tenantId: auth.tenantId,
          profileId: profile.id,
          surface: input.coordinate.surface,
          audience: input.coordinate.audience,
          trigger: "always",
          scope: { tourSurface: input.coordinate.surface },
        });

  const decisionMap = await buildFieldExposureEngineDecisionMap({
    tenantId: auth.tenantId,
    workspaceType: input.workspaceType,
    eventType: "TourPublished",
    surface: input.coordinate.surface,
    fieldPolicySurface: mapUrbanExposureSurfaceToFieldPolicySurface(input.coordinate.surface),
    audience: input.coordinate.audience,
    normalizedTrigger: input.coordinate.trigger,
    payload,
    exposureIntent: nativeIntent,
    exposureProfile: profile,
  });

  return [...decisionMap.entries()]
    .filter(([, decision]) => decision.state === "visible")
    .map(([fieldId]) => fieldId)
    .sort((left, right) => left.localeCompare(right));
}

export function buildUrbanExposureResolverPort(): {
  resolveVisibleFieldIds(input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly canonical: CanonicalDocument;
    readonly coordinate: UrbanExposureCoordinate;
  }): Promise<readonly string[]>;
} {
  return {
    async resolveVisibleFieldIds(input) {
      return resolveUrbanSurfaceVisibleFieldIds(
        {
          tenantId: input.tenantId,
          userId: "urban-exposure-resolver",
          role: "none",
          status: "ACTIVE",
        },
        {
          tenantId: input.tenantId,
          workspaceType: "urban",
          tourId: input.tourId,
          canonical: input.canonical,
          coordinate: input.coordinate,
        },
      );
    },
  };
}
