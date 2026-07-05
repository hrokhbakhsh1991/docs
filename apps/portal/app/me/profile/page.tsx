import { getTranslations } from "next-intl/server";

import { fetchMemberProfile } from "@/me/fetch-member-profile.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberProfileForm } from "./member-profile-form";

export default async function MeProfilePage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const profilePayload = await fetchMemberProfile(host);
  const t = await getTranslations("portalMember.profile");

  if (profilePayload === null) {
    return (
      <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="profile">
        <main data-portal-member-profile>
          <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
          <p role="alert" className="text-sm text-destructive">
            {t("loadFailed")}
          </p>
        </main>
      </MemberModuleEntitlementGate>
    );
  }

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="profile">
      <main data-portal-member-profile>
        <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t("description")}</p>
        <MemberProfileForm profile={profilePayload.profile} />
      </main>
    </MemberModuleEntitlementGate>
  );
}
