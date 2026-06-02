"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import { TourFormDefaultsSettingsPanel } from "../tour-form-defaults/tour-form-defaults-settings-panel";

/** Main `/settings/tour-presets`: simple defaults form for typical admins (JSON editor is under `/advanced`). */
export default function SettingsTourPresetsDefaultsPage() {
  const t = useTranslations("settings");
  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbTourFormDefaults") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("tourFormDefaultsPageTitle")}
      title={t("tourFormDefaultsPageTitle")}
      description={t("tourFormDefaultsPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard title={t("tourFormDefaultsSectionTitle")} description={t("tourFormDefaultsSectionDescription")}>
          <TourFormDefaultsSettingsPanel />
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
