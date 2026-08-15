"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CaseEncounterReadOnlyHost,
  deriveCaseCommandCapability,
  type CaseCommandCapabilityContract,
  type CaseEncounterHostLifecycleEvent,
  type CaseEncounterPresentationEnvelope,
  type CaseEncounterViewContract,
} from "@/finance/finance-case-encounter-ui";

import { buildCaseEncounterLabels } from "@/finance/denali-case-encounter-labels";
import { FINANCE_COMMERCIAL_MEANING_DEFAULT_TIMEOUT_MS } from "@/finance/finance-commercial-meaning-contract";

type OperatorCaseEncounterPanelProps = {
  readonly registrationId: string;
  readonly counterpartyId?: string;
  readonly loadTimeoutMs?: number;
  readonly onLifecycle?: (event: CaseEncounterHostLifecycleEvent) => void;
};

function isEncounterContract(value: unknown): value is CaseEncounterViewContract {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.subjectId === "string" &&
    typeof row.caseKey === "string" &&
    typeof row.reading === "string" &&
    typeof row.owner === "string" &&
    typeof row.primaryPosture === "string" &&
    typeof row.explainability === "object" &&
    row.explainability !== null
  );
}

function isSurfaceState(
  value: unknown
): value is CaseEncounterPresentationEnvelope["surfaceState"] {
  return value === "normal" || value === "degraded" || value === "incomplete";
}

function isCommandCapability(value: unknown): value is CaseCommandCapabilityContract {
  if (value === null || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.supportedCommands)) return false;
  const review = row.reviewReceipt;
  if (review === null || typeof review !== "object") return false;
  const rr = review as Record<string, unknown>;
  return Array.isArray(rr.availableTokens) && typeof rr.endpoint === "string";
}

export function OperatorCaseEncounterPanel({
  registrationId,
  counterpartyId,
  loadTimeoutMs = FINANCE_COMMERCIAL_MEANING_DEFAULT_TIMEOUT_MS,
  onLifecycle,
}: OperatorCaseEncounterPanelProps) {
  const t = useTranslations("finance.caseEncounter");
  const labels = useMemo(() => buildCaseEncounterLabels(t), [t]);

  const loadEncounter = useCallback(async (): Promise<CaseEncounterPresentationEnvelope> => {
    const qs =
      counterpartyId !== undefined && counterpartyId.length > 0
        ? `?counterpartyId=${encodeURIComponent(counterpartyId)}`
        : "";
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, loadTimeoutMs);
    try {
      const res = await fetch(
        `/api/finance/case/encounters/${encodeURIComponent(registrationId)}${qs}`,
        { method: "GET", cache: "no-store", signal: controller.signal }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        encounter?: unknown;
        surfaceState?: unknown;
        commandCapability?: unknown;
        executionId?: unknown;
        meaningFingerprint?: unknown;
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(payload.error?.message ?? t("errors.loadFailed"));
      }
      if (!isEncounterContract(payload.encounter)) {
        throw new Error(t("errors.invalidPresentation"));
      }
      const executionId =
        typeof payload.executionId === "string" && payload.executionId.trim().length > 0
          ? payload.executionId.trim()
          : undefined;
      if (executionId === undefined) {
        throw new Error(t("errors.missingExecutionId"));
      }
      const commandCapability = isCommandCapability(payload.commandCapability)
        ? payload.commandCapability
        : deriveCaseCommandCapability(payload.encounter.allow);
      return {
        encounter: payload.encounter,
        surfaceState: isSurfaceState(payload.surfaceState) ? payload.surfaceState : "normal",
        executionId,
        commandCapability,
        ...(typeof payload.meaningFingerprint === "string"
          ? { meaningFingerprint: payload.meaningFingerprint }
          : {}),
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(t("errors.timeout"));
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
    }
  }, [registrationId, counterpartyId, loadTimeoutMs, t]);

  return (
    <div data-testid="denali-case-encounter-panel">
      <CaseEncounterReadOnlyHost
        loadEncounter={loadEncounter}
        labels={labels}
        showVocabularyHints={true}
        onLifecycle={onLifecycle}
      />
    </div>
  );
}
