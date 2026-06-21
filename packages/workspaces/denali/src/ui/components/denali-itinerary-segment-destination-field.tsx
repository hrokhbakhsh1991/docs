"use client";

import { useTranslations } from "next-intl";

import { resolveCodedErrorMessage } from "../adapters/i18n-errors";
import { Select } from "../adapters/platform-primitives";
import { useDenaliDestinationCatalog, readDenaliDestinationLabel } from "../hooks/use-destination-catalog";
import { buildItinerarySegmentDestinationSelection } from "../logic/denali-itinerary-segment-destination-logic";
import { DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS } from "../test-ids/denali-photos-test-ids";

export { DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS } from "../test-ids/denali-photos-test-ids";

type DenaliItinerarySegmentDestinationFieldProps = {
  readonly destinationId?: string;
  readonly onChange: (selection: {
    readonly destinationId?: string;
    readonly locationLabel?: string;
  }) => void;
};

export function DenaliItinerarySegmentDestinationField({
  destinationId,
  onChange,
}: DenaliItinerarySegmentDestinationFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const { options, destinationById, loading, error } = useDenaliDestinationCatalog();
  const selectedLabel = readDenaliDestinationLabel(destinationId, destinationById);

  return (
    <label className="denali-wizard-composite__field">
      <span>{t("composites.itinerary.segmentDestination")}</span>
      <div data-testid={DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS.select}>
        <Select
          aria-label={t("composites.itinerary.segmentDestination")}
          options={options}
          value={destinationId ?? ""}
          placeholder={
            loading
              ? t("composites.destination.loadingPlaceholder")
              : t("composites.itinerary.segmentDestinationPlaceholder")
          }
          onChange={(event) => {
            const nextId = event.target.value.trim();
            onChange(buildItinerarySegmentDestinationSelection(nextId, destinationById));
          }}
        />
      </div>
      {selectedLabel != null ? (
        <p className="denali-wizard-composite__helper">{selectedLabel}</p>
      ) : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}
    </label>
  );
}
