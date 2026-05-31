"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, LoadingState } from "@tour/ui";

import { WorkspaceTourWizard } from "./WorkspaceTourWizard";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import { normalizeTourFormProfileInput } from "@/lib/workspace/workspace-capabilities";
import { getWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";
import type { WizardSessionBlueprint } from "@/features/tours/wizard/wizard-session-blueprint.types";
import {
  DataLegacyError,
  DATA_LEGACY_PROFILE_MISMATCH_MESSAGE,
} from "@/features/tours/wizard/validation/data-legacy-error";
import { validateWorkspaceTemplateAtWizardLoad } from "@/features/tours/wizard/validation/strict-profile-validator";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";

/**
 * Tour-create orchestrator: resolves workspace template profile, validates storage,
 * then mounts the profile-bound wizard shell from {@link getWizardConfig}.
 */
export function TourCreateWizard() {
  const t = useTranslations("tours.new");
  const wizardTemplateQuery = useTenantWizardTemplate();

  const workspaceFormProfile = useMemo(
    () =>
      wizardTemplateQuery.data
        ? resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data)
        : null,
    [wizardTemplateQuery.data],
  );

  const wizardShellConfig = useMemo(
    () => getWizardConfig(normalizeTourFormProfileInput(workspaceFormProfile)),
    [workspaceFormProfile],
  );
  const usesWorkspaceWizardShell = wizardShellConfig.wizardMode === "denali";

  const profileValidationError = useMemo((): DataLegacyError | null => {
    const template = wizardTemplateQuery.data;
    if (!template || workspaceFormProfile == null) {
      return null;
    }
    try {
      validateWorkspaceTemplateAtWizardLoad(template, workspaceFormProfile);
      return null;
    } catch (error) {
      return error instanceof DataLegacyError ? error : null;
    }
  }, [wizardTemplateQuery.data, workspaceFormProfile]);

  const [sessionBlueprint, setSessionBlueprint] = useState<WizardSessionBlueprint | null>(null);

  useEffect(() => {
    if (!wizardTemplateQuery.data || workspaceFormProfile == null || sessionBlueprint) {
      return;
    }
    setSessionBlueprint({
      template: wizardTemplateQuery.data,
      profile: workspaceFormProfile,
      shellConfig: wizardShellConfig,
    });
  }, [wizardTemplateQuery.data, workspaceFormProfile, wizardShellConfig, sessionBlueprint]);

  if (wizardTemplateQuery.isLoading) {
    return (
      <Card>
        <CardBody>
          <LoadingState message="در حال بارگذاری قالب ویزارد…" />
        </CardBody>
      </Card>
    );
  }

  if (wizardTemplateQuery.isError || !wizardTemplateQuery.data) {
    const detail =
      wizardTemplateQuery.error instanceof Error
        ? wizardTemplateQuery.error.message
        : null;
    return (
      <Card>
        <CardBody>
          <div
            role="alert"
            style={{
              padding: "1rem",
              borderRadius: 8,
              background: "var(--color-danger-50)",
              color: "var(--color-danger-800)",
            }}
          >
            <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
              {t("wizardTemplateLoadFailedTitle")}
            </p>
            <p style={{ margin: "0 0 0.5rem 0" }}>{t("wizardTemplateLoadFailedDescription")}</p>
            <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>
              {t("wizardTemplateLoadFailedHint")}
            </p>
            {detail ? (
              <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.8rem", fontFamily: "monospace" }}>
                {detail}
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>
    );
  }

  if (profileValidationError) {
    return (
      <Card>
        <CardBody>
          <div
            role="alert"
            data-testid="wizard-data-legacy-error"
            style={{
              padding: "1rem",
              borderRadius: 8,
              background: "var(--color-danger-50)",
              color: "var(--color-danger-800)",
            }}
          >
            <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
              {DATA_LEGACY_PROFILE_MISMATCH_MESSAGE}
            </p>
            <p style={{ margin: 0, fontSize: "0.85rem", fontFamily: "monospace" }}>
              templateId={wizardTemplateQuery.data.id} baseProfile=
              {wizardTemplateQuery.data.baseProfile}
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (usesWorkspaceWizardShell) {
    if (!sessionBlueprint) {
      return (
        <Card>
          <CardBody>
            <LoadingState message="در حال آماده‌سازی ویزارد…" />
          </CardBody>
        </Card>
      );
    }
    return <WorkspaceTourWizard sessionBlueprint={sessionBlueprint} />;
  }

  return (
    <Card>
      <CardBody>
        <div
          role="alert"
          data-testid="wizard-classic-shell-unavailable"
          style={{
            padding: "1rem",
            borderRadius: 8,
            background: "var(--color-warning-50)",
            color: "var(--color-warning-900)",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
            {t("wizardClassicShellUnavailableTitle")}
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem" }}>
            {t("wizardClassicShellUnavailableDescription")}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
