import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function MarketingNotFound() {
  const t = await getTranslations("catalog.notFound");

  return (
    <main data-marketing-not-found>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <p>
        <Link href="/tours">{t("back")}</Link>
      </p>
    </main>
  );
}
