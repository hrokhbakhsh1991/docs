"use client";

import { readDenaliCanonicalBasics } from "@app-tour/workspace-denali/plugin";
import React, { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import type { EquipmentResource } from "@/features/settings/settings-module-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { isEquipmentCompatibleWithTourCategory } from "./denali-catalog-filters";
import { parseDenaliGearItems, type DenaliGearItem } from "./denali-gear-types";

export const DENALI_GEAR_TEST_IDS = {
  gear: "denali-composite-gear",
} as const;

type DenaliGearFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

export function DenaliGearField({ draft, onDraftChange }: DenaliGearFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const label = resolveDenaliFieldLabel(t, "participants.gearItems");
  const selected = parseDenaliGearItems(getCanonicalValue(draft, "participants.gearItems"));
  const [catalog, setCatalog] = useState<readonly EquipmentResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const visibleCatalog = useMemo(
    () => catalog.filter((item) => isEquipmentCompatibleWithTourCategory(item, tourCategory)),
    [catalog, tourCategory]
  );

  const selectedIds = new Set(selected.map((item) => item.equipmentId));

  const writeItems = (items: DenaliGearItem[]) => {
    onDraftChange(setCanonicalValue(draft, "participants.gearItems", items));
  };

  const toggleItem = (item: EquipmentResource, checked: boolean) => {
    if (checked) {
      writeItems([
        ...selected,
        { equipmentId: item.id, name: item.name, isRequired: true },
      ]);
      return;
    }
    writeItems(selected.filter((entry) => entry.equipmentId !== item.id));
  };

  const toggleRequired = (equipmentId: string, required: boolean) => {
    writeItems(
      selected.map((entry) =>
        entry.equipmentId === equipmentId ? { ...entry, isRequired: required } : entry
      )
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-testid={DENALI_GEAR_TEST_IDS.gear}
    >
      <div>
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.gear.helper")}</p>
      </div>

      {loading ? <p className="denali-wizard-composite__helper">{t("composites.gear.loading")}</p> : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error" role="alert">
          {resolveCodedErrorMessage(tErrors, error)}
        </p>
      ) : null}

      {!loading && visibleCatalog.length === 0 && error === null ? (
        <p className="denali-wizard-composite__helper">{t("composites.gear.empty")}</p>
      ) : null}

      <ul className="denali-wizard-composite__list" data-denali-wizard-gear-list>
        {visibleCatalog.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const entry = selected.find((gear) => gear.equipmentId === item.id);
          return (
            <li
              key={item.id}
              className="denali-wizard-composite__list-item denali-wizard-composite__gear-item"
            >
              <label className="denali-wizard-composite__field-row">
                <Checkbox
                  aria-label={item.name}
                  checked={isSelected}
                  onChange={(event) => toggleItem(item, event.target.checked)}
                />
                <span>{item.name}</span>
                {item.category ? (
                  <span className="denali-wizard-composite__helper">({item.category})</span>
                ) : null}
              </label>
              {isSelected ? (
                <label className="denali-wizard-composite__field-row denali-wizard-composite__meta">
                  <Checkbox
                    aria-label={`${item.name} required`}
                    checked={entry?.isRequired !== false}
                    onChange={(event) => toggleRequired(item.id, event.target.checked)}
                  />
                  <span>{t("composites.gear.requiredForParticipants")}</span>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
