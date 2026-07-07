import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
    <main data-portal-member-unauthorized data-portal-member-unauthorized-module={moduleId}>
      <h1>{t("title")}</h1>
      <p>{t("description", { moduleId: moduleLabel })}</p>
      {backHref !== null ? <Link href={backHref}>{t("backToHome")}</Link> : null}
    </main>
  );
}
