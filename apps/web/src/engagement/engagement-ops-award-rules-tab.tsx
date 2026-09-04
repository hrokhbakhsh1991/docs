"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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

import {
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementAwardRuleUpdatePath,
  buildEngagementAwardRulesPath,
  buildEngagementBadgesPath,
  buildEngagementCatalogPath,
  createEngagementIdempotencyKey,
  engagementEventTypeLabelKey,
  isEngagementPermissionDenied,
  parseEngagementApiErrorCode,
  resolveEngagementSupportedEventTypes,
  validateEngagementAwardRuleCreateForm,
  type EngagementAwardRuleCreateForm,
} from "./engagement-ops-logic";
import type {
  EngagementAwardRuleDefinition,
  EngagementBadgeDefinition,
  EngagementCatalog,
  EngagementLoadState,
} from "./engagement-ops-types";
import {
  EngagementNativeSelect,
  EngagementPanelState,
  EngagementStatusBadge,
} from "./engagement-ops-ui-primitives";

const EMPTY_RULE_FORM: EngagementAwardRuleCreateForm = {
  eventType: "profile.completed",
  points: "50",
  badgeCode: "",
};

export function EngagementAwardRulesTab({ active }: { readonly active: boolean }) {
  const t = useTranslations("engagement.ops");
  const [items, setItems] = useState<readonly EngagementAwardRuleDefinition[]>([]);
  const [catalog, setCatalog] = useState<EngagementCatalog | null>(null);
  const [badges, setBadges] = useState<readonly EngagementBadgeDefinition[]>([]);
  const [state, setState] = useState<EngagementLoadState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<EngagementAwardRuleDefinition | null>(null);
  const [createForm, setCreateForm] = useState<EngagementAwardRuleCreateForm>(EMPTY_RULE_FORM);
  const [editPoints, setEditPoints] = useState("");
  const [pending, setPending] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const supportedEvents = resolveEngagementSupportedEventTypes(catalog);

  const resolveError = useCallback(
    (code: string | null): string => {
      if (code === null) {
        return t("adminSaveFailed");
      }
      const key = `adminErrors.${code}`;
      return t.has(key) ? t(key) : t("adminSaveFailed");
    },
    [t],
  );

  const resolveEventLabel = useCallback(
    (eventType: string): string => {
      const key = engagementEventTypeLabelKey(eventType);
      return t.has(key) ? t(key) : eventType;
    },
    [t],
  );

  const resolveStatusLabel = useCallback(
    (status: EngagementAwardRuleDefinition["status"]): string => {
      const key = `status.${status}`;
      return t.has(key) ? t(key) : status;
    },
    [t],
  );

  const loadRules = useCallback(async () => {
    setState("loading");
    setFeedback(null);
    try {
      const [rulesRes, catalogRes, badgesRes] = await Promise.all([
        fetch(buildEngagementAwardRulesPath(), { cache: "no-store" }),
        fetch(buildEngagementCatalogPath(), { cache: "no-store" }),
        fetch(buildEngagementBadgesPath(), { cache: "no-store" }),
      ]);
      if (isEngagementPermissionDenied(rulesRes.status)) {
        setState("permissionDenied");
        return;
      }
      if (!rulesRes.ok) {
        setState("error");
        return;
      }
      const rulesPayload = (await rulesRes.json()) as {
        items?: readonly EngagementAwardRuleDefinition[];
      };
      setItems(rulesPayload.items ?? []);
      if (catalogRes.ok) {
        setCatalog((await catalogRes.json()) as EngagementCatalog);
      }
      if (badgesRes.ok) {
        const badgesPayload = (await badgesRes.json()) as {
          items?: readonly EngagementBadgeDefinition[];
        };
        setBadges(badgesPayload.items ?? []);
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadRules();
  }, [active, loadRules]);

  const renderCreateForm = () => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="rule-event">{t("awardRuleEventLabel")}</Label>
        <EngagementNativeSelect
          id="rule-event"
          value={createForm.eventType}
          onChange={(eventType) => setCreateForm((current) => ({ ...current, eventType }))}
        >
          {supportedEvents.map((eventType) => (
            <option key={eventType} value={eventType}>
              {resolveEventLabel(eventType)}
            </option>
          ))}
        </EngagementNativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rule-points">{t("awardRulePointsLabel")}</Label>
        <Input
          id="rule-points"
          value={createForm.points}
          inputMode="numeric"
          dir="ltr"
          onChange={(event) => setCreateForm((current) => ({ ...current, points: event.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rule-badge">{t("awardRuleBadgeLabel")}</Label>
        <EngagementNativeSelect
          id="rule-badge"
          value={createForm.badgeCode}
          onChange={(badgeCode) => setCreateForm((current) => ({ ...current, badgeCode }))}
        >
          <option value="">{t("awardRuleBadgeNone")}</option>
          {badges
            .filter((badge) => badge.status === "active")
            .map((badge) => (
              <option key={badge.code} value={badge.code}>
                {badge.code}
              </option>
            ))}
        </EngagementNativeSelect>
      </div>
    </div>
  );

  const handleCreate = async () => {
    const validated = validateEngagementAwardRuleCreateForm(createForm, supportedEvents);
    if (!validated.ok) {
      setFormError(resolveError(validated.error));
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const idempotencyKey =
        idempotencyKeyRef.current ?? createEngagementIdempotencyKey("award-rule-create");
      const response = await fetch(buildEngagementAwardRulesPath(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(validated.value),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setCreateOpen(false);
      setFeedback(t("adminCreateSuccess"));
      await loadRules();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const patchRule = async (
    rule: EngagementAwardRuleDefinition,
    patch: { readonly status?: EngagementAwardRuleDefinition["status"]; readonly points?: number },
  ) => {
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(buildEngagementAwardRuleUpdatePath(rule.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowVersion: rule.rowVersion, ...patch }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setEditRule(null);
      setFeedback(t("adminUpdateSuccess"));
      await loadRules();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleEditSave = async () => {
    if (editRule === null) {
      return;
    }
    const validated = validateEngagementAwardRuleCreateForm(
      { eventType: editRule.eventType, points: editPoints, badgeCode: editRule.badgeCode ?? "" },
      supportedEvents,
    );
    if (!validated.ok) {
      setFormError(resolveError(validated.error));
      return;
    }
    await patchRule(editRule, { points: validated.value.points });
  };

  return (
    <>
      <EngagementPanelState
        state={state}
        loadingLabel={t("awardRulesLoading")}
        errorLabel={t("awardRulesLoadFailed")}
        permissionDeniedLabel={t("permissionDenied")}
        emptyLabel={t("awardRulesEmpty")}
        isEmpty={items.length === 0}
        testIds={{
          panel: ENGAGEMENT_OPS_TEST_IDS.awardRulesPanel,
          empty: ENGAGEMENT_OPS_TEST_IDS.awardRulesEmpty,
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("awardRulesDescription")}</p>
            <Button
              type="button"
              data-testid={ENGAGEMENT_OPS_TEST_IDS.awardRulesCreateButton}
              onClick={() => {
                setFormError(null);
                idempotencyKeyRef.current = createEngagementIdempotencyKey("award-rule-create");
                setCreateForm({
                  ...EMPTY_RULE_FORM,
                  eventType: supportedEvents[0] ?? "profile.completed",
                });
                setCreateOpen(true);
              }}
            >
              {t("awardRulesCreateAction")}
            </Button>
          </div>
          {feedback !== null ? (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {feedback}
            </p>
          ) : null}
          {formError !== null && state === "ready" ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <ul className="space-y-3" data-testid={ENGAGEMENT_OPS_TEST_IDS.awardRulesList}>
            {items.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
                data-rule-id={rule.id}
                data-rule-event={rule.eventType}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{resolveEventLabel(rule.eventType)}</span>
                    <EngagementStatusBadge
                      status={rule.status}
                      label={resolveStatusLabel(rule.status)}
                    />
                  </div>
                  <p className="text-sm tabular-nums" dir="ltr">
                    +{rule.points}
                    {rule.badgeCode !== null ? ` · ${rule.badgeCode}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormError(null);
                      setEditPoints(String(rule.points));
                      setEditRule(rule);
                    }}
                  >
                    {t("editAction")}
                  </Button>
                  {rule.status === "inactive" ? (
                    <Button type="button" size="sm" onClick={() => void patchRule(rule, { status: "active" })}>
                      {t("activateAction")}
                    </Button>
                  ) : rule.status === "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void patchRule(rule, { status: "inactive" })}
                    >
                      {t("deactivateAction")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </EngagementPanelState>

      <Dialog open={createOpen} onOpenChange={(open) => !open && !pending && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("awardRulesCreateTitle")}</DialogTitle>
            <DialogDescription>{t("awardRulesCreateDescription")}</DialogDescription>
          </DialogHeader>
          {renderCreateForm()}
          {formError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={pending}>
              {t("mutationCancel")}
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={pending}>
              {pending ? t("mutationPending") : t("awardRulesCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRule !== null} onOpenChange={(open) => !open && !pending && setEditRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("awardRulesEditTitle")}</DialogTitle>
            <DialogDescription>{t("awardRulesEditDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-rule-points">{t("awardRulePointsLabel")}</Label>
            <Input
              id="edit-rule-points"
              value={editPoints}
              inputMode="numeric"
              dir="ltr"
              onChange={(event) => setEditPoints(event.target.value)}
            />
          </div>
          {formError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRule(null)} disabled={pending}>
              {t("mutationCancel")}
            </Button>
            <Button type="button" onClick={() => void handleEditSave()} disabled={pending}>
              {pending ? t("mutationPending") : t("saveAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
