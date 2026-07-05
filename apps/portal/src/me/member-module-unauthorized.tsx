import Link from "next/link";
import { getTranslations } from "next-intl/server";

type MemberModuleUnauthorizedProps = {
  readonly moduleId: string;
};

export async function MemberModuleUnauthorized({ moduleId }: MemberModuleUnauthorizedProps) {
  const t = await getTranslations("portalMember.unauthorized");

  return (
    <main data-portal-member-unauthorized data-portal-member-unauthorized-module={moduleId}>
      <h1>{t("title")}</h1>
      <p>{t("description", { moduleId })}</p>
      <Link href="/me/home">{t("backToHome")}</Link>
    </main>
  );
}
