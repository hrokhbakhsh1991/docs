"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { ExposureFieldChecklist } from "@/exposure/ExposureFieldChecklist";
import { buildExposureEventTypeList } from "@/exposure/build-exposure-event-type-list";
import {
  catalogFieldIdsFromExposureFields,
  resolveEffectiveSelectedFieldIds,
  resolveExposureFieldSelectionFromPersisted,
  resolveExposureIntentContextFromPersisted,
  resolveStoredVsEffectiveExposureContext,
  setExposureCustomizeFields,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
  type ExposureCatalogField,
  type ExposureFieldSelectionState,
} from "@/exposure/exposure-field-selection";
import {
  fetchExposureSimulationDiff,
  type ExposureSimulationDiffModel,
  type ExposureSimulationDraftIntent,
} from "@/exposure/exposure-simulation-client";
import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
} from "@/integrations/integrations-types";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

export const EXPOSURE_SIMULATION_CONSOLE_TEST_IDS = {
  root: "exposure-simulation-console",
  run: "exposure-simulation-run",
  diff: "exposure-simulation-diff",
  diffField: "exposure-simulation-diff-field",
  event: "exposure-simulation-event",
} as const;

type SimulationEventState = ExposureFieldSelectionState & {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
};

type ExposureSimulationConsoleProps = {
  readonly connection: IntegrationConnectionPublic;
  readonly providerSurface: IntegrationProviderSurfaceMeta | null;
  readonly exposureCandidateFields: readonly ExposureCatalogField[];
};

function initialEventState(
  connection: IntegrationConnectionPublic,
  _providerSurface: IntegrationProviderSurfaceMeta | null,
  eventType: string,
): SimulationEventState {
  const persistedIntent =
    connection.exposureIntents.find((intent) => intent.eventType === eventType) ??
    connection.exposureIntents.find((intent) => intent.trigger === eventType);
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
    ...selection,
    surface: context.surface,
    audience: context.audience,
    trigger: context.trigger,
  };
}

function buildDraftIntent(
  eventState: SimulationEventState,
  catalogFieldIds: readonly string[],
): ExposureSimulationDraftIntent {
  if (!eventState.customizeFields) {
    return { mode: "inherit_profile", selectedFieldIds: [] };
  }
  return {
    mode: "override_fields",
    selectedFieldIds: resolveEffectiveSelectedFieldIds(
      {
        customizeFields: eventState.customizeFields,
        selectedFieldIds: eventState.selectedFieldIds,
      },
      catalogFieldIds,
    ),
  };
}

function stateBadgeVariant(
  state: ExposureSimulationDiffModel["diff"]["fieldChanges"][number]["currentState"],
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "visible") {
    return "default";
  }
  if (state === "blocked") {
    return "destructive";
  }
  return "outline";
}

export function ExposureSimulationConsole({
  connection,
  providerSurface,
  exposureCandidateFields,
}: ExposureSimulationConsoleProps) {
  const t = useTranslations("settings.exposure.simulation");
  const eventTypes = useMemo(
    () => buildExposureEventTypeList(connection, providerSurface),
    [connection, providerSurface],
  );
  const catalogFieldIds = useMemo(
    () => catalogFieldIdsFromExposureFields(exposureCandidateFields),
    [exposureCandidateFields],
  );
  const [activeEventType, setActiveEventType] = useState<string>(eventTypes[0] ?? "");
  const [eventStates, setEventStates] = useState<Record<string, SimulationEventState>>(() => {
    const initial: Record<string, SimulationEventState> = {};
    for (const eventType of eventTypes) {
      initial[eventType] = initialEventState(connection, providerSurface, eventType);
    }
    return initial;
  });
  const [diff, setDiff] = useState<ExposureSimulationDiffModel | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventState = eventStates[activeEventType] ?? null;
  const persistedIntent =
    connection.exposureIntents.find((intent) => intent.eventType === activeEventType) ??
    connection.exposureIntents.find((intent) => intent.trigger === activeEventType) ??
    null;
  const coordinateHonesty = resolveStoredVsEffectiveExposureContext({
    provider: connection.provider,
    panelEventType: activeEventType,
    draftContext:
      eventState === null
        ? undefined
        : { surface: eventState.surface, audience: eventState.audience, trigger: eventState.trigger },
    persistedIntent:
      persistedIntent == null
        ? null
        : {
            surface: persistedIntent.surface,
            audience: persistedIntent.audience,
            trigger: persistedIntent.trigger,
            eventType: persistedIntent.eventType,
            routeScoped: persistedIntent.routeScoped,
          },
  });

  const updateEventState = useCallback((eventType: string, patch: Partial<SimulationEventState>) => {
    setEventStates((current) => ({
      ...current,
      [eventType]: { ...current[eventType]!, ...patch },
    }));
    setDiff(null);
  }, []);

  async function runSimulation(): Promise<void> {
    if (eventState === null || activeEventType.length === 0) {
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const nextDiff = await fetchExposureSimulationDiff({
        connectionId: connection.id,
        eventType: activeEventType,
        draftIntent: buildDraftIntent(eventState, catalogFieldIds),
      });
      setDiff(nextDiff);
    } catch (simulationError: unknown) {
      setDiff(null);
      setError(
        simulationError instanceof Error
          ? resolveCodedErrorMessage(t, simulationError.message)
          : t("runFailed"),
      );
    } finally {
      setRunning(false);
    }
  }

  if (eventTypes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.root}>
        {t("noEvents")}
      </p>
    );
  }

  return (
    <div className="space-y-6" data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.root}>
      <p className="text-sm text-muted-foreground">{t("nonMutatingNotice")}</p>

      <div className="flex flex-wrap gap-2">
        {eventTypes.map((eventType) => (
          <Button
            key={eventType}
            type="button"
            size="sm"
            variant={eventType === activeEventType ? "default" : "outline"}
            data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.event}
            data-event-type={eventType}
            onClick={() => {
              setActiveEventType(eventType);
              setDiff(null);
              setError(null);
            }}
          >
            {eventType}
          </Button>
        ))}
      </div>

      {eventState === null ? null : (
        <>
          <div className="rounded-md border border-border/60 p-4 text-sm">
            <p className="font-medium">{t("coordinateTitle")}</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("effectiveContext")}</dt>
                <dd className="font-mono text-xs">
                  {coordinateHonesty.effective.surface} /{" "}
                  {coordinateHonesty.effective.audience} /{" "}
                  {coordinateHonesty.effective.trigger}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("runtimeEffective")}</dt>
                <dd className="font-mono text-xs">
                  {coordinateHonesty.coordinateControlsRuntimeEffective
                    ? t("runtimeEffectiveYes")
                    : t("runtimeEffectiveNo")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t("draftFieldsTitle")}</p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={eventState.customizeFields}
                onChange={(event) =>
                  updateEventState(activeEventType, {
                    ...setExposureCustomizeFields(
                      {
                        customizeFields: eventState.customizeFields,
                        selectedFieldIds: eventState.selectedFieldIds,
                      },
                      catalogFieldIds,
                      event.target.checked,
                    ),
                  })
                }
              />
              <span>{t("customizeFields")}</span>
            </label>
            <ExposureFieldChecklist
              context={{
                surface: eventState.surface,
                audience: eventState.audience,
                trigger: eventState.trigger,
              }}
              fields={toExposureChecklistFields(exposureCandidateFields)}
              selectedFieldIds={resolveEffectiveSelectedFieldIds(
                {
                  customizeFields: eventState.customizeFields,
                  selectedFieldIds: eventState.selectedFieldIds,
                },
                catalogFieldIds,
              )}
              disabled={!eventState.customizeFields}
              emptyLabel={t("emptyCatalog")}
              selectedSummary={t("selectedSummary", {
                count: resolveEffectiveSelectedFieldIds(
                  {
                    customizeFields: eventState.customizeFields,
                    selectedFieldIds: eventState.selectedFieldIds,
                  },
                  catalogFieldIds,
                ).length,
              })}
              onFieldToggle={(fieldId, checked) =>
                updateEventState(activeEventType, {
                  ...toggleExposureFieldSelection(
                    {
                      customizeFields: eventState.customizeFields,
                      selectedFieldIds: eventState.selectedFieldIds,
                    },
                    catalogFieldIds,
                    fieldId,
                    checked,
                  ),
                })
              }
            />
          </div>

          <Button
            type="button"
            disabled={running}
            data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.run}
            onClick={() => void runSimulation()}
          >
            {running ? t("running") : t("runSimulation")}
          </Button>

          {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}

          {diff !== null ? (
            <div className="space-y-4" data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.diff}>
              <div>
                <p className="text-sm font-medium">{t("diffTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("diffDescription")}</p>
              </div>

              {diff.diff.selectedFieldIdsAdded.length > 0 ||
              diff.diff.selectedFieldIdsRemoved.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {diff.diff.selectedFieldIdsAdded.length > 0 ? (
                    <p>
                      {t("selectedAdded")}:{" "}
                      <code>{diff.diff.selectedFieldIdsAdded.join(", ")}</code>
                    </p>
                  ) : null}
                  {diff.diff.selectedFieldIdsRemoved.length > 0 ? (
                    <p>
                      {t("selectedRemoved")}:{" "}
                      <code>{diff.diff.selectedFieldIdsRemoved.join(", ")}</code>
                    </p>
                  ) : null}
                </div>
              ) : null}

              {diff.diff.fieldChanges.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noFieldChanges")}</p>
              ) : (
                <div className="space-y-3">
                  {diff.diff.fieldChanges.map((change) => (
                    <div
                      key={change.fieldId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 p-3"
                      data-testid={EXPOSURE_SIMULATION_CONSOLE_TEST_IDS.diffField}
                      data-field-id={change.fieldId}
                    >
                      <code className="text-xs">{change.fieldId}</code>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant={stateBadgeVariant(change.currentState)}>
                          {change.currentState}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant={stateBadgeVariant(change.simulatedState)}>
                          {change.simulatedState}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
