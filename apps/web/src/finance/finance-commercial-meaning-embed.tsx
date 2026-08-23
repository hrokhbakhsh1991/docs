"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CaseCommandCapabilityContract,
  CaseEncounterHostLifecycleEvent,
} from "@/finance/finance-case-encounter-ui";

import { FinanceCaseEncounterPanel } from "@/finance/finance-case-encounter-panel";
import {
  FinanceCaseCommandReviewReceiptUi,
  type FinanceCaseCommandReviewReceiptContext,
} from "@/finance/finance-case-command-review-receipt-ui";
import type { FinanceCommercialMeaningEmbedInput } from "@/finance/finance-commercial-meaning-contract";
import { emitFinanceCommercialMeaningTelemetry } from "@/finance/finance-commercial-meaning-telemetry";

type FinanceCommercialMeaningEmbedProps = FinanceCommercialMeaningEmbedInput & {
  /** When true, show reviewReceipt Command UI (server-gated rollout). */
  readonly commandUiEnabled?: boolean;
};

/**
 * Stable Command Center embed for Commercial Meaning (PR17-B / PR18-B).
 * EncounterView + optional reviewReceipt Command UI (flagged). No optimistic Meaning.
 */
export function FinanceCommercialMeaningEmbed({
  registrationId,
  counterpartyId,
  loadTimeoutMs,
  commandUiEnabled = false,
}: FinanceCommercialMeaningEmbedProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [commandContext, setCommandContext] =
    useState<FinanceCaseCommandReviewReceiptContext | null>(null);

  useEffect(() => {
    emitFinanceCommercialMeaningTelemetry({
      name: "meaning_opened",
      registrationId,
    });
  }, [registrationId]);

  const onForceMeaningRefresh = useCallback(() => {
    setCommandContext(null);
    setReloadToken((n) => n + 1);
  }, []);

  const onLifecycle = useCallback(
    (event: CaseEncounterHostLifecycleEvent) => {
      if (event.kind === "loading") {
        setCommandContext(null);
        return;
      }
      if (event.kind === "ready") {
        const executionId = event.executionId ?? "unknown";
        emitFinanceCommercialMeaningTelemetry({
          name: "meaning_viewed",
          registrationId,
          executionId,
          surfaceState: event.surfaceState,
        });
        if (event.surfaceState === "degraded") {
          emitFinanceCommercialMeaningTelemetry({
            name: "meaning_degraded",
            registrationId,
            executionId,
          });
        }
        if (event.surfaceState === "incomplete") {
          emitFinanceCommercialMeaningTelemetry({
            name: "meaning_incomplete",
            registrationId,
            executionId,
          });
        }
        if (
          commandUiEnabled &&
          typeof event.caseKey === "string" &&
          event.caseKey.trim().length > 0 &&
          typeof event.executionId === "string" &&
          event.executionId.trim().length > 0
        ) {
          setCommandContext({
            caseKey: event.caseKey,
            executionId: event.executionId,
            ...(typeof event.meaningFingerprint === "string"
              ? { meaningFingerprint: event.meaningFingerprint }
              : {}),
            ...(event.commandCapability !== undefined
              ? { commandCapability: event.commandCapability as CaseCommandCapabilityContract }
              : {}),
          });
        } else {
          setCommandContext(null);
        }
        return;
      }
      if (event.kind === "unavailable") {
        setCommandContext(null);
        if (event.reason === "timeout") {
          emitFinanceCommercialMeaningTelemetry({
            name: "meaning_timeout",
            registrationId,
          });
        } else {
          emitFinanceCommercialMeaningTelemetry({
            name: "meaning_unavailable",
            registrationId,
            reason: event.message,
          });
        }
      }
    },
    [registrationId, commandUiEnabled]
  );

  return (
    <div
      data-testid="finance-commercial-meaning-embed"
      data-registration-id={registrationId}
      data-command-ui={commandUiEnabled ? "enabled" : "disabled"}
    >
      <FinanceCaseEncounterPanel
        key={`${registrationId}:${reloadToken}`}
        registrationId={registrationId}
        counterpartyId={counterpartyId}
        loadTimeoutMs={loadTimeoutMs}
        onLifecycle={onLifecycle}
      />
      {commandUiEnabled ? (
        <div className="mt-4">
          <FinanceCaseCommandReviewReceiptUi
            registrationId={registrationId}
            counterpartyId={counterpartyId}
            context={commandContext}
            onForceMeaningRefresh={onForceMeaningRefresh}
          />
        </div>
      ) : null}
    </div>
  );
}
