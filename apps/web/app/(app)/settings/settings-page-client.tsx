"use client";

import { Can } from "@casl/react";
import type { AppAbility } from "@repo/shared";
import { Button, LoadingState } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Link } from "@/i18n/navigation";
import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";

import { EmailSettingsPanel } from "./email-settings-panel";
import { PhoneSettingsPanel } from "./phone-settings-panel";
import { ProfileSettingsPanel } from "./profile-settings-panel";
import styles from "./settings-profile-form.module.css";
import { SettingsLayout } from "./settings-layout";
import { SettingsSectionCard } from "./settings-section-card";
import { useWorkspaceMe, WorkspaceMeProvider } from "./workspace-me-provider";

function SettingsWorkspaceBody() {
  const t = useTranslations("settings");
  const ability = useAbility();
  const { data, isLoading, error, refresh } = useWorkspaceMe();

  if (isLoading && !data) {
    return (
      <SettingsLayout>
        <LoadingState message={t("loadingProfile")} />
      </SettingsLayout>
    );
  }

  if (error && !data) {
    return (
      <SettingsLayout>
        <div className={styles.form}>
          <p className={styles.loadError}>{t("loadFailedDescription")}</p>
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            {t("retryLoad")}
          </Button>
        </div>
      </SettingsLayout>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <SettingsLayout>
      <SettingsSectionCard title={t("hubWorkspaceTitle")} description={t("hubWorkspaceDescription")}>
        <div className={styles.hubGrid}>
          <Link href="/settings/locations" className={styles.hubLink}>
            <p className={styles.hubLinkTitle}>{t("hubLocationsLink")}</p>
            <p className={styles.hubLinkBlurb}>{t("hubLocationsBlurb")}</p>
          </Link>
          <Link href="/settings/equipment" className={styles.hubLink}>
            <p className={styles.hubLinkTitle}>{t("hubEquipmentLink")}</p>
            <p className={styles.hubLinkBlurb}>{t("hubEquipmentBlurb")}</p>
          </Link>
          <Link href="/settings/tour-themes" className={styles.hubLink}>
            <p className={styles.hubLinkTitle}>{t("hubTourThemesLink")}</p>
            <p className={styles.hubLinkBlurb}>{t("hubTourThemesBlurb")}</p>
          </Link>
          <Link href="/settings/guide-languages" className={styles.hubLink}>
            <p className={styles.hubLinkTitle}>{t("hubGuideLanguagesLink")}</p>
            <p className={styles.hubLinkBlurb}>{t("hubGuideLanguagesBlurb")}</p>
          </Link>
          <Link href="/settings/tour-presets" className={styles.hubLink}>
            <p className={styles.hubLinkTitle}>{t("hubTourFormDefaultsLink")}</p>
            <p className={styles.hubLinkBlurb}>{t("hubTourFormDefaultsBlurb")}</p>
          </Link>
          <Can<AppAbility> ability={ability} I={AbilityAction.Read} a="Audit">
            <Link href="/settings/audit-trail" className={styles.hubLink}>
              <p className={styles.hubLinkTitle}>{t("hubAuditTrailLink")}</p>
              <p className={styles.hubLinkBlurb}>{t("hubAuditTrailBlurb")}</p>
            </Link>
          </Can>
          <Can<AppAbility> ability={ability} I={AbilityAction.Read} a="Reconciliation">
            <Link href="/settings/reconciliation-triage" className={styles.hubLink}>
              <p className={styles.hubLinkTitle}>{t("hubReconciliationTriageLink")}</p>
              <p className={styles.hubLinkBlurb}>{t("hubReconciliationTriageBlurb")}</p>
            </Link>
          </Can>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={t("profileSectionTitle")} description={t("profileCardSubtitle")}>
        <ProfileSettingsPanel me={data} refresh={refresh} />
      </SettingsSectionCard>

      <SettingsSectionCard title={t("emailSectionTitle")} description={t("emailCardSubtitle")}>
        <EmailSettingsPanel me={data} refresh={refresh} />
      </SettingsSectionCard>

      <SettingsSectionCard title={t("phoneSectionTitle")} description={t("phoneNewDescription")}>
        <PhoneSettingsPanel me={data} refresh={refresh} />
      </SettingsSectionCard>
    </SettingsLayout>
  );
}

export function SettingsPageClient() {
  const t = useTranslations("settings");
  const pageTitle = t("pageTitle");

  const breadcrumbItems = useMemo(
    () =>
      [
        { label: t("breadcrumbDashboard"), href: "/dashboard" },
        { label: t("breadcrumbSettings") },
      ] as const,
    [t],
  );

  return (
    <RegisteredWorkspacePage
      documentTitle={pageTitle}
      title={pageTitle}
      description={t("pageDescription")}
      breadcrumbItems={[...breadcrumbItems]}
      actions={null}
    >
      <WorkspaceMeProvider>
        <SettingsWorkspaceBody />
      </WorkspaceMeProvider>
    </RegisteredWorkspacePage>
  );
}
