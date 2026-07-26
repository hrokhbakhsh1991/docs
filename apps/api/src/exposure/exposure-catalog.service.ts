import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getSettingsConfigRepository } from "../settings/create-settings-config-repository";
import type { WizardTemplatePayloadV1 } from "../settings/settings.types";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import {
  buildExposureSelectableFieldCatalog,
  type ExposureFieldCatalogEntry,
} from "./exposure-field-catalog";
import {
  PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE,
  REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
  type ExposureCatalogSource,
} from "./exposure-profile";
import { buildWizardTemplateExposureCatalog } from "./resolve-wizard-template-exposure-catalog";
import { assertWorkspaceExposureModuleAccess } from "../settings/settings-exposure-module-access";

export class ExposureWorkspaceForbiddenError extends Error {
  readonly code = "EXPOSURE_WORKSPACE_FORBIDDEN";
  constructor() {
    super("EXPOSURE_WORKSPACE_FORBIDDEN");
    this.name = "ExposureWorkspaceForbiddenError";
  }
}

export class ExposureCatalogFieldNotAllowedError extends Error {
  readonly code = "EXPOSURE_CATALOG_FIELD_NOT_ALLOWED";
  constructor() {
    super("EXPOSURE_CATALOG_FIELD_NOT_ALLOWED");
    this.name = "ExposureCatalogFieldNotAllowedError";
  }
}

export type WorkspaceExposureCatalogResponse = {
  readonly workspaceType: string | null;
  readonly fields: readonly ExposureFieldCatalogEntry[];
  readonly source: ExposureCatalogSource;
};

function authWorkspaceMatches(workspaceId: string, workspaceType: string): boolean {
  return workspaceId.trim().toLowerCase() === workspaceType.trim().toLowerCase();
}

async function resolveWorkspaceTypeForRoute(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<string> {
  if (auth.workspaceId !== undefined && auth.workspaceId === workspaceId) {
    return workspaceId;
  }
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (authWorkspaceMatches(workspaceId, tenantWorkspaceType)) {
    return tenantWorkspaceType;
  }
  throw new ExposureWorkspaceForbiddenError();
}

function isWizardTemplatePayload(
  payload: unknown,
): payload is WizardTemplatePayloadV1 {
  return typeof payload === "object" && payload !== null;
}

async function loadTenantWizardTemplatePayload(
  tenantId: string,
): Promise<WizardTemplatePayloadV1 | null> {
  const stored = await getSettingsConfigRepository().get(tenantId, "wizard_template");
  if (stored == null || !isWizardTemplatePayload(stored.payload)) {
    return null;
  }
  return stored.payload;
}

export async function resolveTenantExposureSelectableCatalog(input: {
  readonly tenantId: string;
  readonly workspaceType: string | null;
}): Promise<{
  readonly fields: readonly ExposureFieldCatalogEntry[];
  readonly source: ExposureCatalogSource;
}> {
  const wizardTemplatePayload = await loadTenantWizardTemplatePayload(input.tenantId);
  if (wizardTemplatePayload != null) {
    const wizardTemplateFields = await buildWizardTemplateExposureCatalog({
      workspaceType: input.workspaceType,
      wizardTemplatePayload,
    });
    if (wizardTemplateFields.length > 0) {
      return {
        fields: wizardTemplateFields,
        source: PUBLISHED_WIZARD_TEMPLATE_EXPOSURE_CATALOG_SOURCE,
      };
    }
  }

  return {
    fields: await buildExposureSelectableFieldCatalog(input.workspaceType),
    source: REGISTRY_DELIVERABLE_EXPOSURE_PROFILE_SEED,
  };
}

export async function exposureSelectableCatalogFieldIdsForTenant(
  tenantId: string,
  workspaceType: string | null,
): Promise<ReadonlySet<string>> {
  const catalog = await resolveTenantExposureSelectableCatalog({ tenantId, workspaceType });
  return new Set(catalog.fields.map((field) => field.id));
}

export function assertExposureSelectedFieldsAllowed(
  selectedFieldIds: readonly string[],
  catalogFieldIds: ReadonlySet<string>,
): void {
  for (const fieldId of selectedFieldIds) {
    if (!catalogFieldIds.has(fieldId)) {
      throw new ExposureCatalogFieldNotAllowedError();
    }
  }
}

export async function getWorkspaceExposureCatalog(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<WorkspaceExposureCatalogResponse> {
  await assertWorkspaceExposureModuleAccess(auth, "read");
  const workspaceType = await resolveWorkspaceTypeForRoute(auth, workspaceId);
  const catalog = await resolveTenantExposureSelectableCatalog({
    tenantId: auth.tenantId,
    workspaceType,
  });
  return {
    workspaceType,
    fields: catalog.fields,
    source: catalog.source,
  };
}
