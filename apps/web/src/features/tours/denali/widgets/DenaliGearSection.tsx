"use client";

import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";
import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";

import {
  buildGearDisplayList,
  normalizeGearItems,
  removeGearItem,
  upsertGearItem,
} from "@/features/tours/wizard/denali/denaliGearSelection";
import { useDenaliCanonical } from "@/features/tours/wizard/denali/application";
import { useWizardLayout } from "@/features/tours/wizard/shell/context";
import { useLayoutFieldValue } from "@/features/tours/wizard/shell/fieldAccess";

export function DenaliGearSection() {
  const t = useTranslations("tours.denali");
  const tNew = useTranslations("tours.new");
  const { getValues, setValue } = useFormContext<DenaliCreateTourWizardForm>();
  const equipmentQuery = useSettingsEquipment();
  const { updateCanonical } = useDenaliCanonical();

  const layout = useWizardLayout();
  const gearFilter = layout.gearCatalogFilter;

  const gearItems = useWatch({
    name: "participantRequirements.gearItems",
  });

  const classificationValue = useLayoutFieldValue(gearFilter.classificationFieldPath);

  const { displayEquipment, activeCatalogIds, selectedById, categoryFilteredCount } = useMemo(() => {
    const categorySlug = gearFilter.resolveCategorySlug(classificationValue, layout.profile);
    return buildGearDisplayList(equipmentQuery.data, categorySlug, gearItems);
  }, [classificationValue, equipmentQuery.data, gearFilter, gearItems, layout.profile]);

  const hasRhfGearSelections = selectedById.size > 0;

  /** RHF is source of truth for pills; canonical is synced after each gear change. */
  const commitGearItems = useCallback(
    (next: DenaliGearItem[] | undefined) => {
      const normalized = normalizeGearItems(next);
      setValue("participantRequirements.gearItems", normalized, {
        shouldDirty: true,
        shouldValidate: true,
      });

      const form = getValues();
      updateCanonical({
        participants: {
          minimumAge: form.participantRequirements.minimumAge,
          maximumAge: form.participantRequirements.maximumAge,
          fitnessLevel: form.participantRequirements.fitnessLevel,
          sportsInsuranceRequired: form.participantRequirements.sportsInsuranceRequired,
          fitnessPrerequisiteText: form.participantRequirements.fitnessPrerequisiteText,
          gearItems: normalized,
        },
      });
    },
    [getValues, setValue, updateCanonical],
  );

  const handleIncludeChange = useCallback(
    (id: string, checked: boolean) => {
      const current = getValues().participantRequirements.gearItems;
      if (checked) {
        commitGearItems(upsertGearItem(current, id, { isRequired: false }));
      } else {
        commitGearItems(removeGearItem(current, id));
      }
    },
    [commitGearItems, getValues],
  );

  const handleRequiredChange = useCallback(
    (id: string, isRequired: boolean) => {
      const current = getValues().participantRequirements.gearItems;
      commitGearItems(upsertGearItem(current, id, { isRequired }));
    },
    [commitGearItems, getValues],
  );

  if (equipmentQuery.isLoading) {
    return (
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>
        {tNew("trip_gearEquipmentLoading")}
      </p>
    );
  }

  if (equipmentQuery.isError) {
    return (
      <p
        role="alert"
        style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-800)" }}
      >
        {tNew("trip_gearEquipmentLoadError")}
      </p>
    );
  }

  if (!hasRhfGearSelections && displayEquipment.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>
        {tNew("trip_gearEquipmentEmptyHint")}
      </p>
    );
  }

  return (
    <FormField label={t("gear.title")} description={t("gear.hint")}>
      <>
        {categoryFilteredCount === 0 && hasRhfGearSelections ? (
          <p
            style={{ margin: "0 0 0.65rem", fontSize: "0.85rem", color: "var(--color-warning-800)" }}
            data-testid="denali-gear-catalog-empty-stale-hint"
          >
            {t("gear.catalogEmptyWithStaleHint")}
          </p>
        ) : null}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.65rem",
            padding: "1rem",
            backgroundColor: "var(--color-surface-muted)",
            borderRadius: "0.75rem",
          }}
          data-testid="denali-gear-list"
        >
          {displayEquipment.map((item, index) => {
            const equipmentId = item.id.trim();
            const selected = selectedById.get(equipmentId);
            const isIncluded = selected != null;
            const isRequired = selected?.isRequired === true;
            const isStale = !activeCatalogIds.has(equipmentId);
            const displayName = isStale ? equipmentId : item.name;
            const staleSuffix = t("gear.staleInactiveLabel");

            const baseStyle: React.CSSProperties = {
              display: "inline-flex",
              alignItems: "center",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              border: "1px solid",
              fontSize: "0.85rem",
              transition: "all 0.2s",
              cursor: "pointer",
              userSelect: "none",
              gap: "0.4rem",
            };

            const unselectedStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-bg-surface)",
              color: "var(--color-slate-500)",
              borderColor: "var(--color-slate-200)",
            };

            const suggestedStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-primary-50)",
              color: "var(--color-primary-700)",
              borderColor: "var(--color-primary-200)",
              fontWeight: 600,
            };

            const requiredStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-danger-50)",
              color: "var(--color-danger-700)",
              borderColor: "var(--color-danger-200)",
              fontWeight: 700,
              boxShadow: "var(--shadow-gear-required)",
            };

            const staleStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-warning-50)",
              color: "var(--color-warning-800)",
              borderColor: "var(--color-warning-300)",
              borderStyle: "dashed",
              fontWeight: 600,
            };

            const activeStyle = isStale && isIncluded
              ? staleStyle
              : !isIncluded
                ? unselectedStyle
                : isRequired
                  ? requiredStyle
                  : suggestedStyle;

            const pillLabel = isIncluded && !isStale
              ? `${displayName} (${isRequired ? t("gear.pillRequired") : t("gear.pillSuggested")})`
              : isStale
                ? `${displayName} (${staleSuffix})`
                : displayName;

            return (
              <span
                key={`${item.id}-${index}`}
                style={{ position: "relative", display: "inline-flex" }}
              >
                <button
                  type="button"
                  onClick={() => handleIncludeChange(equipmentId, !isIncluded)}
                  style={{
                    ...activeStyle,
                    font: "inherit",
                    margin: 0,
                  }}
                  data-testid={`denali-gear-pill-${item.slug}`}
                  data-gear-stale={isStale ? "true" : "false"}
                  title={
                    isStale
                      ? `${displayName} (${staleSuffix})`
                      : item.description || item.name
                  }
                  aria-pressed={isIncluded}
                >
                  {isIncluded ? (
                    <>
                      <span aria-hidden>{isStale ? "⚠️" : isRequired ? "🚨" : "🎒"}</span>
                      <span>{pillLabel}</span>
                    </>
                  ) : (
                    <span>{pillLabel}</span>
                  )}
                </button>
                {isIncluded && !isStale ? (
                  <button
                    type="button"
                    aria-label={isRequired ? t("gear.toggleToSuggested") : t("gear.toggleToRequired")}
                    onClick={() => handleRequiredChange(equipmentId, !isRequired)}
                    style={{
                      position: "absolute",
                      top: "0.15rem",
                      insetInlineEnd: "0.15rem",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "1.25rem",
                      height: "1.25rem",
                      padding: 0,
                      border: "none",
                      borderRadius: "50%",
                      backgroundColor: isRequired
                        ? "var(--color-bg-surface)"
                        : "var(--color-indicator-bg-muted)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "transform 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <span aria-hidden>{isRequired ? "🎒" : "🚨"}</span>
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      </>
    </FormField>
  );
}
