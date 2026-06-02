import { parseTenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/parse-tenant-wizard-template";
import type { TenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";

export type UpdateWorkspaceTourWizardTemplatePayload = {
  fieldRulesOverlay?: Record<string, unknown>;
  canonicalData?: Record<string, unknown>;
  publish?: boolean;
};

export async function fetchWorkspaceTourWizardTemplate(): Promise<TenantWizardTemplateEnvelope> {
  const json = await bffBrowserClient.get<unknown>("/api/settings/tour-wizard-template");
  return parseTenantWizardTemplateEnvelope(json);
}

export async function updateWorkspaceTourWizardTemplate(
  payload: UpdateWorkspaceTourWizardTemplatePayload,
): Promise<TenantWizardTemplateEnvelope> {
  const json = await bffBrowserClient.patch<unknown>("/api/settings/tour-wizard-template", payload);
  return parseTenantWizardTemplateEnvelope(json);
}

export type TourWizardTemplateInstantiateResponse = {
  success: boolean;
  draftState: {
    data: Record<string, unknown>;
    version: number;
    schemaVersion: number;
    lastModified: number;
  };
  payload?: Record<string, unknown>;
  errors?: readonly string[];
  seededDraft?: boolean;
};

function parseTourWizardTemplateInstantiateResponse(
  json: unknown,
): TourWizardTemplateInstantiateResponse {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid tour wizard template instantiate response");
  }
  const record = json as Record<string, unknown>;
  const draftState = record.draftState;
  if (!draftState || typeof draftState !== "object") {
    throw new Error("Invalid tour wizard template instantiate draftState");
  }
  const draft = draftState as Record<string, unknown>;
  return {
    success: record.success === true,
    draftState: {
      data:
        draft.data && typeof draft.data === "object" && !Array.isArray(draft.data)
          ? (draft.data as Record<string, unknown>)
          : {},
      version: Number(draft.version),
      schemaVersion: Number(draft.schemaVersion),
      lastModified: Number(draft.lastModified),
    },
    payload:
      record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
        ? (record.payload as Record<string, unknown>)
        : undefined,
    errors: Array.isArray(record.errors)
      ? record.errors.filter((entry): entry is string => typeof entry === "string")
      : undefined,
    seededDraft: record.seededDraft === true,
  };
}

export async function instantiateWorkspaceTourWizardTemplate(input?: {
  seedDraft?: boolean;
}): Promise<TourWizardTemplateInstantiateResponse> {
  const query = input?.seedDraft ? "?seedDraft=true" : "";
  const json = await bffBrowserClient.post<unknown>(
    `/api/settings/tour-wizard-template/instantiate${query}`,
    {},
  );
  return parseTourWizardTemplateInstantiateResponse(json);
}
