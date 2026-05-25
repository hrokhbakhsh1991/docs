"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { LoadingState } from "@tour/ui";

import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";

import { SettingsLayout } from "../settings-layout";
import { SettingsSectionCard } from "../settings-section-card";
import { TourWizardTemplateBuilderForm } from "./tour-wizard-template-builder-form";

export default function TourWizardTemplateSettingsPage() {
  const t = useTranslations("settings");
  const { data: template, isLoading, error, refetch } = useTenantWizardTemplate();

  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings"), href: "/settings" },
        { label: t("breadcrumbTourWizardTemplate") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={t("tourWizardTemplatePageTitle")}
      title={t("tourWizardTemplatePageTitle")}
      description={t("tourWizardTemplatePageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <SettingsLayout>
        <SettingsSectionCard
          title={t("tourWizardTemplateSectionTitle")}
          description={t("tourWizardTemplateSectionDescription")}
        >
          {isLoading ? (
            <LoadingState message={t("tourWizardTemplateLoading")} />
          ) : error ? (
            <p>{t("tourWizardTemplateLoadFailed")}</p>
          ) : (
            <TourWizardTemplateBuilderForm template={template ?? null} onSaved={() => void refetch()} />
          )}
        </SettingsSectionCard>
      </SettingsLayout>
    </RegisteredWorkspacePage>
  );
}
