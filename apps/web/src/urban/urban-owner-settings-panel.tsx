import { buildTourAuthHeaders, type TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveUrbanApiBaseUrl } from "./urban-api-base";

type UrbanSettingsEnvelope = {
  readonly success: boolean;
  readonly data?: {
    readonly urban?: {
      readonly catalog?: { readonly publicEnabled?: boolean; readonly slug?: string };
      readonly registration?: { readonly policy?: string };
    };
  };
};

export async function UrbanOwnerSettingsPanel(props: {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: TenantAuthContext["role"];
  readonly status: TenantAuthContext["status"];
  readonly workspaceId: string;
}) {
  const headers = buildTourAuthHeaders({
    tenantId: props.tenantId,
    userId: props.userId,
    role: props.role,
    status: props.status,
    workspaceId: props.workspaceId,
  });

  const res = await fetch(`${resolveUrbanApiBaseUrl()}/urban/settings`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div role="alert" data-urban-settings-error data-status-code={String(res.status)}>
        <p>Unable to load urban settings ({res.status}).</p>
      </div>
    );
  }

  const body = (await res.json()) as UrbanSettingsEnvelope;
  const urban = body.data?.urban;

  return (
    <section data-urban-owner-settings-panel>
      <h1>Urban workspace settings</h1>
      <dl>
        <dt>Catalog enabled</dt>
        <dd>{urban?.catalog?.publicEnabled === false ? "no" : "yes"}</dd>
        <dt>Catalog slug</dt>
        <dd>{urban?.catalog?.slug ?? "catalog"}</dd>
        <dt>Registration policy</dt>
        <dd>{urban?.registration?.policy ?? "open"}</dd>
      </dl>
      <p>
        <a href="/catalog">View public catalog</a>
      </p>
    </section>
  );
}
