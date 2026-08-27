import { createClientSafeUuid } from "@app-tour/draft-engine";
import { fetchPlatformApi } from "../platform-api-client";
import { buildCreateClubSuccessPath, type CreateClubDraft } from "./use-create-club-wizard";

export function generateCreateClubIdempotencyKey(): string {
  return createClientSafeUuid();
}

export type CreateClubSubmitResult =
  | { readonly ok: true; readonly tenantId: string; readonly redirectPath: string }
  | { readonly ok: false; readonly message: string };

export function resolveCreateClubErrorMessage(body: {
  readonly error?: string;
  readonly code?: string;
}): string {
  if (body.code === "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION") {
    return "This workspace is not certified for production club onboarding";
  }
  return body.error ?? body.code ?? "Failed to create club";
}

export async function submitCreateClubRequest(
  draft: CreateClubDraft
): Promise<CreateClubSubmitResult> {
  const idempotencyKey = generateCreateClubIdempotencyKey();
  const response = await fetchPlatformApi("/tenants", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      subdomain: draft.subdomain.trim().toLowerCase(),
      workspaceType: draft.workspaceType,
      ownerPhone: draft.ownerPhone.trim(),
      ownerNameNote: draft.ownerNameNote.trim() || undefined,
      displayName: draft.displayName.trim() || undefined,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    tenant?: { id?: string };
    error?: string;
    code?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      message: resolveCreateClubErrorMessage(body),
    };
  }

  const tenantId = body.tenant?.id;
  if (!tenantId) {
    return { ok: false, message: "Missing tenant id in response" };
  }

  return {
    ok: true,
    tenantId,
    redirectPath: buildCreateClubSuccessPath(tenantId),
  };
}
