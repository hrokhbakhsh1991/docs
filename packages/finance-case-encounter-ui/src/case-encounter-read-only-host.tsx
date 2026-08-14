"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CaseEncounterReadOnlyScreen,
  type CaseEncounterReadOnlyScreenProps,
} from "./case-encounter-read-only-screen";
import type { CaseCommandCapabilityContract } from "./command-capability";
import type {
  CaseEncounterPresentationEnvelope,
  CaseEncounterViewContract,
  EncounterSurfaceStateContract,
} from "./contract";
import {
  DEFAULT_CASE_ENCOUNTER_LABELS,
  type CaseEncounterLabelBundle,
} from "./labels";

export type LoadCaseEncounter = () => Promise<
  CaseEncounterViewContract | CaseEncounterPresentationEnvelope
>;

export type CaseEncounterHostLifecycleEvent =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly surfaceState: Exclude<EncounterSurfaceStateContract, "loading" | "unavailable">;
      readonly executionId: string | null;
      readonly caseKey?: string;
      readonly meaningFingerprint?: string;
      readonly commandCapability?: CaseCommandCapabilityContract;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: "error" | "timeout";
      readonly message: string;
    };

export type CaseEncounterReadOnlyHostProps = {
  /** Host-owned loader — returns Encounter presentation contract only. */
  readonly loadEncounter: LoadCaseEncounter;
  readonly counterpartyLabel?: string;
  readonly labels?: CaseEncounterLabelBundle;
  readonly showVocabularyHints?: boolean;
  /** When true, load on mount (default true). */
  readonly loadOnMount?: boolean;
  /** Optional fail-open lifecycle observer (PR17-B). */
  readonly onLifecycle?: (event: CaseEncounterHostLifecycleEvent) => void;
};

type HostStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly encounter: CaseEncounterViewContract;
      readonly surfaceState: Exclude<EncounterSurfaceStateContract, "loading" | "unavailable">;
      readonly commandCapability?: CaseCommandCapabilityContract;
      readonly executionId: string | null;
    }
  | { readonly kind: "error"; readonly message: string; readonly reason: "error" | "timeout" };

function normalizeLoadResult(
  value: CaseEncounterViewContract | CaseEncounterPresentationEnvelope
): {
  readonly encounter: CaseEncounterViewContract;
  readonly surfaceState: Exclude<EncounterSurfaceStateContract, "loading" | "unavailable">;
  readonly commandCapability?: CaseCommandCapabilityContract;
  readonly executionId: string | null;
  readonly meaningFingerprint?: string;
} {
  if ("encounter" in value && "surfaceState" in value) {
    return {
      encounter: value.encounter,
      surfaceState: value.surfaceState,
      commandCapability: value.commandCapability,
      executionId:
        typeof value.executionId === "string" && value.executionId.trim().length > 0
          ? value.executionId
          : null,
      ...(typeof value.meaningFingerprint === "string"
        ? { meaningFingerprint: value.meaningFingerprint }
        : {}),
    };
  }
  return { encounter: value, surfaceState: "normal", executionId: null };
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("timed out") || err.name === "TimeoutError";
  }
  return false;
}

/**
 * Host adapter: owns load/refresh/error + surface chrome (PR13-A / PR17-B).
 * Does not accept repositories, payment services, or workspace entities.
 * Refresh always re-invokes loadEncounter (new Host execution) — never patches Case fields.
 */
export function CaseEncounterReadOnlyHost({
  loadEncounter,
  counterpartyLabel,
  labels = DEFAULT_CASE_ENCOUNTER_LABELS,
  showVocabularyHints = true,
  loadOnMount = true,
  onLifecycle,
}: CaseEncounterReadOnlyHostProps) {
  const [status, setStatus] = useState<HostStatus>(
    loadOnMount ? { kind: "loading" } : { kind: "idle" }
  );

  const refresh = useCallback(async () => {
    setStatus({ kind: "loading" });
    try {
      onLifecycle?.({ kind: "loading" });
    } catch {
      /* fail-open */
    }
    try {
      const loaded = normalizeLoadResult(await loadEncounter());
      setStatus({
        kind: "ready",
        encounter: loaded.encounter,
        surfaceState: loaded.surfaceState,
        commandCapability: loaded.commandCapability,
        executionId: loaded.executionId,
      });
      try {
        onLifecycle?.({
          kind: "ready",
          surfaceState: loaded.surfaceState,
          executionId: loaded.executionId,
          caseKey: loaded.encounter.caseKey,
          ...(loaded.commandCapability !== undefined
            ? { commandCapability: loaded.commandCapability }
            : {}),
          ...(loaded.meaningFingerprint !== undefined
            ? { meaningFingerprint: loaded.meaningFingerprint }
            : {}),
        });
      } catch {
        /* fail-open */
      }
    } catch (err) {
      const reason = isTimeoutError(err) ? "timeout" : "error";
      const message = err instanceof Error ? err.message : labels.fields.loadError;
      setStatus({ kind: "error", message, reason });
      try {
        onLifecycle?.({ kind: "unavailable", reason, message });
      } catch {
        /* fail-open */
      }
    }
  }, [loadEncounter, labels.fields.loadError, onLifecycle]);

  useEffect(() => {
    if (!loadOnMount) {
      return;
    }
    void refresh();
  }, [loadOnMount, refresh]);

  const screenProps: Omit<CaseEncounterReadOnlyScreenProps, "encounter" | "commandCapability"> = {
    counterpartyLabel,
    labels,
    showVocabularyHints,
  };

  const surfaceLabel =
    status.kind === "loading" || status.kind === "idle"
      ? labels.surfaceStates?.loading ?? labels.fields.loading
      : status.kind === "error"
        ? labels.surfaceStates?.unavailable ?? labels.fields.loadError
        : status.kind === "ready"
          ? labels.surfaceStates?.[status.surfaceState]
          : undefined;

  return (
    <div data-testid="case-encounter-read-only-host">
      <div data-testid="case-encounter-host-chrome">
        <button
          type="button"
          data-testid="case-encounter-refresh"
          onClick={() => {
            void refresh();
          }}
          disabled={status.kind === "loading"}
        >
          {labels.fields.refresh}
        </button>
        {status.kind === "ready" && status.executionId !== null ? (
          <p data-testid="case-encounter-execution-id">
            {labels.fields.executionId ?? "Execution"}: <code>{status.executionId}</code>
          </p>
        ) : null}
      </div>
      {surfaceLabel !== undefined ? (
        <p
          data-testid="case-encounter-surface-state"
          data-surface-state={
            status.kind === "loading" || status.kind === "idle"
              ? "loading"
              : status.kind === "error"
                ? status.reason === "timeout"
                  ? "unavailable"
                  : "unavailable"
                : status.surfaceState
          }
          data-unavailable-reason={status.kind === "error" ? status.reason : undefined}
          role="status"
        >
          {surfaceLabel}
        </p>
      ) : null}
      {status.kind === "loading" || status.kind === "idle" ? (
        <p data-testid="case-encounter-loading" role="status">
          {labels.fields.loading}
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p data-testid="case-encounter-error" role="alert" data-reason={status.reason}>
          {status.message}
        </p>
      ) : null}
      {status.kind === "ready" ? (
        <CaseEncounterReadOnlyScreen
          encounter={status.encounter}
          commandCapability={status.commandCapability}
          {...screenProps}
        />
      ) : null}
    </div>
  );
}
