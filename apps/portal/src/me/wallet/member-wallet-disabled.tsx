import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MemberModuleStatusShell } from "@/me/member-module-status-shell";
import { resolveMemberPortalBackTargetPath } from "@/me/resolve-member-portal-routes.server";

type MemberWalletDisabledProps = {
  readonly pluginId: string;
  readonly reason: "workspace_disabled" | "module_disabled" | "entitlement_denied";
};

export async function MemberWalletDisabled({
  pluginId,
  reason,
}: MemberWalletDisabledProps) {
  const t = await getTranslations("portalMember.wallet");
  const backHref = resolveMemberPortalBackTargetPath(pluginId);
  const description =
    reason === "workspace_disabled"
      ? t("workspaceDisabled")
      : reason === "module_disabled"
        ? t("moduleDisabled")
        : t("entitlementDenied");

  return (
    <MemberModuleStatusShell
      heading={t("title")}
      description={description}
      headerProps={{ "data-portal-member-page-header": "" }}
      mainProps={{
        "data-portal-member-wallet-disabled": "",
        "data-portal-member-wallet-disabled-reason": reason,
      }}
    >
      {backHref !== null ? (
        <Link href={backHref} data-portal-member-wallet-back>
          {t("backToHome")}
        </Link>
      ) : null}
    </MemberModuleStatusShell>
  );
}
