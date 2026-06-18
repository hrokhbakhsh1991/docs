"use client";

import { readDenaliCanonicalBasics } from "@app-tour/workspace-denali/plugin";
import { Check } from "lucide-react";
import { Input } from "@app-tour/ui-primitives/input";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { EquipmentResource } from "@/features/settings/settings-module-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import { isEquipmentVisibleInWizard } from "./denali-catalog-filters";
import { parseDenaliGearItems, type DenaliGearItem } from "./denali-gear-types";
import { filterPickerItemsByQuery } from "./denali-picker-filter-logic";
import { themeDisplayInitials, themeSwatchToneClass } from "./denali-theme-picker-logic";

function parseThemeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export const DENALI_GEAR_TEST_IDS = {
  gear: "denali-composite-gear",
  card: "denali-gear-picker-card",
} as const;

type DenaliGearFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

export function DenaliGearField({ draft, onDraftChange }: DenaliGearFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const label = resolveDenaliFieldLabel(t, "participants.gearItems");
  const draftRef = useLatestWizardDraft(draft);

  const selected = parseDenaliGearItems(getCanonicalValue(draft, "participants.gearItems"));
  const [catalog, setCatalog] = useState<readonly EquipmentResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/resources/equipment", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`EQUIPMENT_HTTP_${response.status}`);
        }
        return (await response.json()) as { items: EquipmentResource[] };
      })
      .then((payload) => {
        if (!cancelled) {
          setCatalog(payload.items ?? []);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "EQUIPMENT_LOAD_FAILED");
          setCatalog([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tourCategory = useMemo(() => {
    const tourKind = getCanonicalStringValue(draft, "category").trim();
    return readDenaliCanonicalBasics(tourKind.length > 0 ? tourKind : undefined)?.category;
  }, [draft]);

  const tourThemeIds = useMemo(
    () => parseThemeIds(getCanonicalValue(draft, "program.themeIds")),
    [draft]
  );

  const visibleCatalog = useMemo(
    () => catalog.filter((item) => isEquipmentVisibleInWizard(item, tourCategory, tourThemeIds)),
    [catalog, tourCategory, tourThemeIds]
  );

  const filteredCatalog = useMemo(
    () =>
      filterPickerItemsByQuery(visibleCatalog, searchQuery, (item) =>
        [item.name, item.category].filter(Boolean).join(" ")
      ),
    [visibleCatalog, searchQuery]
  );

  const selectedById = useMemo(
    () => new Map(selected.map((item) => [item.equipmentId, item])),
    [selected]
  );

  const writeItems = (items: DenaliGearItem[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "participants.gearItems", items)
    );
  };

  const readSelected = () =>
    parseDenaliGearItems(getCanonicalValue(draftRef.current, "participants.gearItems"));

  const toggleItem = (item: EquipmentResource) => {
    const current = readSelected();
    const isSelected = current.some((entry) => entry.equipmentId === item.id);
    if (isSelected) {
      writeItems(current.filter((entry) => entry.equipmentId !== item.id));
      return;
    }
    writeItems([...current, { equipmentId: item.id, name: item.name, isRequired: true }]);
  };

  const setRequirement = (equipmentId: string, isRequired: boolean) => {
    writeItems(
      readSelected().map((entry) =>
        entry.equipmentId === equipmentId ? { ...entry, isRequired } : entry
      )
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-gear-picker
      data-testid={DENALI_GEAR_TEST_IDS.gear}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.gear.helper")}</p>
        {selected.length > 0 ? (
          <p className="denali-gear-picker__summary">
            {t("composites.gear.selectedCount", { count: selected.length })}
          </p>
        ) : null}
      </div>

      {loading ? <p className="denali-wizard-composite__status">{t("composites.gear.loading")}</p> : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error" role="alert">
          {resolveCodedErrorMessage(tErrors, error)}
        </p>
      ) : null}

      {!loading && visibleCatalog.length === 0 && error === null ? (
        <div className="denali-gear-picker__empty">
          <p className="denali-wizard-composite__status">{t("composites.gear.empty")}</p>
          <a className="denali-wizard-composite__link" href="/settings/equipment">
            {t("composites.gear.openEquipment")}
          </a>
        </div>
      ) : null}

      {visibleCatalog.length > 0 ? (
        <>
          <label className="denali-wizard-picker__search">
            <span className="denali-wizard-picker__search-label">{t("composites.gear.searchLabel")}</span>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("composites.gear.searchPlaceholder")}
              aria-label={t("composites.gear.searchLabel")}
            />
          </label>
          {filteredCatalog.length === 0 ? (
            <p className="denali-wizard-composite__status">{t("composites.gear.searchEmpty")}</p>
          ) : (
            <div className="denali-wizard-picker__scroll">
              <div
                className="denali-gear-picker__grid"
                role="list"
                data-denali-wizard-gear-list
              >
                {filteredCatalog.map((item) => {
            const entry = selectedById.get(item.id);
            const isSelected = entry !== undefined;
            const isRequired = entry?.isRequired !== false;

            return (
              <article
                key={item.id}
                role="listitem"
                data-testid={DENALI_GEAR_TEST_IDS.card}
                data-denali-gear-card
                className={
                  isSelected
                    ? "denali-gear-picker__card denali-gear-picker__card--selected"
                    : "denali-gear-picker__card"
                }
              >
                <button
                  type="button"
                  className="denali-gear-picker__select"
                  aria-pressed={isSelected}
                  aria-label={item.name}
                  onClick={() => toggleItem(item)}
                >
                  <span
                    className={`denali-gear-picker__swatch ${themeSwatchToneClass(item.id)}`}
                    aria-hidden
                  >
                    {themeDisplayInitials(item.name)}
                  </span>
                  <span className="denali-gear-picker__body">
                    <span className="denali-gear-picker__name">{item.name}</span>
                    {item.category ? (
                      <span className="denali-gear-picker__category">{item.category}</span>
                    ) : null}
                  </span>
                  <span
                    className={
                      isSelected
                        ? "denali-gear-picker__check denali-gear-picker__check--visible"
                        : "denali-gear-picker__check"
                    }
                    aria-hidden
                  >
                    <Check />
                  </span>
                </button>

                {isSelected ? (
                  <div
                    className="denali-gear-picker__requirement"
                    role="group"
                    aria-label={t("composites.gear.requirementGroup", { name: item.name })}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={
                        isRequired
                          ? "denali-gear-picker__requirement-btn denali-gear-picker__requirement-btn--active"
                          : "denali-gear-picker__requirement-btn"
                      }
                      aria-pressed={isRequired}
                      onClick={() => setRequirement(item.id, true)}
                    >
                      {t("composites.gear.required")}
                    </button>
                    <button
                      type="button"
                      className={
                        !isRequired
                          ? "denali-gear-picker__requirement-btn denali-gear-picker__requirement-btn--active"
                          : "denali-gear-picker__requirement-btn"
                      }
                      aria-pressed={!isRequired}
                      onClick={() => setRequirement(item.id, false)}
                    >
                      {t("composites.gear.optional")}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
