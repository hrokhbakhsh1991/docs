"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

import {
  DenaliFlatEditPageView,
  DenaliFlatEditValidationList,
} from "@/bootstrap/workspace-wizard-flat-edit-page-bindings.generated";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import {
  CreateTourWizardLoadingMessage,
  CreateTourWizardNotConfigured,
} from "@/wizard/create-tour-wizard-chrome";
import {
  DenaliFlatEditPageHeader,
  DenaliFlatEditPageShell,
} from "@/wizard/denali-flat-edit-chrome";
import { DenaliFlatEditForm } from "@/wizard/denali-flat-edit-form-shell";
import {
  createDenaliWizardSubmitFieldLabelResolver,
  resolveWizardSubmitErrorMessage,
} from "@/wizard/resolve-wizard-submit-error-message";
import { createWizardSubmitErrorTranslator } from "@/wizard/create-wizard-submit-error-translator";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { WizardSubmitErrorAlert } from "@/wizard/wizard-submit-error-alert";
import {
  createDenaliDraftSchemaGate,
  useDenaliFlatEditPage,
} from "@/wizard/use-denali-flat-edit-page";

import { TourStatusBadge } from "../../tour-status-badge";

type DenaliFlatEditPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

function buildFlatEditMetaLine(parts: readonly (string | null | undefined)[]): string | null {
  const line = parts.filter((part) => part != null && part.length > 0).join(" · ");
  return line.length > 0 ? line : null;
}

export function DenaliFlatEditPageClient({ session, tourId }: DenaliFlatEditPageClientProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.edit");
  const tErrors = useTranslations("tours.edit.errors");
  const tNav = useTranslations("tours.nav");
  const tFormat = useTranslations("tours.format");
  const tWizard = useTranslations("wizard");
  const tDenali = useWorkspaceWizardTranslator("denali");
  const tCommon = useTranslations("common");
  const core = useDenaliFlatEditPage({ session, tourId });
  const { draftSyncEngine } = core;

  const formatSeats = useCallback(
    (projection: { readonly acceptedSeats: number; readonly capacity: number | null }) =>
      formatTourSeats(
        { acceptedCount: projection.acceptedSeats, totalCapacity: projection.capacity },
        {
          withCapacity: (accepted, capacity) => tFormat("seatsWithCapacity", { accepted, capacity }),
          open: (accepted) => tFormat("seatsOpen", { accepted }),
        }
      ),
    [tFormat]
  );

  return (
    <DenaliFlatEditPageView
      core={core}
      tourId={tourId}
      slots={{
        renderLoading: () => (
          <CreateTourWizardLoadingMessage testId={TOUR_EDIT_TEST_IDS.page} />
        ),
        renderNotConfigured: () => <CreateTourWizardNotConfigured />,
        renderNotFound: () => (
          <DenaliFlatEditPageShell testId={TOUR_EDIT_TEST_IDS.page}>
            <section className="new-tour-wizard-page__empty">
              <p className="new-tour-wizard-page__empty-desc">{t("notFound")}</p>
            </section>
          </DenaliFlatEditPageShell>
        ),
        renderReady: ({ core: readyCore, detail, tourId: readyTourId }) => {
          const loadError = resolveTourErrorMessage(tErrors, readyCore.error);
          const submitPresentation = resolveWizardSubmitErrorMessage({
            raw: readyCore.submitError,
            context: "edit",
            translateFieldLabel: createDenaliWizardSubmitFieldLabelResolver((key) => tDenali(key)),
            t: createWizardSubmitErrorTranslator(tWizard),
          });
          const priceLabel = formatTourPrice(
            detail.projection.priceAmount,
            detail.projection.priceCurrency,
            locale
          );
          const departureLabel = formatTourDeparture(detail.projection.departureAt, locale);
          const seatsLabel = formatSeats(detail.projection);
          const metaLine = buildFlatEditMetaLine([departureLabel, priceLabel, seatsLabel]);

          return (
            <DenaliFlatEditPageShell testId={TOUR_EDIT_TEST_IDS.page}>
              <DenaliFlatEditPageHeader
                tourId={readyTourId}
                title={detail.projection.title}
                statusBadge={
                  <TourStatusBadge status={detail.projection.uiStatus as TourUiStatus} />
                }
                metaLine={metaLine}
                toursNavLabel={tNav("tours")}
                workspaceNavLabel={tNav("workspace")}
                draftSync={draftSyncEngine}
              />

              <DenaliFlatEditForm
                tenantId={session.tenantId}
                draft={readyCore.draft}
                onDraftChange={readyCore.onDraftChange}
                navLocked={readyCore.draftSync.navLocked}
                templateSteps={readyCore.gate.templateSteps}
                allowedCanonicalPaths={readyCore.gate.allowedCanonicalPaths}
                wizardRuleEvalContext={readyCore.wizardRuleEvalContext}
                wizardSessionId={readyCore.wizardSessionId}
                footer={
                  <div className="space-y-3 pt-2" data-wizard-footer>
                    {readyCore.submitValidationIssues != null &&
                    readyCore.submitValidationIssues.length > 0 ? (
                      <DenaliFlatEditValidationList issues={readyCore.submitValidationIssues} />
                    ) : null}
                    {loadError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {loadError}
                      </p>
                    ) : null}
                    <WizardSubmitErrorAlert
                      presentation={submitPresentation}
                      className="text-sm text-destructive"
                    />
                    {readyCore.saved ? (
                      <p className="text-sm text-muted-foreground">{t("saved")}</p>
                    ) : null}
                    {readyCore.published ? (
                      <p className="text-sm text-muted-foreground">{t("published")}</p>
                    ) : null}
                    {readyCore.unpublished ? (
                      <p className="text-sm text-muted-foreground">{t("unpublished")}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Link href="/tours">
                        <Button
                          type="button"
                          variant="ghost"
                          data-testid={TOUR_EDIT_TEST_IDS.cancel}
                          disabled={readyCore.pending}
                        >
                          {t("cancelEdits")}
                        </Button>
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        data-testid={TOUR_EDIT_TEST_IDS.save}
                        disabled={readyCore.pending || readyCore.draftSync.navLocked}
                        onClick={() => void readyCore.handlePatch("save")}
                      >
                        {readyCore.pending && readyCore.pendingIntent === "save"
                          ? tCommon("saving")
                          : t("saveChanges")}
                      </Button>
                      {readyCore.canPublish ? (
                        <Button
                          type="button"
                          data-testid={TOUR_EDIT_TEST_IDS.publish}
                          disabled={readyCore.pending || readyCore.draftSync.navLocked}
                          onClick={() => void readyCore.handlePatch("publish")}
                        >
                          {readyCore.pending && readyCore.pendingIntent === "publish"
                            ? t("publishing")
                            : t("publishChanges")}
                        </Button>
                      ) : null}
                      {readyCore.canUnpublish ? (
                        <Button
                          type="button"
                          variant="secondary"
                          data-testid={TOUR_EDIT_TEST_IDS.unpublish}
                          disabled={readyCore.pending || readyCore.draftSync.navLocked}
                          onClick={() => void readyCore.handlePatch("unpublish")}
                        >
                          {readyCore.pending && readyCore.pendingIntent === "unpublish"
                            ? t("unpublishing")
                            : t("unpublishChanges")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                }
              />
            </DenaliFlatEditPageShell>
          );
        },
      }}
    />
  );
}

export { createDenaliDraftSchemaGate };
