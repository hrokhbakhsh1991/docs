"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ExposureFieldChecklist } from "@/exposure/ExposureFieldChecklist";
import { ExposureEnginePreviewPanel } from "@/exposure/ExposureEnginePreviewPanel";
import type { ExposureControlPlaneEventContext } from "@/exposure/exposure-control-plane-client";
import {
  fetchExposureEnginePreview,
  type ExposureEnginePreviewModel,
} from "@/exposure/exposure-engine-preview-client";
import { localizeExposureCatalogFields } from "@/exposure/localize-exposure-catalog-fields";
import {
  catalogFieldIdsFromExposureFields,
  reorderExposureSelectedFieldId,
  resolveEffectiveSelectedFieldIds,
  resolveExposureCatalogFieldsInSelectedOrder,
  resolveExposureFieldSelectionFromPersisted,
  resolveExposureIntentContextFromPersisted,
  resolveExposureIntentPatchInput,
  setExposureCustomizeFields,
  setExposureFieldDecorationPrefix,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
  type ExposureChecklistContext,
  type ExposureCatalogField,
  type ExposureFieldDecorations,
  type ExposureFieldSelectionState,
} from "@/exposure/exposure-field-selection";
import { buildExposureEventTypeList } from "@/exposure/build-exposure-event-type-list";
import {
  patchExposureIntent,
  patchIntegrationEventPolicy,
} from "@/integrations/integrations-client";
import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
} from "@/integrations/integrations-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

export const INTEGRATION_DELIVERY_POLICY_TEST_IDS = {
  panel: "integration-delivery-policy-panel",
  event: "integration-delivery-policy-event",
  surface: "integration-delivery-policy-surface",
  fieldOrder: "integration-delivery-policy-field-order",
  fieldOrderMoveUp: "integration-delivery-policy-field-order-move-up",
  fieldOrderMoveDown: "integration-delivery-policy-field-order-move-down",
  fieldOrderIconInput: "integration-delivery-policy-field-order-icon-input",
} as const;

type DeliveryPolicyEventState = {
  readonly enabled: boolean;
  /** When true, {@link selectedFieldIds} narrows delivery; otherwise registry defaults apply. */
  readonly customizeFields: boolean;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations: ExposureFieldDecorations;
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
  readonly fieldDecorations: ExposureFieldDecorations;
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

function fieldLabel(field: ExposureCatalogField): string {
  return field.adminLabel ?? field.id;
}

function sampleFieldValue(field: ExposureCatalogField, fallback: string): string {
  const key = `${field.id} ${field.canonicalPath}`.toLowerCase();
  if (key.includes("title") || key.includes("name")) {
    return "تور کویر لوت";
  }
  if (key.includes("date") || key.includes("time")) {
    return "۱۴۰۳/۰۸/۲۰";
  }
  if (key.includes("price") || key.includes("amount")) {
    return "۴۸٬۰۰۰٬۰۰۰ تومان";
  }
  if (key.includes("location") || key.includes("destination")) {
    return "کرمان";
  }
  return fallback;
}

function renderTelegramPreviewMessage({
  eventLabel,
  fields,
  selectedFieldIds,
  fieldDecorations,
  template,
  labels,
}: TelegramMessagePreviewProps): string {
  const selectedFields = resolveExposureCatalogFieldsInSelectedOrder(fields, selectedFieldIds);
  if (selectedFields.length === 0) {
    return labels.empty;
  }
  const sampleById = new Map(
    selectedFields.map((field) => [
      field.id,
      sampleFieldValue(field, labels.sampleValue),
    ] as const),
  );
  const trimmedTemplate = template.trim();
  if (trimmedTemplate.length > 0) {
    return trimmedTemplate
      .replaceAll("{{eventType}}", eventLabel)
      .replaceAll("{{aggregateId}}", labels.aggregateId)
      .replace(/{{field:([^}]+)}}/g, (_match, fieldId: string) => {
        return sampleById.get(fieldId.trim()) ?? labels.redacted;
      });
  }
  const lines = selectedFields.map((field) => {
    const prefix = fieldDecorations[field.id]?.prefix?.trim();
    const label = fieldLabel(field);
    const value = sampleFieldValue(field, labels.sampleValue);
    return prefix !== undefined && prefix.length > 0
      ? `${prefix} ${label}: ${value}`
      : `${label}: ${value}`;
  });
  return `${labels.defaultPrefix}: ${eventLabel}\n${lines.join("\n")}`;
}

function TelegramMessagePreview(props: TelegramMessagePreviewProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{props.labels.title}</p>
        <p className="text-xs text-muted-foreground">{props.labels.description}</p>
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border/60 bg-background p-3 text-xs leading-6 text-foreground">
        {renderTelegramPreviewMessage(props)}
      </pre>
    </div>
  );
}

type TelegramFieldOrderSectionProps = {
  readonly fields: readonly ExposureCatalogField[];
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations: ExposureFieldDecorations;
  readonly disabled: boolean;
  readonly labels: {
    readonly title: string;
    readonly description: string;
    readonly empty: string;
    readonly moveUp: string;
    readonly moveDown: string;
    readonly iconLabel: string;
  };
  readonly onMove: (fieldId: string, direction: "up" | "down") => void;
  readonly onIconChange: (fieldId: string, prefix: string) => void;
};

function TelegramFieldOrderSection({
  fields,
  selectedFieldIds,
  fieldDecorations,
  disabled,
  labels,
  onMove,
  onIconChange,
}: TelegramFieldOrderSectionProps) {
  const orderedFields = resolveExposureCatalogFieldsInSelectedOrder(fields, selectedFieldIds);

  return (
    <div
      className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3"
      data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.fieldOrder}
    >
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{labels.title}</p>
        <p className="text-xs text-muted-foreground">{labels.description}</p>
      </div>
      {orderedFields.length === 0 ? (
        <p className="text-xs text-muted-foreground">{labels.empty}</p>
      ) : (
        <ol className="space-y-1.5">
          {orderedFields.map((field, index) => (
            <li
              key={field.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_auto]"
            >
              <span className="truncate font-medium">{fieldLabel(field)}</span>
              <Input
                id={`field-icon-${field.id}`}
                type="text"
                className="h-8 text-sm"
                value={fieldDecorations[field.id]?.prefix ?? ""}
                placeholder="✅ 📍"
                disabled={disabled}
                aria-label={`${labels.iconLabel}: ${fieldLabel(field)}`}
                data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.fieldOrderIconInput}
                onChange={(event) => onIconChange(field.id, event.target.value)}
              />
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled || index === 0}
                  data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.fieldOrderMoveUp}
                  aria-label={`${labels.moveUp}: ${fieldLabel(field)}`}
                  onClick={() => onMove(field.id, "up")}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled || index === orderedFields.length - 1}
                  data-testid={INTEGRATION_DELIVERY_POLICY_TEST_IDS.fieldOrderMoveDown}
                  aria-label={`${labels.moveDown}: ${fieldLabel(field)}`}
                  onClick={() => onMove(field.id, "down")}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function toEnginePreviewContext(
  eventType: string,
  eventState: DeliveryPolicyEventState,
  preview: ExposureEnginePreviewModel | null | undefined,
): ExposureControlPlaneEventContext {
  const coordinates = {
    surface: eventState.surface,
    audience: eventState.audience,
    trigger: eventState.trigger,
  };
  return {
    eventType,
    eventPolicyEnabled: eventState.enabled,
    storedContext: coordinates,
    effectiveContext: coordinates,
    storedDiffersFromEffective: false,
    coordinateControlsRuntimeEffective: true,
    seededProfile: null,
    persistedProfile: null,
    activeExposureIntent: null,
    enginePreview: preview ?? null,
  };
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
  return {
    enabled,
    customizeFields: selection.customizeFields,
    selectedFieldIds: selection.selectedFieldIds,
    fieldDecorations: persistedIntent?.fieldDecorations ?? {},
    template: persistedIntent?.templateId ?? "",
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
}: IntegrationEventDeliveryPolicyPanelProps) {
  const t = useTranslations("settings.integrations.deliveryPolicy");
  const tChecklist = useTranslations("settings.exposure.fieldChecklist");
  const tWizard = useTranslations("denali");
  const tErrors = useTranslations("settings.integrations.errors");

  const localizedCandidateFields = useMemo(
    () => localizeExposureCatalogFields(exposureCandidateFields, tWizard),
    [exposureCandidateFields, tWizard],
  );

  const eventTypes = useMemo(
    () => buildExposureEventTypeList(connection, providerSurface),
    [connection, providerSurface],
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
  const [previewByEvent, setPreviewByEvent] = useState<
    Record<string, ExposureEnginePreviewModel | null>
  >({});
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [errorByEvent, setErrorByEvent] = useState<Record<string, string>>({});
  const [successEvent, setSuccessEvent] = useState<string | null>(null);

  async function refreshPreview(eventType: string): Promise<void> {
    try {
      const preview = await fetchExposureEnginePreview(connection.id, eventType);
      setPreviewByEvent((current) => ({ ...current, [eventType]: preview }));
    } catch {
      setPreviewByEvent((current) => ({ ...current, [eventType]: null }));
    }
  }

  useEffect(() => {
    const next: Record<string, DeliveryPolicyEventState> = {};
    for (const eventType of eventTypes) {
      next[eventType] = initialEventState(connection, providerSurface, eventType);
    }
    setStateByEvent(next);
    setErrorByEvent({});
    setSuccessEvent(null);
  }, [connection, eventTypes, providerSurface]);

  useEffect(() => {
    for (const eventType of eventTypes) {
      void refreshPreview(eventType);
    }
  }, [connection.id, eventTypes]);

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
      const next = toggleExposureFieldSelection(
        toSelectionState(previous),
        catalogFieldIds(exposureCandidateFields),
        fieldId,
        checked,
      );
      return {
        ...current,
        [eventType]: { ...previous, ...next },
      };
    });
    setSuccessEvent(null);
  }

  function setCustomizeFields(eventType: string, customize: boolean): void {
    setStateByEvent((current) => {
      const previous = current[eventType];
      const next = setExposureCustomizeFields(
        toSelectionState(previous),
        catalogFieldIds(exposureCandidateFields),
        customize,
      );
      return {
        ...current,
        [eventType]: { ...previous, ...next },
      };
    });
    setSuccessEvent(null);
  }

  function moveFieldOrder(
    eventType: string,
    fieldId: string,
    direction: "up" | "down",
  ): void {
    setStateByEvent((current) => {
      const previous = current[eventType];
      if (previous === undefined) {
        return current;
      }
      const next = reorderExposureSelectedFieldId(
        toSelectionState(previous),
        catalogFieldIds(exposureCandidateFields),
        fieldId,
        direction,
      );
      return {
        ...current,
        [eventType]: { ...previous, ...next },
      };
    });
    setSuccessEvent(null);
  }

  function updateFieldDecoration(eventType: string, fieldId: string, prefix: string): void {
    setStateByEvent((current) => {
      const previous = current[eventType];
      if (previous === undefined) {
        return current;
      }
      return {
        ...current,
        [eventType]: {
          ...previous,
          fieldDecorations: setExposureFieldDecorationPrefix(
            previous.fieldDecorations,
            fieldId,
            prefix,
          ),
        },
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
        fieldDecorations: eventState.fieldDecorations,
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

                  <TelegramFieldOrderSection
                    fields={localizedCandidateFields}
                    selectedFieldIds={selectedFieldIds}
                    fieldDecorations={eventState.fieldDecorations}
                    disabled={!canEdit || isSaving}
                    labels={{
                      title: t("fieldOrderTitle"),
                      description: t("fieldOrderDescription"),
                      empty: t("fieldOrderEmpty"),
                      moveUp: t("fieldOrderMoveUp"),
                      moveDown: t("fieldOrderMoveDown"),
                      iconLabel: t("fieldIconLabel"),
                    }}
                    onMove={(fieldId, direction) => moveFieldOrder(eventType, fieldId, direction)}
                    onIconChange={(fieldId, prefix) =>
                      updateFieldDecoration(eventType, fieldId, prefix)
                    }
                  />

                  <details className="rounded-lg border border-border/70 bg-card">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                      {t("templateAdvancedToggle")}
                    </summary>
                    <div className="space-y-2 border-t border-border/60 px-4 py-3">
                      <Label htmlFor={`delivery-template-${eventType}`}>{t("templateLabel")}</Label>
                      <textarea
                        id={`delivery-template-${eventType}`}
                        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        value={eventState.template}
                        placeholder={t("templatePlaceholder")}
                        disabled={!canEdit || isSaving}
                        onChange={(event) =>
                          updateEventState(eventType, { template: event.target.value })
                        }
                      />
                      <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
                    </div>
                  </details>
                </div>

                <div className="space-y-4">
                  <TelegramMessagePreview
                    eventLabel={eventLabel(eventType)}
                    fields={localizedCandidateFields}
                    selectedFieldIds={selectedFieldIds}
                    fieldDecorations={eventState.fieldDecorations}
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

                  <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">{t("enginePreviewTitle")}</p>
                    <ExposureEnginePreviewPanel
                      context={toEnginePreviewContext(
                        eventType,
                        eventState,
                        previewByEvent[eventType],
                      )}
                      labels={{
                        title: t("enginePreviewTitle"),
                        empty: t("enginePreviewEmpty"),
                        samplePayload: t("samplePayload"),
                        engineSelected: t("engineSelected"),
                        reasonChain: t("reasonChain"),
                        appliedPolicies: t("appliedPolicies"),
                        noPolicies: t("noPolicies"),
                      }}
                    />
                  </div>
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
