import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.pageNotFound");
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function WebNotFound() {
  const t = await getTranslations("common.pageNotFound");

  return (
    <main data-web-not-found data-web-page-not-found>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <p>
        <Link href="/">{t("back")}</Link>
      </p>
    </main>
  );
}
