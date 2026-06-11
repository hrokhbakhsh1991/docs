import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function buildFinancePageMetadata(): Promise<Metadata> {
  const t = await getTranslations("finance.commandCenter");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}
