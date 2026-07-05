import Link from "next/link";
import { getTranslations } from "next-intl/server";

type MemberModuleStubProps = {
  readonly moduleId: string;
  readonly labelKey: string;
  readonly routePath: string;
};

export async function MemberModuleStub({ moduleId, labelKey, routePath }: MemberModuleStubProps) {
  const tNav = await getTranslations("portalMember.nav");
  const tStub = await getTranslations("portalMember.moduleStub");

  return (
    <main
      data-portal-member-module-stub
      data-portal-member-module-id={moduleId}
      data-portal-member-module-route={routePath}
    >
      <h1>{tNav(labelKey)}</h1>
      <p>{tStub("lede")}</p>
      <Link href="/me/home">{tStub("backToHome")}</Link>
    </main>
  );
}
