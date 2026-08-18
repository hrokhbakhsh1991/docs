import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { resolveMarketingPublicBaseUrl } from "@app-tour/guest-surface-host";

import { fetchMemberProfile } from "@/me/fetch-member-profile.server";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { redirectDeadMemberSession } from "@/me/redirect-dead-member-session.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberProfileForm } from "./member-profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.profile");
  return { title: t("title") };
}

export default async function MeProfilePage() {
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const profileResult = await fetchMemberProfile(host);
  const t = await getTranslations("portalMember.profile");

  if (profileResult.status === "ok") {
    return (
      <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="profile">
        <main data-portal-member-profile>
          <header data-portal-member-page-header>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </header>
          <MemberProfileForm
            profile={profileResult.payload.profile}
            logoutTarget={resolveMarketingPublicBaseUrl(host)}
          />
        </main>
      </MemberModuleEntitlementGate>
    );
  }

  if (profileResult.status === "unavailable") {
    return (
      <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="profile">
        <main data-portal-member-profile>
          <header data-portal-member-page-header>
            <h1>{t("title")}</h1>
            <p role="alert">{t("loadFailed")}</p>
          </header>
        </main>
      </MemberModuleEntitlementGate>
    );
  }

  redirectDeadMemberSession("/me/profile");
}
