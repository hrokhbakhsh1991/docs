"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import { EquipmentSettingsPanel } from "./equipment-settings-panel";

export default function EquipmentSettingsPage() {
  const t = useTranslations("settings");
  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbEquipment") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("equipmentPageTitle")}
      title={t("equipmentPageTitle")}
      description={t("equipmentPageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard title={t("equipmentSectionTitle")} description={t("equipmentSectionDescription")}>
          <EquipmentSettingsPanel />
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
