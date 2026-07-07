import {
  parseIntegrationConnectionPublic,
  parseIntegrationTestConnectionResult,
  parseWorkspaceIntegrationSurfaceMetaResponse,
  parseWorkspaceIntegrationsListResponse,
  type IntegrationConnectionPublic,
  type IntegrationTestConnectionResult,
  type WorkspaceIntegrationSurfaceMetaResponse,
  type WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";

export async function fetchWorkspaceIntegrations(
  workspaceId: string
): Promise<WorkspaceIntegrationsListResponse> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/integrations`, {
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `INTEGRATIONS_LIST_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseWorkspaceIntegrationsListResponse(payload);
}

export async function fetchWorkspaceIntegrationMeta(
  workspaceId: string
): Promise<WorkspaceIntegrationSurfaceMetaResponse> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/integrations/meta`, {
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `INTEGRATION_META_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseWorkspaceIntegrationSurfaceMetaResponse(payload);
}

export type CreateWorkspaceIntegrationInput = {
  readonly provider: string;
  readonly config: Record<string, string>;
  readonly credentials?: Record<string, string>;
};

export async function createWorkspaceIntegration(
  workspaceId: string,
  input: CreateWorkspaceIntegrationInput
): Promise<IntegrationConnectionPublic> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/integrations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `INTEGRATION_CREATE_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseIntegrationConnectionPublic(payload);
}

export type PatchIntegrationInput = {
  readonly config?: Record<string, string>;
  readonly credentials?: Record<string, string>;
};

export async function patchIntegration(
  integrationId: string,
  input: PatchIntegrationInput
): Promise<IntegrationConnectionPublic> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `INTEGRATION_PATCH_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseIntegrationConnectionPublic(payload);
}

export type PatchIntegrationEventPolicyInput = {
  readonly enabled?: boolean;
};

export type PatchExposureIntentInput = {
  readonly enabled: boolean;
  readonly selectedFieldIds: readonly string[];
  readonly templateId?: string | null;
  readonly fieldDecorations?: Record<string, { prefix: string }> | null;
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
};

export async function patchIntegrationEventPolicy(
  integrationId: string,
  eventType: string,
  input: PatchIntegrationEventPolicyInput,
): Promise<IntegrationConnectionPublic> {
  const eventPolicyPath =
    `/api/integrations/${encodeURIComponent(integrationId)}` +
    `/event-policies/${encodeURIComponent(eventType)}`;
  const res = await fetch(eventPolicyPath, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string"
        ? payload.code
        : `INTEGRATION_EVENT_POLICY_PATCH_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseIntegrationConnectionPublic(payload);
}

export async function patchExposureIntent(
  integrationId: string,
  eventType: string,
  input: PatchExposureIntentInput,
): Promise<IntegrationConnectionPublic> {
  const exposureIntentPath =
    `/api/integrations/${encodeURIComponent(integrationId)}` +
    `/exposure-intents/${encodeURIComponent(eventType)}`;
  const res = await fetch(exposureIntentPath, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string"
        ? payload.code
        : `EXPOSURE_INTENT_PATCH_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseIntegrationConnectionPublic(payload);
}

export async function fetchIntegrationDetail(
  integrationId: string
): Promise<IntegrationConnectionPublic> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`INTEGRATION_DETAIL_HTTP_${res.status}`);
  }
  return parseIntegrationConnectionPublic(await res.json());
}

export async function enableIntegration(
  integrationId: string
): Promise<IntegrationConnectionPublic> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/enable`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`INTEGRATION_ENABLE_HTTP_${res.status}`);
  }
  return parseIntegrationConnectionPublic(await res.json());
}

export async function disableIntegration(
  integrationId: string
): Promise<IntegrationConnectionPublic> {
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/disable`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`INTEGRATION_DISABLE_HTTP_${res.status}`);
  }
  return parseIntegrationConnectionPublic(await res.json());
}

export async function testIntegrationConnection(
  integrationId: string
): Promise<IntegrationTestConnectionResult> {
  const res = await fetch(
    `/api/integrations/${encodeURIComponent(integrationId)}/test-connection`,
    { method: "POST" }
  );
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string" ? payload.code : `INTEGRATION_TEST_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseIntegrationTestConnectionResult(payload);
}
