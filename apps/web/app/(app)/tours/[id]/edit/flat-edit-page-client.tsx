"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import {
  ensureFlatEditChromeReady,
  ensureFlatEditFormReady,
  ensureFlatEditPageReady,
} from "@app-tour/workspace-sdk";

import { peekWizardFlatEditChromeSurface } from "@/wizard/wizard-flat-edit-chrome-registry";
import { peekWizardFlatEditFormSurface } from "@/wizard/wizard-flat-edit-form-registry";
import {
  peekWizardFlatEditPageSurface,
  resolveWizardFlatEditPageSurface,
} from "@/wizard/wizard-flat-edit-page-registry";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import type { TourUiStatus } from "@/features/tours/operator-tours-types";
import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { readCachedTourPlugin } from "@/features/tours/tour-route-cache";
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
  OperatorFlatEditPageHeader,
  OperatorFlatEditPageShell,
} from "@/wizard/flat-edit-chrome";
import { buildFlatEditMetaLine } from "@/wizard/wizard-host-adapter-registry";
import { OperatorFlatEditForm } from "@/wizard/flat-edit-form-shell";
import {
  createWizardSubmitFieldLabelResolver,
  resolveWizardSubmitErrorMessage,
} from "@/wizard/resolve-wizard-submit-error-message";
import { createWizardSubmitErrorTranslator } from "@/wizard/create-wizard-submit-error-translator";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";
import { WizardSubmitErrorAlert } from "@/wizard/wizard-submit-error-alert";
import {
  createDraftSchemaGateForPlugin,
  useOperatorFlatEditPage,
} from "@/wizard/use-flat-edit-page";
import { warmOperatorWizardShell } from "@/wizard/warm-operator-wizard-shell";
import { TourStatusBadge } from "../../tour-status-badge";

type OperatorFlatEditPageClientProps = {
  readonly session: OperatorSessionContext;
  readonly tourId: string;
};

/** True when flat-edit Pattern B surfaces are already published for pluginId. */
function areFlatEditSurfacesWarm(pluginId: string): boolean {
  return (
    peekWizardFlatEditChromeSurface(pluginId) != null &&
    peekWizardFlatEditFormSurface(pluginId) != null &&
    peekWizardFlatEditPageSurface(pluginId) != null
  );
}

/**
 * Shared host warm + flat-edit-only Pattern B surfaces (idempotent).
 * @see docs/dev/wizard-create-warm-ownership.mdoc
 */
async function warmFlatEditOperatorShell(pluginId: string): Promise<WorkspacePlugin> {
  const loaded = await warmOperatorWizardShell(pluginId);
  await Promise.all([
    ensureFlatEditChromeReady(loaded),
    ensureFlatEditFormReady(loaded),
    ensureFlatEditPageReady(loaded),
  ]);
  return loaded;
}

/** Wave B.c / I.6 — load plugin via registry (session.pluginId), then mount orchestration hook. */
export function OperatorFlatEditPageClient({ session, tourId }: OperatorFlatEditPageClientProps) {
  const [plugin, setPlugin] = useState<WorkspacePlugin | null>(() => {
    const cached = readCachedTourPlugin(session.pluginId);
    // Create warm alone leaves flat-edit surfaces cold — do not mount Ready from that cache.
    return cached != null && areFlatEditSurfacesWarm(session.pluginId) ? cached : null;
  });

  useEffect(() => {
    let cancelled = false;
    void warmFlatEditOperatorShell(session.pluginId).then((loaded) => {
      if (!cancelled) {
        setPlugin(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  if (plugin == null) {
    return <CreateTourWizardLoadingMessage testId={TOUR_EDIT_TEST_IDS.page} />;
  }

  return <OperatorFlatEditPageClientReady session={session} tourId={tourId} plugin={plugin} />;
}

type OperatorFlatEditPageClientReadyProps = OperatorFlatEditPageClientProps & {
  readonly plugin: WorkspacePlugin;
};

function OperatorFlatEditPageClientReady({
  session,
  tourId,
  plugin,
}: OperatorFlatEditPageClientReadyProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("tours.edit");
  const tErrors = useTranslations("tours.edit.errors");
  const tNav = useTranslations("tours.nav");
  const tFormat = useTranslations("tours.format");
  const tWizard = useTranslations("wizard");
  const tPlugin = useWorkspaceWizardTranslator(session.pluginId);
  const tCommon = useTranslations("common");
  const core = useOperatorFlatEditPage({ session, tourId, plugin });
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

  const pageSurface = resolveWizardFlatEditPageSurface(plugin.id);
  if (pageSurface == null) {
    return <CreateTourWizardLoadingMessage testId={TOUR_EDIT_TEST_IDS.page} />;
  }
  const FlatEditPageView = pageSurface.FlatEditPageView;
  const FlatEditValidationList = pageSurface.FlatEditValidationList;

  return (
    <FlatEditPageView
      core={core}
      tourId={tourId}
      slots={{
        renderLoading: () => (
          <CreateTourWizardLoadingMessage testId={TOUR_EDIT_TEST_IDS.page} />
        ),
        renderNotConfigured: () => <CreateTourWizardNotConfigured />,
        renderNotFound: () => (
          <OperatorFlatEditPageShell testId={TOUR_EDIT_TEST_IDS.page}>
            <section className="new-tour-wizard-page__empty">
              <p className="new-tour-wizard-page__empty-desc">{t("notFound")}</p>
            </section>
          </OperatorFlatEditPageShell>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product view slot props
        renderReady: ({ core: readyCore, detail, tourId: readyTourId }: any) => {
          const loadError = resolveTourErrorMessage(tErrors, readyCore.error);
          const hasSubmitValidationIssues =
            readyCore.submitValidationIssues != null &&
            readyCore.submitValidationIssues.length > 0;
          // Field-level validation list already conveys the blocker — suppress duplicate footer summary.
          const submitPresentation = resolveWizardSubmitErrorMessage({
            pluginId: session.pluginId,
            raw: hasSubmitValidationIssues ? null : readyCore.submitError,
            context: "edit",
            translateFieldLabel: createWizardSubmitFieldLabelResolver(session.pluginId, (key) =>
              tPlugin(key)
            ),
            translateWorkspace: (key, values) => tPlugin(key, values),
            t: createWizardSubmitErrorTranslator(tWizard),
          });
          const priceLabel = formatTourPrice(
            detail.projection.priceAmount,
            detail.projection.priceCurrency,
            locale,
            session.pluginId
          );
          const departureLabel = formatTourDeparture(detail.projection.departureAt, locale);
          const seatsLabel = formatSeats(detail.projection);
          const metaLine = buildFlatEditMetaLine(session.pluginId, [
            departureLabel,
            priceLabel,
            seatsLabel,
          ]);

          return (
            <OperatorFlatEditPageShell testId={TOUR_EDIT_TEST_IDS.page}>
              <OperatorFlatEditPageHeader
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

              <OperatorFlatEditForm
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
                      <FlatEditValidationList issues={readyCore.submitValidationIssues} />
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
                      <Button
                        asChild
                        variant="ghost"
                        data-testid={TOUR_EDIT_TEST_IDS.cancel}
                        disabled={readyCore.pending}
                      >
                        <TourInternalLink href="/tours">{t("cancelEdits")}</TourInternalLink>
                      </Button>
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
            </OperatorFlatEditPageShell>
          );
        },
      }}
    />
  );
}

export { createDraftSchemaGateForPlugin };
