import Link from "next/link";
import { getTranslations } from "next-intl/server";

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

  return (
    <main data-portal-member-unauthorized data-portal-member-unauthorized-module={moduleId}>
      <h1>{t("title")}</h1>
      <p>{t("description", { moduleId: moduleLabel })}</p>
      <Link href="/me/home">{t("backToHome")}</Link>
    </main>
  );
}
