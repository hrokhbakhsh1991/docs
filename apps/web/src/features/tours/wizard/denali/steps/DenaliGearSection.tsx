"use client";

import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import {
  useSettingsEquipment,
  type SettingsEquipmentDto,
} from "@/hooks/use-settings-equipment";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";

import {
  normalizeGearItems,
  removeGearItem,
  upsertGearItem,
} from "../denaliGearSelection";
import { useDenaliCanonical } from "../DenaliCanonicalContext";

export function DenaliGearSection() {
  const t = useTranslations("tours.denali");
  const tNew = useTranslations("tours.new");
  const { getValues, setValue } = useFormContext<DenaliCreateTourWizardForm>();
  const equipmentQuery = useSettingsEquipment();
  const { updateCanonical } = useDenaliCanonical();

  const gearItems = useWatch({
    name: "participantRequirements.gearItems",
  });

  const catalogById = useMemo(() => {
    const map = new Map<string, SettingsEquipmentDto>();
    for (const row of equipmentQuery.data ?? []) {
      const id = row.id.trim();
      if (id) {
        map.set(id, row);
      }
    }
    return map;
  }, [equipmentQuery.data]);

  const activeEquipment = useMemo(
    () => (equipmentQuery.data ?? []).filter((row) => row.isActive),
    [equipmentQuery.data],
  );

  const activeEquipmentIdSet = useMemo(
    () => new Set(activeEquipment.map((row) => row.id.trim()).filter(Boolean)),
    [activeEquipment],
  );

  const selectedById = useMemo(() => {
    const map = new Map<string, DenaliGearItem>();
    for (const row of gearItems ?? []) {
      const id = row.id.trim();
      if (!id) continue;
      map.set(id, { id, isRequired: row.isRequired === true });
    }
    return map;
  }, [gearItems]);

  const hasRhfGearSelections = selectedById.size > 0;

  /** Active catalog pills plus RHF-selected gear not in the active catalog (stale / inactive). */
  const displayEquipment = useMemo(() => {
    const extras: SettingsEquipmentDto[] = [];
    for (const id of selectedById.keys()) {
      if (activeEquipmentIdSet.has(id)) continue;
      const catalogRow = catalogById.get(id);
      extras.push(
        catalogRow ?? {
          id,
          name: id,
          slug: id,
          category: null,
          description: null,
          icon: null,
          isActive: false,
          sortOrder: 9999,
          createdAt: "",
          updatedAt: "",
        },
      );
    }
    return [...activeEquipment, ...extras];
  }, [activeEquipment, activeEquipmentIdSet, catalogById, selectedById]);

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
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
        {tNew("trip_gearEquipmentLoading")}
      </p>
    );
  }

  if (equipmentQuery.isError) {
    return (
      <p
        role="alert"
        style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-danger-800, #991b1b)" }}
      >
        {tNew("trip_gearEquipmentLoadError")}
      </p>
    );
  }

  if (!hasRhfGearSelections && displayEquipment.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
        {tNew("trip_gearEquipmentEmptyHint")}
      </p>
    );
  }

  return (
    <FormField label={t("gear.title")} description={t("gear.hint")}>
      <>
        {activeEquipment.length === 0 && hasRhfGearSelections ? (
          <p
            style={{ margin: "0 0 0.65rem", fontSize: "0.85rem", color: "#92400e" }}
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
            backgroundColor: "var(--color-surface-muted, #f8fafc)",
            borderRadius: "0.75rem",
          }}
          data-testid="denali-gear-list"
        >
          {displayEquipment.map((item, index) => {
            const equipmentId = item.id.trim();
            const selected = selectedById.get(equipmentId);
            const isIncluded = selected != null;
            const isRequired = selected?.isRequired === true;
            const isStale = !activeEquipmentIdSet.has(equipmentId);
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
              backgroundColor: "white",
              color: "#64748b",
              borderColor: "var(--color-border-subtle, #e2e8f0)",
            };

            const suggestedStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-primary-50, #eff6ff)",
              color: "var(--color-primary-700, #1d4ed8)",
              borderColor: "var(--color-primary-200, #bfdbfe)",
              fontWeight: 600,
            };

            const requiredStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "var(--color-danger-50, #fef2f2)",
              color: "var(--color-danger-700, #b91c1c)",
              borderColor: "var(--color-danger-200, #fecaca)",
              fontWeight: 700,
              boxShadow: "0 1px 2px rgba(220, 38, 38, 0.1)",
            };

            const staleStyle: React.CSSProperties = {
              ...baseStyle,
              backgroundColor: "#fffbeb",
              color: "#92400e",
              borderColor: "#fcd34d",
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

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => handleIncludeChange(equipmentId, !isIncluded)}
                style={activeStyle}
                data-testid={`denali-gear-pill-${item.slug}`}
                data-gear-stale={isStale ? "true" : "false"}
                title={
                  isStale
                    ? `${displayName} (${staleSuffix})`
                    : item.description || item.name
                }
              >
                {isIncluded ? (
                  <>
                    <span>{isStale ? "⚠️" : isRequired ? "🚨" : "🎒"}</span>
                    <span>
                      {displayName}
                      {isStale
                        ? ` (${staleSuffix})`
                        : ` (${isRequired ? "الزامی" : "پیشنهادی"})`}
                    </span>
                    {!isStale ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequiredChange(equipmentId, !isRequired);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "1.25rem",
                          height: "1.25rem",
                          borderRadius: "50%",
                          backgroundColor: isRequired ? "white" : "rgba(0,0,0,0.05)",
                          fontSize: "0.75rem",
                          marginLeft: "-0.25rem",
                          transition: "transform 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                        title={isRequired ? "تغییر به پیشنهادی" : "تغییر به الزامی"}
                      >
                        {isRequired ? "🎒" : "🚨"}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span>
                    {displayName}
                    {isStale ? ` (${staleSuffix})` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </>
    </FormField>
  );
}
