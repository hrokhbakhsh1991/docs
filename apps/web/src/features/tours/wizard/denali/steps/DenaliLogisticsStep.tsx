"use client";

import { DENALI_TRANSPORT_MODE_VALUES } from "@repo/types";
import type { DenaliTransportMode } from "@repo/types";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, Checkbox, FormField, Select, Textarea } from "@tour/ui";

import quickAddStyles from "@/components/shared/quick-add/QuickAddModal.module.css";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "../denaliFieldHints";
import { DenaliGatheringPointsWidget } from "../components/DenaliGatheringPointsWidget";
import { DenaliLocationZonesSection } from "../components/DenaliLocationZoneField";
import { useDenaliEquipmentQuickAdd } from "../hooks/useDenaliEquipmentQuickAdd";
import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { patchDenaliTransportForMode } from "../transport/patchDenaliTransportForMode";
import { DenaliGearSection } from "./DenaliGearSection";

const STEP = "denali_logistics" as const;

export function DenaliLogisticsStep() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { canonicalModel, updateCanonical } = useDenaliCanonical();
  const form = getValues();
  const { isVisible } = useDenaliStepFieldRules(STEP);
  const openEquipmentQuickAdd = useDenaliEquipmentQuickAdd();
  const showGear = isVisible("participants.gearItems", form);

  const transportMode = canonicalModel.transport.mode;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }} data-testid="denali-step-logistics">
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <p style={{ ...denaliFieldHintStyle, margin: 0 }} dir="rtl">
          {DENALI_FIELD_HINTS.gatheringStations}
        </p>
        <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
      </div>

      <DenaliLocationZonesSection />

      {showGear ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <div
            className={quickAddStyles.quickAddRow}
            data-testid="denali-logistics-quick-add"
            dir="rtl"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openEquipmentQuickAdd}
              data-testid="denali-quick-add-equipment"
            >
              + تجهیز
            </Button>
          </div>
          <DenaliGearSection />
        </div>
      ) : null}

      <hr style={{ margin: "0.5rem 0", border: 0, borderTop: "1px solid var(--color-border-subtle, #e2e8f0)" }} />

      <div style={{ display: "grid", gap: "0.85rem" }}>
        <FormField label={t("transport.transportModeLabel")} error={errors.transport?.transportMode?.message}>
          <Select
            value={transportMode ?? ""}
            onChange={(e) => {
              const mode = e.target.value as DenaliTransportMode;
              updateCanonical({
                transport: patchDenaliTransportForMode(canonicalModel.transport, mode),
              });
            }}
            data-testid="denali-transport-mode"
            invalid={Boolean(errors.transport?.transportMode)}
          >
            {DENALI_TRANSPORT_MODE_VALUES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`transport.transportMode.${mode}`)}
              </option>
            ))}
          </Select>
        </FormField>

        {isVisible("transport.transportCost", form) ? (
          <FormField
            label={t("transport.transportCost")}
            error={errors.transport?.transportCost?.message}
          >
            <PersianNumberInput
              numericMode="integer"
              formatThousands
              value={canonicalModel.transport.transportCost ?? ""}
              onChange={(v) =>
                updateCanonical({
                  transport: {
                    ...canonicalModel.transport,
                    transportCost: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-transport-cost"
            />
          </FormField>
        ) : null}

        {isVisible("transport.allowPersonalCar", form) ? (
          <Checkbox
            checked={canonicalModel.transport.allowPersonalCar === true}
            onChange={(e) => {
              const checked = e.target.checked;
              updateCanonical({
                transport: {
                  ...canonicalModel.transport,
                  allowPersonalCar: checked ? true : undefined,
                  dongAmount: checked ? canonicalModel.transport.dongAmount : undefined,
                },
              });
            }}
            label={t("transport.allowPersonalCar")}
            data-testid="denali-transport-allow-personal-car"
          />
        ) : null}

        {isVisible("transport.dongAmount", form) ? (
          <FormField label={t("transport.dongAmount")} error={errors.transport?.dongAmount?.message}>
            <PersianNumberInput
              numericMode="integer"
              formatThousands
              value={canonicalModel.transport.dongAmount ?? ""}
              onChange={(v) =>
                updateCanonical({
                  transport: {
                    ...canonicalModel.transport,
                    dongAmount: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-transport-dong-amount"
            />
          </FormField>
        ) : null}

        <FormField label={t("transport.notes")} error={errors.transport?.transportNotes?.message}>
          <Textarea
            rows={3}
            value={canonicalModel.transport.transportNotes ?? ""}
            onChange={(e) =>
              updateCanonical({
                transport: { ...canonicalModel.transport, transportNotes: e.target.value || undefined },
              })
            }
          />
        </FormField>
      </div>
    </div>
  );
}
