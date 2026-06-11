import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function MarketingHomePage() {
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
