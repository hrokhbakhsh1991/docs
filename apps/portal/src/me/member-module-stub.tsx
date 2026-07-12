import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { resolveMemberPortalBackTargetPath } from "./resolve-member-portal-routes.server";

type MemberModuleStubProps = {
  readonly pluginId: string;
  readonly moduleId: string;
  readonly labelKey: string;
  readonly routePath: string;
};

export async function MemberModuleStub({
  pluginId,
  moduleId,
  labelKey,
  routePath,
}: MemberModuleStubProps) {
  const tNav = await getTranslations("portalMember.nav");
  const tStub = await getTranslations("portalMember.moduleStub");
  const backHref = resolveMemberPortalBackTargetPath(pluginId);
  const ledeKey = moduleId === "wallet" ? "walletLede" : "lede";

  return (
    <main
      data-portal-member-module-stub
      data-portal-member-module-id={moduleId}
      data-portal-member-module-route={routePath}
    >
      <h1>{tNav(labelKey)}</h1>
      <p data-portal-member-module-stub-lede>{tStub(ledeKey)}</p>
      {backHref !== null ? <Link href={backHref}>{tStub("backToHome")}</Link> : null}
    </main>
  );
}
