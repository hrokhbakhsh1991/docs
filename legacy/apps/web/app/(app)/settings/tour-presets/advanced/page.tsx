"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsLayout } from "../../settings-layout";
import { SettingsSectionCard } from "../../settings-section-card";
import { TourPresetsSettingsPanel } from "../tour-presets-settings-panel";

export default function SettingsTourPresetsAdvancedJsonPage() {
  const t = useTranslations("settings");
  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbTourFormDefaults"), href: "/settings/tour-presets" },
        { label: t("breadcrumbTourPresetsAdvanced") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("tourPresetsMetadataTitle")}
      title={t("tourPresetsPageTitle")}
      description={t("tourPresetsPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <p
          style={{
            margin: "0 0 1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            background: "var(--color-warning-50, #fffbeb)",
            border: "1px solid var(--color-warning-200, #fde68a)",
            fontSize: "0.875rem",
            color: "var(--color-neutral-800, #1e293b)",
          }}
        >
          {t("tourPresetsAdvancedOnlyBanner")}
        </p>
        <SettingsSectionCard title={t("tourPresetsSectionTitle")} description={t("tourPresetsSectionDescription")}>
          <TourPresetsSettingsPanel />
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
