import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MemberModuleStatusShell } from "./member-module-status-shell";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { resolveMemberPortalBackTargetPath } from "./resolve-member-portal-routes.server";

type MemberModuleUnauthorizedProps = {
  readonly moduleId: string;
};

function resolveModuleLabel(
  tNav: (key: string) => string,
  moduleId: string
): string {
  const navKeys = ["home", "trips", "profile", "more", "wallet", "registrations"] as const;
  if ((navKeys as readonly string[]).includes(moduleId)) {
    return tNav(moduleId);
  }
  return moduleId;
}

export async function MemberModuleUnauthorized({ moduleId }: MemberModuleUnauthorizedProps) {
  const t = await getTranslations("portalMember.unauthorized");
  const tNav = await getTranslations("portalMember.nav");
  const moduleLabel = resolveModuleLabel((key) => tNav(key), moduleId);
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const backHref = resolveMemberPortalBackTargetPath(bootstrap.pluginId);

  return (
    <MemberModuleStatusShell
      heading={t("title")}
      eyebrow={moduleLabel}
      description={t("description", { moduleId: moduleLabel })}
      headerProps={{ "data-portal-member-page-header": "" }}
      mainProps={{
        "data-portal-member-unauthorized": "",
        "data-portal-member-unauthorized-module": moduleId,
      }}
    >
      <div data-portal-member-status-actions>
        {backHref !== null ? <Link href={backHref}>{t("backToHome")}</Link> : null}
      </div>
    </MemberModuleStatusShell>
  );
}
