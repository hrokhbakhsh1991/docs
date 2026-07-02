import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { fetchMemberProfile } from "@/me/fetch-member-profile.server";

import { MemberProfileForm } from "./member-profile-form";

export default async function MeProfilePage() {
  const host = (await headers()).get("host") ?? "localhost:3003";
  const profilePayload = await fetchMemberProfile(host);
  const t = await getTranslations("portalMember.profile");

  if (profilePayload === null) {
    return (
      <main data-portal-member-profile>
        <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
        <p role="alert" className="text-sm text-destructive">
          {t("loadFailed")}
        </p>
      </main>
    );
  }

  return (
    <main data-portal-member-profile>
      <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("description")}</p>
      <MemberProfileForm profile={profilePayload.profile} />
    </main>
  );
}
