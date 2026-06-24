"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";

import { DenaliFlatEditPageView } from "@app-tour/workspace-denali/ui/flat-edit";
import { DenaliFlatEditValidationList } from "@app-tour/workspace-denali/ui/chrome/denali-flat-edit-validation-list";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DraftSyncChrome } from "@/draft/draft-sync-chrome";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "@/features/tours/tour-list-formatters";
import type { AppLocale } from "@/i18n/routing";
import { resolveTourErrorMessage } from "@/i18n/resolve-tour-error-message";
import { DenaliFlatEditForm } from "@/wizard/denali-flat-edit-form-shell";
import {
  createDenaliWizardSubmitFieldLabelResolver,
  resolveWizardSubmitErrorMessage,
} from "@/wizard/resolve-wizard-submit-error-message";
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
          <div className="space-y-4" data-testid={TOUR_EDIT_TEST_IDS.page}>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ),
        renderNotConfigured: () => (
          <Card data-testid={TOUR_EDIT_TEST_IDS.page}>
            <CardContent className="py-8 text-center text-muted-foreground">
              {tWizard("notConfigured.description")}
            </CardContent>
          </Card>
        ),
        renderNotFound: () => (
          <Card data-testid={TOUR_EDIT_TEST_IDS.page}>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t("notFound")}
            </CardContent>
          </Card>
        ),
        renderReady: ({ core: readyCore, detail, tourId: readyTourId }) => {
          const loadError = resolveTourErrorMessage(tErrors, readyCore.error);
          const submitPresentation = resolveWizardSubmitErrorMessage({
            raw: readyCore.submitError,
            context: "edit",
            translateFieldLabel: createDenaliWizardSubmitFieldLabelResolver((key) => tDenali(key)),
            t: {
              translate: (key, values) => tWizard(key, values),
              has: (key) => {
                try {
                  tWizard(key);
                  return true;
                } catch {
                  return false;
                }
              },
            },
          });
          const priceLabel = formatTourPrice(
            detail.projection.priceAmount,
            detail.projection.priceCurrency,
            locale
          );
          const departureLabel = formatTourDeparture(detail.projection.departureAt, locale);
          const seatsLabel = formatSeats(detail.projection);

          return (
            <div className="mx-auto max-w-3xl space-y-6" data-testid={TOUR_EDIT_TEST_IDS.page}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/tours">
                  <Button type="button" variant="ghost" size="sm" className="gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    {tNav("tours")}
                  </Button>
                </Link>
                <Link href={`/tours/${encodeURIComponent(readyTourId)}/workspace`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={TOUR_EDIT_TEST_IDS.workspace}
                  >
                    {tNav("workspace")}
                  </Button>
                </Link>
              </div>

              <div className="space-y-2">
                <DraftSyncChrome
                  status={draftSyncEngine.status}
                  schemaIssues={draftSyncEngine.schemaIssues}
                  navLocked={draftSyncEngine.navLocked}
                  pendingDraft={draftSyncEngine.pendingDraft}
                  conflictReloadNotice={draftSyncEngine.conflictReloadNotice}
                  onRetry={() => void draftSyncEngine.retry()}
                  onFlush={() => void draftSyncEngine.flush()}
                  onApplyPending={draftSyncEngine.applyDraft}
                  onDiscardPending={() => {
                    if (draftSyncEngine.pendingDraft != null) {
                      draftSyncEngine.setData(draftSyncEngine.pendingDraft.data, {
                        source: "remote",
                      });
                    }
                  }}
                  manualSyncTestId={TOUR_EDIT_TEST_IDS.save}
                  rowTestId={TOUR_EDIT_TEST_IDS.draftSync}
                  showInlineSoftLockBanner
                  canRevertQuarantine={draftSyncEngine.canRevertQuarantine}
                  onRevertQuarantine={draftSyncEngine.revertToLastValid}
                />
                <TourStatusBadge status={detail.projection.uiStatus as TourUiStatus} />
                <h1 className="text-2xl font-semibold">{detail.projection.title}</h1>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {departureLabel ? <span>{departureLabel}</span> : null}
                  {priceLabel ? <span>{priceLabel}</span> : null}
                  <span>{seatsLabel}</span>
                </div>
              </div>

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
                  <div className="space-y-3 pt-2">
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
            </div>
          );
        },
      }}
    />
  );
}

export { createDenaliDraftSchemaGate };
