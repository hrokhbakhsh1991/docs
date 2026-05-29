"use client";

import { DENALI_TRANSPORT_MODE_VALUES, type DenaliTransportMode } from "@repo/types";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, Checkbox, FormField, Select } from "@tour/ui";

import quickAddStyles from "@/components/shared/quick-add/QuickAddModal.module.css";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliLogistics.schema";

import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliEquipmentQuickAdd, useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";
import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "@/features/tours/wizard/denali/denaliFieldHints";
import { DenaliCustomServicesField } from "@/features/tours/wizard/denali/components/DenaliCustomServicesField";
import { DenaliGatheringPointsWidget } from "@/features/tours/wizard/denali/components/DenaliGatheringPointsWidget";
import { DenaliLocationZonesSection } from "@/features/tours/wizard/denali/components/DenaliLocationZoneField";
import { patchDenaliTransportForMode } from "@/features/tours/wizard/denali/transport/patchDenaliTransportForMode";
import { DenaliGearSection } from "@/features/tours/denali/widgets/DenaliGearSection";

const STEP = "denali_logistics" as const;

export function DenaliLogisticsSection() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { updateCanonical } = useDenaliCanonical();
  const transport = useDenaliCanonicalValue<DenaliCanonicalTourModel["transport"]>("transport");
  const form = getValues();
  const { isVisible, arePathsVisible } = useDenaliStepFieldRules(STEP);
  const openEquipmentQuickAdd = useDenaliEquipmentQuickAdd();
  const showGear = isVisible("participants.gearItems", form);
  const showGathering = isVisible("gatheringPoints", form);
  const showLocationZones = arePathsVisible(
    ["startPoint", "summitPoint", "campPoint", "endPoint"],
    form,
  );

  const transportMode = transport.mode;
  const allowPersonalCar = transport.allowPersonalCar === true;

  const showTransportCost = isVisible("transport.transportCost", form);
  const showPermitPersonalCar = isVisible("transport.allowPersonalCar", form);
  const showDongAmount = isVisible("transport.dongAmount", form);
  const showSeparateCapacity = isVisible("transport.adminCapacityApproval", form);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }} data-testid="denali-section-logistics">
      {showGathering ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <p style={{ ...denaliFieldHintStyle, margin: 0 }} dir="rtl">
            {DENALI_FIELD_HINTS.gatheringStations}
          </p>
          <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
        </div>
      ) : null}

      {showLocationZones ? <DenaliLocationZonesSection /> : null}

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

      <hr style={{ margin: "0.5rem 0", border: 0, borderTop: "1px solid var(--color-slate-200)" }} />

      <div style={{ display: "grid", gap: "0.85rem" }}>
        <FormField label={t("transport.transportModeLabel")} error={errors.transport?.transportMode?.message}>
          <Select
            value={transportMode ?? ""}
            onChange={(e) => {
              const mode = e.target.value as DenaliTransportMode;
              updateCanonical({
                transport: patchDenaliTransportForMode(transport, mode),
              });
            }}
            data-testid="denali-transport-mode"
            data-field-path="transport.transportMode"
            invalid={Boolean(errors.transport?.transportMode)}
          >
            {DENALI_TRANSPORT_MODE_VALUES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`transport.transportMode.${mode}`)}
              </option>
            ))}
          </Select>
        </FormField>

        {showTransportCost ? (
          <FormField
            label={t("transport.transportCost")}
            error={errors.transport?.transportCost?.message}
          >
            <PersianNumberInput
              numericMode="integer"
              formatThousands
              value={transport.transportCost ?? ""}
              onChange={(v) =>
                updateCanonical({
                  transport: {
                    ...transport,
                    transportCost: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-transport-cost"
              data-field-path="transport.transportCost"
            />
          </FormField>
        ) : null}

        {showPermitPersonalCar ? (
          <Checkbox
            checked={allowPersonalCar}
            onChange={(e) => {
              const checked = e.target.checked;
              updateCanonical({
                transport: {
                  ...transport,
                  allowPersonalCar: checked ? true : undefined,
                  dongAmount: checked ? transport.dongAmount : undefined,
                  adminCapacityApproval: checked
                    ? transport.adminCapacityApproval
                    : undefined,
                },
              });
            }}
            label={t("transport.allowPersonalCar")}
            data-testid="denali-transport-allow-personal-car"
            data-field-path="transport.allowPersonalCar"
          />
        ) : null}

        {showDongAmount ? (
          <FormField label={t("transport.dongAmount")} error={errors.transport?.dongAmount?.message}>
            <PersianNumberInput
              numericMode="integer"
              formatThousands
              value={transport.dongAmount ?? ""}
              onChange={(v) =>
                updateCanonical({
                  transport: {
                    ...transport,
                    dongAmount: v === "" ? undefined : Number(v),
                  },
                })
              }
              data-testid="denali-transport-dong-amount"
              data-field-path="transport.dongAmount"
            />
          </FormField>
        ) : null}

        {showSeparateCapacity ? (
          <Checkbox
            checked={transport.adminCapacityApproval === true}
            onChange={(e) => {
              const checked = e.target.checked;
              updateCanonical({
                transport: {
                  ...transport,
                  adminCapacityApproval: checked ? true : undefined,
                },
              });
            }}
            label={t("transport.adminCapacityApproval")}
            data-testid="denali-transport-admin-capacity-approval"
            data-field-path="transport.adminCapacityApproval"
          />
        ) : null}
      </div>

      <DenaliCustomServicesField />
    </div>
  );
}
