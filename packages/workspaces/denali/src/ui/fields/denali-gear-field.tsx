"use client";

import { readDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { DENALI_SUBMIT_CATALOG_BFF_PATHS } from "../../wizard/denali-wizard-catalog-sanitize";
import type { EquipmentResource, TourThemeResource, TourThemesListResponse } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { fetchDenaliCatalogJsonWithSoftRetry } from "../adapters/catalog-soft-fail";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
import { CheckIcon } from "../components/icons/tour-service-icons";
import { EquipmentCatalogAvatar } from "../components/equipment-catalog-avatar";
import { isEquipmentVisibleInWizard } from "../logic/denali-catalog-filters";
import {
  resolveEquipmentCatalogSearchText,
  resolveEquipmentCatalogSubtitle,
  resolveEquipmentThemeNames,
  resolveTourCategoryLabelKey,
} from "../logic/denali-equipment-catalog-labels";
import { parseDenaliGearItems, type DenaliGearItem } from "../logic/denali-gear-types";
import { filterPickerItemsByQuery } from "../logic/denali-picker-filter-logic";
import { DENALI_GEAR_TEST_IDS } from "../test-ids/denali-gear-test-ids";

export { DENALI_GEAR_TEST_IDS } from "../test-ids/denali-gear-test-ids";

function parseThemeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

type DenaliGearFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

export function DenaliGearField({ draft, onDraftChange, invalid = false }: DenaliGearFieldProps) {
  const locale = useLocale();
  const t = useTranslations("denali");
  const label = resolveDenaliFieldLabel(t, "participants.gearItems");
  const draftRef = useLatestWizardDraft(draft);

  const selected = parseDenaliGearItems(getCanonicalValue(draft, "participants.gearItems"));
  const [catalog, setCatalog] = useState<readonly EquipmentResource[]>([]);
  const [themes, setThemes] = useState<readonly TourThemeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchDenaliCatalogJsonWithSoftRetry<{ items: EquipmentResource[] }>(
        DENALI_SUBMIT_CATALOG_BFF_PATHS.equipment,
        "EQUIPMENT"
      ),
      fetchDenaliCatalogJsonWithSoftRetry<TourThemesListResponse>(
        DENALI_SUBMIT_CATALOG_BFF_PATHS.tourThemes,
        "TOUR_THEMES"
      ),
    ])
      .then(([equipmentPayload, themesPayload]) => {
        if (!cancelled) {
          setCatalog(equipmentPayload.items ?? []);
          setThemes((themesPayload.items ?? []).filter((theme) => theme.isActive));
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "EQUIPMENT_LOAD_FAILED");
          setCatalog([]);
          setThemes([]);
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

  const themesById = useMemo(
    () => new Map(themes.map((theme) => [theme.id, theme] as const)),
    [themes]
  );

  const formatThemeNameList = useMemo(
    () => new Intl.ListFormat(locale, { style: "short", type: "conjunction" }),
    [locale]
  );

  const resolveEquipmentSubtitle = (item: EquipmentResource): string =>
    resolveEquipmentCatalogSubtitle(item, themesById, {
      formatThemeNames: (names) => formatThemeNameList.format([...names]),
      resolveCategoryLabel: (category) => {
        const categoryKey = resolveTourCategoryLabelKey(category);
        try {
          const categoryLabel = t(categoryKey);
          if (categoryLabel !== categoryKey && categoryLabel.length > 0) {
            return categoryLabel;
          }
        } catch {
          // Missing message keys fall through.
        }
        return null;
      },
      allThemesLabel: t("composites.gear.allThemes"),
    });

  const tourCategory = useMemo(() => {
    const tourKind = getCanonicalStringValue(draft, "category").trim();
    return readDenaliCanonicalBasics(
      (tourKind.length > 0 ? tourKind : undefined) as Parameters<
        typeof readDenaliCanonicalBasics
      >[0]
    )?.category;
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
        resolveEquipmentCatalogSearchText(
          item,
          resolveEquipmentThemeNames(item.themeIds, themesById)
        )
      ),
    [visibleCatalog, searchQuery, themesById]
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
      data-operator-wizard-surface="section"
      data-operator-gear-picker
      data-testid={DENALI_GEAR_TEST_IDS.gear}
      aria-invalid={invalid || undefined}
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
      <DenaliCatalogLoadNotice error={error} />

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
                data-operator-wizard-gear-list
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
                      data-operator-gear-card
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
                        <EquipmentCatalogAvatar
                          id={item.id}
                          name={item.name}
                          iconKey={item.iconKey}
                        />
                        <span className="denali-gear-picker__body">
                          <span className="denali-gear-picker__name">{item.name}</span>
                          <span className="denali-gear-picker__category">
                            {resolveEquipmentSubtitle(item)}
                          </span>
                        </span>
                        <span
                          className={
                            isSelected
                              ? "denali-gear-picker__check denali-gear-picker__check--visible"
                              : "denali-gear-picker__check"
                          }
                          aria-hidden
                        >
                          <CheckIcon />
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
