"use client";

import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@tour/ui";

import quickAddStyles from "@/components/shared/quick-add/QuickAddModal.module.css";
import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import {
  useDenaliCanonical,
  useDenaliCanonicalValue,
  useDenaliDestinationQuickAdd,
} from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "../denaliZodKindFieldProps";

export function DenaliDestinationField(_props: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    control,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const peakHeightField = useController({
    control,
    name: "tripDetails.overview.peakHeight",
  });
  const { updateCanonical } = useDenaliCanonical();
  const destinationId = useDenaliCanonicalValue<string | undefined>("destinationId");
  const openDestinationQuickAdd = useDenaliDestinationQuickAdd();
  const destinationsQuery = useTourDestinations();

  const destinationById = new Map<string, SettingsDestinationDto>(
    (destinationsQuery.destinations ?? []).map((item) => [item.id, item]),
  );
  const activeDestinations = destinationsQuery.groupedRegions.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      name: item.name,
      regionId: group.regionId,
      regionName: group.regionName,
    })),
  );

  const applyDestinationSelection = (id: string) => {
    updateCanonical({ destinationId: id });
    const altitudeM = destinationById.get(id)?.altitudeM;
    if (typeof altitudeM === "number" && Number.isFinite(altitudeM) && altitudeM > 0) {
      peakHeightField.field.onChange(altitudeM);
      updateCanonical({
        overview: {
          peakHeight: altitudeM,
        },
      });
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.5rem" }} data-field-path="basicInfo.destinationId">
      <DestinationCombobox
        label={t("basic.destination")}
        placeholder={t("basic.destinationPlaceholder")}
        options={activeDestinations}
        value={destinationId}
        onChange={(id) => {
          if (typeof id === "string" && id) {
            applyDestinationSelection(id);
            return;
          }
          updateCanonical({ destinationId: "" });
        }}
        error={errors.basicInfo?.destinationId?.message}
      />
      <div className={quickAddStyles.quickAddRow} dir="rtl">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openDestinationQuickAdd}
          data-testid="denali-quick-add-destination"
        >
          + مقصد
        </Button>
      </div>
    </div>
  );
}
