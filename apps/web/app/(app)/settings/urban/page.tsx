import { headers } from "next/headers";

import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";
import {
  CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
  resolveUrbanSettingsPageBranch,
} from "@/urban/urban-settings-access";
import { UrbanOwnerSettingsPanel } from "@/urban/urban-owner-settings-panel";
import { WizardAccessDenied } from "@/wizard/wizard-access-denied";

export const dynamic = "force-dynamic";

export default async function UrbanSettingsPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = resolveBootstrapAppSessionForHost(host);
  const workspaceType =
    resolved.session.pluginId === CANLOAD_URBAN_SETTINGS_PLUGIN_ID ? "urban" : "starter";

  const branch = resolveUrbanSettingsPageBranch({
    authz: resolved.scopedAuthz,
    tenantId: resolved.context.tenantId,
    workspaceId: resolved.context.workspaceId,
    workspaceType,
    pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
  });

  if (branch.kind === "forbidden") {
    return <WizardAccessDenied />;
  }

  if (resolved.context.workspaceId === undefined) {
    return <WizardAccessDenied />;
  }

  return (
    <UrbanOwnerSettingsPanel
      tenantId={resolved.context.tenantId}
      userId={resolved.context.userId}
      role={resolved.context.role}
      status={resolved.context.status}
      workspaceId={resolved.context.workspaceId}
    />
  );
}
