"use client";

import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FormField } from "@tour/ui";

import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
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
  const { getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const equipmentQuery = useSettingsEquipment();
  const { canonicalModel, updateCanonical } = useDenaliCanonical();

  const activeEquipment = useMemo(
    () => (equipmentQuery.data ?? []).filter((row) => row.isActive),
    [equipmentQuery.data],
  );

  const selectedById = useMemo(() => {
    const map = new Map<string, DenaliGearItem>();
    for (const row of canonicalModel.participants.gearItems ?? []) {
      map.set(row.id, row);
    }
    return map;
  }, [canonicalModel.participants.gearItems]);

  /** Read latest gear from RHF before each patch to avoid stale closure during bulk toggles. */
  const commitGearItems = useCallback(
    (next: DenaliGearItem[] | undefined) => {
      const form = getValues();
      updateCanonical({
        participants: {
          minimumAge: form.participantRequirements.minimumAge,
          maximumAge: form.participantRequirements.maximumAge,
          fitnessLevel: form.participantRequirements.fitnessLevel,
          sportsInsuranceRequired: form.participantRequirements.sportsInsuranceRequired,
          fitnessPrerequisiteText: form.participantRequirements.fitnessPrerequisiteText,
          gearItems: normalizeGearItems(next),
        },
      });
    },
    [getValues, updateCanonical],
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

  if (activeEquipment.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
        {tNew("trip_gearEquipmentEmptyHint")}
      </p>
    );
  }

  return (
    <FormField label={t("gear.title")} description={t("gear.hint")}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.65rem",
          padding: "1rem",
          backgroundColor: "var(--color-surface-muted, #f8fafc)",
          borderRadius: "0.75rem",
        }}
        data-testid="denali-gear-matrix"
      >
        {activeEquipment.map((item) => {
          const selected = selectedById.get(item.id);
          const isIncluded = selected != null;
          const isRequired = selected?.isRequired === true;

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

          const activeStyle = !isIncluded
            ? unselectedStyle
            : isRequired
              ? requiredStyle
              : suggestedStyle;

          return (
            <div
              key={item.id}
              onClick={() => handleIncludeChange(item.id, !isIncluded)}
              style={activeStyle}
              data-testid={`denali-gear-pill-${item.slug}`}
              title={item.description || item.name}
            >
              {isIncluded ? (
                <>
                  <span>{isRequired ? "🚨" : "🎒"}</span>
                  <span>
                    {item.name} ({isRequired ? "الزامی" : "پیشنهادی"})
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequiredChange(item.id, !isRequired);
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
                </>
              ) : (
                <span>{item.name}</span>
              )}
            </div>
          );
        })}
      </div>
    </FormField>
  );
}
