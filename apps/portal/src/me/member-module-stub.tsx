import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MemberModuleStatusShell } from "./member-module-status-shell";
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
  const ledeKey = "lede";

  return (
    <MemberModuleStatusShell
      heading={tNav(labelKey)}
      eyebrow={routePath}
      description={tStub(ledeKey)}
      headerProps={{ "data-portal-member-page-header": "" }}
      mainProps={{
        "data-portal-member-module-stub": "",
        "data-portal-member-module-id": moduleId,
        "data-portal-member-module-route": routePath,
      }}
    >
      <section data-portal-member-module-stub-card>
        <p data-portal-member-module-stub-lede>{tStub(ledeKey)}</p>
        {backHref !== null ? (
          <Link href={backHref} data-portal-member-stub-back>
            {tStub("backToHome")}
          </Link>
        ) : null}
      </section>
    </MemberModuleStatusShell>
  );
}
