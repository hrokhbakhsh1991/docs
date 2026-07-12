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
  | "reconciliation"
  | "integrations";

export function resolveSettingsMetadataNamespace(
  section: SettingsMetadataSection
): string {
  if (section === "equipment") {
    return "equipmentPage";
  }
  return section;
}

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

  const namespace = resolveSettingsMetadataNamespace(section);
  const t = await getTranslations(`settings.${namespace}`);
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}
