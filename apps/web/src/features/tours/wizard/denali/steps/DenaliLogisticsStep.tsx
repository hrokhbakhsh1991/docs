"use client";

import { DENALI_TRANSPORT_MODE_VALUES } from "@repo/types";
import {
  isDenaliOrganizedTransportWithPersonalCarOption,
  isDenaliTransportDongAmountVisible,
} from "@repo/types/denali";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Select, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "../denaliFieldHints";
import { DenaliGatheringPointsWidget } from "../components/DenaliGatheringPointsWidget";
import { DenaliLocationZonesSection } from "../components/DenaliLocationZoneField";

export function DenaliLogisticsStep() {
  const t = useTranslations("tours.denali");
  const {
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { canonicalModel, ui, updateCanonical } = useDenaliCanonical();
  const transportMode = canonicalModel.transport.mode;
  const form = getValues();

  return (
    <div style={{ display: "grid", gap: "1.25rem" }} data-testid="denali-step-logistics">
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <p style={{ ...denaliFieldHintStyle, margin: 0 }} dir="rtl">
          {DENALI_FIELD_HINTS.gatheringStations}
        </p>
        <DenaliGatheringPointsWidget name="tripDetails.logistics.gatheringPoints" />
      </div>

      <DenaliLocationZonesSection />

      <hr style={{ margin: "0.5rem 0", border: 0, borderTop: "1px solid var(--color-border-subtle, #e2e8f0)" }} />

      <div style={{ display: "grid", gap: "0.85rem" }}>
        <FormField label={t("transport.transportModeLabel")} error={errors.transport?.transportMode?.message}>
          <Select
            value={transportMode ?? ""}
            onChange={(e) => {
              const mode = e.target.value as (typeof DENALI_TRANSPORT_MODE_VALUES)[number];
              const hasPersonalCarOption = isDenaliOrganizedTransportWithPersonalCarOption(mode);
              const allowPersonalCar = hasPersonalCarOption
                ? canonicalModel.transport.allowPersonalCar
                : undefined;
              const dongVisible = isDenaliTransportDongAmountVisible({
                mode,
                allowPersonalCar,
              });
              updateCanonical({
                transport: {
                  ...canonicalModel.transport,
                  mode,
                  transportCost: mode === "none" || mode === "shared_cars"
                    ? undefined
                    : canonicalModel.transport.transportCost,
                  allowPersonalCar,
                  dongAmount: dongVisible ? canonicalModel.transport.dongAmount : undefined,
                },
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

        {ui.isVisible("denali_logistics", "transport.transportCost", form) ? (
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

        {ui.isVisible("denali_logistics", "transport.allowPersonalCar", form) ? (
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

        {ui.isVisible("denali_logistics", "transport.dongAmount", form) ? (
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
