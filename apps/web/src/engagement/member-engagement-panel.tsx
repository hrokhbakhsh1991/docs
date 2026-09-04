"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/routing";

import {
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementAdjustPath,
  buildEngagementMemberLookupPath,
  buildEngagementReversePath,
  canMutateEngagementAsOperator,
  canReverseEngagementPointEvent,
  createEngagementIdempotencyKey,
  engagementEventTypeLabelKey,
  engagementLevelLabelKey,
  formatEngagementTimestamp,
  isEngagementPermissionDenied,
  validateEngagementAdjustmentForm,
  validateEngagementReversalForm,
  type EngagementAdjustmentForm,
  type EngagementMutationKind,
  type EngagementReversalForm,
} from "./engagement-ops-logic";
import type { MemberLookupPayload, PointEventRow } from "./engagement-ops-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoadState = "idle" | "loading" | "error" | "ready" | "permissionDenied";

const EMPTY_ADJUSTMENT_FORM: EngagementAdjustmentForm = { pointsDelta: "", reason: "" };
const EMPTY_REVERSAL_FORM: EngagementReversalForm = { reason: "" };

export type MemberEngagementPanelProps = {
  readonly userId: string;
  readonly active: boolean;
  readonly actorRole: string;
  readonly memberLabel?: string;
};

export function MemberEngagementPanel({
  userId,
  active,
  actorRole,
  memberLabel,
}: MemberEngagementPanelProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");
  const canMutate = canMutateEngagementAsOperator(actorRole);

  const [lookupResult, setLookupResult] = useState<MemberLookupPayload | null>(null);
  const [lookupState, setLookupState] = useState<LoadState>("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [mutationDialog, setMutationDialog] = useState<{
    readonly kind: EngagementMutationKind;
    readonly event?: PointEventRow;
  } | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<EngagementAdjustmentForm>(EMPTY_ADJUSTMENT_FORM);
  const [reversalForm, setReversalForm] = useState<EngagementReversalForm>(EMPTY_REVERSAL_FORM);
  const [mutationPending, setMutationPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationFeedback, setMutationFeedback] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const resolveEventLabel = useCallback(
    (sourceEventType: string): string => {
      const key = engagementEventTypeLabelKey(sourceEventType);
      return t.has(key) ? t(key) : sourceEventType;
    },
    [t],
  );

  const resolveLevelLabel = useCallback(
    (levelCode: string): string => {
      const key = engagementLevelLabelKey(levelCode);
      return t.has(key) ? t(key) : levelCode;
    },
    [t],
  );

  const resolveMutationError = useCallback(
    (code: string | null): string => {
      if (code === null) {
        return t("mutationFailed");
      }
      const key = `mutationErrors.${code}`;
      return t.has(key) ? t(key) : t("mutationFailed");
    },
    [t],
  );

  const loadMemberLookup = useCallback(
    async (targetUserId: string) => {
      setLookupState("loading");
      setLookupError(null);
      setLookupResult(null);
      setMutationFeedback(null);
      try {
        const res = await fetch(buildEngagementMemberLookupPath(targetUserId), { cache: "no-store" });
        if (isEngagementPermissionDenied(res.status)) {
          setLookupState("permissionDenied");
          return;
        }
        if (!res.ok) {
          setLookupState("error");
          setLookupError(res.status === 404 ? t("memberLookupNotFound") : t("memberLookupFailed"));
          return;
        }
        const payload = (await res.json()) as MemberLookupPayload;
        setLookupResult(payload);
        setLookupState("ready");
      } catch {
        setLookupState("error");
        setLookupError(t("memberLookupFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    if (!active || userId.trim().length === 0) {
      return;
    }
    void loadMemberLookup(userId);
  }, [active, userId, loadMemberLookup]);

  const openMutationDialog = (kind: EngagementMutationKind, event?: PointEventRow) => {
    if (!canMutate || mutationPending || lookupResult === null) {
      return;
    }
    setMutationError(null);
    setMutationFeedback(null);
    setAdjustmentForm(EMPTY_ADJUSTMENT_FORM);
    setReversalForm(EMPTY_REVERSAL_FORM);
    idempotencyKeyRef.current = createEngagementIdempotencyKey(`engagement-${kind}`);
    setMutationDialog({ kind, ...(event !== undefined ? { event } : {}) });
  };

  const closeMutationDialog = () => {
    if (mutationPending) {
      return;
    }
    setMutationDialog(null);
    setMutationError(null);
  };

  const handleMutationConfirm = async () => {
    if (!canMutate || mutationPending || mutationDialog === null || lookupResult === null) {
      return;
    }
    setMutationError(null);
    setMutationFeedback(null);

    const idempotencyKey =
      idempotencyKeyRef.current ?? createEngagementIdempotencyKey("engagement-mutation");
    idempotencyKeyRef.current = idempotencyKey;

    let path = "";
    let body = "";

    if (mutationDialog.kind === "reverse") {
      const validated = validateEngagementReversalForm(reversalForm);
      if (!validated.ok) {
        setMutationError(resolveMutationError(validated.error));
        return;
      }
      if (mutationDialog.event === undefined) {
        setMutationError(t("mutationFailed"));
        return;
      }
      path = buildEngagementReversePath(lookupResult.userId);
      body = JSON.stringify({
        originalEventId: mutationDialog.event.id,
        reason: validated.value.reason,
      });
    } else {
      const validated = validateEngagementAdjustmentForm(adjustmentForm);
      if (!validated.ok) {
        setMutationError(resolveMutationError(validated.error));
        return;
      }
      path = buildEngagementAdjustPath(lookupResult.userId);
      body = JSON.stringify({
        pointsDelta: validated.value.pointsDelta,
        reason: validated.value.reason,
      });
    }

    setMutationPending(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body,
      });
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        error?: { code?: string };
        replay?: boolean;
      } | null;
      if (!response.ok) {
        const code = payload?.code ?? payload?.error?.code ?? null;
        setMutationError(resolveMutationError(code));
        return;
      }
      setMutationFeedback(payload?.replay === true ? t("mutationReplay") : t("mutationSuccess"));
      setMutationDialog(null);
      await loadMemberLookup(lookupResult.userId);
    } catch {
      setMutationError(t("mutationFailed"));
    } finally {
      setMutationPending(false);
    }
  };

  if (lookupState === "loading" || lookupState === "idle") {
    return (
      <div data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookup}>
        <Skeleton className="h-24 w-full rounded-lg" aria-label={t("memberLookupSearching")} />
      </div>
    );
  }

  if (lookupState === "permissionDenied") {
    return (
      <p
        role="alert"
        className="text-sm text-destructive"
        data-testid={ENGAGEMENT_OPS_TEST_IDS.permissionDenied}
      >
        {t("permissionDenied")}
      </p>
    );
  }

  if (lookupState === "error") {
    return (
      <div data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookup}>
        <p role="alert" className="text-sm text-destructive">
          {lookupError}
        </p>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void loadMemberLookup(userId)}>
          {t("memberLookupRetry")}
        </Button>
      </div>
    );
  }

  if (lookupResult === null) {
    return null;
  }

  return (
    <div
      data-operator-engagement-member-lookup
      data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookup}
      className="space-y-3"
    >
      {mutationFeedback !== null ? (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          {mutationFeedback}
        </p>
      ) : null}
      <div
        className="space-y-4 rounded-md border border-border/70 bg-background/60 p-4"
        data-operator-engagement-member-lookup-result
        data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookupResult}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{memberLabel ?? t("memberLookupResult")}</p>
          {canMutate ? (
            <Button
              type="button"
              size="sm"
              data-testid={ENGAGEMENT_OPS_TEST_IDS.adjustButton}
              onClick={() => openMutationDialog("adjust")}
            >
              {t("adjustAction")}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("readOnlyHint")}</p>
          )}
        </div>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("memberLookupPoints")}</dt>
            <dd className="font-medium tabular-nums" dir="ltr" data-testid={ENGAGEMENT_OPS_TEST_IDS.memberPoints}>
              {lookupResult.summary.totalPoints}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("memberLookupLevel")}</dt>
            <dd>{resolveLevelLabel(lookupResult.summary.currentLevelCode)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("memberLookupBadges")}</dt>
            <dd>{lookupResult.summary.earnedBadgeCount}</dd>
          </div>
        </dl>
        <div data-testid={ENGAGEMENT_OPS_TEST_IDS.memberHistory}>
          <h4 className="mb-2 text-sm font-medium">{t("memberHistoryTitle")}</h4>
          {lookupResult.summary.recentPointEvents.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {lookupResult.summary.recentPointEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0"
                >
                  <div>
                    <span className="font-medium tabular-nums" dir="ltr">
                      {event.pointsDelta > 0 ? "+" : ""}
                      {event.pointsDelta}
                    </span>{" "}
                    <span>{resolveEventLabel(event.sourceEventType)}</span>
                    {event.reason ? (
                      <p className="text-xs text-muted-foreground">{event.reason}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
                      {formatEngagementTimestamp(event.createdAt, locale)}
                    </time>
                    {canMutate && canReverseEngagementPointEvent(event) ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={ENGAGEMENT_OPS_TEST_IDS.reverseButton}
                        onClick={() => openMutationDialog("reverse", event)}
                      >
                        {t("reverseAction")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("memberLookupNoHistory")}</p>
          )}
        </div>
      </div>

      <Dialog open={mutationDialog !== null} onOpenChange={(open) => !open && closeMutationDialog()}>
        <DialogContent
          data-testid={
            mutationDialog?.kind === "reverse"
              ? ENGAGEMENT_OPS_TEST_IDS.reverseDialog
              : ENGAGEMENT_OPS_TEST_IDS.adjustDialog
          }
        >
          <DialogHeader>
            <DialogTitle>
              {mutationDialog?.kind === "reverse" ? t("reverseDialogTitle") : t("adjustDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {mutationDialog?.kind === "reverse"
                ? t("reverseDialogDescription")
                : t("adjustDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          {mutationDialog?.kind === "adjust" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="engagement-adjust-points">{t("adjustPointsLabel")}</Label>
                <Input
                  id="engagement-adjust-points"
                  value={adjustmentForm.pointsDelta}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, pointsDelta: event.target.value }))
                  }
                  placeholder={t("adjustPointsPlaceholder")}
                  inputMode="numeric"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagement-adjust-reason">{t("adjustReasonLabel")}</Label>
                <Input
                  id="engagement-adjust-reason"
                  value={adjustmentForm.reason}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="engagement-reverse-reason">{t("reverseReasonLabel")}</Label>
              <Input
                id="engagement-reverse-reason"
                value={reversalForm.reason}
                onChange={(event) =>
                  setReversalForm((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </div>
          )}
          {mutationError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMutationDialog} disabled={mutationPending}>
              {t("mutationCancel")}
            </Button>
            <Button type="button" onClick={() => void handleMutationConfirm()} disabled={mutationPending}>
              {mutationPending ? t("mutationPending") : t("mutationConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
