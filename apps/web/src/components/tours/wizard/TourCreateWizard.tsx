"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Card, CardBody, LoadingState } from "@tour/ui";

import { DenaliCreateTourWizard } from "./DenaliCreateTourWizard";
import { resolveWorkspaceTourFormProfileFromTemplate } from "@/features/tours/wizard/resolveWorkspaceTourFormProfile";
import {
  DataLegacyError,
  DATA_LEGACY_PROFILE_MISMATCH_MESSAGE,
} from "@/features/tours/wizard/validation/data-legacy-error";
import { validateWorkspaceTemplateAtWizardLoad } from "@/features/tours/wizard/validation/strict-profile-validator";
import { useTenantWizardTemplate } from "@/hooks/use-tenant-wizard-template";

/**
 * Tour-create orchestrator: resolves workspace template profile, validates storage,
 * then mounts the Denali wizard rail.
 */
export function TourCreateWizard() {
  const t = useTranslations("tours.new");
  const wizardTemplateQuery = useTenantWizardTemplate();

  const profileValidationError = useMemo((): DataLegacyError | null => {
    const template = wizardTemplateQuery.data;
    if (!template) {
      return null;
    }
    try {
      const resolved = resolveWorkspaceTourFormProfileFromTemplate(template);
      validateWorkspaceTemplateAtWizardLoad(template, resolved);
      return null;
    } catch (error) {
      return error instanceof DataLegacyError ? error : null;
    }
  }, [wizardTemplateQuery.data]);

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
              background: "var(--color-danger-50, #fef2f2)",
              color: "var(--color-danger-800, #991b1b)",
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
              background: "var(--color-danger-50, #fef2f2)",
              color: "var(--color-danger-800, #991b1b)",
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

  return <DenaliCreateTourWizard />;
}
