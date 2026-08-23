import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { buildTourAuthHeaders } from "@app-tour/workspace-sdk";

import { loadWorkspaceOwnerSettingsPanel } from "@/bootstrap/workspace-owner-settings-panel-loaders.generated";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";
import { WizardAccessDenied } from "@/wizard/wizard-access-denied";

import {
  WORKSPACE_OWNER_SETTINGS_PLUGIN_ID,
  resolveWorkspaceOwnerSettingsPageBranch,
} from "./workspace-owner-settings-access";

export const dynamic = "force-dynamic";

export default async function WorkspaceOwnerSettingsPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  const workspaceType = resolved.session.pluginId;

  const branch = resolveWorkspaceOwnerSettingsPageBranch({
    authz: resolved.scopedAuthz.authz,
    tenantId: resolved.context.tenantId,
    workspaceId: resolved.context.workspaceId,
    workspaceType,
    pluginId: WORKSPACE_OWNER_SETTINGS_PLUGIN_ID,
  });

  if (branch.kind === "forbidden") {
    return <WizardAccessDenied />;
  }

  if (resolved.context.workspaceId === undefined) {
    return <WizardAccessDenied />;
  }

  const Panel = await loadWorkspaceOwnerSettingsPanel(resolved.session.pluginId);
  if (Panel == null) {
    return <WizardAccessDenied />;
  }

  const t = await getTranslations("settings.workspaceOwner");
  const authHeaders = buildTourAuthHeaders({
    tenantId: resolved.context.tenantId,
    userId: resolved.context.userId,
    role: resolved.context.role,
    status: resolved.context.status,
    workspaceId: resolved.context.workspaceId,
  });

  return (
    <Panel
      apiBaseUrl={resolveTourOpsApiBaseUrl()}
      headers={authHeaders}
      labels={{
        title: t("title"),
        loadError: (status) => t("loadError", { status }),
        catalogEnabled: t("catalogEnabled"),
        catalogSlug: t("catalogSlug"),
        registrationPolicy: t("registrationPolicy"),
        yes: t("yes"),
        no: t("no"),
        viewCatalog: t("viewCatalog"),
      }}
    />
  );
}
