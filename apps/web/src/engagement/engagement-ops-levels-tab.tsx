"use client";

import { useLocale, useTranslations } from "next-intl";
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
  buildEngagementLevelUpdatePath,
  buildEngagementLevelsPath,
  createEngagementIdempotencyKey,
  isEngagementPermissionDenied,
  parseEngagementApiErrorCode,
  sortEngagementLevelsByMinPoints,
  validateEngagementLevelCreateForm,
  validateEngagementLevelUpdateMinPoints,
  type EngagementLevelCreateForm,
} from "./engagement-ops-logic";
import type { EngagementLevelDefinition, EngagementLoadState } from "./engagement-ops-types";
import { EngagementPanelState, EngagementStatusBadge } from "./engagement-ops-ui-primitives";

const EMPTY_LEVEL_FORM: EngagementLevelCreateForm = {
  code: "",
  titleEn: "",
  titleFa: "",
  descriptionEn: "",
  descriptionFa: "",
  minPoints: "",
  sortOrder: "0",
};

export function EngagementLevelsTab({ active }: { readonly active: boolean }) {
  const locale = useLocale();
  const t = useTranslations("engagement.ops");
  const [items, setItems] = useState<readonly EngagementLevelDefinition[]>([]);
  const [state, setState] = useState<EngagementLoadState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<EngagementLevelDefinition | null>(null);
  const [createForm, setCreateForm] = useState<EngagementLevelCreateForm>(EMPTY_LEVEL_FORM);
  const [editForm, setEditForm] = useState<EngagementLevelCreateForm>(EMPTY_LEVEL_FORM);
  const [pending, setPending] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

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

  const resolveStatusLabel = useCallback(
    (status: EngagementLevelDefinition["status"]): string => {
      const key = `status.${status}`;
      return t.has(key) ? t(key) : status;
    },
    [t],
  );

  const loadLevels = useCallback(async () => {
    setState("loading");
    setFeedback(null);
    try {
      const response = await fetch(buildEngagementLevelsPath(), { cache: "no-store" });
      if (isEngagementPermissionDenied(response.status)) {
        setState("permissionDenied");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const payload = (await response.json()) as { items?: readonly EngagementLevelDefinition[] };
      setItems(sortEngagementLevelsByMinPoints(payload.items ?? []));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadLevels();
  }, [active, loadLevels]);

  const existingMinPoints = items.map((item) => item.minPoints);

  const renderForm = (
    form: EngagementLevelCreateForm,
    onChange: (next: EngagementLevelCreateForm) => void,
    codeDisabled: boolean,
    excludeMinPoints?: number,
  ) => {
    const otherMinPoints = existingMinPoints.filter((value) => value !== excludeMinPoints);
    const thresholdPreview =
      form.minPoints.trim().length > 0
        ? validateEngagementLevelUpdateMinPoints(form.minPoints, otherMinPoints, excludeMinPoints ?? -1)
        : null;

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="level-code">{t("levelCodeLabel")}</Label>
          <Input
            id="level-code"
            value={form.code}
            disabled={codeDisabled}
            dir="ltr"
            onChange={(event) => onChange({ ...form, code: event.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="level-title-en">{t("levelTitleEnLabel")}</Label>
            <Input
              id="level-title-en"
              value={form.titleEn}
              onChange={(event) => onChange({ ...form, titleEn: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-title-fa">{t("levelTitleFaLabel")}</Label>
            <Input
              id="level-title-fa"
              value={form.titleFa}
              onChange={(event) => onChange({ ...form, titleFa: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="level-desc-en">{t("levelDescriptionEnLabel")}</Label>
            <Input
              id="level-desc-en"
              value={form.descriptionEn}
              onChange={(event) => onChange({ ...form, descriptionEn: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-desc-fa">{t("levelDescriptionFaLabel")}</Label>
            <Input
              id="level-desc-fa"
              value={form.descriptionFa}
              onChange={(event) => onChange({ ...form, descriptionFa: event.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="level-min-points">{t("levelMinPointsLabel")}</Label>
            <Input
              id="level-min-points"
              value={form.minPoints}
              inputMode="numeric"
              dir="ltr"
              onChange={(event) => onChange({ ...form, minPoints: event.target.value })}
            />
            {thresholdPreview !== null && !thresholdPreview.ok ? (
              <p role="alert" className="text-xs text-destructive">
                {resolveError(thresholdPreview.error)}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="level-sort-order">{t("levelSortOrderLabel")}</Label>
            <Input
              id="level-sort-order"
              value={form.sortOrder}
              inputMode="numeric"
              dir="ltr"
              onChange={(event) => onChange({ ...form, sortOrder: event.target.value })}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleCreate = async () => {
    const validated = validateEngagementLevelCreateForm(createForm, existingMinPoints);
    if (!validated.ok) {
      setFormError(resolveError(validated.error));
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const idempotencyKey =
        idempotencyKeyRef.current ?? createEngagementIdempotencyKey("level-create");
      const response = await fetch(buildEngagementLevelsPath(), {
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
      await loadLevels();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const handleEditSave = async () => {
    if (editLevel === null) {
      return;
    }
    const otherMinPoints = existingMinPoints.filter((value) => value !== editLevel.minPoints);
    const minPointsResult = validateEngagementLevelUpdateMinPoints(
      editForm.minPoints,
      otherMinPoints,
      editLevel.minPoints,
    );
    if (!minPointsResult.ok) {
      setFormError(resolveError(minPointsResult.error));
      return;
    }
    const titleEn = editForm.titleEn.trim();
    const titleFa = editForm.titleFa.trim();
    const descriptionEn = editForm.descriptionEn.trim();
    const descriptionFa = editForm.descriptionFa.trim();
    if (titleEn.length === 0 || titleFa.length === 0 || descriptionEn.length === 0 || descriptionFa.length === 0) {
      setFormError(resolveError("I18N_REQUIRED"));
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const response = await fetch(buildEngagementLevelUpdatePath(editLevel.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowVersion: editLevel.rowVersion,
          titleI18n: { en: titleEn, fa: titleFa },
          descriptionI18n: { en: descriptionEn, fa: descriptionFa },
          minPoints: minPointsResult.value,
          sortOrder: Number.parseInt(editForm.sortOrder.trim() || "0", 10),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setEditLevel(null);
      setFeedback(t("adminUpdateSuccess"));
      await loadLevels();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const patchStatus = async (
    level: EngagementLevelDefinition,
    status: EngagementLevelDefinition["status"],
  ) => {
    setPending(true);
    try {
      const response = await fetch(buildEngagementLevelUpdatePath(level.code), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowVersion: level.rowVersion, status }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(resolveError(parseEngagementApiErrorCode(payload)));
        return;
      }
      setFeedback(t("adminUpdateSuccess"));
      await loadLevels();
    } catch {
      setFormError(t("adminSaveFailed"));
    } finally {
      setPending(false);
    }
  };

  const visibleItems = sortEngagementLevelsByMinPoints(
    items.filter((item) => item.status !== "archived"),
  );

  return (
    <>
      <EngagementPanelState
        state={state}
        loadingLabel={t("levelsLoading")}
        errorLabel={t("levelsLoadFailed")}
        permissionDeniedLabel={t("permissionDenied")}
        emptyLabel={t("levelsEmpty")}
        isEmpty={visibleItems.length === 0}
        testIds={{
          panel: ENGAGEMENT_OPS_TEST_IDS.levelsPanel,
          empty: ENGAGEMENT_OPS_TEST_IDS.levelsEmpty,
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t("levelsDescription")}</p>
            <Button
              type="button"
              data-testid={ENGAGEMENT_OPS_TEST_IDS.levelsCreateButton}
              onClick={() => {
                setFormError(null);
                idempotencyKeyRef.current = createEngagementIdempotencyKey("level-create");
                setCreateForm(EMPTY_LEVEL_FORM);
                setCreateOpen(true);
              }}
            >
              {t("levelsCreateAction")}
            </Button>
          </div>
          {feedback !== null ? (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {feedback}
            </p>
          ) : null}
          <ul className="space-y-3" data-testid={ENGAGEMENT_OPS_TEST_IDS.levelsList}>
            {visibleItems.map((level) => (
              <li
                key={level.code}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="ltr">
                      {level.code}
                    </span>
                    <EngagementStatusBadge
                      status={level.status}
                      label={resolveStatusLabel(level.status)}
                    />
                  </div>
                  <p className="text-sm">
                    {locale === "fa" ? level.titleI18n.fa : level.titleI18n.en}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                    {level.minPoints}+
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormError(null);
                      setEditForm({
                        code: level.code,
                        titleEn: level.titleI18n.en,
                        titleFa: level.titleI18n.fa,
                        descriptionEn: level.descriptionI18n.en,
                        descriptionFa: level.descriptionI18n.fa,
                        minPoints: String(level.minPoints),
                        sortOrder: String(level.sortOrder),
                      });
                      setEditLevel(level);
                    }}
                  >
                    {t("editAction")}
                  </Button>
                  {level.status === "inactive" ? (
                    <Button type="button" size="sm" onClick={() => void patchStatus(level, "active")}>
                      {t("activateAction")}
                    </Button>
                  ) : level.status === "active" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void patchStatus(level, "inactive")}
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
            <DialogTitle>{t("levelsCreateTitle")}</DialogTitle>
            <DialogDescription>{t("levelsCreateDescription")}</DialogDescription>
          </DialogHeader>
          {renderForm(createForm, setCreateForm, false)}
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
              {pending ? t("mutationPending") : t("levelsCreateAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLevel !== null} onOpenChange={(open) => !open && !pending && setEditLevel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("levelsEditTitle")}</DialogTitle>
            <DialogDescription>{t("levelsEditDescription")}</DialogDescription>
          </DialogHeader>
          {editLevel !== null
            ? renderForm(editForm, setEditForm, true, editLevel.minPoints)
            : null}
          {formError !== null ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditLevel(null)} disabled={pending}>
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
