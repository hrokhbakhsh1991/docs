"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { AppLocale } from "@/i18n/routing";

import {
  ENGAGEMENT_BADGE_ICON_KEYS,
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementBadgeUpdatePath,
  buildEngagementBadgesPath,
  buildEngagementCatalogPath,
  createEngagementIdempotencyKey,
  engagementEventTypeLabelKey,
  isEngagementPermissionDenied,
  parseEngagementApiErrorCode,
  resolveEngagementSupportedEventTypes,
  validateEngagementBadgeCreateForm,
  type EngagementBadgeCreateForm,
} from "./engagement-ops-logic";
import type { EngagementBadgeDefinition, EngagementCatalog, EngagementLoadState } from "./engagement-ops-types";
import {
  EngagementNativeSelect,
  EngagementPanelState,
  EngagementStatusBadge,
} from "./engagement-ops-ui-primitives";

const EMPTY_BADGE_FORM: EngagementBadgeCreateForm = {
  code: "",
  titleEn: "",
  titleFa: "",
  descriptionEn: "",
  descriptionFa: "",
  iconKey: ENGAGEMENT_BADGE_ICON_KEYS[0] ?? "mountain",
  triggerKind: "event",
  triggerEventType: "profile.completed",
  triggerMinPoints: "100",
};

export function EngagementBadgesTab({ active }: { readonly active: boolean }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");
  const [items, setItems] = useState<readonly EngagementBadgeDefinition[]>([]);
  const [catalog, setCatalog] = useState<EngagementCatalog | null>(null);
  const [state, setState] = useState<EngagementLoadState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBadge, setEditBadge] = useState<EngagementBadgeDefinition | null>(null);
  const [createForm, setCreateForm] = useState<EngagementBadgeCreateForm>(EMPTY_BADGE_FORM);
  const [editForm, setEditForm] = useState<EngagementBadgeCreateForm>(EMPTY_BADGE_FORM);
  const [pending, setPending] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<EngagementBadgeDefinition | null>(null);
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
    (eventType: string | null): string => {
      if (eventType === null) {
        return "—";
      }
      const key = engagementEventTypeLabelKey(eventType);
      return t.has(key) ? t(key) : eventType;
    },
    [t],
  );

  const resolveStatusLabel = useCallback(
    (status: EngagementBadgeDefinition["status"]): string => {
      const key = `status.${status}`;
      return t.has(key) ? t(key) : status;
    },
    [t],
  );

  const loadBadges = useCallback(async () => {
    setState("loading");
    setFeedback(null);
    try {
      const [badgesRes, catalogRes] = await Promise.all([
        fetch(buildEngagementBadgesPath(), { cache: "no-store" }),
        fetch(buildEngagementCatalogPath(), { cache: "no-store" }),
      ]);
      if (isEngagementPermissionDenied(badgesRes.status)) {
        setState("permissionDenied");
        return;
      }
      if (!badgesRes.ok) {
        setState("error");
        return;
      }
      const badgesPayload = (await badgesRes.json()) as { items?: readonly EngagementBadgeDefinition[] };
      setItems(badgesPayload.items ?? []);
      if (catalogRes.ok) {
        setCatalog((await catalogRes.json()) as EngagementCatalog);
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
    void loadBadges();
  }, [active, loadBadges]);

  const openCreate = () => {
    setFormError(null);
    setCreateForm({
      ...EMPTY_BADGE_FORM,
      triggerEventType: supportedEvents[0] ?? "profile.completed",
    });
    idempotencyKeyRef.current = createEngagementIdempotencyKey("badge-create");
    setCreateOpen(true);
  };

  const openEdit = (badge: EngagementBadgeDefinition) => {
    setFormError(null);
    setEditForm({
      code: badge.code,
      titleEn: badge.titleI18n.en,
      titleFa: badge.titleI18n.fa,
      descriptionEn: badge.descriptionI18n.en,
      descriptionFa: badge.descriptionI18n.fa,
      iconKey: badge.iconKey,
      triggerKind: badge.triggerKind,
      triggerEventType: badge.triggerEventType ?? supportedEvents[0] ?? "profile.completed",
      triggerMinPoints: badge.triggerMinPoints !== null ? String(badge.triggerMinPoints) : "100",
    });
    setEditBadge(badge);
  };

  const handleCreate = async () => {
    const validated = validateEngagementBadgeCreateForm(createForm, supportedEvents);
    if (!validated.ok) {
      setFormError(resolveError(validated.error));
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const idempotencyKey =
        idempotencyKeyRef.current ?? createEngagementIdempotencyKey("badge-create");
      const response = await fetch(buildEngagementBadgesPath(), {
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
      await loadBadges();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleEditSave = async () => {
    if (editBadge === null) {
      return;
    }
    const validated = validateEngagementBadgeCreateForm(editForm, supportedEvents);
    if (!validated.ok) {
      setFormError(resolveError(validated.error));
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(buildEngagementBadgeUpdatePath(editBadge.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowVersion: editBadge.rowVersion,
          titleI18n: validated.value.titleI18n,
          descriptionI18n: validated.value.descriptionI18n,
          iconKey: validated.value.iconKey,
          triggerKind: validated.value.triggerKind,
          triggerEventType:
            validated.value.triggerKind === "event" ? validated.value.triggerEventType : null,
          triggerMinPoints:
            validated.value.triggerKind === "points_threshold"
              ? validated.value.triggerMinPoints
              : null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setEditBadge(null);
      setFeedback(t("adminUpdateSuccess"));
      await loadBadges();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const patchStatus = async (
    badge: EngagementBadgeDefinition,
    status: EngagementBadgeDefinition["status"],
  ) => {
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(buildEngagementBadgeUpdatePath(badge.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowVersion: badge.rowVersion, status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback(null);
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setConfirmArchive(null);
      setFeedback(t("adminUpdateSuccess"));
      await loadBadges();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const renderBadgeFormFields = (
    form: EngagementBadgeCreateForm,
    onChange: (next: EngagementBadgeCreateForm) => void,
    codeDisabled: boolean,
  ) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="badge-code">{t("badgeCodeLabel")}</Label>
        <Input
          id="badge-code"
          value={form.code}
          disabled={codeDisabled}
          dir="ltr"
          onChange={(event) => onChange({ ...form, code: event.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="badge-title-en">{t("badgeTitleEnLabel")}</Label>
          <Input
            id="badge-title-en"
            value={form.titleEn}
            onChange={(event) => onChange({ ...form, titleEn: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="badge-title-fa">{t("badgeTitleFaLabel")}</Label>
          <Input
            id="badge-title-fa"
            value={form.titleFa}
            onChange={(event) => onChange({ ...form, titleFa: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="badge-desc-en">{t("badgeDescriptionEnLabel")}</Label>
          <Input
            id="badge-desc-en"
            value={form.descriptionEn}
            onChange={(event) => onChange({ ...form, descriptionEn: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="badge-desc-fa">{t("badgeDescriptionFaLabel")}</Label>
          <Input
            id="badge-desc-fa"
            value={form.descriptionFa}
            onChange={(event) => onChange({ ...form, descriptionFa: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="badge-icon">{t("badgeIconLabel")}</Label>
        <EngagementNativeSelect
          id="badge-icon"
          value={form.iconKey}
          onChange={(iconKey) => onChange({ ...form, iconKey })}
        >
          {(catalog?.icons ?? ENGAGEMENT_BADGE_ICON_KEYS.map((key) => ({ key, labelKey: key }))).map(
            (icon) => (
              <option key={icon.key} value={icon.key}>
                {icon.key}
              </option>
            ),
          )}
        </EngagementNativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="badge-trigger-kind">{t("badgeTriggerKindLabel")}</Label>
        <EngagementNativeSelect
          id="badge-trigger-kind"
          value={form.triggerKind}
          onChange={(triggerKind) =>
            onChange({
              ...form,
              triggerKind: triggerKind as EngagementBadgeCreateForm["triggerKind"],
            })
          }
        >
          <option value="event">{t("badgeTriggerEvent")}</option>
          <option value="points_threshold">{t("badgeTriggerPoints")}</option>
        </EngagementNativeSelect>
      </div>
      {form.triggerKind === "event" ? (
        <div className="space-y-2">
          <Label htmlFor="badge-trigger-event">{t("badgeTriggerEventLabel")}</Label>
          <EngagementNativeSelect
            id="badge-trigger-event"
            value={form.triggerEventType}
            onChange={(triggerEventType) => onChange({ ...form, triggerEventType })}
          >
            {supportedEvents.map((eventType) => (
              <option key={eventType} value={eventType}>
                {resolveEventLabel(eventType)}
              </option>
            ))}
          </EngagementNativeSelect>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="badge-trigger-points">{t("badgeTriggerMinPointsLabel")}</Label>
          <Input
            id="badge-trigger-points"
            value={form.triggerMinPoints}
            inputMode="numeric"
            dir="ltr"
            onChange={(event) => onChange({ ...form, triggerMinPoints: event.target.value })}
          />
        </div>
      )}
      <Card data-testid={ENGAGEMENT_OPS_TEST_IDS.badgePreview}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("badgePreviewTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">
            {locale === "fa" ? form.titleFa || form.titleEn : form.titleEn || form.titleFa}
          </Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            {locale === "fa"
              ? form.descriptionFa || form.descriptionEn
              : form.descriptionEn || form.descriptionFa}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const visibleItems = items.filter((item) => item.status !== "archived");

  return (
    <>
      <EngagementPanelState
        state={state}
        loadingLabel={t("badgesLoading")}
        errorLabel={t("badgesLoadFailed")}
        permissionDeniedLabel={t("permissionDenied")}
        emptyLabel={t("badgesEmpty")}
        isEmpty={visibleItems.length === 0}
        testIds={{
          panel: ENGAGEMENT_OPS_TEST_IDS.badgesPanel,
          empty: ENGAGEMENT_OPS_TEST_IDS.badgesEmpty,
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("badgesDescription")}</p>
            <Button
              type="button"
              data-testid={ENGAGEMENT_OPS_TEST_IDS.badgesCreateButton}
              onClick={openCreate}
            >
              {t("badgesCreateAction")}
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
          <ul className="space-y-3" data-testid={ENGAGEMENT_OPS_TEST_IDS.badgesList}>
            {visibleItems.map((badge) => (
              <li
                key={badge.code}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
                data-badge-code={badge.code}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="ltr">
                      {badge.code}
                    </span>
                    <EngagementStatusBadge
                      status={badge.status}
                      label={resolveStatusLabel(badge.status)}
                    />
                  </div>
                  <p className="text-sm">
                    {locale === "fa" ? badge.titleI18n.fa : badge.titleI18n.en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {badge.triggerKind === "event"
                      ? resolveEventLabel(badge.triggerEventType)
                      : t("badgeTriggerPointsThreshold", {
                          points: badge.triggerMinPoints ?? 0,
                        })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(badge)}>
                    {t("editAction")}
                  </Button>
                  {badge.status === "inactive" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void patchStatus(badge, "active")}
                      disabled={pending}
                    >
                      {t("activateAction")}
                    </Button>
                  ) : badge.status === "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void patchStatus(badge, "inactive")}
                      disabled={pending}
                    >
                      {t("deactivateAction")}
                    </Button>
                  ) : null}
                  {badge.status !== "archived" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmArchive(badge)}
                      disabled={pending}
                    >
                      {t("archiveAction")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </EngagementPanelState>

      <Dialog open={createOpen} onOpenChange={(open) => !open && !pending && setCreateOpen(false)}>
        <DialogContent data-testid={ENGAGEMENT_OPS_TEST_IDS.badgesCreateDialog}>
          <DialogHeader>
            <DialogTitle>{t("badgesCreateTitle")}</DialogTitle>
            <DialogDescription>{t("badgesCreateDescription")}</DialogDescription>
          </DialogHeader>
          {renderBadgeFormFields(createForm, setCreateForm, false)}
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
              {pending ? t("mutationPending") : t("badgesCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editBadge !== null} onOpenChange={(open) => !open && !pending && setEditBadge(null)}>
        <DialogContent data-testid={ENGAGEMENT_OPS_TEST_IDS.badgesEditDialog}>
          <DialogHeader>
            <DialogTitle>{t("badgesEditTitle")}</DialogTitle>
            <DialogDescription>{t("badgesEditDescription")}</DialogDescription>
          </DialogHeader>
          {renderBadgeFormFields(editForm, setEditForm, true)}
          {formError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditBadge(null)} disabled={pending}>
              {t("mutationCancel")}
            </Button>
            <Button type="button" onClick={() => void handleEditSave()} disabled={pending}>
              {pending ? t("mutationPending") : t("saveAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmArchive !== null}
        onOpenChange={(open) => !open && !pending && setConfirmArchive(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("archiveConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("archiveConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmArchive(null)} disabled={pending}>
              {t("mutationCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => confirmArchive !== null && void patchStatus(confirmArchive, "archived")}
            >
              {pending ? t("mutationPending") : t("archiveAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
