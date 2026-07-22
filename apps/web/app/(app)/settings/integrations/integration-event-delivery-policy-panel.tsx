"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExposureFieldChecklist } from "@/exposure/ExposureFieldChecklist";
import { localizeExposureCatalogFields } from "@/exposure/localize-exposure-catalog-fields";
import { ensureWizardHostAdapters } from "@/wizard/host-adapter-runtime";
import {
  catalogFieldIdsFromExposureFields,
  resolveEffectiveSelectedFieldIds,
  resolveExposureFieldSelectionFromPersisted,
  resolveExposureIntentContextFromPersisted,
  resolveExposureIntentPatchInput,
  setExposureCustomizeFields,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
  type ExposureChecklistContext,
  type ExposureCatalogField,
  type ExposureFieldSelectionState,
} from "@/exposure/exposure-field-selection";
import {
  hydrateTelegramTemplateState,
  renderTelegramDeliveryPreview,
  syncTelegramTemplateOnFieldToggle,
} from "@/exposure/telegram-delivery-template-sync";
import { buildExposureEventTypeList } from "@/exposure/build-exposure-event-type-list";
import {
  patchExposureIntent,
  patchIntegrationEventPolicy,
} from "@/integrations/integrations-client";
import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
} from "@/integrations/integrations-types";
import { listDeprecatedEventPolicies } from "@/integrations/integration-connection-load-warnings";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import { useWorkspaceWizardTranslator } from "@/wizard/use-workspace-wizard-translator";

export const INTEGRATION_DELIVERY_POLICY_TEST_IDS = {
  panel: "integration-delivery-policy-panel",
  deprecatedMigration: "integration-delivery-policy-deprecated-migration",
  event: "integration-delivery-policy-event",
  surface: "integration-delivery-policy-surface",
  messageTemplate: "integration-delivery-policy-message-template",
} as const;

type DeliveryPolicyEventState = {
  readonly enabled: boolean;
  /** When true, {@link selectedFieldIds} narrows delivery; otherwise registry defaults apply. */
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
  readonly template: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

type IntegrationEventDeliveryPolicyPanelProps = {
  readonly connection: IntegrationConnectionPublic;
  readonly providerSurface: IntegrationProviderSurfaceMeta | null;
  readonly exposureCandidateFields: readonly ExposureCatalogField[];
  readonly canEdit: boolean;
  readonly onUpdated: (updated: IntegrationConnectionPublic) => void;
  /** Workspace plugin id — drives wizard message namespace for field localization. */
  readonly pluginId: string;
};

function catalogFieldIds(fields: readonly ExposureCatalogField[]): readonly string[] {
  return catalogFieldIdsFromExposureFields(fields);
}

/** Operator-friendly event title, e.g. "TourCreated" → "Tour created". */
function humanizeEventType(eventType: string): string {
  const spaced = eventType
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
  if (spaced.length === 0) {
    return eventType;
  }
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

type TelegramMessagePreviewProps = {
  readonly eventLabel: string;
  readonly fields: readonly ExposureCatalogField[];
  readonly selectedFieldIds: readonly string[];
  readonly template: string;
  readonly labels: {
    readonly title: string;
    readonly description: string;
    readonly empty: string;
    readonly defaultPrefix: string;
    readonly sampleValue: string;
    readonly aggregateId: string;
    readonly redacted: string;
  };
};

function TelegramMessagePreview(props: TelegramMessagePreviewProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{props.labels.title}</p>
        <p className="text-xs text-muted-foreground">{props.labels.description}</p>
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border/60 bg-background p-3 text-xs leading-6 text-foreground">
        {renderTelegramDeliveryPreview({
          eventLabel: props.eventLabel,
          fields: props.fields,
          selectedFieldIds: props.selectedFieldIds,
          template: props.template,
          labels: {
            empty: props.labels.empty,
            defaultPrefix: props.labels.defaultPrefix,
            sampleValue: props.labels.sampleValue,
            aggregateId: props.labels.aggregateId,
            redacted: props.labels.redacted,
          },
        })}
      </pre>
    </div>
  );
}

function toSelectionState(eventState: DeliveryPolicyEventState): ExposureFieldSelectionState {
  return {
    customizeFields: eventState.customizeFields,
    selectedFieldIds: eventState.selectedFieldIds,
  };
}

function toExposureContext(eventState: DeliveryPolicyEventState): ExposureChecklistContext {
  return {
    surface: eventState.surface,
    audience: eventState.audience,
    trigger: eventState.trigger,
  };
}

function effectiveSelectedFieldIds(
  eventState: DeliveryPolicyEventState,
  exposureCandidateFields: readonly ExposureCatalogField[],
): readonly string[] {
  return resolveEffectiveSelectedFieldIds(
    toSelectionState(eventState),
    catalogFieldIds(exposureCandidateFields),
  );
}

function initialEventState(
  connection: IntegrationConnectionPublic,
  providerSurface: IntegrationProviderSurfaceMeta | null,
  eventType: string,
  exposureCandidateFields: readonly ExposureCatalogField[],
): DeliveryPolicyEventState {
  const persistedPolicy = connection.eventPolicies.find((policy) => policy.eventType === eventType);
  const persistedIntent =
    connection.exposureIntents.find((intent) => intent.eventType === eventType) ??
    connection.exposureIntents.find((intent) => intent.trigger === eventType);
  const defaultEnabled =
    providerSurface?.defaultEventPolicies.find((policy) => policy.eventType === eventType)
      ?.enabled ?? false;
  const enabled = persistedPolicy?.enabled ?? defaultEnabled;
  const selection = resolveExposureFieldSelectionFromPersisted(
    persistedIntent?.enabled === true,
    persistedIntent?.selectedFieldIds ?? [],
  );
  const context = resolveExposureIntentContextFromPersisted(
    connection.provider,
    eventType,
    persistedIntent,
  );
  const selectedFieldIds = resolveEffectiveSelectedFieldIds(
    selection,
    catalogFieldIds(exposureCandidateFields),
  );
  const hydratedTemplate = hydrateTelegramTemplateState({
    template: persistedIntent?.templateId ?? "",
    legacyFieldDecorations: persistedIntent?.fieldDecorations,
    fields: exposureCandidateFields,
    selectedFieldIds,
    customizeFields: selection.customizeFields,
  });

  return {
    enabled,
    customizeFields: selection.customizeFields,
    selectedFieldIds: selection.selectedFieldIds,
    template: hydratedTemplate,
    surface: context.surface,
    audience: context.audience,
    trigger: context.trigger,
  };
}

export function IntegrationEventDeliveryPolicyPanel({
  connection,
  providerSurface,
  exposureCandidateFields,
  canEdit,
  onUpdated,
  pluginId,
}: IntegrationEventDeliveryPolicyPanelProps) {
  const t = useTranslations("settings.integrations.deliveryPolicy");
  const tChecklist = useTranslations("settings.exposure.fieldChecklist");
  const tWizard = useWorkspaceWizardTranslator(pluginId);
  const tErrors = useTranslations("settings.integrations.errors");

  const [hostAdaptersWarm, setHostAdaptersWarm] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void ensureWizardHostAdapters().then(() => {
      if (!cancelled) {
        setHostAdaptersWarm(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const localizedCandidateFields = useMemo((): readonly ExposureCatalogField[] => {
    if (!hostAdaptersWarm) {
      return exposureCandidateFields;
    }
    return localizeExposureCatalogFields(exposureCandidateFields, tWizard);
  }, [exposureCandidateFields, tWizard, hostAdaptersWarm]);

  const eventTypes = useMemo(
    () => buildExposureEventTypeList(connection, providerSurface),
    [connection, providerSurface],
  );

  const deprecatedEventPolicies = useMemo(
    () => listDeprecatedEventPolicies(connection),
    [connection],
  );

  const eventLabel = (eventType: string): string => {
    const key = `eventNames.${eventType}`;
    return t.has(key) ? t(key) : humanizeEventType(eventType);
  };
  const eventHint = (eventType: string): string | null => {
    const key = `eventHints.${eventType}`;
    return t.has(key) ? t(key) : null;
  };

  const [stateByEvent, setStateByEvent] = useState<Record<string, DeliveryPolicyEventState>>({});
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [errorByEvent, setErrorByEvent] = useState<Record<string, string>>({});
  const [successEvent, setSuccessEvent] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, DeliveryPolicyEventState> = {};
    for (const eventType of eventTypes) {
      next[eventType] = initialEventState(
        connection,
        providerSurface,
        eventType,
        localizedCandidateFields,
      );
    }
    setStateByEvent(next);
    setErrorByEvent({});
    setSuccessEvent(null);
  }, [connection, eventTypes, providerSurface, localizedCandidateFields]);

  if (eventTypes.length === 0) {
    return null;
  }

  function updateEventState(eventType: string, patch: Partial<DeliveryPolicyEventState>): void {
    setSuccessEvent(null);
    setStateByEvent((current) => ({
      ...current,
      [eventType]: { ...current[eventType], ...patch },
    }));
  }

  function toggleField(eventType: string, fieldId: string, checked: boolean): void {
    setStateByEvent((current) => {
      const previous = current[eventType];
      if (previous === undefined) {
        return current;
      }
      const nextSelection = toggleExposureFieldSelection(
        toSelectionState(previous),
        catalogFieldIds(exposureCandidateFields),
        fieldId,
        checked,
      );
      const field = localizedCandidateFields.find((candidate) => candidate.id === fieldId);
      const nextTemplate =
        field === undefined
          ? previous.template
          : syncTelegramTemplateOnFieldToggle({
              template: previous.template,
              field,
              checked,
            });
      return {
        ...current,
        [eventType]: {
          ...previous,
          ...nextSelection,
          template: nextTemplate,
        },
      };
    });
    setSuccessEvent(null);
  }

  function setCustomizeFields(eventType: string, customize: boolean): void {
    setStateByEvent((current) => {
      const previous = current[eventType];
      if (previous === undefined) {
        return current;
      }
      const nextSelection = setExposureCustomizeFields(
        toSelectionState(previous),
        catalogFieldIds(exposureCandidateFields),
        customize,
      );
      const selectedIds = resolveEffectiveSelectedFieldIds(
        nextSelection,
        catalogFieldIds(exposureCandidateFields),
      );
      const template =
        customize && previous.template.trim().length === 0
          ? hydrateTelegramTemplateState({
              template: "",
              fields: localizedCandidateFields,
              selectedFieldIds: selectedIds,
              customizeFields: true,
            })
          : previous.template;
      return {
        ...current,
        [eventType]: { ...previous, ...nextSelection, template },
      };
    });
    setSuccessEvent(null);
  }

  async function handleSave(eventType: string): Promise<void> {
    const eventState = stateByEvent[eventType];
    if (eventState === undefined) {
      return;
    }
    setSavingEvent(eventType);
    setErrorByEvent((current) => {
      const next = { ...current };
      delete next[eventType];
      return next;
    });
    setSuccessEvent(null);
    try {
      await patchIntegrationEventPolicy(connection.id, eventType, {
        enabled: eventState.enabled,
      });
      const patchInput = resolveExposureIntentPatchInput({
        selection: toSelectionState(eventState),
        context: toExposureContext(eventState),
        template: eventState.template,
      });
      const updated = await patchExposureIntent(connection.id, eventType, patchInput);
      onUpdated(updated);
      setSuccessEvent(eventType);
    } catch (actionError: unknown) {
      const code =
        actionError instanceof Error
          ? actionError.message
          : "INTEGRATION_DELIVERY_INTENT_PATCH_FAILED";
      setErrorByEvent((current) => ({ ...current, [eventType]: code }));
    } finally {
      setSavingEvent(null);
    }
  }

  return (
    <div className="space-y-6" data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.panel}>
      {deprecatedEventPolicies.length > 0 ? (
        <div
          className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-4 text-sm"
          data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.deprecatedMigration}
        >
          {deprecatedEventPolicies.map((policy) => {
            const supersededBy = policy.supersededBy ?? "TourPublished";
            return (
              <div key={policy.eventType} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                  {t("deprecatedEventBadge")}
                </Badge>
                <p className="text-muted-foreground">
                  {t("deprecatedEventNotice", {
                    eventName: eventLabel(policy.eventType),
                    supersededBy: eventLabel(supersededBy),
                  })}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
      {eventTypes.map((eventType, eventIndex) => {
        const eventState = stateByEvent[eventType];
        if (eventState === undefined) {
          return null;
        }
        const selectedFieldIds = effectiveSelectedFieldIds(eventState, exposureCandidateFields);
        const eventError = errorByEvent[eventType];
        const isSaving = savingEvent === eventType;

        return (
          <div
            key={eventType}
            className="space-y-5"
            data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.event}
            data-event-type={eventType}
          >
            {eventIndex > 0 ? <Separator /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{eventLabel(eventType)}</p>
                  <Badge variant={eventState.enabled ? "default" : "outline"}>
                    {eventState.enabled ? t("enabledLabel") : t("enabledLabelOff")}
                  </Badge>
                </div>
                {eventHint(eventType) !== null ? (
                  <p className="text-xs leading-5 text-muted-foreground">{eventHint(eventType)}</p>
                ) : null}
              </div>
              <label className="flex shrink-0 items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm">
                <Checkbox
                  checked={eventState.enabled}
                  disabled={!canEdit || isSaving}
                  onChange={(event) => updateEventState(eventType, { enabled: event.target.checked })}
                />
                <span>{t("enabledLabel")}</span>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border/70 px-4 py-3 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={eventState.customizeFields}
                disabled={!canEdit || isSaving}
                onChange={(event) => setCustomizeFields(eventType, event.target.checked)}
              />
              <span className="leading-5">
                <span className="font-medium text-foreground">{t("customizeFieldsLabel")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("customizeFieldsHint")}
                </span>
              </span>
            </label>

            {eventState.customizeFields ? (
              <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-start lg:gap-6">
                <div className="space-y-5">
                  <section
                    className="space-y-3"
                    data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.surface}
                  >
                    <p className="text-sm font-medium text-foreground">{t("fieldsLabel")}</p>
                    <ExposureFieldChecklist
                      context={toExposureContext(eventState)}
                      disabled={!canEdit || isSaving}
                      emptyLabel={t("noCandidateFields")}
                      fields={toExposureChecklistFields(localizedCandidateFields)}
                      selectedFieldIds={selectedFieldIds}
                      selectedSummary={t("selectedSummary", { count: selectedFieldIds.length })}
                      labels={{
                        searchPlaceholder: tChecklist("searchPlaceholder"),
                        selectAllInGroup: tChecklist("selectAllInGroup"),
                        clearGroup: tChecklist("clearGroup"),
                        selectedOfTotal: tChecklist("selectedOfTotal", {
                          selected: selectedFieldIds.length,
                          total: localizedCandidateFields.length,
                        }),
                      }}
                      onFieldToggle={(fieldId, checked) => toggleField(eventType, fieldId, checked)}
                    />
                  </section>

                  <section className="space-y-2 rounded-lg border border-border/70 bg-card p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor={`delivery-template-${eventType}`}>{t("templateLabel")}</Label>
                      <p className="text-xs text-muted-foreground">{t("templateCanvasDescription")}</p>
                    </div>
                    <textarea
                      id={`delivery-template-${eventType}`}
                      className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={eventState.template}
                      placeholder={t("templatePlaceholder")}
                      disabled={!canEdit || isSaving}
                      data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.messageTemplate}
                      onChange={(event) =>
                        updateEventState(eventType, { template: event.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
                  </section>
                </div>

                <div className="space-y-4">
                  <TelegramMessagePreview
                    eventLabel={eventLabel(eventType)}
                    fields={localizedCandidateFields}
                    selectedFieldIds={selectedFieldIds}
                    template={eventState.template}
                    labels={{
                      title: t("previewTitle"),
                      description: t("previewDescription"),
                      empty: t("previewEmpty"),
                      defaultPrefix: t("previewDefaultPrefix"),
                      sampleValue: t("previewSampleValue"),
                      aggregateId: t("previewAggregateId"),
                      redacted: t("previewRedacted"),
                    }}
                  />
                </div>
              </div>
            ) : null}

            {eventError !== undefined ? (
              <p className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, eventError)}
              </p>
            ) : null}
            {successEvent === eventType ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
                {t("success")}
              </p>
            ) : null}

            {canEdit ? (
              <div className="flex justify-end border-t border-border/60 pt-4">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => void handleSave(eventType)}
                >
                  {isSaving ? t("saving") : t("save")}
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
