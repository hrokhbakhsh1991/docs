import { buildTourAuthHeaders, type TenantAuthContext } from "@app-tour/workspace-sdk";
import { getTranslations } from "next-intl/server";

import { resolveTourOpsApiBaseUrl } from "./urban-api-base";

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
  const t = await getTranslations("settings.urban");
  const headers = buildTourAuthHeaders({
    tenantId: props.tenantId,
    userId: props.userId,
    role: props.role,
    status: props.status,
    workspaceId: props.workspaceId,
  });

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}/urban/settings`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div role="alert" data-urban-settings-error data-status-code={String(res.status)}>
        <p>{t("loadError", { status: res.status })}</p>
      </div>
    );
  }

  const body = (await res.json()) as UrbanSettingsEnvelope;
  const urban = body.data?.urban;

  return (
    <section data-urban-owner-settings-panel>
      <h1>{t("title")}</h1>
      <dl>
        <dt>{t("catalogEnabled")}</dt>
        <dd>{urban?.catalog?.publicEnabled === false ? t("no") : t("yes")}</dd>
        <dt>{t("catalogSlug")}</dt>
        <dd>{urban?.catalog?.slug ?? "catalog"}</dd>
        <dt>{t("registrationPolicy")}</dt>
        <dd>{urban?.registration?.policy ?? "open"}</dd>
      </dl>
      <p>
        <a href="/catalog">{t("viewCatalog")}</a>
      </p>
    </section>
  );
}
