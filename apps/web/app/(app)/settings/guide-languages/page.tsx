"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import { GuideLanguagesSettingsPanel } from "./guide-languages-settings-panel";

export default function GuideLanguagesSettingsPage() {
  const t = useTranslations("settings");
  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbGuideLanguages") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("guideLanguagesPageTitle")}
      title={t("guideLanguagesPageTitle")}
      description={t("guideLanguagesPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard
          title={t("guideLanguagesSectionTitle")}
          description={t("guideLanguagesSectionDescription")}
        >
          <GuideLanguagesSettingsPanel />
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
