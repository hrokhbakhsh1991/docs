import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function buildDashboardPageMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return {
    title: t("pageTitle"),
    description: t("metadata.description"),
  };
}

export async function buildUsersPageMetadata(): Promise<Metadata> {
  const t = await getTranslations("users.metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export async function buildAuthLoginPageMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export async function buildRootLayoutMetadata(): Promise<Metadata> {
  const t = await getTranslations("app.metadata");
  const brand = t("title");
  return {
    title: {
      default: brand,
      template: `%s | ${brand}`,
    },
    description: t("description"),
  };
}
