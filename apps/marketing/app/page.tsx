import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buildPlatformAdminUrl } from "@/platform/build-platform-admin-url";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";

export default async function MarketingHomePage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";

  if (isPlatformMotherHost(host)) {
    return (
      <main data-platform-mother-home className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-semibold">پلتفرم مدیریت باشگاه کوهنوردی</h1>
        <a
          href={buildPlatformAdminUrl()}
          data-platform-admin-cta
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ورود PlatformOps
        </a>
      </main>
    );
  }

  const t = await getTranslations("catalog.home");

  return (
    <main data-marketing-home>
      <h1>{t("title")}</h1>
      <p>
        <Link href="/tours">{t("browseTours")}</Link>
      </p>
    </main>
  );
}
