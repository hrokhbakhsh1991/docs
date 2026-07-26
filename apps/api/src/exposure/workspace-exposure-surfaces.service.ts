import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

import { assertWorkspaceExposureModuleAccess } from "../settings/settings-exposure-module-access";
import { emitSettingsResourceAudit } from "../settings/settings-audit-emitter";
import {
  assertExposureSelectedFieldsAllowed,
  exposureSelectableCatalogFieldIdsForTenant,
  ExposureWorkspaceForbiddenError,
} from "./exposure-catalog.service";
import type { ExposureIntentMode, ExposureIntent } from "./exposure-intent";
import { createExposureIntentRepository } from "./prisma-exposure-intent.repository";
import { exposureIntentContextLookupKey } from "./exposure-intent.repository";
import type { ExposureIntentContextKey } from "./exposure-intent.repository";
import { resolveSeededExposureProfile } from "./exposure-profile";
import {
  findWorkspaceExposureSurfaceDefinition,
  listOperatorVisibleExposureSurfaceDefinitions,
  workspaceSupportsExposureSurfaces,
} from "./resolve-workspace-exposure-surfaces";

export type WorkspaceExposureSurfaceDefinition = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly triggerLabel: string;
  readonly defaultFieldIds: readonly string[];
  readonly activeIntent: {
    readonly mode: ExposureIntentMode;
    readonly selectedFieldIds: readonly string[] | null;
  } | null;
};

export type WorkspaceExposureSurfacesResponse = {
  readonly workspaceType: string;
  readonly surfaces: readonly WorkspaceExposureSurfaceDefinition[];
};

async function resolveWorkspaceTypeForRoute(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<string> {
  if (auth.workspaceId !== undefined && auth.workspaceId === workspaceId) {
    return workspaceId;
  }
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (workspaceId.trim().toLowerCase() === tenantWorkspaceType.trim().toLowerCase()) {
    return tenantWorkspaceType;
  }
  throw new ExposureWorkspaceForbiddenError();
}

function buildExposureSurfaceIntentPrefetch(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly definitions: Awaited<ReturnType<typeof listOperatorVisibleExposureSurfaceDefinitions>>;
}): {
  readonly contextKeys: ExposureIntentContextKey[];
  readonly profilesByIndex: Array<ReturnType<typeof resolveSeededExposureProfile>>;
} {
  const contextKeys: ExposureIntentContextKey[] = [];
  const profilesByIndex: Array<ReturnType<typeof resolveSeededExposureProfile>> = [];

  for (const definition of input.definitions) {
    const trigger = definition.triggerStorageKey;
    const profile = resolveSeededExposureProfile({
      workspaceType: input.workspaceType,
      entityType: "tour",
      surface: definition.surface,
      audience: definition.audience,
      trigger,
      defaultFieldIds: definition.defaultFieldIds,
    });
    profilesByIndex.push(profile);
    if (profile !== null) {
      contextKeys.push({
        tenantId: input.tenantId,
        profileId: profile.id,
        surface: definition.surface,
        audience: definition.audience,
        trigger,
        scope: { tourSurface: definition.surface },
      });
    }
  }

  return { contextKeys, profilesByIndex };
}

function assembleWorkspaceExposureSurfaces(input: {
  readonly tenantId: string;
  readonly definitions: Awaited<ReturnType<typeof listOperatorVisibleExposureSurfaceDefinitions>>;
  readonly profilesByIndex: Array<ReturnType<typeof resolveSeededExposureProfile>>;
  readonly intentLookup: ReadonlyMap<string, ExposureIntent>;
}): WorkspaceExposureSurfaceDefinition[] {
  const surfaces: WorkspaceExposureSurfaceDefinition[] = [];

  for (let index = 0; index < input.definitions.length; index += 1) {
    const definition = input.definitions[index]!;
    const trigger = definition.triggerStorageKey;
    const profile = input.profilesByIndex[index] ?? null;
    const intent =
      profile === null
        ? null
        : (input.intentLookup.get(
            exposureIntentContextLookupKey({
              tenantId: input.tenantId,
              profileId: profile.id,
              surface: definition.surface,
              audience: definition.audience,
              trigger,
              scope: { tourSurface: definition.surface },
            }),
          ) ?? null);

    surfaces.push(
      Object.freeze({
        surface: definition.surface,
        audience: definition.audience,
        trigger,
        triggerLabel: definition.triggerLabel,
        defaultFieldIds: definition.defaultFieldIds,
        activeIntent:
          intent === null
            ? null
            : Object.freeze({
                mode: intent.mode,
                selectedFieldIds: intent.selectedFieldIds,
              }),
      }),
    );
  }

  return surfaces;
}

export async function getWorkspaceExposureSurfaces(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<WorkspaceExposureSurfacesResponse> {
  await assertWorkspaceExposureModuleAccess(auth, "read");
  const workspaceType = await resolveWorkspaceTypeForRoute(auth, workspaceId);
  if (!await workspaceSupportsExposureSurfaces(workspaceType)) {
    return { workspaceType, surfaces: Object.freeze([]) };
  }

  const repository = createExposureIntentRepository();
  const definitions = await listOperatorVisibleExposureSurfaceDefinitions(workspaceType);
  const { contextKeys, profilesByIndex } = buildExposureSurfaceIntentPrefetch({
    tenantId: auth.tenantId,
    workspaceType,
    definitions,
  });
  const intentLookup = await repository.findForContexts(contextKeys);
  const surfaces = assembleWorkspaceExposureSurfaces({
    tenantId: auth.tenantId,
    definitions,
    profilesByIndex,
    intentLookup,
  });

  return {
    workspaceType,
    surfaces: Object.freeze(surfaces),
  };
}

export type PatchWorkspaceSurfaceExposureIntentInput = {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly selectedFieldIds: readonly string[];
  readonly enabled: boolean;
  readonly updatedByUserId?: string | null;
};

export async function patchWorkspaceSurfaceExposureIntent(
  auth: TenantAuthContext,
  workspaceId: string,
  input: PatchWorkspaceSurfaceExposureIntentInput,
) {
  await assertWorkspaceExposureModuleAccess(auth, "mutate");
  const workspaceType = await resolveWorkspaceTypeForRoute(auth, workspaceId);
  const definition = await findWorkspaceExposureSurfaceDefinition(workspaceType, input.surface);
  if (definition === null || definition.operatorSettingsVisible === false) {
    throw new ExposureWorkspaceForbiddenError();
  }

  const profile = resolveSeededExposureProfile({
    workspaceType,
    entityType: "tour",
    surface: input.surface,
    audience: input.audience,
    trigger: input.trigger,
    defaultFieldIds: definition.defaultFieldIds,
  });
  if (profile === null) {
    throw new ExposureWorkspaceForbiddenError();
  }

  if (input.enabled) {
    const catalogFieldIds = await exposureSelectableCatalogFieldIdsForTenant(
      auth.tenantId,
      workspaceType,
    );
    assertExposureSelectedFieldsAllowed(input.selectedFieldIds, catalogFieldIds);
  }

  const mode: ExposureIntentMode = input.enabled ? "override_fields" : "inherit_profile";
  const repository = createExposureIntentRepository();
  const intent = await repository.upsert({
    tenantId: auth.tenantId,
    workspaceType,
    profileId: profile.id,
    entityType: profile.entityType,
    surface: input.surface,
    audience: input.audience,
    trigger: input.trigger,
    scope: { tourSurface: input.surface },
    mode,
    selectedFieldIds: input.enabled ? [...input.selectedFieldIds] : null,
    updatedByUserId: input.updatedByUserId ?? auth.userId,
  });

  await emitSettingsResourceAudit(
    auth,
    "patch",
    "exposure",
    `${workspaceId}:${input.surface}:${input.trigger}`,
    `Patched ${input.surface} surface exposure for workspace ${workspaceId}`,
  );

  return intent;
}
