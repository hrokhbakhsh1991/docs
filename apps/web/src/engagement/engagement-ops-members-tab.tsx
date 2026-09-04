"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { UsersDirectoryRow } from "@/features/users/users-directory-types";
import type { AppLocale } from "@/i18n/routing";

import {
  ENGAGEMENT_MEMBER_SEARCH_MIN_LENGTH,
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementAdjustPath,
  buildEngagementMemberLookupPath,
  buildEngagementMemberSearchPath,
  buildEngagementReversePath,
  canReverseEngagementPointEvent,
  createEngagementIdempotencyKey,
  engagementEventTypeLabelKey,
  engagementLevelLabelKey,
  formatEngagementTimestamp,
  validateEngagementAdjustmentForm,
  validateEngagementReversalForm,
  type EngagementAdjustmentForm,
  type EngagementMutationKind,
  type EngagementReversalForm,
} from "./engagement-ops-logic";
import type { MemberLookupPayload, PointEventRow } from "./engagement-ops-types";

type LoadState = "idle" | "loading" | "error" | "ready";

const EMPTY_ADJUSTMENT_FORM: EngagementAdjustmentForm = { pointsDelta: "", reason: "" };
const EMPTY_REVERSAL_FORM: EngagementReversalForm = { reason: "" };

export function EngagementMembersTab() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");

  const [searchInput, setSearchInput] = useState("");
  const [memberResults, setMemberResults] = useState<readonly UsersDirectoryRow[]>([]);
  const [memberSearchState, setMemberSearchState] = useState<LoadState>("idle");
  const [selectedMember, setSelectedMember] = useState<UsersDirectoryRow | null>(null);

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
    async (userId: string) => {
      setLookupState("loading");
      setLookupError(null);
      setLookupResult(null);
      try {
        const res = await fetch(buildEngagementMemberLookupPath(userId), { cache: "no-store" });
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
    const search = searchInput.trim();
    if (search.length < ENGAGEMENT_MEMBER_SEARCH_MIN_LENGTH) {
      setMemberResults([]);
      setMemberSearchState("idle");
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setMemberSearchState("loading");
      void fetch(buildEngagementMemberSearchPath(search), { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`USERS_LIST_HTTP_${response.status}`);
          }
          return (await response.json()) as { items?: readonly UsersDirectoryRow[] };
        })
        .then((payload) => {
          if (!cancelled) {
            setMemberResults(payload.items ?? []);
            setMemberSearchState("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMemberResults([]);
            setMemberSearchState("error");
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  const handleSelectMember = (member: UsersDirectoryRow) => {
    setSelectedMember(member);
    setSearchInput(member.displayName.trim().length > 0 ? member.displayName : (member.phone ?? member.userId));
    setMemberResults([]);
    void loadMemberLookup(member.userId);
  };

  const handleMemberSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedMember !== null) {
      void loadMemberLookup(selectedMember.userId);
      return;
    }
    if (memberResults.length === 1) {
      handleSelectMember(memberResults[0]!);
    }
  };

  const openMutationDialog = (kind: EngagementMutationKind, event?: PointEventRow) => {
    if (mutationPending || lookupResult === null) {
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
    if (mutationPending || mutationDialog === null || lookupResult === null) {
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

  return (
    <div data-testid={ENGAGEMENT_OPS_TEST_IDS.membersPanel}>
      <Card data-operator-engagement-member-lookup data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookup}>
        <CardHeader>
          <CardTitle>{t("memberLookupTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleMemberSearchSubmit}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="relative flex-1 space-y-2">
              <Label htmlFor="engagement-member-search">{t("memberLookupLabel")}</Label>
              <Input
                id="engagement-member-search"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                  setSelectedMember(null);
                }}
                placeholder={t("memberLookupPlaceholder")}
                autoComplete="off"
                disabled={lookupState === "loading"}
                data-testid={ENGAGEMENT_OPS_TEST_IDS.memberSearchInput}
              />
              {memberResults.length > 0 ? (
                <ul
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md"
                  data-testid={ENGAGEMENT_OPS_TEST_IDS.memberSearchResults}
                >
                  {memberResults.map((member) => (
                    <li key={member.userId}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-start hover:bg-muted/50"
                        onClick={() => handleSelectMember(member)}
                      >
                        <span className="font-medium">{member.displayName}</span>
                        {member.phone ? (
                          <span className="text-xs text-muted-foreground" dir="ltr">
                            {member.phone}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button type="submit" disabled={lookupState === "loading" || memberSearchState === "loading"}>
              {lookupState === "loading" ? t("memberLookupSearching") : t("memberLookupAction")}
            </Button>
          </form>
          {memberSearchState === "loading" ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("memberSearchLoading")}</p>
          ) : null}
          {lookupError !== null ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {lookupError}
            </p>
          ) : null}
          {mutationFeedback !== null ? (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">
              {mutationFeedback}
            </p>
          ) : null}
          {lookupResult !== null && lookupState === "ready" ? (
            <div
              className="mt-4 space-y-4 rounded-md border p-4"
              data-operator-engagement-member-lookup-result
              data-testid={ENGAGEMENT_OPS_TEST_IDS.memberLookupResult}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {selectedMember?.displayName ?? t("memberLookupResult")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid={ENGAGEMENT_OPS_TEST_IDS.adjustButton}
                  onClick={() => openMutationDialog("adjust")}
                >
                  {t("adjustAction")}
                </Button>
              </div>
              <dl className="grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("memberLookupPoints")}</dt>
                  <dd
                    className="font-medium tabular-nums"
                    dir="ltr"
                    data-testid={ENGAGEMENT_OPS_TEST_IDS.memberPoints}
                  >
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
                <h3 className="mb-2 text-sm font-medium">{t("memberHistoryTitle")}</h3>
                {lookupResult.summary.recentPointEvents.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {lookupResult.summary.recentPointEvents.map((event) => (
                      <li
                        key={event.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0"
                      >
                        <div>
                          <span className="tabular-nums font-medium" dir="ltr">
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
                          {canReverseEngagementPointEvent(event) ? (
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
          ) : null}
        </CardContent>
      </Card>

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
