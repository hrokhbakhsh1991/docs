import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export type SettingsMetadataSection =
  | "hub"
  | "profile"
  | "equipment"
  | "guideLanguages"
  | "tourThemes"
  | "locations"
  | "tourPresets"
  | "presetsAdvanced"
  | "wizardTemplate"
  | "auditTrail"
  | "wizardDrafts"
  | "reconciliation";

export async function buildSettingsPageMetadata(
  section: SettingsMetadataSection
): Promise<Metadata> {
  if (section === "hub") {
    const t = await getTranslations("settings.hub");
    return {
      title: t("title"),
      description: t("subtitle"),
    };
  }

  const t = await getTranslations(`settings.${section}`);
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}
