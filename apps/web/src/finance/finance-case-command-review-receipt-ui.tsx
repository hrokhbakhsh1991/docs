"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CaseCommandCapabilityContract } from "@/finance/finance-case-encounter-ui";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildReviewReceiptCommandBody,
  canSubmitCommandFromPhase,
  createCommandIdempotencyKey,
  decisionForCommandToken,
  FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH,
  parseFinanceCaseCommandClientResult,
  type FinanceCaseCommandActionToken,
  type FinanceCaseCommandClientResult,
  type FinanceCaseCommandUiPhase,
} from "@/finance/finance-case-command-review-receipt";
import {
  isCommandTokenDiscovered,
  projectCommandBridgeUxDiscovery,
} from "@/finance/finance-command-bridge-ux-architecture";
import { emitFinanceCaseCommandUiTelemetry } from "@/finance/finance-case-command-ui-telemetry";
import {
  parseFinancePendingReceiptsResponse,
  type FinancePendingReceipt,
} from "@/finance/finance-receipts-logic";
import { withFinanceListScopeQuery } from "@/finance/finance-registration-context";
import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";

export type FinanceCaseCommandReviewReceiptContext = {
  readonly caseKey: string;
  readonly executionId: string;
  readonly meaningFingerprint?: string;
  readonly commandCapability?: CaseCommandCapabilityContract;
};

type FinanceCaseCommandReviewReceiptUiProps = {
  readonly registrationId: string;
  readonly counterpartyId?: string;
  readonly context: FinanceCaseCommandReviewReceiptContext | null;
  readonly onForceMeaningRefresh: () => void;
};

/**
 * PR18-B — reviewReceipt Command UI inside Commercial Meaning only.
 * Discovery from capability; permission on Host POST; confirm required; no optimistic Meaning.
 */
export function FinanceCaseCommandReviewReceiptUi({
  registrationId,
  counterpartyId: counterpartyIdProp,
  context,
  onForceMeaningRefresh,
}: FinanceCaseCommandReviewReceiptUiProps) {
  const t = useTranslations("finance.commandBridge");
  const [phase, setPhase] = useState<FinanceCaseCommandUiPhase>("idle");
  const [token, setToken] = useState<FinanceCaseCommandActionToken | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState(counterpartyIdProp?.trim() ?? "");
  const [reviewNote, setReviewNote] = useState("");
  const [pending, setPending] = useState<readonly FinancePendingReceipt[]>([]);
  const [result, setResult] = useState<FinanceCaseCommandClientResult | null>(null);
  const [busyReceipts, setBusyReceipts] = useState(false);

  const discovery = useMemo(
    () => projectCommandBridgeUxDiscovery(context?.commandCapability),
    [context?.commandCapability]
  );

  useEffect(() => {
    setCounterpartyId((prev) =>
      prev.trim().length > 0 ? prev : (counterpartyIdProp?.trim() ?? "")
    );
  }, [counterpartyIdProp]);

  useEffect(() => {
    let cancelled = false;
    setBusyReceipts(true);
    const path = withFinanceListScopeQuery("/api/finance/receipts/pending?limit=50", {
      registrationId,
    });
    void fetch(path, { cache: "no-store" })
      .then(async (res) => parseFinancePendingReceiptsResponse(await res.json().catch(() => ({}))))
      .then((payload) => {
        if (!cancelled) {
          setPending(payload.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPending([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusyReceipts(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [registrationId]);

  const availableTokens = discovery.availableTokens.filter(
    (tok): tok is FinanceCaseCommandActionToken =>
      tok === "approve_evidence" || tok === "reject_evidence"
  );

  useEffect(() => {
    if (availableTokens.length === 0) return;
    emitFinanceCaseCommandUiTelemetry({
      name: "command_discovered",
      registrationId,
      tokenCount: availableTokens.length,
    });
  }, [registrationId, availableTokens.length]);

  const meaningOpenedAtRef = useRef<number | null>(null);
  useEffect(() => {
    meaningOpenedAtRef.current = Date.now();
  }, [registrationId, context?.executionId]);

  const beginSelect = useCallback(
    (next: FinanceCaseCommandActionToken) => {
      if (!isCommandTokenDiscovered(discovery, next)) {
        return;
      }
      emitFinanceCaseCommandUiTelemetry({
        name: "command_ui_opened",
        registrationId,
      });
      setToken(next);
      setResult(null);
      setPhase("select");
    },
    [discovery, registrationId]
  );

  const goConfirm = useCallback(() => {
    if (token === null || receiptId.trim().length === 0 || counterpartyId.trim().length === 0) {
      return;
    }
    if (context === null || context.executionId.trim().length === 0) {
      return;
    }
    if (result !== null || phase === "failure") {
      emitFinanceCaseCommandUiTelemetry({
        name: "command_retry",
        registrationId,
      });
    }
    setPhase("confirm");
    emitFinanceCaseCommandUiTelemetry({
      name: "command_confirmation_shown",
      registrationId,
      token,
    });
  }, [token, receiptId, counterpartyId, context, registrationId, result, phase]);

  const cancel = useCallback(() => {
    emitFinanceCaseCommandUiTelemetry({
      name: "command_cancelled",
      registrationId,
      phase,
    });
    setPhase("idle");
    setToken(null);
    setResult(null);
  }, [registrationId, phase]);

  const submit = useCallback(async () => {
    if (!canSubmitCommandFromPhase(phase) || token === null || context === null) {
      return;
    }
    setPhase("submitting");
    setResult(null);
    const body = buildReviewReceiptCommandBody({
      caseKey: context.caseKey,
      executionId: context.executionId,
      meaningFingerprint: context.meaningFingerprint,
      token,
      registrationId,
      counterpartyId: counterpartyId.trim(),
      receiptId: receiptId.trim(),
      reviewNote,
      correlationId: createCommandIdempotencyKey(),
    });
    const started = Date.now();
    const openedAt = meaningOpenedAtRef.current;
    const meaningOpenToSubmitMs =
      openedAt !== null ? Math.max(0, started - openedAt) : undefined;
    const decision = decisionForCommandToken(token);
    try {
      const res = await fetch(FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createCommandIdempotencyKey(),
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      const parsed = parseFinanceCaseCommandClientResult(res.status, payload);
      setResult(parsed);
      emitFinanceCaseCommandUiTelemetry({
        name: "command_submitted",
        registrationId,
        ok: parsed.ok,
        decision,
        failureClass: parsed.ok ? undefined : parsed.failureClass,
        latencyMs: Math.max(0, Date.now() - started),
        meaningOpenToSubmitMs,
      });
      if (parsed.ok) {
        setPhase("success");
        // PR21-F4 — Command reviewReceipt success invalidates Booking Strip caches.
        invalidateFinanceRegistrationCaches(registrationId);
        onForceMeaningRefresh();
        emitFinanceCaseCommandUiTelemetry({
          name: "meaning_refreshed_after_command",
          registrationId,
          submitToRefreshMs: Math.max(0, Date.now() - started),
        });
        return;
      }
      setPhase("failure");
      if (parsed.forceRefresh) {
        onForceMeaningRefresh();
      }
    } catch {
      emitFinanceCaseCommandUiTelemetry({
        name: "command_submitted",
        registrationId,
        ok: false,
        decision,
        failureClass: "unknown",
        latencyMs: Math.max(0, Date.now() - started),
        meaningOpenToSubmitMs,
      });
      setResult({
        ok: false,
        failureClass: "unknown",
        code: "CASE_COMMAND_UNKNOWN",
        message: t("networkError"),
        forceRefresh: false,
      });
      setPhase("failure");
    }
  }, [
    phase,
    token,
    context,
    registrationId,
    counterpartyId,
    receiptId,
    reviewNote,
    onForceMeaningRefresh,
    t,
  ]);

  if (context === null) {
    return null;
  }

  if (availableTokens.length === 0) {
    return (
      <div
        className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground"
        data-testid="finance-case-command-ui-empty"
      >
        {t("noTokens")}
      </div>
    );
  }

  return (
    <section
      className="space-y-3 rounded-md border p-4"
      data-testid="finance-case-command-ui"
      data-phase={phase}
      data-grants-permission="false"
    >
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <p className="text-xs text-muted-foreground">{t("guidance")}</p>

      <div className="flex flex-wrap gap-2" data-testid="finance-case-command-discovery">
        {availableTokens.map((tok) => (
          <Button
            key={tok}
            type="button"
            variant={token === tok ? "default" : "outline"}
            size="sm"
            data-testid={`finance-case-command-token-${tok}`}
            disabled={phase === "submitting"}
            onClick={() => beginSelect(tok)}
          >
            {t(`tokens.${tok}`)}
          </Button>
        ))}
      </div>

      {phase !== "idle" && phase !== "success" ? (
        <div className="space-y-3" data-testid="finance-case-command-form">
          <div className="space-y-1">
            <Label htmlFor="case-command-receipt">{t("receiptId")}</Label>
            <Input
              id="case-command-receipt"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              data-testid="finance-case-command-receipt-id"
              disabled={phase === "submitting"}
            />
            {busyReceipts ? (
              <p className="text-xs text-muted-foreground">{t("loadingReceipts")}</p>
            ) : null}
            {pending.length > 0 ? (
              <ul
                className="mt-1 max-h-28 space-y-1 overflow-auto text-xs"
                data-testid="finance-case-command-pending-receipts"
              >
                {pending.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setReceiptId(row.id)}
                    >
                      {row.id}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="case-command-counterparty">{t("counterpartyId")}</Label>
            <Input
              id="case-command-counterparty"
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              data-testid="finance-case-command-counterparty-id"
              disabled={phase === "submitting"}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="case-command-note">{t("reviewNote")}</Label>
            <Input
              id="case-command-note"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              data-testid="finance-case-command-review-note"
              disabled={phase === "submitting"}
            />
          </div>

          {phase === "select" ? (
            <div className="flex gap-2">
              <Button
                type="button"
                data-testid="finance-case-command-prepare-confirm"
                onClick={goConfirm}
                disabled={
                  receiptId.trim().length === 0 || counterpartyId.trim().length === 0
                }
              >
                {t("prepareConfirm")}
              </Button>
              <Button type="button" variant="ghost" onClick={cancel}>
                {t("cancel")}
              </Button>
            </div>
          ) : null}

          {phase === "confirm" || phase === "submitting" ? (
            <div
              className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3"
              data-testid="finance-case-command-confirm"
            >
              <p className="text-sm font-medium">{t("confirmTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("confirmBody", {
                  token: token ?? "",
                  receiptId: receiptId.trim(),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  data-testid="finance-case-command-submit"
                  disabled={phase === "submitting" || !canSubmitCommandFromPhase(phase)}
                  onClick={() => {
                    void submit();
                  }}
                >
                  {phase === "submitting" ? t("submitting") : t("confirmSubmit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={phase === "submitting"}
                  onClick={cancel}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {phase === "success" && result?.ok === true ? (
        <p className="text-sm text-green-700" data-testid="finance-case-command-success" role="status">
          {t("success", { executionId: result.executionId })}
        </p>
      ) : null}

      {phase === "failure" && result?.ok === false ? (
        <p
          className="text-sm text-destructive"
          data-testid="finance-case-command-failure"
          data-failure-class={result.failureClass}
          role="alert"
        >
          {t(`failures.${result.failureClass}`, { message: result.message })}
        </p>
      ) : null}
    </section>
  );
}
