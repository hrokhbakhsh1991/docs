"use client";

import { useTranslations } from "next-intl";

import { DenaliSearchableSelect } from "../components/denali-searchable-select";
import { DenaliCatalogLoadNotice } from "../components/denali-catalog-load-notice";
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
  const { options, destinationById, loading, error } = useDenaliDestinationCatalog();
  const selectedLabel = readDenaliDestinationLabel(destinationId, destinationById);

  return (
    <label className="denali-wizard-composite__field">
      <span>{t("composites.itinerary.segmentDestination")}</span>
      <div data-testid={DENALI_ITINERARY_SEGMENT_DESTINATION_TEST_IDS.select}>
        <DenaliSearchableSelect
          ariaLabel={t("composites.itinerary.segmentDestination")}
          options={options}
          value={destinationId ?? ""}
          placeholder={
            loading
              ? t("composites.destination.loadingPlaceholder")
              : t("composites.itinerary.segmentDestinationPlaceholder")
          }
          loading={loading}
          searchableThreshold={0}
          searchLabel={t("composites.destination.searchLabel")}
          searchPlaceholder={t("composites.destination.searchPlaceholder")}
          searchEmptyMessage={t("composites.destination.searchEmpty")}
          onChange={(nextId) => {
            onChange(buildItinerarySegmentDestinationSelection(nextId, destinationById));
          }}
        />
      </div>
      {selectedLabel != null ? (
        <p className="denali-wizard-composite__helper">{selectedLabel}</p>
      ) : null}
      <DenaliCatalogLoadNotice error={error} />
    </label>
  );
}
