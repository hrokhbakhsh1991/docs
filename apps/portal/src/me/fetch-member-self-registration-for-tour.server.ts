import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { getWorkspaceIntakePlugin, resolveIntakeSchema } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export type MemberSelfRegistrationRef = {
  readonly id: string;
  readonly status: string;
};

const MEMBER_SELF_REGISTRATION_FETCH_TIMEOUT_MS = 10_000;

/** SSR — active self registration on a tour for the signed-in member. */
export async function fetchMemberSelfRegistrationForTour(
  host: string,
  tourId: string
): Promise<MemberSelfRegistrationRef | null> {
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return null;
  }

  bindWorkspacePluginRegisterInvokers();
  await registerWorkspaceIntakeSafe(bootstrap.pluginId);
  const features = resolveIntakeSchema(bootstrap.pluginId).features;
  if (features.selfRegistrationGate !== true) {
    return null;
  }

  const intake = getWorkspaceIntakePlugin(bootstrap.pluginId)?.catalogIntake;
  const apiPath = intake?.registrationApiPath?.trim() ?? "";
  if (apiPath.length === 0) {
    return null;
  }

  try {
    const res = await fetch(
      `${resolveTourOpsApiBaseUrl()}${apiPath}/for-tour/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(MEMBER_SELF_REGISTRATION_FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as {
      ok?: boolean;
      data?: { self?: { id: string; status: string } | null };
    };
    const self = payload.data?.self;
    if (self === null || self === undefined || typeof self.id !== "string") {
      return null;
    }
    return { id: self.id, status: self.status };
  } catch {
    return null;
  }
}
