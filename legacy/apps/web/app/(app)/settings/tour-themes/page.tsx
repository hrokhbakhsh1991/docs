"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import { TourThemesSettingsPanel } from "./tour-themes-settings-panel";

export default function TourThemesSettingsPage() {
  const t = useTranslations("settings");
  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbTourThemes") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("tourThemesPageTitle")}
      title={t("tourThemesPageTitle")}
      description={t("tourThemesPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard title={t("tourThemesSectionTitle")} description={t("tourThemesSectionDescription")}>
          <TourThemesSettingsPanel />
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
